/**
 * Фирменный знак LEX — реальный логотип (контур из брендового файла,
 * перекрашенный в IG-градиент). Лежит в public/lex-logo.png.
 */
export default function LexLogo({ size = 48 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/lex-logo.png"
      alt="LEX"
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size, objectFit: "contain" }}
    />
  );
}
