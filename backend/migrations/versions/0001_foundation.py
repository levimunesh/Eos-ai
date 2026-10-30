"""Foundation: eos schema, app role, organisations, users, memberships, invitations,
branches, audit logs, row-level security.

Revision ID: 0001
Revises:
Create Date: 2026-10-30
"""

from migrations.sqlrun import run_script

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


UPGRADE_SQL = r"""
-- ---------------------------------------------------------------------------
-- App role. Created without a password; set one per environment:
--   ALTER ROLE eos_app WITH PASSWORD '...';
-- It owns nothing and has no BYPASSRLS, so every policy below applies to it.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eos_app') THEN
    CREATE ROLE eos_app LOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

REVOKE ALL ON SCHEMA eos FROM PUBLIC;
GRANT USAGE ON SCHEMA eos TO eos_app;


-- Tenant context helpers. Empty or missing settings read as NULL, which matches nothing.
CREATE FUNCTION eos.current_org_id() RETURNS uuid
  LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

CREATE FUNCTION eos.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE FUNCTION eos.touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS
$$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TYPE eos.member_role AS ENUM ('owner', 'manager', 'viewer');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE eos.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  base_currency varchar(3) NOT NULL,
  timezone varchar(64) NOT NULL,
  fiscal_year_start_month smallint NOT NULL DEFAULT 1,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0,
  prices_include_tax boolean NOT NULL DEFAULT false,
  date_format varchar(16) NOT NULL DEFAULT 'DD/MM/YYYY',
  is_demo boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_organisations_fiscal_month CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  CONSTRAINT ck_organisations_tax_rate CHECK (tax_rate >= 0 AND tax_rate < 1),
  CONSTRAINT ck_organisations_currency_len CHECK (char_length(base_currency) = 3)
);

CREATE TABLE eos.users (
  id uuid PRIMARY KEY,
  email varchar(320) NOT NULL UNIQUE,
  full_name varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE eos.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  city varchar(100),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_branches_org_id_code UNIQUE (org_id, code)
);
CREATE INDEX ix_branches_org_id ON eos.branches (org_id);

CREATE TABLE eos.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES eos.users(id) ON DELETE CASCADE,
  role eos.member_role NOT NULL,
  all_branches boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_memberships_org_id_user_id UNIQUE (org_id, user_id)
);
CREATE INDEX ix_memberships_org_id ON eos.memberships (org_id);
CREATE INDEX ix_memberships_user_id ON eos.memberships (user_id);

CREATE TABLE eos.membership_branches (
  membership_id uuid NOT NULL REFERENCES eos.memberships(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES eos.branches(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  PRIMARY KEY (membership_id, branch_id)
);
CREATE INDEX ix_membership_branches_org_id ON eos.membership_branches (org_id);

CREATE TABLE eos.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  role eos.member_role NOT NULL,
  all_branches boolean NOT NULL DEFAULT true,
  branch_ids uuid[] NOT NULL DEFAULT '{}',
  token_hash varchar(64) NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES eos.users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_invitations_org_id ON eos.invitations (org_id);

CREATE TABLE eos.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  user_id uuid,
  action varchar(100) NOT NULL,
  entity varchar(100) NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_logs_org_id_created_at ON eos.audit_logs (org_id, created_at DESC);

CREATE TRIGGER trg_organisations_updated BEFORE UPDATE ON eos.organisations
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON eos.users
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON eos.branches
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON eos.memberships
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();
CREATE TRIGGER trg_invitations_updated BEFORE UPDATE ON eos.invitations
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: the second wall behind repository filters (ADR 0002).
-- ---------------------------------------------------------------------------
ALTER TABLE eos.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE eos.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE eos.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE eos.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE eos.membership_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE eos.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE eos.audit_logs ENABLE ROW LEVEL SECURITY;

-- Organisations: the current org, or any org the current user belongs to (for /me).
CREATE POLICY org_select ON eos.organisations FOR SELECT TO eos_app
  USING (id = eos.current_org_id()
         OR id IN (SELECT m.org_id FROM eos.memberships m WHERE m.user_id = eos.current_user_id()));
-- Creating an org: the app sets app.org_id to the new id first, and must be a known user.
CREATE POLICY org_insert ON eos.organisations FOR INSERT TO eos_app
  WITH CHECK (id = eos.current_org_id() AND eos.current_user_id() IS NOT NULL);
CREATE POLICY org_update ON eos.organisations FOR UPDATE TO eos_app
  USING (id = eos.current_org_id()) WITH CHECK (id = eos.current_org_id());

-- Users: yourself, or members of the current org.
CREATE POLICY users_select ON eos.users FOR SELECT TO eos_app
  USING (id = eos.current_user_id()
         OR id IN (SELECT m.user_id FROM eos.memberships m WHERE m.org_id = eos.current_org_id()));
CREATE POLICY users_insert ON eos.users FOR INSERT TO eos_app
  WITH CHECK (id = eos.current_user_id());
CREATE POLICY users_update ON eos.users FOR UPDATE TO eos_app
  USING (id = eos.current_user_id()) WITH CHECK (id = eos.current_user_id());

-- Memberships: read your own across orgs; everything else only inside the current org.
CREATE POLICY memberships_select ON eos.memberships FOR SELECT TO eos_app
  USING (org_id = eos.current_org_id() OR user_id = eos.current_user_id());
CREATE POLICY memberships_insert ON eos.memberships FOR INSERT TO eos_app
  WITH CHECK (org_id = eos.current_org_id());
CREATE POLICY memberships_update ON eos.memberships FOR UPDATE TO eos_app
  USING (org_id = eos.current_org_id()) WITH CHECK (org_id = eos.current_org_id());
CREATE POLICY memberships_delete ON eos.memberships FOR DELETE TO eos_app
  USING (org_id = eos.current_org_id());

-- Plain tenant tables.
CREATE POLICY tenant_all ON eos.branches FOR ALL TO eos_app
  USING (org_id = eos.current_org_id()) WITH CHECK (org_id = eos.current_org_id());
CREATE POLICY tenant_all ON eos.membership_branches FOR ALL TO eos_app
  USING (org_id = eos.current_org_id()) WITH CHECK (org_id = eos.current_org_id());
CREATE POLICY tenant_all ON eos.invitations FOR ALL TO eos_app
  USING (org_id = eos.current_org_id()) WITH CHECK (org_id = eos.current_org_id());
CREATE POLICY audit_select ON eos.audit_logs FOR SELECT TO eos_app
  USING (org_id = eos.current_org_id());
CREATE POLICY audit_insert ON eos.audit_logs FOR INSERT TO eos_app
  WITH CHECK (org_id = eos.current_org_id());

-- ---------------------------------------------------------------------------
-- Accepting an invitation has to find it before the user belongs to the org,
-- so it runs as the owner. It checks the token, expiry and that the invite was
-- sent to the signed-in user's email before creating the membership.
-- ---------------------------------------------------------------------------
CREATE FUNCTION eos.accept_invitation(p_token_hash text, p_email text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = eos, pg_temp AS
$$
DECLARE
  v_user uuid := eos.current_user_id();
  inv eos.invitations%ROWTYPE;
  v_membership uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'no_user' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO inv FROM eos.invitations
   WHERE token_hash = p_token_hash
     AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = 'P0002';
  END IF;
  IF lower(inv.email) <> lower(p_email) THEN
    RAISE EXCEPTION 'email_mismatch' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO eos.memberships (org_id, user_id, role, all_branches)
  VALUES (inv.org_id, v_user, inv.role, inv.all_branches)
  ON CONFLICT (org_id, user_id) DO NOTHING
  RETURNING id INTO v_membership;

  IF v_membership IS NULL THEN
    RAISE EXCEPTION 'already_member' USING ERRCODE = 'P0001';
  END IF;

  IF NOT inv.all_branches THEN
    INSERT INTO eos.membership_branches (membership_id, branch_id, org_id)
    SELECT v_membership, b.id, inv.org_id
      FROM eos.branches b
     WHERE b.org_id = inv.org_id AND b.id = ANY (inv.branch_ids);
  END IF;

  UPDATE eos.invitations SET accepted_at = now() WHERE id = inv.id;
  INSERT INTO eos.audit_logs (org_id, user_id, action, entity, entity_id, metadata)
  VALUES (inv.org_id, v_user, 'invitation.accepted', 'membership', v_membership,
          jsonb_build_object('invitation_id', inv.id, 'role', inv.role));
  RETURN inv.org_id;
END
$$;

REVOKE ALL ON FUNCTION eos.accept_invitation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION eos.accept_invitation(text, text) TO eos_app;
GRANT EXECUTE ON FUNCTION eos.current_org_id(), eos.current_user_id() TO eos_app;

-- ---------------------------------------------------------------------------
-- Grants. Audit logs are append-only for the app.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  eos.organisations, eos.users, eos.branches, eos.memberships,
  eos.membership_branches, eos.invitations
TO eos_app;
GRANT SELECT, INSERT ON eos.audit_logs TO eos_app;
GRANT USAGE ON TYPE eos.member_role TO eos_app;
"""

DOWNGRADE_SQL = r"""
DROP FUNCTION IF EXISTS eos.accept_invitation(text, text);
DROP TABLE IF EXISTS eos.audit_logs, eos.invitations, eos.membership_branches,
  eos.memberships, eos.branches, eos.users, eos.organisations CASCADE;
DROP TYPE IF EXISTS eos.member_role;
DROP FUNCTION IF EXISTS eos.touch_updated_at(), eos.current_user_id(), eos.current_org_id();
"""


def upgrade() -> None:
    run_script(UPGRADE_SQL)


def downgrade() -> None:
    run_script(DOWNGRADE_SQL)
