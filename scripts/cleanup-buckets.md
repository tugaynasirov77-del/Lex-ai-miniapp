# Финальная чистка Supabase Storage (вручную)

После Этапа 4 в БД больше нет ссылок на reels/raw-uploads bucket'ы.
Удалить через Supabase Dashboard:

1. Открыть https://supabase.com/dashboard/project/oawpgchdoshuqjvafgvt/storage/buckets
2. Bucket `reels` → правый меню → Empty bucket → Delete bucket
3. Bucket `raw-uploads` → Empty bucket → Delete bucket
4. Bucket `post-photos` — **оставить** (нужен для будущего)

Это освободит ~50-200 МБ из Supabase Free 1GB.
