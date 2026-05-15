// Чистит markdown-мусор из ответа агента: #, **, *, `, ~~, >, ", '
// Сохраняет переносы строк и абзацы.

export function cleanReply(text: string): string {
  if (!text) return text;
  let s = text;

  // убрать code-fence маркеры ```lang
  s = s.replace(/```[\w-]*\n?/g, "");
  s = s.replace(/```/g, "");

  // inline code `...`
  s = s.replace(/`([^`]+)`/g, "$1");

  // bold/italic **text**, *text*, __text__, _text_
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2");
  s = s.replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2");

  // strikethrough
  s = s.replace(/~~([^~]+)~~/g, "$1");

  // заголовки markdown в начале строки: # / ## / ###
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");

  // блок-цитата >
  s = s.replace(/^[ \t]*>[ \t]?/gm, "");

  // буллеты "- " "* " "+ " → "• "
  s = s.replace(/^[ \t]*[-*+][ \t]+/gm, "• ");

  // нумерация "1. " оставить, но убрать лишний \t

  // убрать одиночные кавычки в начале/конце абзаца
  s = s.replace(/^[«"']+|[»"']+$/gm, "");

  // лишние множественные пустые строки → одна
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}
