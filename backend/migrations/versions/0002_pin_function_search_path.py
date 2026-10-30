"""Pin search_path on helper functions (Supabase advisor 0011).

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-30
"""

from migrations.sqlrun import run_script

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

UPGRADE_SQL = """
ALTER FUNCTION eos.current_org_id() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION eos.current_user_id() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION eos.touch_updated_at() SET search_path = pg_catalog, pg_temp;
"""

DOWNGRADE_SQL = """
ALTER FUNCTION eos.current_org_id() RESET search_path;
ALTER FUNCTION eos.current_user_id() RESET search_path;
ALTER FUNCTION eos.touch_updated_at() RESET search_path;
"""


def upgrade() -> None:
    run_script(UPGRADE_SQL)


def downgrade() -> None:
    run_script(DOWNGRADE_SQL)
