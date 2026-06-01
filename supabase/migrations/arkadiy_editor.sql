-- Аркадий-редактор: оценка 1-10 + retry-флаг
-- Этап 1 контент-фабрики. Не ломает существующие черновики.

alter table content_drafts
  add column if not exists editor_score smallint,
  add column if not exists editor_verdict text,
  add column if not exists editor_comments text,
  add column if not exists editor_errors jsonb,
  add column if not exists editor_retried boolean not null default false,
  add column if not exists needs_review boolean not null default false;

create index if not exists content_drafts_needs_review_idx
  on content_drafts(needs_review)
  where needs_review = true;

comment on column content_drafts.editor_score is 'Балл Аркадия 1-10 за итоговый текст';
comment on column content_drafts.editor_verdict is 'approve | rewrite';
comment on column content_drafts.editor_comments is 'Короткий вердикт Аркадия для копирайтера';
comment on column content_drafts.editor_errors is 'jsonb массив конкретных косяков';
comment on column content_drafts.editor_retried is 'true если был один retry к Алине после score<7';
comment on column content_drafts.needs_review is 'true если итоговый score<7 — пост идёт в очередь, но помечен для ручной проверки';
