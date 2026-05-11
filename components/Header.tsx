export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-5 pt-7 pb-5">
      <h1 className="h1">{title}</h1>
      {subtitle && <p className="text-muted text-[13px] mt-1.5">{subtitle}</p>}
    </header>
  );
}
