"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13.5" stroke="#D9A648" strokeWidth="1.4" />
      <ellipse cx="16" cy="16" rx="6.5" ry="13.5" stroke="#D9A648" strokeOpacity="0.55" strokeWidth="1.1" />
      <line x1="2.5" y1="16" x2="29.5" y2="16" stroke="#D9A648" strokeOpacity="0.35" strokeWidth="1" />
      <circle cx="16" cy="16" r="2.1" fill="#F0C576" />
    </svg>
  );
}

const I = {
  overview: (
    <path d="M2 8h3l2-4 3 8 2.5-5H14l2-3 3 7 2-4h3" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  holdings: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" strokeWidth="1.3" fill="none" />
      <rect x="9.5" y="2" width="5" height="9" rx="1" strokeWidth="1.3" fill="none" />
      <rect x="2" y="9.5" width="5" height="4.5" rx="1" strokeWidth="1.3" fill="none" />
      <rect x="17" y="2" width="5" height="5" rx="1" strokeWidth="1.3" fill="none" />
      <rect x="17" y="9.5" width="5" height="4.5" rx="1" strokeWidth="1.3" fill="none" />
    </>
  ),
  performance: (
    <path d="M2 14L7 8l3.5 3.5L16 4m0 0h-4m4 0v4M3 16h13" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  analysis: (
    <>
      <circle cx="5" cy="13" r="2.2" strokeWidth="1.3" fill="none" />
      <circle cx="12" cy="6" r="2.8" strokeWidth="1.3" fill="none" />
      <circle cx="14.5" cy="14" r="1.8" strokeWidth="1.3" fill="none" />
      <path d="M2.5 17.5L17 2.5" strokeOpacity="0.4" strokeWidth="1" />
    </>
  ),
  news: (
    <>
      <rect x="2.5" y="2" width="12" height="15" rx="1.5" strokeWidth="1.3" fill="none" />
      <path d="M5 5.5h7M5 8.5h7M5 11.5h4" strokeWidth="1.2" />
    </>
  ),
  watchlist: (
    <path d="M9 2.5l1.9 3.9 4.3.6-3.1 3 .7 4.2L9 12.2l-3.8 2 .7-4.2-3.1-3 4.3-.6L9 2.5z" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
  ),
  markets: (
    <>
      <circle cx="9.5" cy="9" r="7" strokeWidth="1.3" fill="none" />
      <ellipse cx="9.5" cy="9" rx="3.2" ry="7" strokeWidth="1" fill="none" />
      <path d="M2.5 9h14" strokeWidth="1" />
    </>
  ),
  research: (
    <>
      <path d="M7 2.5h5v4.5l4 7.5-2 2.5H6l-2-2.5 4-7.5V2.5z" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      <path d="M7 13h6" strokeWidth="1.2" />
    </>
  ),
  settings: (
    <>
      <circle cx="9.5" cy="9.5" r="2.5" strokeWidth="1.3" fill="none" />
      <path d="M9.5 2.5v2.4M9.5 14.1v2.4M2.5 9.5h2.4M14.1 9.5h2.4M4.6 4.6l1.7 1.7M12.8 12.8l1.7 1.7M14.4 4.6l-1.7 1.7M6.2 12.8l-1.7 1.7" strokeWidth="1.2" />
    </>
  ),
};

type Item = { href: string; label: string; icon: keyof typeof I; soon?: boolean };
const PORTFOLIO: Item[] = [
  { href: "/portfolio", label: "Overview", icon: "overview" },
  { href: "/portfolio/holdings", label: "Holdings", icon: "holdings" },
  { href: "/portfolio/performance", label: "Performance", icon: "performance" },
  { href: "/portfolio/analysis", label: "Analysis", icon: "analysis" },
];
const REST: { label: string; items: Item[] }[] = [
  { label: "Intelligence", items: [{ href: "/news", label: "News & Signals", icon: "news", soon: true }, { href: "/watchlist", label: "Watchlist", icon: "watchlist", soon: true }] },
  { label: "Desk", items: [{ href: "/markets", label: "Markets", icon: "markets", soon: true }, { href: "/research", label: "Research", icon: "research", soon: true }, { href: "/settings", label: "Settings", icon: "settings", soon: true }] },
];

function isActive(pathname: string, href: string) {
  return href === "/portfolio" ? pathname === "/portfolio" : pathname.startsWith(href);
}

function NavItem({ item, pathname, compact }: { item: Item; pathname: string; compact?: boolean }) {
  const on = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
        on ? "bg-ink-800 text-tx-1" : "text-tx-2 hover:text-tx-1 hover:bg-ink-850"
      } ${compact ? "" : ""}`}
    >
      <svg width="18" height="18" viewBox="0 0 19 19" className={`shrink-0 ${on ? "text-brass2" : "text-tx-3 group-hover:text-tx-2"}`} stroke="currentColor">
        {I[item.icon]}
      </svg>
      <span className="font-medium tracking-tight">{item.label}</span>
      {item.soon && (
        <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-tx-3 border border-line rounded px-1.5 py-0.5">
          soon
        </span>
      )}
      {on && !item.soon && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brass" />}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <>
      {/* desktop rail */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-ink-900/85 backdrop-blur-sm z-30">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <Mark />
          <div>
            <div className="font-display text-[19px] tracking-[0.08em] leading-none">
              MERIDIAN
            </div>
            <div className="text-[10px] tracking-[0.22em] uppercase text-tx-3 mt-1.5">Private markets</div>
          </div>
        </div>
        <div className="mx-5 h-px bg-line" />
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div>
            <div className="kicker px-2.5 pb-2">Portfolio</div>
            <div className="space-y-0.5">
              {PORTFOLIO.map((it) => (
                <NavItem key={it.href} item={it} pathname={pathname} />
              ))}
            </div>
          </div>
          {REST.map((sec) => (
            <div key={sec.label}>
              <div className="kicker px-2.5 pb-2">{sec.label}</div>
              <div className="space-y-0.5">
                {sec.items.map((it) => (
                  <NavItem key={it.href} item={it} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3.5">
          <div className="rounded-xl border border-line bg-ink-850/80 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-up inline-block" />
              <span className="text-[11px] font-medium text-tx-2">Live · New York session</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-tx-3">
              <span className="font-mono">Base USD</span>
              <span>Single owner</span>
            </div>
          </div>
        </div>
      </aside>

      {/* mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 border-b border-line bg-ink-900/90 backdrop-blur px-4 pt-3">
        <div className="flex items-center gap-2.5">
          <Mark size={24} />
          <span className="font-display text-[16px] tracking-[0.08em]">MERIDIAN</span>
        </div>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 mt-2 pb-2">
          {PORTFOLIO.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap ${
                isActive(pathname, it.href) ? "bg-ink-800 text-brass2" : "text-tx-2"
              }`}
            >
              {it.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
