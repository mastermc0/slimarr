"""Persistent job API routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.api.models import JobActionResponse, JobDetailResponse, JobsListResponse
from backend.auth.dependencies import get_current_user
from backend.core.jobs import cancel_job, get_persistent_job, list_persistent_jobs, retry_job
from backend.utils.responses import get_correlation_id, not_found

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=JobsListResponse)
async def list_jobs_api(
    status: str = Query(default="active"),
    kind: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user=Depends(get_current_user),
):
    """Return persistent jobs, defaulting to active queued/running work."""
    return await list_persistent_jobs(status=status, kind=kind, limit=limit)


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job_api(job_id: str, user=Depends(get_current_user)):
    """Return one persistent job with its event timeline."""
    job = await get_persistent_job(job_id)
    if job is None:
        raise not_found(f"Job '{job_id}'", correlation_id=get_correlation_id())
    return job


@router.post("/{job_id}/cancel", response_model=JobActionResponse)
async def cancel_job_api(job_id: str, user=Depends(get_current_user)):
    """Request cancellation for an active job."""
    job = await cancel_job(job_id)
    if job is None:
        raise not_found(f"Job '{job_id}'", correlation_id=get_correlation_id())
    return {"status": "cancel_requested", "job": job}


@router.post("/{job_id}/retry", response_model=JobActionResponse)
async def retry_job_api(job_id: str, user=Depends(get_current_user)):
    """Create and start a new job using the same kind and payload."""
    existing = await get_persistent_job(job_id)
    if existing is None:
        raise not_found(f"Job '{job_id}'", correlation_id=get_correlation_id())
    result = await retry_job(job_id)
    if result and result.get("already_running"):
        return {"status": "not_retryable", "job": existing, "retried_job": None}
    return {"status": "retry_started", "job": existing, "retried_job": result.get("job") if result else None}
