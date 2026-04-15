"""
Async import jobs with pollable progress (GET /import-jobs/{id}).

POST endpoints accept the same payloads as synchronous extract routes,
return 202 + job_id immediately, and run extraction in a background task.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, BackgroundTasks, File, Header, HTTPException, UploadFile
from pydantic import BaseModel
from starlette.datastructures import UploadFile as StarletteUploadFile

from models.schemas import InstagramURL
from services.auth_service import get_current_user
from services.image_service import process_multiple_recipe_images
from services.import_job_service import import_job_service
from services.pdf_service import process_recipe_pdf
from services.recipe_extraction_service import recipe_extraction_service
from utils.constants import StatusCodes
from utils.helpers import format_success_response, setup_logger

logger = setup_logger(__name__)

router = APIRouter(prefix="/api/import-jobs", tags=["import-jobs"])


def _extraction_error_message(result: Dict[str, Any]) -> str:
    if "error" not in result:
        return ""
    return str(result.get("error") or result.get("message") or "Import failed")


def _normalize_text_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten text extraction shape to match URL/image response fields."""
    if "error" in result:
        return result
    rid = result.get("recipe_id")
    return {
        "success": True,
        "recipe_id": rid,
        "title": result.get("title", "Untitled Recipe"),
        "description": result.get("description", ""),
        "prep_time": result.get("prepTime"),
        "cook_time": result.get("cookTime"),
        "total_time": result.get("totalTime"),
        "servings": result.get("servings"),
        "difficulty": result.get("difficulty"),
        "ingredients": result.get("ingredients", []),
        "instructions": result.get("instructions", []),
        "tags": result.get("tags", []),
        "source_url": result.get("source_url", ""),
        "post_url": result.get("post_url"),
        "image_url": result.get("image_url") or "",
        "video_url": result.get("video_url"),
        "source": result.get("source", "text"),
        "extracted_via": result.get("extracted_via", "text_input"),
    }


async def _run_url_job(job_id: str, url: str, user_id: Optional[str]) -> None:
    await import_job_service.mark_running(job_id)

    async def on_progress(stage: str, label: str, pct: int) -> None:
        await import_job_service.update_progress(job_id, stage=stage, stage_label=label, percent=pct)

    try:
        result = await recipe_extraction_service.extract_recipe_from_url(
            url, user_id, on_progress=on_progress
        )
        err = _extraction_error_message(result)
        if err:
            await import_job_service.fail_job(job_id, err)
            return
        await import_job_service.complete_job(job_id, result)
    except Exception as e:
        logger.exception("URL import job failed")
        await import_job_service.fail_job(job_id, str(e))


async def _run_text_job(job_id: str, text: str, user_id: Optional[str]) -> None:
    await import_job_service.mark_running(job_id)

    async def on_progress(stage: str, label: str, pct: int) -> None:
        await import_job_service.update_progress(job_id, stage=stage, stage_label=label, percent=pct)

    try:
        raw = await recipe_extraction_service.extract_recipe_from_text(
            text, user_id, on_progress=on_progress
        )
        err = _extraction_error_message(raw)
        if err:
            await import_job_service.fail_job(job_id, err)
            return
        await import_job_service.complete_job(job_id, _normalize_text_result(raw))
    except Exception as e:
        logger.exception("Text import job failed")
        await import_job_service.fail_job(job_id, str(e))


def _upload_files_from_parts(parts: List[Tuple[bytes, str, str]]) -> List[StarletteUploadFile]:
    out: List[StarletteUploadFile] = []
    for content, filename, _content_type in parts:
        out.append(StarletteUploadFile(BytesIO(content), filename=filename))
    return out


