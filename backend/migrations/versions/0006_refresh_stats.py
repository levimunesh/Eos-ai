"""Refresh planner statistics after an import.

Right after a large import, Postgres still believes the tables are nearly empty until
autovacuum gets round to analysing them, and can pick plans that run for minutes instead of
milliseconds. The app role can't ANALYZE tables it doesn't own, so this owner-run function
analyses only the tables for one known import type.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-30
"""

from migrations.sqlrun import run_script

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

UPGRADE_SQL = r"""
CREATE FUNCTION eos.refresh_stats(p_entity text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = eos, pg_temp AS
$$
BEGIN
  CASE p_entity
    WHEN 'sales' THEN ANALYZE eos.sales; ANALYZE eos.sale_lines;
    WHEN 'purchases' THEN ANALYZE eos.purchases; ANALYZE eos.purchase_lines;
    WHEN 'branches' THEN ANALYZE eos.branches;
    WHEN 'products' THEN ANALYZE eos.products;
    WHEN 'product_costs' THEN ANALYZE eos.product_costs;
    WHEN 'suppliers' THEN ANALYZE eos.suppliers;
    WHEN 'fx_rates' THEN ANALYZE eos.fx_rates;
    WHEN 'expenses' THEN ANALYZE eos.expenses;
    WHEN 'inventory_counts' THEN ANALYZE eos.inventory_counts;
    ELSE RAISE EXCEPTION 'unknown entity %', p_entity USING ERRCODE = '22023';
  END CASE;
END
$$;
REVOKE ALL ON FUNCTION eos.refresh_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION eos.refresh_stats(text) TO eos_app;
"""


def upgrade() -> None:
    run_script(UPGRADE_SQL)


def downgrade() -> None:
    run_script("DROP FUNCTION IF EXISTS eos.refresh_stats(text);")
