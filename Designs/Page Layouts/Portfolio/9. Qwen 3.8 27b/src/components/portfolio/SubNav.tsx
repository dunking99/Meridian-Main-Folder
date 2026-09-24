"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portfolio", label: "Overview" },
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/performance", label: "Performance" },
  { href: "/portfolio/analysis", label: "Analysis" },
];

export default function SubNav() {
  const pathname = usePathname();
  const active =
    TABS.find((t) => (t.href === "/portfolio" ? pathname === "/portfolio" : pathname.startsWith(t.href))) ?? TABS[0];
  return (
    <div>
      <div className="flex items-end justify-between gap-4 pt-6">
        <div>
          <div className="kicker">Portfolio</div>
          <h1 className="font-display text-[30px] leading-tight tracking-tight mt-1.5">{active.label}</h1>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-tx-3 pb-1.5">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-up inline-block" />
          <span className="font-mono">
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
      </div>
      <nav className="mt-4 flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map((t) => {
          const on = active.label === t.label;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3.5 py-2.5 text-[13px] font-medium -mb-px border-b-2 whitespace-nowrap transition-colors ${
                on ? "text-brass2 border-brass" : "text-tx-3 border-transparent hover:text-tx-1"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
