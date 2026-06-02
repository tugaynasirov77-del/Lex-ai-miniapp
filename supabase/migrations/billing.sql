-- Billing/subscriptions: расширяем существующую subscriptions (per-tg_id) + project_budget.tier + billing_events
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS renew_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'telegram_stars',
  ADD COLUMN IF NOT EXISTS telegram_payment_charge_id text,
  ADD COLUMN IF NOT EXISTS invoice_payload text,
  ADD COLUMN IF NOT EXISTS amount_stars int;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_charge_uk
  ON subscriptions(telegram_payment_charge_id)
  WHERE telegram_payment_charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_tg_status_idx
  ON subscriptions(tg_id, status, renew_at DESC);

ALTER TABLE project_budget
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS billing_events (
  id bigserial PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  tg_id bigint,
  type text NOT NULL,        -- upgrade_intent | payment_success | payment_failed | expired | downgrade | gate_block
  tier text,
  amount_stars int,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_events_proj_idx ON billing_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_events_tg_idx ON billing_events(tg_id, created_at DESC);
