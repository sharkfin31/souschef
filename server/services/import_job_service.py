"""
In-memory import job registry for async recipe imports with pollable progress.

Jobs are keyed by UUID; state is updated by background tasks. Suitable for
single-process dev / small deployments (not durable across restarts).
"""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Dict, List, Literal, Optional, TypedDict


class ImportJobPublic(TypedDict, total=False):
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    stage: str
    stage_label: str
    percent: int
    result: Optional[Dict[str, Any]]
    error: Optional[str]
    updated_at: float


class ImportJobService:
    """Process-local job store with async-safe updates."""

    def __init__(self, max_jobs: int = 500) -> None:
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._order: List[str] = []
        self._lock = asyncio.Lock()
        self._max_jobs = max_jobs

    async def create_job(self) -> str:
        job_id = str(uuid.uuid4())
        now = time.time()
        async with self._lock:
            self._evict_if_needed_unlocked()
            self._jobs[job_id] = {
                "job_id": job_id,
                "status": "pending",
                "stage": "queued",
                "stage_label": "Queued…",
                "percent": 0,
                "result": None,
                "error": None,
                "updated_at": now,
            }
            self._order.append(job_id)
        return job_id

    def _evict_if_needed_unlocked(self) -> None:
        while len(self._order) > self._max_jobs:
            oldest = self._order.pop(0)
            self._jobs.pop(oldest, None)

    async def mark_running(self, job_id: str) -> None:
        async with self._lock:
            row = self._jobs.get(job_id)
            if not row:
                return
            row["status"] = "running"
            row["updated_at"] = time.time()

    async def update_progress(
        self, job_id: str, *, stage: str, stage_label: str, percent: int
    ) -> None:
        async with self._lock:
            row = self._jobs.get(job_id)
            if not row:
                return
            row["stage"] = stage
            row["stage_label"] = stage_label
            row["percent"] = max(0, min(100, percent))
            row["updated_at"] = time.time()

    async def complete_job(self, job_id: str, result: Dict[str, Any]) -> None:
        async with self._lock:
            row = self._jobs.get(job_id)
            if not row:
                return
            row["status"] = "completed"
            row["stage"] = "completed"
            row["stage_label"] = "Imported"
            row["percent"] = 100
            row["result"] = result
            row["error"] = None
            row["updated_at"] = time.time()

    async def fail_job(self, job_id: str, message: str) -> None:
        async with self._lock:
            row = self._jobs.get(job_id)
            if not row:
                return
            row["status"] = "failed"
            row["stage"] = "failed"
            row["stage_label"] = "Failed"
            row["percent"] = row.get("percent", 0) or 0
            row["error"] = message
            row["updated_at"] = time.time()

    def get_job(self, job_id: str) -> Optional[ImportJobPublic]:
        row = self._jobs.get(job_id)
        if not row:
            return None
        return {
            "job_id": row["job_id"],
            "status": row["status"],
            "stage": row["stage"],
            "stage_label": row["stage_label"],
            "percent": row["percent"],
            "result": row.get("result"),
            "error": row.get("error"),
            "updated_at": row.get("updated_at", 0),
        }


import_job_service = ImportJobService()
