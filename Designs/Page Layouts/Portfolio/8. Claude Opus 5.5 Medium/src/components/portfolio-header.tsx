"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMoney } from "./money";
import { pct, tone } from "@/lib/format";
import { Sparkline } from "./charts/basic";

type Tick = { symbol: string; price: number; dayPct: number };
type Totals = {
  value: number; invested: number; cash: number; netDeposits: number; dayChange: number; dayPct: number;
  totalGain: number; totalGainPct: number; twr: number; positions: number; annualIncome: number;
};

const TABS = [
  { href: "/portfolio", label: "Overview", exact: true },
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/performance", label: "Performance" },
  { href: "/portfolio/analysis", label: "Analysis" },
  { href: "/portfolio/activity", label: "Activity" },
];

export function TickerTape({ ticks }: { ticks: Tick[] }) {
  const row = [...ticks, ...ticks];
  return (
    <div className="relative -mx-5 mb-6 overflow-hidden border-y border-line bg-panel/40 py-2 lg:-mx-8">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent" />
      <div className="marquee flex w-max gap-8 whitespace-nowrap">
        {row.map((t, i) => (
          <Link key={i} href={`/portfolio/holdings/${t.symbol}`} className="flex items-center gap-2 text-xs hover:opacity-80">
            <span className="font-semibold">{t.symbol}</span>
            <span className="num text-muted">{t.price >= 1000 ? t.price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : t.price.toFixed(2)}</span>
            <span className={`num ${tone(t.dayPct)}`}>{t.dayPct >= 0 ? "▲" : "▼"} {pct(Math.abs(t.dayPct), 2)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PortfolioHeader({ totals, spark, health, risk }: { totals: Totals; spark: number[]; health: number; risk: { level: number; label: string } }) {
  const { fmt } = useMoney();
  const full = fmt(totals.value, { digits: 2 });
  const [whole, cents] = full.includes(".") ? full.split(".") : [full, ""];
  const cells = [
    { k: "Invested", v: fmt(totals.invested, { compact: true }), s: `${pct(totals.invested / totals.value, 0)} of book` },
    { k: "Cash", v: fmt(totals.cash, { compact: true }), s: `${pct(totals.cash / totals.value, 1)} · 5 ccys` },
    { k: "Net deposits", v: fmt(totals.netDeposits, { compact: true }), s: "since inception" },
    { k: "Fwd income", v: fmt(totals.annualIncome, { compact: true }), s: `${fmt(totals.annualIncome / 12, { compact: true })}/mo` },
  ];
  return (
    <section className="rise mb-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <div className="eyebrow mb-2 flex items-center gap-2">
          <span className="h-px w-6 bg-accent" /> Total portfolio value
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <h1 className="font-serif text-[clamp(3rem,7vw,5.6rem)] leading-[0.9] tracking-tight">
            {whole}
            {cents && <span className="text-dim">.{cents}</span>}
          </h1>
          <div className="mb-2 hidden sm:block"><Sparkline data={spark} w={160} h={48} /></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className={`num rounded-full px-3 py-1 ${totals.dayChange >= 0 ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>
            {fmt(totals.dayChange, { sign: true })} · {pct(totals.dayPct, 2, true)} <span className="text-muted">today</span>
          </span>
          <span className={`num rounded-full bg-panel2 px-3 py-1 ${tone(totals.totalGain)}`}>
            {fmt(totals.totalGain, { sign: true, compact: true })} <span className="text-muted">total gain</span>
          </span>
          <span className="num rounded-full bg-panel2 px-3 py-1">
            <span className={tone(totals.twr)}>{pct(totals.twr, 1, true)}</span> <span className="text-muted">time-weighted</span>
          </span>
          <span className="rounded-full border border-line px-3 py-1 text-muted">
            Health <span className="num text-fg">{health}</span> · Risk <span className="num text-fg">{risk.level}/7</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.k} className="min-w-[128px] bg-panel px-4 py-3">
            <div className="eyebrow">{c.k}</div>
            <div className="num mt-1 text-lg">{c.v}</div>
            <div className="text-[11px] text-dim">{c.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PortfolioTabs({ counts }: { counts: Record<string, string> }) {
  const path = usePathname();
  return (
    <nav className="sticky top-14 z-30 -mx-5 mb-6 flex gap-1 overflow-x-auto border-b border-line bg-ink/80 px-5 backdrop-blur-xl scroll-thin lg:-mx-8 lg:px-8">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm transition ${active ? "text-fg" : "text-muted hover:text-fg"}`}>
            {t.label}
            {counts[t.label] && <span className="num rounded-md bg-panel2 px-1.5 text-[10px] text-dim">{counts[t.label]}</span>}
            {active && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-accent shadow-[0_0_12px_#d4ff3a]" />}
          </Link>
        );
      })}
    </nav>
  );
}
