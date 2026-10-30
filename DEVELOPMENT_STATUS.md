# Development status

Last updated: 2026-10-30

## Current phase
Phase 1 — Foundation: **built, awaiting review**. Phase 2 (imports) not started.

## Done
- Phase 0 plan approved with changes: industry-agnostic, multicurrency, Supabase `eos` schema inside mdf-hrms, Arabic later (`docs/PHASE_0_PLAN.md`)
- Backend: FastAPI app, Supabase JWT verification (JWKS for asymmetric keys, HS256 fallback), per-request tenant context, error envelope
- Organisations with any supported ISO 4217 base currency (fixed after creation), timezone, tax, fiscal year, date format
- Members with owner / manager / viewer roles and per-member branch access
- Invitations: hashed single-use tokens, 7-day expiry, bound to the invitee's email, revocable
- Branches: create, edit, deactivate; branch-scoped listing
- Append-only audit log for org, member, invitation and branch changes
- Row-level security on every tenant table, enforced for the `eos_app` role; repository filters as the first wall
- Demo data generator: 3-branch trading company, 120 products, 12 months, ~115k sales lines, refunds, voids, OMR/USD/AED, Ramadan and seasonal patterns, a messy file with known defects and a prompt-injection row, and independently computed expected KPIs
- CI workflow (backend lint + tests on Postgres 17; frontend lint, tests, build)

## In progress
- Frontend shell (login, onboarding, members, branches, settings)

## Next
- Owner review of Phase 1
- Phase 2 — Import: upload, preview, mapping, validation, quality report, error download, re-import handling

## Decisions and clarifications made during Phase 1
- Base currency cannot be changed after creation (it would silently restate every figure).
- "Transactions" KPI excludes refund receipts as well as voided ones (brief said voided only); otherwise refunds would inflate ticket counts and lower average ticket. Please confirm.
- COGS uses net quantity (sales minus returns) at the unit cost effective on the sale date.
- Non-members asking for an org get 404, not 403, so org existence isn't revealed.

## Known bugs
- None known

## Migrations
| Revision | Local | Supabase (mdf-hrms, schema `eos`) |
| --- | --- | --- |
| 0001 foundation | applied | applied |
| 0002 pin function search_path | applied | applied |
| 0003 FK indexes | applied | applied |

Round-trip checked locally: upgrade → downgrade to base → upgrade.

## Tests
- Backend: 63 passing (tenancy isolation via API and raw SQL as `eos_app`, auth edge cases, roles, invitations, demo generator determinism and independent recomputation)
- Isolation tests verified to fail when RLS is removed from a table
- Frontend: see frontend section once complete

## Integrations
- Supabase database: live, `eos` schema in mdf-hrms; not exposed via the Data API (anon/authenticated have no schema access)
- Supabase Auth: shared with other apps in mdf-hrms; only users with an EOS membership can access EOS data
- `eos_app` password: **not set yet in Supabase** — owner must run `ALTER ROLE eos_app WITH PASSWORD '...'` in the SQL editor
- Claude API: not used until Phase 4
- GitHub: private repo `eos-ai` not yet reachable from the build session; code committed locally

## Deployment
- Not deployed. Backend hosting decision (Railway or similar) comes with Phase 3 when there is something to look at.

## Backlog (out of MVP scope)
Forecasting, anomaly detection, risk centre, autonomous agents and workflows, email sending (invites are links for now), billing, admin panel, external connectors, RAG, customer/RFM analytics, procurement analytics, Arabic/RTL UI, moving EOS to its own Supabase project before real customers.
