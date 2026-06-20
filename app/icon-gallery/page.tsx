"use client";

import { PREMIUM_ICONS, type PremiumIconName } from "../../components/icons/PremiumIcons";

const NAMES = Object.keys(PREMIUM_ICONS) as PremiumIconName[];

export default function IconGalleryPage() {
  return (
    <main style={{
      minHeight: "100vh", padding: "32px 18px 48px",
      background: "#0B0B11", color: "#F4F4F8",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <h1 style={{ margin: "8px 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
        LEX AI · Premium Icon Gallery
      </h1>
      <p style={{ margin: "0 0 22px", color: "#9A9AAB", fontSize: 12.5 }}>
        Единая дизайн-система · soft-clay 3D · {NAMES.length} иконок
      </p>

      {/* Размеры */}
      <Section title="Размерная сетка (одна иконка)">
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          {[24, 32, 40, 48, 56, 64, 80].map((s) => {
            const Cmp = PREMIUM_ICONS.briefcase;
            return (
              <div key={s} style={{ textAlign: "center" }}>
                <Cmp size={s} />
                <div style={{ fontSize: 10, color: "#6B6B7B", marginTop: 6 }}>{s}px</div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Все иконки */}
      <Section title="Все иконки · 48px">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 14 }}>
          {NAMES.map((n) => {
            const Cmp = PREMIUM_ICONS[n];
            return (
              <div key={n} style={{
                background: "#15151E", border: "1px solid #262630", borderRadius: 16,
                padding: "16px 8px", textAlign: "center",
              }}>
                <Cmp size={48} />
                <div style={{ fontSize: 10.5, color: "#9A9AAB", marginTop: 8, fontWeight: 600 }}>{n}</div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* На светлом фоне — проверка контраста */}
      <Section title="На светлом фоне">
        <div style={{
          background: "#F6F6F9", borderRadius: 16, padding: 20,
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 12,
        }}>
          {NAMES.slice(0, 12).map((n) => {
            const Cmp = PREMIUM_ICONS[n];
            return (
              <div key={n} style={{ textAlign: "center" }}>
                <Cmp size={48} />
              </div>
            );
          })}
        </div>
      </Section>

      {/* Внутри карточек как в Wizard */}
      <Section title="В карточках (как в Wizard)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {NAMES.slice(0, 6).map((n) => {
            const Cmp = PREMIUM_ICONS[n];
            return (
              <div key={n} style={{
                background: "#15151E", border: "1.5px solid #262630", borderRadius: 14,
                padding: "10px 8px 9px", textAlign: "center",
              }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                  <Cmp size={56} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#F4F4F8" }}>{n}</div>
              </div>
            );
          })}
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 12, color: "#6B6B7B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
