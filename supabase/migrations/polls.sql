-- Опросы как формат поста
-- poll_data структура: { question, options: string[], type: 'poll'|'quiz', correct_option_id?: number, explanation?: string }
alter table content_drafts
  add column if not exists poll_data jsonb;
