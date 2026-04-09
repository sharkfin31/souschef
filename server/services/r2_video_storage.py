"""
Upload recipe videos to Cloudflare R2 (S3-compatible API).

Requires: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
"""
from __future__ import annotations

import asyncio
from functools import lru_cache
from typing import Optional, Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from config import config
from utils.helpers import setup_logger

logger = setup_logger(__name__)


def _max_total_bytes() -> int:
    return int(config.R2_MAX_TOTAL_GB * (1024**3))


def is_r2_configured() -> bool:
    return bool(
        config.R2_ACCOUNT_ID
        and config.R2_ACCESS_KEY_ID
        and config.R2_SECRET_ACCESS_KEY
        and config.R2_BUCKET_NAME
        and config.R2_PUBLIC_BASE_URL
    )


@lru_cache(maxsize=1)
def _sync_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=config.R2_ACCESS_KEY_ID,
        aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _public_url_for_key(object_key: str) -> str:
    base = config.R2_PUBLIC_BASE_URL.rstrip("/")
    key = object_key.lstrip("/")
    return f"{base}/{key}"


def _sum_bucket_bytes_sync() -> int:
    """Total logical size of all objects (standard R2 usage for quota)."""
    client = _sync_s3_client()
    bucket = config.R2_BUCKET_NAME
    total = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            total += int(obj.get("Size", 0))
    return total


def _object_size_sync(object_key: str) -> int:
    client = _sync_s3_client()
    try:
        r = client.head_object(Bucket=config.R2_BUCKET_NAME, Key=object_key)
        return int(r["ContentLength"])
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return 0
        raise


def _quota_check_and_upload_sync(
    object_key: str, body: bytes, content_type: str = "video/mp4"
) -> Tuple[bool, Optional[str]]:
    """
    Returns (ok, public_url_or_none). If quota would be exceeded, returns (False, None).
    """
    client = _sync_s3_client()
    bucket = config.R2_BUCKET_NAME
    new_size = len(body)
    cap = _max_total_bytes()

    try:
        used_total = _sum_bucket_bytes_sync()
    except Exception as e:
        logger.error("R2 list bucket failed (cannot verify quota): %s", e)
        return False, None

    old_size = 0
    try:
        old_size = _object_size_sync(object_key)
    except Exception as e:
        logger.warning("R2 head_object for %s: %s — assuming new object", object_key, e)

    projected = used_total - old_size + new_size
    if projected > cap:
        avail = max(0, cap - (used_total - old_size))
        logger.warning(
            "R2 upload skipped: would exceed total cap (projected=%s bytes, cap=%s bytes, "
            "available for this key≈%s bytes, new file=%s bytes)",
            projected,
            cap,
            avail,
            new_size,
        )
        return False, None

    # Put overwrites an existing key; quota math above already accounts for replacement.
    client.put_object(
        Bucket=bucket,
        Key=object_key,
        Body=body,
        ContentType=content_type or "video/mp4",
    )
    remaining = cap - projected
    logger.info(
        "R2 video stored key=%s size=%s bytes (~%.2f GiB remaining under %.2f GiB cap)",
        object_key,
        new_size,
        remaining / (1024**3),
        cap / (1024**3),
    )
    return True, _public_url_for_key(object_key)


async def store_recipe_video_bytes(
    object_key: str, data: bytes, content_type: str = "video/mp4"
) -> Optional[str]:
    """
    Upload bytes to R2 if within total storage cap. Returns public URL or None.
    """
    if not is_r2_configured():
        return None
    ok, url = await asyncio.to_thread(
        _quota_check_and_upload_sync, object_key, data, content_type
    )
    if not ok or not url:
        return None
    return url


def get_r2_usage_bytes_sync() -> Optional[int]:
    """Best-effort current bucket usage; None if R2 not configured or list fails."""
    if not is_r2_configured():
        return None
    try:
        return _sum_bucket_bytes_sync()
    except Exception as e:
        logger.error("R2 usage query failed: %s", e)
        return None
