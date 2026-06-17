-- WorkBoard: Strategic Execution Layer schema
-- Run once against your Supabase project via the SQL editor or CLI

-- ── Meetings ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    headline TEXT,
    raw_transcript TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Manager Focus List (sign-off items for executives) ────────────────────

CREATE TABLE IF NOT EXISTS manager_focus_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    manager_name TEXT NOT NULL,
    team_name TEXT NOT NULL DEFAULT '',
    checklist_item TEXT NOT NULL,
    context_summary TEXT NOT NULL DEFAULT '',
    target_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL'
        CHECK (status IN ('PENDING_APPROVAL', 'IN_REVIEW', 'SIGNED_OFF', 'DEFERRED')),
    is_signed_off BOOLEAN NOT NULL DEFAULT FALSE,
    signed_off_at TIMESTAMPTZ,
    is_blocker BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_meeting ON manager_focus_lists(meeting_id);
CREATE INDEX IF NOT EXISTS idx_focus_status ON manager_focus_lists(status);

-- ── Employee Action Items (granular tasks for team members) ───────────────

CREATE TABLE IF NOT EXISTS employee_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    assigned_to TEXT NOT NULL,
    task_name TEXT NOT NULL,
    task_details TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    status TEXT NOT NULL DEFAULT 'TODO'
        CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
    deadline TIMESTAMPTZ,
    jira_ticket_url TEXT,
    slack_message_ts TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_meeting ON employee_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON employee_action_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON employee_action_items(status);

-- ── Auto-update updated_at ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER focus_updated_at
  BEFORE UPDATE ON manager_focus_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER tasks_updated_at
  BEFORE UPDATE ON employee_action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Enable RLS; policies should be added based on your auth provider setup.

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_focus_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_action_items ENABLE ROW LEVEL SECURITY;
