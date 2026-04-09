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
MAX_VIDEO_BYTES = 80 * 1024 * 1024  # 80 MB per-file safety limit


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

    if not is_r2_configured() and not supabase:
        return None

    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            resp = await client.get(source_video_url)
            resp.raise_for_status()
            data = resp.content

        if len(data) > MAX_VIDEO_BYTES:
            logger.warning(
                "Video too large to store (%s bytes); using original URL only",
                len(data),
            )
            return None

        path = recipe_video_storage_path(recipe_id, recipe_title)

        if is_r2_configured():
            url = await store_recipe_video_bytes(path, data)
            if url:
                return url
            logger.warning("R2 upload failed or over quota; trying Supabase if available")

        if not supabase:
            return None

        bucket = supabase.storage.from_(VIDEO_BUCKET)

        try:
            try:
                bucket.remove([path])
            except Exception:
                pass
            bucket.upload(
                path,
                data,
                file_options={
                    "content-type": "video/mp4",
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
