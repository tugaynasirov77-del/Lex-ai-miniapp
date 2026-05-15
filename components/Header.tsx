export default function Header({ title, subtitle, accent }: { title: string; subtitle?: string; accent?: string }) {
  return (
    <header
      className="px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 72px)",
        paddingBottom: 20,
      }}
    >
      <h1 className="h1">
        {title}
        {accent && <span className="grad-amber font-light"> {accent}</span>}
      </h1>
      {subtitle && (
        <p
          className="mt-1"
          style={{
            fontWeight: 300,
            fontSize: 12,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.04em",
          }}
        >
          {subtitle}
        </p>
      )}
    </header>
  );
}
