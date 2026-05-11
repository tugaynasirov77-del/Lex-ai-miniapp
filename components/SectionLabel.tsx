import Link from "next/link";

export default function SectionLabel({ children, href }: { children: React.ReactNode; href?: string }) {
  return (
    <div className="px-5 mb-3 flex items-center justify-between">
      <span className="caption">{children}</span>
      {href && <Link href={href} className="text-[11px] font-semibold text-accent hover:text-accent/80">все →</Link>}
    </div>
  );
}
