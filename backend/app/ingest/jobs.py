"""Background import jobs.

A job is an `imports` row in status validating/importing. `eos.claim_import_job()` hands
out one job at a time (SKIP LOCKED), then the job runs under that organisation's RLS
context with the uploader's branch access. Validation and commit each run in a single
transaction, so a crash leaves no partial data and the job is retried after 15 minutes
(up to 3 attempts).
"""

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, text

from app.core.db import get_sessionmaker, set_tenant_vars
from app.ingest import pipeline
from app.ingest.models import Import, ImportFile, ImportStatus
from app.ingest.parsing import FileReadError, read_table
from app.ingest.service import parse_options
from app.ingest.specs import ENTITIES
from app.orgs.models import Membership, MembershipBranch, Organisation

log = logging.getLogger("eos.jobs")


async def claim() -> tuple[UUID, UUID, str] | None:
    async with get_sessionmaker()() as s, s.begin():
        row = (await s.execute(text("select * from eos.claim_import_job()"))).first()
    return (row[0], row[1], row[2]) if row else None


async def _branch_scope(s, org_id: UUID, user_id: UUID | None) -> frozenset[UUID] | None:
    m = (
        await s.execute(
            select(Membership).where(Membership.org_id == org_id, Membership.user_id == user_id)
        )
    ).scalar_one_or_none()
    if m is None:
        raise PermissionError("The person who uploaded this file is no longer a member")
    if m.all_branches:
        return None
    rows = await s.execute(
        select(MembershipBranch.branch_id).where(MembershipBranch.membership_id == m.id)
    )
    return frozenset(rows.scalars())


async def _mark_failed(import_id: UUID, org_id: UUID, message: str) -> None:
    async with get_sessionmaker()() as s, s.begin():
        await set_tenant_vars(s, user_id=None, org_id=org_id)
        imp = (await s.execute(select(Import).where(Import.id == import_id))).scalar_one()
        imp.status = ImportStatus.failed
        imp.last_error = message[:2000]
        imp.finished_at = datetime.now(UTC)


async def run_job(import_id: UUID, org_id: UUID, kind: str) -> None:
    try:
        async with get_sessionmaker()() as s, s.begin():
            await set_tenant_vars(s, user_id=None, org_id=org_id)
            imp = (await s.execute(select(Import).where(Import.id == import_id))).scalar_one()
            org = (
                await s.execute(select(Organisation).where(Organisation.id == org_id))
            ).scalar_one()
            content = (
                await s.execute(select(ImportFile.content).where(ImportFile.import_id == imp.id))
            ).scalar_one()
            table = read_table(
                content,
                imp.file_name,
                sheet=imp.options.get("sheet"),
                header_row=imp.options.get("header_row"),
            )
            ctx = pipeline.Ctx(
                session=s,
                org=org,
                imp=imp,
                spec=ENTITIES[imp.entity_type],
                table=table,
                column_map=imp.column_map,
                opts=parse_options(org, imp.options),
                allowed_branch_ids=await _branch_scope(s, org_id, imp.created_by),
                conflict_mode=imp.conflict_mode or "skip",
                dry_run=(kind == "validate"),
            )
            report = await pipeline.run(ctx)
            imp.quality_report = report
            imp.status = ImportStatus.validated if kind == "validate" else ImportStatus.done
            imp.finished_at = datetime.now(UTC)
            imp.last_error = None
        log.info("import %s %s: %s", import_id, kind, imp.status.value)
    except (FileReadError, PermissionError) as exc:
        await _mark_failed(import_id, org_id, str(exc))
    except Exception as exc:  # unexpected: record it, never leave the job silent
        log.exception("import %s failed", import_id)
        await _mark_failed(import_id, org_id, f"Unexpected error: {exc.__class__.__name__}")


async def run_pending(max_jobs: int = 10) -> int:
    done = 0
    while done < max_jobs:
        job = await claim()
        if job is None:
            break
        await run_job(*job)
        done += 1
    return done


async def run_soon(retries: int = 20, delay: float = 0.25) -> None:
    """Inline mode for single-process deployments: wait for the request's commit, then
    work through the queue."""
    for _ in range(retries):
        if await run_pending():
            return
        await asyncio.sleep(delay)


async def worker_loop(poll_seconds: float = 2.0) -> None:
    log.info("import worker started")
    while True:
        try:
            if not await run_pending():
                await asyncio.sleep(poll_seconds)
        except Exception:  # keep the worker alive; each job records its own failure
            log.exception("worker loop error")
            await asyncio.sleep(poll_seconds)
