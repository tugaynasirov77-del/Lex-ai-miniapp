/**
 * Удаляет «осиротевшие» UTF-16 суррогаты из строки.
 *
 * Anthropic API строго парсит JSON и падает с
 * `invalid_request_error: no low surrogate in string` если в user content
 * встречается одинокий high surrogate (U+D800-U+DBFF) без пары
 * U+DC00-U+DFFF — это бывает в обрезанных эмодзи, парсенных через
 * t.me/s/<channel> с длинными лимитами текста, или в постах, склеенных
 * с обрезкой по символам вместо code points.
 *
 * Тихо вырезаем все одинокие суррогаты с обеих сторон.
 */
export function sanitizeForAnthropic(s: string | null | undefined): string {
  if (!s) return "";
  // Lone high surrogate (D800-DBFF) не сопровождается low surrogate (DC00-DFFF)
  // Lone low surrogate (DC00-DFFF) без предшествующего high surrogate
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    ""
  );
}
