-- Юзер-управляемый workflow для Reels: транскрипция → юзер выбирает ключевые слова → рендер
alter table reel_jobs
  add column if not exists transcript_words jsonb,    -- [{w, start_ms, end_ms, idx}]
  add column if not exists user_selections jsonb,     -- {key_indices: [int], animation: text}
  add column if not exists awaiting_approval_at timestamptz;

-- Новый статус: 'awaiting_approval' (после транскрипции, до выбора юзером)
comment on column reel_jobs.transcript_words is 'word-level транскрипт от whisper.cpp -ml 1 --split-on-word';
comment on column reel_jobs.user_selections is '{key_indices:[int], animation:"slide_up"|"pop"|"fade"} — что выбрал юзер в Mini App';
comment on column reel_jobs.status is 'pending | claimed | rendering | awaiting_approval | done | failed';
