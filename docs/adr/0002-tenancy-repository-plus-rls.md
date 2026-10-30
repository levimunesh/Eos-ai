# ADR 0002: Tenancy enforced in repositories, RLS as a second wall

Status: proposed · 2026-10-30

## Decision
- Every business table carries `org_id`.
- Repositories take an `OrgContext` and always filter by `org_id` (and branch scope where applicable).
- PostgreSQL RLS is enabled on every business table with policy `org_id = current_setting('app.org_id', true)::uuid`.
- Each request transaction runs `SET LOCAL app.org_id` and `SET LOCAL app.user_id`.
- The app connects as `eos_app`, which does not own the tables and has no `BYPASSRLS`. Migrations run as the owner.

## Why
Supabase RLS normally keys off the JWT, but our backend talks to Postgres directly through SQLAlchemy, so JWT-based policies would not apply. A session variable makes RLS work for a server-side client. Two independent layers mean one bug does not leak data.

## Consequences
- Background jobs must set `app.org_id` too; the job runner wraps each job in a tenant-scoped session.
- Isolation tests run in CI: org A cannot read org B through the API, AI tools or repositories, and a raw query without `app.org_id` returns zero rows.
