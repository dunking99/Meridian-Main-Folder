"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CurrencySwitch } from "./money";

const I = {
  today: "M3 12h4l3-8 4 16 3-8h4",
  portfolio: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  markets: "M3 17l6-6 4 4 8-8M15 7h6v6",
  news: "M4 5h13v14H6a2 2 0 01-2-2V5zm13 4h3v8a2 2 0 01-2 2M8 9h5M8 13h5",
  watchlist: "M12 17.3l-6.2 3.7 1.6-7L2 9.3l7.2-.6L12 2l2.8 6.7 7.2.6-5.4 4.7 1.6 7z",
  research: "M11 18a7 7 0 100-14 7 7 0 000 14zm10 3l-5-5",
  planner: "M4 6h16M4 12h10M4 18h6M18 14v6m-3-3h6",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14.4 3h-4l-.4 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3l.4 2.4h4l.4-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z",
};

const NAV = [
  { href: "/today", label: "Today", icon: I.today, soon: true },
  { href: "/portfolio", label: "Portfolio", icon: I.portfolio },
  { href: "/markets", label: "Markets", icon: I.markets, soon: true },
  { href: "/news", label: "News", icon: I.news },
  { href: "/watchlist", label: "Watchlist", icon: I.watchlist, soon: true },
  { href: "/research", label: "Research", icon: I.research, soon: true },
  { href: "/planner", label: "Planner", icon: I.planner, soon: true },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#d4ff3a" />
          <stop offset="1" stopColor="#8f7cff" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="none" stroke="url(#lg)" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="5.5" ry="13" fill="none" stroke="url(#lg)" strokeWidth="1.3" opacity="0.7" />
      <line x1="16" y1="1" x2="16" y2="31" stroke="#d4ff3a" strokeWidth="2" />
      <circle cx="16" cy="11" r="2.2" fill="#d4ff3a" />
    </svg>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Shell({ children, asOf }: { children: React.ReactNode; asOf: string }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r border-line bg-ink/60 py-5 backdrop-blur md:flex xl:w-[216px] xl:items-stretch xl:px-4">
        <Link href="/portfolio" className="mb-8 flex items-center gap-2.5 xl:px-2">
          <Logo />
          <span className="hidden font-serif text-2xl tracking-tight xl:inline">Meridian</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-panel2 text-fg" : "text-muted hover:bg-panel hover:text-fg"}`}
              >
                {active && <span className="meridian-line absolute -left-4 top-1 bottom-1 hidden w-[2px] xl:block" />}
                <span className={active ? "text-accent" : ""}><Icon d={n.icon} /></span>
                <span className="hidden flex-1 xl:inline">{n.label}</span>
                {n.soon && <span className="hidden rounded-full border border-line px-1.5 text-[9px] uppercase tracking-wider text-dim xl:inline">soon</span>}
              </Link>
            );
          })}
        </nav>
        <div className="hidden rounded-xl border border-line bg-panel p-3 xl:block">
          <div className="eyebrow mb-1">Signed in</div>
          <div className="text-sm">Personal account</div>
          <div className="text-[11px] text-dim">Single-user · Base USD</div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-line bg-ink/70 px-5 backdrop-blur-xl lg:px-8">
          <div className="md:hidden"><Logo size={24} /></div>
          <div className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 text-sm text-dim">
            <Icon d={I.research} />
            <span className="flex-1 truncate">Search holdings, tickers, news…</span>
            <kbd className="rounded border border-line2 px-1.5 text-[10px]">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-muted lg:flex">
              <span className="live-dot h-2 w-2 rounded-full bg-pos" />
              <span>Close · <span className="num">{asOf}</span></span>
            </div>
            <CurrencySwitch />
          </div>
        </header>
        <main className="px-5 pb-16 pt-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
