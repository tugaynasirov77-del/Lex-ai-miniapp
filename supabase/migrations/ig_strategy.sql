-- IG strategic layer: competitor notes + analysis history + plan platform field
ALTER TABLE ig_competitors
  ADD COLUMN IF NOT EXISTS profile_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS added_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS ig_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  competitor_ids uuid[] DEFAULT ARRAY[]::uuid[],
  prompt_version text,
  cost_usd numeric,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ig_analyses_project_idx ON ig_analyses(project_id, created_at DESC);

ALTER TABLE content_plans ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'telegram';
