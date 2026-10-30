# EOS AI — working notes for Claude

Read `docs/PHASE_0_PLAN.md` and `DEVELOPMENT_STATUS.md` before changing anything.

## Commands
- Start Postgres: `docker compose up -d db`
- Backend deps: `cd backend && uv sync`
- Migrate (owner role): `cd backend && uv run alembic upgrade head`, then once per database:
  `ALTER ROLE eos_app WITH PASSWORD '...'`
- Migration SQL for Supabase: `cd backend && uv run alembic upgrade <from>:<to> --sql`
- Run API: `cd backend && cp .env.example .env && uv run uvicorn app.main:app --reload`
- Generate demo data: `cd backend && uv run python scripts/generate_demo_data.py --out ../demo_data`
- Backend tests (needs Postgres; set `TEST_PG_ADMIN_URL` if not `postgres@localhost:5432`):
  `cd backend && uv run pytest`
- Lint: `cd backend && uv run ruff check . && uv run ruff format --check .`
- Frontend: `cd frontend && npm install && npm run dev`
- Frontend checks: `cd frontend && npm run lint && npm test -- --run && npm run build`

## Where things live
- Supabase project `mdf-hrms` (ref `tjqmemvtwcaqakyqgdrh`), schema `eos`. Never touch `public` or other schemas there.
- New tenant tables need: `org_id`, RLS enabled, a `tenant_all` policy for `eos_app`, grants, and a test in `tests/integration/test_tenancy.py`.

## Decisions that must not drift
- Tenancy: repository `org_id` filter + RLS via `SET LOCAL app.org_id`; app DB role never owns tables (ADR 0002).
- Money: `numeric`, never float; decimals as strings in JSON; OMR has 3 decimals.
- Dates: stored UTC; `business_date` computed in org timezone at import.
- KPI definitions: exactly as in the brief, section 6; one pure function each with tests.
- AI: typed tools only, number verifier on every answer (ADR 0004).
- Imports: `rows_total = imported + rejected + duplicate`, always.
- New infrastructure needs an ADR first.

## Process
- Small commits; run the full test suite before calling a step done and paste the summary.
- Stop at the end of each phase and wait for approval.
- Update `DEVELOPMENT_STATUS.md` at the end of every working session.
