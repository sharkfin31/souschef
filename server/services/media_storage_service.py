"""
Download remote video (e.g. Instagram CDN) and upload to Cloudflare R2 or Supabase Storage.
"""
from typing import Optional

import httpx

from config import supabase
from services.r2_video_storage import is_r2_configured, store_recipe_video_bytes
from utils.helpers import setup_logger
from utils.recipe_video_path import recipe_video_storage_path

logger = setup_logger(__name__)

VIDEO_BUCKET = "recipe-videos"
MAX_VIDEO_BYTES = 50 * 1024 * 1024  # 50 MB per-file safety limit


def _content_type_for_extension(ext: str) -> str:
    ext = ext.lower().lstrip(".")
    if ext == "webm":
        return "video/webm"
    if ext in ("mov", "qt"):
        return "video/quicktime"
    if ext == "m4v":
        return "video/x-m4v"
    return "video/mp4"


async def upload_recipe_video_bytes(
    recipe_id: str,
    user_id: str,
    data: bytes,
    recipe_title: Optional[str] = None,
    file_extension: str = "mp4",
) -> Optional[str]:
    """
    Upload raw video bytes to R2 (if configured) or Supabase Storage.
    Returns public URL, or None if upload is skipped or fails.
    """
    if not user_id or not data:
        return None

    if not is_r2_configured() and not supabase:
        return None

    if len(data) > MAX_VIDEO_BYTES:
        logger.warning(
            "Video too large to store (%s bytes); skipping bucket upload",
            len(data),
        )
        return None

    try:
        path = recipe_video_storage_path(recipe_id, recipe_title, file_extension)

        if is_r2_configured():
            url = await store_recipe_video_bytes(
                path, data, content_type=_content_type_for_extension(file_extension)
            )
            if url:
                return url
            logger.warning("R2 upload failed or over quota; trying Supabase if available")

        if not supabase:
            return None

        bucket = supabase.storage.from_(VIDEO_BUCKET)
        ctype = _content_type_for_extension(file_extension)

        try:
            try:
                bucket.remove([path])
            except Exception:
                pass
            bucket.upload(
                path,
                data,
                file_options={
                    "content-type": ctype,
                    "upsert": "true",
                },
            )
        except Exception as upload_err:
            logger.error("Supabase storage upload failed: %s", upload_err)
            return None

        public = bucket.get_public_url(path)
        if isinstance(public, str):
            return public
        if isinstance(public, dict) and public.get("publicUrl"):
            return public["publicUrl"]
        return str(public)
    except Exception as e:
        logger.error("upload_recipe_video_bytes failed: %s", e)
        return None


async def download_and_store_recipe_video(
    source_video_url: str,
    recipe_id: str,
    user_id: str,
    recipe_title: Optional[str] = None,
) -> Optional[str]:
    """
    Download video bytes and upload to R2 (if configured) or Supabase Storage.
    Object key: videos/{sanitized-title}-{recipe_id}.mp4
    Returns public URL, or None if upload is skipped or fails.
    """
    if not source_video_url or not user_id:
        return None

    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            resp = await client.get(source_video_url)
            resp.raise_for_status()
            data = resp.content
            ct = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()

        ext = "mp4"
        if "webm" in ct:
            ext = "webm"
        elif "quicktime" in ct or ct == "video/mov":
            ext = "mov"

        return await upload_recipe_video_bytes(
            recipe_id, user_id, data, recipe_title, file_extension=ext
        )
    except Exception as e:
        logger.error("download_and_store_recipe_video failed: %s", e)
        return None


async def set_recipe_video_url(recipe_id: str, video_url: str) -> None:
    """Persist video URL on recipe row."""
    if not supabase or not video_url:
        return
    try:
        supabase.table("recipes").update({"video_url": video_url}).eq("id", recipe_id).execute()
    except Exception as e:
        logger.error("Failed to update recipe video_url: %s", e)
