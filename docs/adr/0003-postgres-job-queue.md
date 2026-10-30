# ADR 0003: Postgres-backed job queue using the imports table

Status: accepted (revised 2026-10-30) · supersedes the procrastinate proposal

## Decision
Background jobs (imports today, reports later) use their own business table as the queue. An import row in status `validating` or `importing` is a job. `eos.claim_import_job()` (SECURITY DEFINER) hands out one job at a time with `FOR UPDATE SKIP LOCKED`, increments `attempts`, and returns the job's org id. The job then runs as `eos_app` under that org's RLS context and the uploader's branch access.

Two ways to run jobs:
- `INLINE_JOBS=true` (default): the API process works the queue after the request that queued a job. Fine for a pilot on one server.
- `python worker.py` with `INLINE_JOBS=false` on the API: a separate worker process. Use this once imports get large or there is more than one API instance.

## Why
procrastinate would add its own tables, functions and schema handling inside a Supabase project shared with other apps. The import table already carries status, attempts and errors, so a second job table added nothing. Each job runs in one transaction, so a crash leaves no partial data; a job stuck for 15 minutes is retried, up to 3 attempts, then marked failed with a reason.

## Revisit when
Several job types need priorities, scheduling or fan-out (reports on a schedule, autonomous workflows). Then adopt a dedicated queue and record it in a new ADR.
