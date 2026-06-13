DELETE FROM content_drafts
WHERE status = 'pending'
  AND (body IS NULL OR trim(body) = '')
  AND created_at < now() - interval '1 hour';
