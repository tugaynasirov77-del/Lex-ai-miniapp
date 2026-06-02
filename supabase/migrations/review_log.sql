-- Журнал действий ревью (approve/reject/edit/reschedule)
ALTER TABLE content_drafts
  ADD COLUMN IF NOT EXISTS review_log jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_drafts_status_scheduled
  ON content_drafts(status, scheduled_at);
