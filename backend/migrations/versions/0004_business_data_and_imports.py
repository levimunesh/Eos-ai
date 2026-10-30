"""Business data (catalog, sales, purchases, expenses, stock counts, FX) and imports.

Every table carries org_id with RLS for eos_app, plus source_import_id and
source_row_number so any figure can be traced to the file row it came from.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-30
"""

from migrations.sqlrun import run_script

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

TENANT_TABLES = [
    "imports",
    "import_files",
    "import_errors",
    "import_mappings",
    "products",
    "product_costs",
    "suppliers",
    "fx_rates",
    "sales",
    "sale_lines",
    "purchases",
    "purchase_lines",
    "expenses",
    "inventory_counts",
]

UPGRADE_SQL = r"""
CREATE TYPE eos.import_status AS ENUM
  ('uploaded', 'mapped', 'validating', 'validated', 'importing', 'done', 'failed');
CREATE TYPE eos.sale_status AS ENUM ('completed', 'voided', 'refund');

-- ---------------------------------------------------------------------------
-- Imports. The imports row doubles as the job record for the background worker.
-- ---------------------------------------------------------------------------
CREATE TABLE eos.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  entity_type varchar(40) NOT NULL,
  file_name varchar(300) NOT NULL,
  file_hash varchar(64) NOT NULL,
  file_size integer NOT NULL,
  status eos.import_status NOT NULL DEFAULT 'uploaded',
  options jsonb NOT NULL DEFAULT '{}',
  column_map jsonb NOT NULL DEFAULT '{}',
  preview jsonb NOT NULL DEFAULT '{}',
  quality_report jsonb,
  conflict_mode varchar(10),
  rows_total integer,
  rows_imported integer,
  rows_rejected integer,
  rows_duplicate integer,
  job_kind varchar(10),
  queued_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_by uuid REFERENCES eos.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_imports_conflict_mode CHECK (conflict_mode IN ('skip', 'replace')),
  CONSTRAINT ck_imports_job_kind CHECK (job_kind IN ('validate', 'commit'))
);
CREATE INDEX ix_imports_org_id_created_at ON eos.imports (org_id, created_at DESC);
CREATE INDEX ix_imports_org_id_file_hash ON eos.imports (org_id, file_hash);
CREATE INDEX ix_imports_jobs ON eos.imports (queued_at)
  WHERE status IN ('validating', 'importing');
CREATE INDEX ix_imports_created_by ON eos.imports (created_by);

CREATE TABLE eos.import_files (
  import_id uuid PRIMARY KEY REFERENCES eos.imports(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  content bytea NOT NULL
);
CREATE INDEX ix_import_files_org_id ON eos.import_files (org_id);

CREATE TABLE eos.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES eos.imports(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  column_name varchar(200),
  error_code varchar(50) NOT NULL,
  message text NOT NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX ix_import_errors_import_row ON eos.import_errors (import_id, row_number);
CREATE INDEX ix_import_errors_org_id ON eos.import_errors (org_id);

CREATE TABLE eos.import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  entity_type varchar(40) NOT NULL,
  header_signature varchar(64) NOT NULL,
  column_map jsonb NOT NULL,
  options jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_import_mappings_sig UNIQUE (org_id, entity_type, header_signature)
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
CREATE TABLE eos.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  sku varchar(100) NOT NULL,
  name varchar(300) NOT NULL,
  category varchar(150),
  unit varchar(30),
  is_active boolean NOT NULL DEFAULT true,
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_products_org_sku UNIQUE (org_id, sku)
);

CREATE TABLE eos.product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES eos.products(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  unit_cost numeric(18,6) NOT NULL,
  currency varchar(3) NOT NULL,
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_costs UNIQUE (org_id, product_id, effective_from)
);
CREATE INDEX ix_product_costs_lookup ON eos.product_costs (org_id, product_id, effective_from DESC);

CREATE TABLE eos.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  code varchar(100) NOT NULL,
  name varchar(300) NOT NULL,
  currency varchar(3),
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_suppliers_org_code UNIQUE (org_id, code)
);

CREATE TABLE eos.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  currency varchar(3) NOT NULL,
  rate_date date NOT NULL,
  rate_to_base numeric(18,8) NOT NULL CHECK (rate_to_base > 0),
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fx_rates UNIQUE (org_id, currency, rate_date)
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
CREATE TABLE eos.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES eos.branches(id),
  receipt_no varchar(100) NOT NULL,
  sold_at timestamptz NOT NULL,
  business_date date NOT NULL,
  status eos.sale_status NOT NULL,
  currency varchar(3) NOT NULL,
  ref_receipt_no varchar(100),
  customer_ref varchar(200),
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sales_receipt UNIQUE (org_id, branch_id, receipt_no)
);
CREATE INDEX ix_sales_org_date_branch ON eos.sales (org_id, business_date, branch_id);
CREATE INDEX ix_sales_branch_id ON eos.sales (branch_id);
CREATE INDEX ix_sales_source_import ON eos.sales (source_import_id);

CREATE TABLE eos.sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES eos.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES eos.products(id),
  raw_product_ref varchar(100),
  description text,
  qty numeric(14,3) NOT NULL,
  unit_price numeric(18,6) NOT NULL,
  discount numeric(18,4) NOT NULL DEFAULT 0,
  tax numeric(18,4) NOT NULL DEFAULT 0,
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer
);
CREATE INDEX ix_sale_lines_org_sale ON eos.sale_lines (org_id, sale_id);
CREATE INDEX ix_sale_lines_sale_id ON eos.sale_lines (sale_id);
CREATE INDEX ix_sale_lines_org_product ON eos.sale_lines (org_id, product_id);
CREATE INDEX ix_sale_lines_product_id ON eos.sale_lines (product_id);
CREATE INDEX ix_sale_lines_source_import ON eos.sale_lines (source_import_id);

CREATE TABLE eos.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES eos.branches(id),
  supplier_id uuid NOT NULL REFERENCES eos.suppliers(id),
  doc_no varchar(100) NOT NULL,
  purchased_on date NOT NULL,
  currency varchar(3) NOT NULL,
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_purchases_doc UNIQUE (org_id, supplier_id, doc_no)
);
CREATE INDEX ix_purchases_org_date ON eos.purchases (org_id, purchased_on);
CREATE INDEX ix_purchases_branch_id ON eos.purchases (branch_id);
CREATE INDEX ix_purchases_supplier_id ON eos.purchases (supplier_id);
CREATE INDEX ix_purchases_source_import ON eos.purchases (source_import_id);

CREATE TABLE eos.purchase_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES eos.purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES eos.products(id),
  qty numeric(14,3) NOT NULL,
  unit_cost numeric(18,6) NOT NULL,
  tax numeric(18,4) NOT NULL DEFAULT 0,
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer
);
CREATE INDEX ix_purchase_lines_purchase_id ON eos.purchase_lines (purchase_id);
CREATE INDEX ix_purchase_lines_org_product ON eos.purchase_lines (org_id, product_id);
CREATE INDEX ix_purchase_lines_product_id ON eos.purchase_lines (product_id);
CREATE INDEX ix_purchase_lines_source_import ON eos.purchase_lines (source_import_id);

CREATE TABLE eos.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES eos.branches(id),
  category varchar(100) NOT NULL,
  description text,
  incurred_on date NOT NULL,
  amount numeric(18,4) NOT NULL,
  tax numeric(18,4) NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL,
  row_hash varchar(64) NOT NULL,
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_expenses_row UNIQUE (org_id, row_hash)
);
CREATE INDEX ix_expenses_org_date_cat ON eos.expenses (org_id, incurred_on, category);
CREATE INDEX ix_expenses_branch_id ON eos.expenses (branch_id);
CREATE INDEX ix_expenses_source_import ON eos.expenses (source_import_id);

CREATE TABLE eos.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES eos.branches(id),
  product_id uuid NOT NULL REFERENCES eos.products(id),
  count_date date NOT NULL,
  qty numeric(14,3) NOT NULL,
  unit_cost numeric(18,6),
  source_import_id uuid REFERENCES eos.imports(id) ON DELETE SET NULL,
  source_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_counts UNIQUE (org_id, branch_id, product_id, count_date)
);
CREATE INDEX ix_inventory_counts_lookup
  ON eos.inventory_counts (org_id, branch_id, product_id, count_date DESC);
CREATE INDEX ix_inventory_counts_branch_id ON eos.inventory_counts (branch_id);
CREATE INDEX ix_inventory_counts_product_id ON eos.inventory_counts (product_id);
CREATE INDEX ix_inventory_counts_source_import ON eos.inventory_counts (source_import_id);

-- Remaining FK indexes on source_import_id for small tables.
CREATE INDEX ix_products_source_import ON eos.products (source_import_id);
CREATE INDEX ix_product_costs_product_id ON eos.product_costs (product_id);
CREATE INDEX ix_product_costs_source_import ON eos.product_costs (source_import_id);
CREATE INDEX ix_suppliers_source_import ON eos.suppliers (source_import_id);
CREATE INDEX ix_fx_rates_source_import ON eos.fx_rates (source_import_id);
CREATE INDEX ix_expenses_org_category ON eos.expenses (org_id, category);

CREATE TRIGGER trg_imports_updated BEFORE UPDATE ON eos.imports
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();
CREATE TRIGGER trg_import_mappings_updated BEFORE UPDATE ON eos.import_mappings
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON eos.products
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON eos.suppliers
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Job claiming. The worker has no org context until it holds a job, so this
-- runs as the owner and only returns which job to run and for which org.
-- Jobs stuck past p_stale are retried up to 3 attempts, then marked failed.
-- ---------------------------------------------------------------------------
CREATE FUNCTION eos.claim_import_job(p_stale interval DEFAULT interval '15 minutes')
  RETURNS TABLE (import_id uuid, org_id uuid, job_kind varchar)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = eos, pg_temp AS
$$
BEGIN
  UPDATE eos.imports i
     SET status = 'failed', finished_at = now(),
         last_error = coalesce(i.last_error, 'Gave up after 3 attempts')
   WHERE i.status IN ('validating', 'importing')
     AND i.attempts >= 3
     AND i.started_at < now() - p_stale;

  RETURN QUERY
  UPDATE eos.imports i
     SET started_at = now(), attempts = i.attempts + 1
   WHERE i.id = (
     SELECT j.id FROM eos.imports j
      WHERE j.status IN ('validating', 'importing')
        AND j.attempts < 3
        AND (j.started_at IS NULL OR j.started_at < now() - p_stale)
      ORDER BY j.queued_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1)
  RETURNING i.id, i.org_id, i.job_kind;
END
$$;
REVOKE ALL ON FUNCTION eos.claim_import_job(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION eos.claim_import_job(interval) TO eos_app;
"""


def _rls_sql() -> str:
    parts = []
    for t in TENANT_TABLES:
        parts.append(f"ALTER TABLE eos.{t} ENABLE ROW LEVEL SECURITY;")
        parts.append(
            f"CREATE POLICY tenant_all ON eos.{t} FOR ALL TO eos_app "
            "USING (org_id = eos.current_org_id()) WITH CHECK (org_id = eos.current_org_id());"
        )
        parts.append(f"GRANT SELECT, INSERT, UPDATE, DELETE ON eos.{t} TO eos_app;")
    parts.append("GRANT USAGE ON TYPE eos.import_status, eos.sale_status TO eos_app;")
    return "\n".join(parts)


def upgrade() -> None:
    run_script(UPGRADE_SQL + "\n" + _rls_sql())


def downgrade() -> None:
    run_script(
        "DROP FUNCTION IF EXISTS eos.claim_import_job(interval);\n"
        + "DROP TABLE IF EXISTS "
        + ", ".join(f"eos.{t}" for t in reversed(TENANT_TABLES))
        + " CASCADE;\nDROP TYPE IF EXISTS eos.import_status, eos.sale_status;"
    )
