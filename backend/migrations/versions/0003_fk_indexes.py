"""Index foreign keys flagged by the Supabase performance advisor.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-30
"""

from migrations.sqlrun import run_script

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    run_script(
        """
        CREATE INDEX IF NOT EXISTS ix_invitations_invited_by ON eos.invitations (invited_by);
        CREATE INDEX IF NOT EXISTS ix_membership_branches_branch_id
          ON eos.membership_branches (branch_id);
        """
    )


def downgrade() -> None:
    run_script(
        """
        DROP INDEX IF EXISTS eos.ix_membership_branches_branch_id;
        DROP INDEX IF EXISTS eos.ix_invitations_invited_by;
        """
    )
