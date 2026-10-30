# ADR 0001: Modular monolith on FastAPI

Status: proposed · 2026-10-30

## Decision
One FastAPI application with internal modules (`core`, `orgs`, `catalog`, `ingest`, `transactions`, `kpi`, `assistant`, `reports`, `audit`) plus one worker process from the same codebase.

## Why
The MVP has one team, one database and no independent scaling need. Separate services would add deploys, network calls and auth between services with no benefit yet.

## Rules
- Modules call each other through `service.py`, never through another module's models.
- Each module owns its tables and migrations are grouped by module name in the revision message.

## Revisit when
A module needs independent scaling or deploy cadence, measured, not predicted.
