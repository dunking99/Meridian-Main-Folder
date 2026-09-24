import Link from "next/link";
import type { ReactNode } from "react";
import { getPortfolio, twr, type Position } from "@/lib/engine";
import { fmtDate, fmtMoney, fmtPct, fmtPrice } from "@/lib/format";
import { Delta, Money, Pct } from "@/components/ui";
import { CurrencySwitch, PortfolioTabs, PrivacyToggle } from "@/components/client";

export const dynamic = "force-dynamic";

function TickerTape({ positions }: { positions: Position[] }) {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden}>
      {positions.map((p) => (
        <Link key={p.symbol} href={`/portfolio/holdings/${encodeURIComponent(p.symbol)}`} tabIndex={hidden ? -1 : 0} className="flex items-center gap-2 border-r border-white/[0.05] px-4 py-1.5 transition-colors hover:bg-white/[0.03]">
          <span className="num text-[11px] font-semibold text-mist-200">{p.symbol}</span>
          <span className="num text-[11px] text-mist-400">{fmtPrice(p.price, p.inst.currency)}</span>
          <span className={`num text-[11px] ${p.dayPct >= 0 ? "text-up" : "text-down"}`}>
            {p.dayPct >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(p.dayPct), 2, false)}
          </span>
        </Link>
      ))}
    </div>
  );
  return (
    <div className="fade-r relative overflow-hidden border-b border-white/[0.06] bg-ink-950/70">
      <div className="marquee flex w-max">{row(false)}{row(true)}</div>
    </div>
  );
}

function Globe({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden>
      <defs>
        <radialGradient id="gl" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f5bd62" stopOpacity="0.16" />
          <stop offset="1" stopColor="#f5bd62" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="170" fill="url(#gl)" stroke="rgba(245,189,98,0.22)" />
      {[150, 115, 75, 32].map((rx) => (
        <ellipse key={rx} cx="200" cy="200" rx={rx} ry="170" fill="none" stroke="rgba(245,189,98,0.13)" />
      ))}
      {[-120, -60, 0, 60, 120].map((dy) => {
        const w = Math.sqrt(170 * 170 - dy * dy);
        return <ellipse key={dy} cx="200" cy={200 + dy} rx={w} ry={w * 0.12} fill="none" stroke="rgba(255,255,255,0.06)" />;
      })}
      <line x1="200" y1="10" x2="200" y2="390" stroke="rgba(245,189,98,0.35)" />
      <g className="sweep">
        <path d="M200 30 A170 170 0 0 1 370 200" fill="none" stroke="rgba(255,226,176,0.5)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <circle cx="200" cy="30" r="4" fill="#ffe2b0" />
    </svg>
  );
}

export default async function PortfolioLayout({ children }: { children: ReactNode }) {
  const core = await getPortfolio();
  const t = core.totals;
  const ccy = core.ccy;
  const ytd = twr(core, "YTD");
  const oneY = twr(core, "1Y");
  const accounts = new Set(core.txns.map((x) => x.account)).size;
  return (
    <div>
      <TickerTape positions={core.positions} />
      <header className="relative overflow-hidden border-b border-white/[0.06]">
        <Globe className="pointer-events-none absolute -right-24 -top-36 h-[460px] w-[460px] opacity-70" />
        <div className="relative mx-auto max-w-[1480px] px-4 pt-7 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="label flex flex-wrap items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-up" />
                </span>
                <span>Live book</span>
                <span className="text-mist-500">·</span>
                <span>{accounts} accounts · {t.positions} positions</span>
                <span className="text-mist-500">·</span>
                <span>as of {fmtDate(core.asOf, "dow")}, {core.asOf.slice(0, 4)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                <h1 className="serif text-[48px] italic leading-[0.9] text-mist-100">Portfolio</h1>
                <div className="money num text-[40px] font-light leading-none tracking-tight text-white">{fmtMoney(t.value, ccy)}</div>
                <div className="flex items-center gap-2 pb-1 text-[13px]">
                  <Delta v={t.dayChange} pct={t.dayPct} ccy={ccy} />
                  <span className="text-mist-500">today</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-mist-400">
                <span>YTD <Pct v={ytd} className="ml-1" /></span>
                <span>1Y <Pct v={oneY} className="ml-1" /></span>
                <span>Total gain <Money v={t.totalGain} ccy={ccy} sign compact className="ml-1 text-up" /> <Pct v={t.totalGainPct} className="ml-1" /></span>
                <span>Net invested <Money v={t.invested} ccy={ccy} compact className="ml-1 text-mist-200" /></span>
                <span>Cash <Money v={t.cash} ccy={ccy} compact className="ml-1 text-mist-200" /></span>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <CurrencySwitch value={ccy} />
              <PrivacyToggle />
            </div>
          </div>
          <div className="mt-6">
            <PortfolioTabs />
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-[1480px] px-4 py-6 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-[1480px] px-6 pb-10 pt-4 text-[11px] text-mist-500">
        Meridian · simulated market data for design purposes · values in {ccy} at daily closing FX
      </footer>
    </div>
  );
}
