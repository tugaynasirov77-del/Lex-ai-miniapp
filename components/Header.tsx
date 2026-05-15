export default function Header({ title, subtitle, accent }: { title: string; subtitle?: string; accent?: string }) {
  return (
    <header
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 96px)",
        paddingLeft: 22,
        paddingRight: 22,
        paddingBottom: 24,
        position: "relative",
        zIndex: 2,
      }}
    >
      <h1
        style={{
          fontWeight: 200,
          fontSize: 28,
          color: "rgba(240,232,218,0.92)",
          lineHeight: 1.2,
          letterSpacing: "-0.4px",
          marginBottom: 8,
        }}
      >
        {title}
        {accent && (
          <span
            style={{
              background: "linear-gradient(135deg, #F0A020 0%, #E06020 55%, #C04020 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontWeight: 300,
            }}
          >
            {" "}{accent}
          </span>
        )}
      </h1>
      {subtitle && (
        <p
          style={{
            fontWeight: 300,
            fontSize: 13,
            color: "rgba(255,255,255,0.22)",
            letterSpacing: "0.04em",
          }}
        >
          — {subtitle}
        </p>
      )}
    </header>
  );
}
