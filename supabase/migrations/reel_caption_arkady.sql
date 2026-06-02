-- Аркадий для caption-from-transcript: версии промптов, retries, явное caption-поле
ALTER TABLE content_drafts
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS editor_prompt_version text,
  ADD COLUMN IF NOT EXISTS writer_prompt_version text,
  ADD COLUMN IF NOT EXISTS editor_retries int DEFAULT 0;
