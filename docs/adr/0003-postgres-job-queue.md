# ADR 0003: Postgres-backed job queue (procrastinate)

Status: proposed · 2026-10-30

## Decision
Use procrastinate for background jobs (imports, later report generation). Queue tables live in the same Postgres database.

## Why
Imports need retries, status and isolation from request timeouts, but not high throughput. A Postgres queue avoids running Redis and keeps job state transactional with import state. Temporal is built for long-running multi-step workflows, which arrive only with autonomous agents, out of MVP scope.

## Revisit when
Job volume or latency needs exceed what Postgres polling handles, or Phase 6+ workflows need durable multi-step orchestration.