async def _run_images_job(
    job_id: str,
    parts: List[Tuple[bytes, str, str]],
    user_id: Optional[str],
) -> None:
    await import_job_service.mark_running(job_id)
    images = _upload_files_from_parts(parts)

    async def on_progress(stage: str, label: str, pct: int) -> None:
        await import_job_service.update_progress(job_id, stage=stage, stage_label=label, percent=pct)

    try:
        result = await process_multiple_recipe_images(
            images, background_tasks=None, user_id=user_id, on_progress=on_progress
        )
        await import_job_service.complete_job(job_id, result)
    except HTTPException as he:
        await import_job_service.fail_job(job_id, str(he.detail))
    except Exception as e:
        logger.exception("Image import job failed")
        await import_job_service.fail_job(job_id, str(e))


async def _run_pdf_job(
    job_id: str,
    content: bytes,
    filename: str,
    user_id: Optional[str],
) -> None:
    await import_job_service.mark_running(job_id)
    uf = StarletteUploadFile(
        BytesIO(content),
        filename=filename or "recipe.pdf",
        headers={"content-type": "application/pdf"},
    )

    async def on_progress(stage: str, label: str, pct: int) -> None:
        await import_job_service.update_progress(job_id, stage=stage, stage_label=label, percent=pct)

    try:
        result = await process_recipe_pdf(
            uf, background_tasks=None, user_id=user_id, on_progress=on_progress
        )
        err = _extraction_error_message(result)
        if err:
            await import_job_service.fail_job(job_id, err)
            return
        await import_job_service.complete_job(job_id, result)
    except Exception as e:
        logger.exception("PDF import job failed")
        await import_job_service.fail_job(job_id, str(e))


class RecipeTextBody(BaseModel):
    text: str


@router.post("/from-url", status_code=202)
async def start_url_import(
    data: InstagramURL,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    if not data.url or not data.url.strip():
        raise HTTPException(status_code=StatusCodes.BAD_REQUEST, detail="URL is required")
    user_id = await get_current_user(authorization)
    job_id = await import_job_service.create_job()
    background_tasks.add_task(_run_url_job, job_id, data.url.strip(), user_id)
    return format_success_response({"job_id": job_id}, "Import job started")


@router.post("/from-text", status_code=202)
async def start_text_import(
    body: RecipeTextBody,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=StatusCodes.BAD_REQUEST, detail="Text is required")
    user_id = await get_current_user(authorization)
    job_id = await import_job_service.create_job()
    background_tasks.add_task(_run_text_job, job_id, body.text, user_id)
    return format_success_response({"job_id": job_id}, "Import job started")


@router.post("/from-images", status_code=202)
async def start_images_import(
    background_tasks: BackgroundTasks,
    images: List[UploadFile] = File(...),
    authorization: Optional[str] = Header(None),
):
    if not images:
        raise HTTPException(status_code=StatusCodes.BAD_REQUEST, detail="No images provided")
    user_id = await get_current_user(authorization)
    parts: List[Tuple[bytes, str, str]] = []
    for uf in images:
        raw = await uf.read()
        ctype = uf.content_type or "application/octet-stream"
        parts.append((raw, uf.filename or "image.jpg", ctype))

    job_id = await import_job_service.create_job()
    background_tasks.add_task(_run_images_job, job_id, parts, user_id)
    return format_success_response({"job_id": job_id}, "Import job started")


@router.post("/from-pdf", status_code=202)
async def start_pdf_import(
    background_tasks: BackgroundTasks,
    pdf: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    if not pdf.content_type or not pdf.content_type.startswith("application/pdf"):
        raise HTTPException(status_code=StatusCodes.BAD_REQUEST, detail="File must be a PDF")
    user_id = await get_current_user(authorization)
    content = await pdf.read()
    job_id = await import_job_service.create_job()
    background_tasks.add_task(_run_pdf_job, job_id, content, pdf.filename or "recipe.pdf", user_id)
    return format_success_response({"job_id": job_id}, "Import job started")


@router.get("/{job_id}")
async def get_import_job(job_id: str):
    row = import_job_service.get_job(job_id)
    if not row:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return format_success_response(row, "OK")
