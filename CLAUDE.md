# EOS AI — working notes for Claude

Read `docs/PHASE_0_PLAN.md` and `DEVELOPMENT_STATUS.md` before changing anything.

## Commands (available from Phase 1)
- Start Postgres: `docker compose up -d db`
- Backend deps: `cd backend && uv sync`
- Migrate: `cd backend && uv run alembic upgrade head`
- Run API: `cd backend && uv run uvicorn app.main:app --reload`
- Run worker: `cd backend && uv run python worker.py`
- Seed demo org: `cd backend && uv run python scripts/generate_demo_data.py --load`
- Backend tests: `cd backend && uv run pytest`
- Frontend: `cd frontend && npm install && npm run dev`
- Frontend tests: `cd frontend && npm test`
- Eval (Phase 4): `cd backend && uv run python ../eval/run_eval.py`

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
