"""AI assistant: conversations, messages, tool calls, usage.

Conversations are private to the person who started them, enforced by RLS as well as in
the app. Every number in an answer can be traced to a stored tool call.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-30
"""

from migrations.sqlrun import run_script

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

UPGRADE_SQL = r"""
CREATE TABLE eos.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES eos.users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_conversations_org_user
  ON eos.ai_conversations (org_id, user_id, updated_at DESC);
CREATE INDEX ix_ai_conversations_user_id ON eos.ai_conversations (user_id);

CREATE TABLE eos.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES eos.ai_conversations(id) ON DELETE CASCADE,
  role varchar(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  verified boolean,
  unverified_numbers jsonb NOT NULL DEFAULT '[]',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_messages_conversation ON eos.ai_messages (conversation_id, created_at);
CREATE INDEX ix_ai_messages_org_id ON eos.ai_messages (org_id);

CREATE TABLE eos.ai_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES eos.ai_messages(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  tool_name varchar(60) NOT NULL,
  args jsonb NOT NULL DEFAULT '{}',
  result jsonb,
  is_error boolean NOT NULL DEFAULT false,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_tool_calls_message ON eos.ai_tool_calls (message_id, seq);
CREATE INDEX ix_ai_tool_calls_org_id ON eos.ai_tool_calls (org_id);

CREATE TABLE eos.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES eos.organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES eos.users(id) ON DELETE SET NULL,
  message_id uuid REFERENCES eos.ai_messages(id) ON DELETE SET NULL,
  model varchar(100) NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6),
  latency_ms integer,
  rounds integer NOT NULL DEFAULT 0,
  tools_called jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ai_usage_org_created ON eos.ai_usage (org_id, created_at DESC);
CREATE INDEX ix_ai_usage_user_id ON eos.ai_usage (user_id);
CREATE INDEX ix_ai_usage_message_id ON eos.ai_usage (message_id);

CREATE TRIGGER trg_ai_conversations_updated BEFORE UPDATE ON eos.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION eos.touch_updated_at();

ALTER TABLE eos.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_conversations ON eos.ai_conversations FOR ALL TO eos_app
  USING (org_id = eos.current_org_id() AND user_id = eos.current_user_id())
  WITH CHECK (org_id = eos.current_org_id() AND user_id = eos.current_user_id());

ALTER TABLE eos.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_messages ON eos.ai_messages FOR ALL TO eos_app
  USING (org_id = eos.current_org_id() AND conversation_id IN (
           SELECT c.id FROM eos.ai_conversations c))
  WITH CHECK (org_id = eos.current_org_id() AND conversation_id IN (
           SELECT c.id FROM eos.ai_conversations c));

ALTER TABLE eos.ai_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_tool_calls ON eos.ai_tool_calls FOR ALL TO eos_app
  USING (org_id = eos.current_org_id() AND message_id IN (SELECT m.id FROM eos.ai_messages m))
  WITH CHECK (org_id = eos.current_org_id() AND message_id IN (SELECT m.id FROM eos.ai_messages m));

-- Usage is visible org-wide to the app (owners will see cost reports); written per request.
ALTER TABLE eos.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_all ON eos.ai_usage FOR ALL TO eos_app
  USING (org_id = eos.current_org_id()) WITH CHECK (org_id = eos.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON eos.ai_conversations, eos.ai_messages,
  eos.ai_tool_calls TO eos_app;
GRANT SELECT, INSERT ON eos.ai_usage TO eos_app;
"""

DOWNGRADE_SQL = """
DROP TABLE IF EXISTS eos.ai_usage, eos.ai_tool_calls, eos.ai_messages, eos.ai_conversations
  CASCADE;
"""


def upgrade() -> None:
    run_script(UPGRADE_SQL)


def downgrade() -> None:
    run_script(DOWNGRADE_SQL)
