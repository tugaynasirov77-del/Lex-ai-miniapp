interface Props {
  size?: number;
  /** уникальный id чтобы defs не конфликтовали при нескольких экземплярах на странице */
  uid?: string;
  glow?: boolean;
  spinning?: boolean;
  className?: string;
}

export default function AtomLogo({ size = 24, uid = "al", glow = false, spinning = false, className }: Props) {
  const orb = `${uid}Orb`;
  const stroke = `${uid}Stroke`;
  const gf = `${uid}Glow`;
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        position: "relative",
        flexShrink: 0,
        display: "inline-block",
      }}
    >
      {glow && (
        <div
          style={{
            position: "absolute",
            inset: -Math.round(size * 0.18),
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(240,160,40,0.35) 0%, rgba(240,160,40,0) 65%)",
            filter: `blur(${Math.max(6, size * 0.12)}px)`,
            animation: "lexLogoGlow 2.6s ease-in-out infinite",
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        shapeRendering="geometricPrecision"
        style={{
          position: "relative",
          display: "block",
          animation: spinning ? "lexLogoSpin 12s linear infinite" : undefined,
        }}
      >
        <defs>
          <radialGradient id={orb} cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#FFE6B0" />
            <stop offset="50%" stopColor="#F0A020" />
            <stop offset="100%" stopColor="#8A2A0A" />
          </radialGradient>
          <linearGradient id={stroke} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F0A020" />
            <stop offset="100%" stopColor="#C04020" />
          </linearGradient>
          <filter id={gf} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#${gf})`}>
          <circle cx="100" cy="100" r="78" fill="none" stroke={`url(#${stroke})`} strokeWidth="4" />
          <g stroke={`url(#${stroke})`} strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M 100 100 C 70 90, 60 50, 100 22" />
            <path d="M 100 100 C 110 70, 150 60, 178 100" />
            <path d="M 100 100 C 130 110, 140 150, 100 178" />
            <path d="M 100 100 C 90 130, 50 140, 22 100" />
          </g>
          <circle cx="100" cy="22" r="14" fill={`url(#${orb})`} />
          <circle cx="178" cy="100" r="14" fill={`url(#${orb})`} />
          <circle cx="100" cy="178" r="14" fill={`url(#${orb})`} />
          <circle cx="22" cy="100" r="14" fill={`url(#${orb})`} />
          <circle cx="100" cy="100" r="18" fill={`url(#${orb})`} />
        </g>
      </svg>
    </div>
  );
}
