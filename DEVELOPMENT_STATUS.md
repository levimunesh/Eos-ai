# Development status

Last updated: 2026-10-30

## Current phase
Phase 1 — Foundation: **complete** (owner approved 2026-10-30).
Phase 2 — Import: **backend complete**; import screens in the frontend are next.

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

- Frontend: React + Vite + Tailwind; Supabase email/password sign-up, sign-in and password reset; onboarding with base-currency picker; org switcher; Organisation settings, Members (invite links, roles, branch access, revoke) and Branches pages; honest empty Overview (no numbers); phone, tablet and desktop layouts; all strings in one module for Arabic later

## Phase 2 (backend) done
- Business tables: products, product costs, suppliers, FX rates, sales + lines, purchases + lines, expenses, stock counts. Every record keeps its source import and file row number.
- Import any of 9 record types from CSV or Excel (.xlsx): encoding detection (UTF-8, Arabic Windows cp1256), delimiter sniffing, header-row detection under title rows, sheet choice
- Column profiles and mapping suggestions (English + Arabic header synonyms); confirmed mappings are remembered per file layout
- Strict conversion: day/month order from settings, ambiguous numbers like "1,250" rejected unless a thousands separator is set, accounting negatives, AM/PM times, ISO dates
- Validation as a dry run with a quality report before anything is written; then commit with skip or replace for records already in EOS
- Every row ends as imported, rejected (with a downloadable reason) or duplicate; checked as an invariant on every run
- Same-file re-uploads are flagged; branch-scoped managers can only import their own branches; branches import is owner-only
- Background jobs via the imports table (ADR 0003 revised), single transaction per job, retry on crash

## In progress
- Frontend import screens (upload, mapping, report, history)

## Next
- Import screens in the frontend
- Phase 3 — KPI engine and dashboard

## Decisions and clarifications made during Phase 1
- Base currency cannot be changed after creation (it would silently restate every figure).
- "Transactions" counts every receipt except voided ones; refund receipts count (owner confirmed 2026-10-30). Demo year: 48,475 transactions, average ticket 8.631 OMR.
- The member list (with emails) is visible to owners and managers only; viewers are told to ask an owner.
- Member names come from the `full_name` given at sign-up and are kept if a later token omits it.
- Identical sales lines on one receipt are kept as repeat purchases (a customer can buy the same item twice). They are only treated as duplicates when the file has a line-number column. The report warns when it sees them.
- Rejected lines don't block the rest of their receipt; the report says so and the error file lists them for re-import.
- Import "append" mode from the brief is not offered: records with a natural key (receipt, invoice, SKU) can only be skipped or replaced, otherwise totals would double.
- Uploaded files are stored in the database (`eos.import_files`, 25 MB limit) for now; move to object storage before large customers.
- COGS uses net quantity (sales minus returns) at the unit cost effective on the sale date.
- Non-members asking for an org get 404, not 403, so org existence isn't revealed.

## Known bugs and gaps
- None known in code
- Supabase Auth: add the frontend's `/reset-password` URL to the allowed redirect URLs before password reset will work
- Invites are links the owner copies; no email is sent yet
- The backend's allowed browser origins default to localhost; set `CORS_ORIGINS` when the frontend is deployed

## Migrations
| Revision | Local | Supabase (mdf-hrms, schema `eos`) |
| --- | --- | --- |
| 0001 foundation | applied | applied |
| 0002 pin function search_path | applied | applied |
| 0003 FK indexes | applied | applied |
| 0004 business data and imports | applied | applied |

Round-trip checked locally: upgrade → downgrade to base → upgrade.

## Tests
- Backend: 112 passing, including full demo-company import whose loaded sales match the independently computed answers (418,364.517 OMR net, 48,475 transactions), messy-file accounting (51 rows = 1 imported + 8 rejected + 42 duplicate), replace mode, re-upload detection, branch-scoped imports and Excel/Arabic parsing. Previously: 66 passing (tenancy isolation via API and raw SQL as `eos_app`, RLS guardrail for every tenant table, auth edge cases, roles, invitations, names, demo generator determinism and independent recomputation)
- Isolation tests verified to fail when RLS is removed from a table
- Frontend: 31 passing (API client headers and error envelope, onboarding validation and percent conversion, empty overview shows no figures, role gating for viewer/manager/owner); lint and production build clean
- Not yet tested: real sign-in against Supabase Auth end to end (the build environment can't reach Supabase); first run should be done by the owner

## Integrations
- Supabase database: live, `eos` schema in mdf-hrms; not exposed via the Data API (anon/authenticated have no schema access)
- Supabase Auth: shared with other apps in mdf-hrms; only users with an EOS membership can access EOS data
- `eos_app` password: set by the owner in Supabase (2026-10-30); store it only in the backend host's secrets, never in the repo
- Claude API: not used until Phase 4
- GitHub: private repo `levimunesh/Eos-ai`, pushed to `main`

## Deployment
- Not deployed. Backend hosting decision (Railway or similar) comes with Phase 3 when there is something to look at.

## Backlog (out of MVP scope)
Forecasting, anomaly detection, risk centre, autonomous agents and workflows, email sending (invites are links for now), billing, admin panel, external connectors, RAG, customer/RFM analytics, procurement analytics, Arabic/RTL UI, moving EOS to its own Supabase project before real customers.
