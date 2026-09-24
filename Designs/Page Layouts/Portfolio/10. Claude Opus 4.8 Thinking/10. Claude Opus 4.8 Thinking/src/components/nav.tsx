"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function Icon({ path }: { path: ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Dashboard", icon: <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></> },
  { href: "/portfolio", label: "Portfolio", icon: <><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></> },
  { href: "/markets", label: "Markets", icon: <><path d="M3 12h4l3 8 4-16 3 8h4" /></> },
  { href: "/news", label: "News", icon: <><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></> },
  { href: "/screener", label: "Screener", icon: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></> },
];

export function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <aside className="sticky top-0 flex h-screen w-[68px] shrink-0 flex-col items-center border-r border-line bg-bg2/80 py-4 backdrop-blur lg:w-[224px] lg:items-stretch lg:px-3">
      <Link href="/" className="mb-6 flex items-center gap-2.5 px-1 lg:px-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg,#34e0c4,#7c9bff)" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#05070d" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
          </svg>
        </span>
        <span className="hidden font-serif text-xl tracking-wide text-ink lg:block">Meridian</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition lg:justify-start ${
                active ? "bg-[#141c28] text-ink" : "text-ink-faint hover:bg-[#0f1620] hover:text-ink-dim"
              }`}
            >
              <span className={active ? "text-accent" : ""}>
                <Icon path={n.icon} />
              </span>
              <span className="hidden lg:block">{n.label}</span>
              {active && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-accent lg:block" />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-ink-dim">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a2331] text-xs font-semibold text-ink">M</span>
        <div className="hidden leading-tight lg:block">
          <div className="text-xs font-medium text-ink">Investor</div>
          <div className="text-[10px] text-ink-faint">Single-user</div>
        </div>
      </div>
    </aside>
  );
}

const TABS = [
  { href: "/portfolio", label: "Overview" },
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/performance", label: "Performance" },
  { href: "/portfolio/analysis", label: "Analysis" },
];

export function SubNav() {
  const path = usePathname();
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active = t.href === "/portfolio" ? path === "/portfolio" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              active ? "bg-panel text-ink" : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {t.label}
            {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </Link>
        );
      })}
    </div>
  );
}
