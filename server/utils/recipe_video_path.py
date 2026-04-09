"""Build R2 / Supabase object keys for recipe videos: videos/{title-slug}-{recipe_id}.mp4"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional

# S3/R2-safe key characters; keep filename readable in URLs
_INVALID_RE = re.compile(r"[^a-zA-Z0-9._-]+")
_MAX_SLUG_LEN = 100


def sanitize_recipe_title_for_filename(title: Optional[str]) -> str:
    if not title or not str(title).strip():
        return "recipe"
    raw = str(title).strip()
    normalized = unicodedata.normalize("NFKD", raw)
    ascii_part = normalized.encode("ascii", "ignore").decode("ascii")
    slug = _INVALID_RE.sub("-", ascii_part).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    if not slug:
        slug = "recipe"
    return slug[:_MAX_SLUG_LEN].rstrip("-.") or "recipe"


def recipe_video_storage_path(recipe_id: str, recipe_title: Optional[str], extension: str = "mp4") -> str:
    """
    Single directory `videos/`; filename leads with human-readable title, ends with recipe_id for uniqueness.
    Example: videos/lemon-tart-550e8400-e29b-41d4-a716-446655440000.mp4
    """
    ext = extension.lstrip(".").lower()
    if ext not in ("mp4", "webm", "mov", "m4v"):
        ext = "mp4"
    slug = sanitize_recipe_title_for_filename(recipe_title)
    return f"videos/{slug}-{recipe_id}.{ext}"
