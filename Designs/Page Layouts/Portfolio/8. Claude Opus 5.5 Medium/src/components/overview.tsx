"use client";

import { useState } from "react";
import Link from "next/link";
import { TimeChart } from "./charts/advanced";
import { Sparkline } from "./charts/basic";
import { useMoney, Money } from "./money";
import { pct, tone, BUCKET_COLORS, SECTOR_COLORS, shortDate, timeAgo } from "@/lib/format";
import { SymbolBadge, Pill } from "./ui";

type H = { symbol: string; name: string; bucket: string; sector: string; value: number; weight: number; dayPct: number; dayChange: number; r1m: number; rYtd: number; r1y: number; pnl: number; pnlPct: number; qty: number; price: number; currency: string; spark: number[] };

export function PortfolioChart({ dates, value, invested, idx, bidx }: { dates: string[]; value: number[]; invested: number[]; idx: number[]; bidx: number[] }) {
  const [mode, setMode] = useState<"value" | "return">("value");
  const toggle = (
    <div className="flex rounded-full border border-line bg-ink/40 p-0.5 text-[11px]">
      {(["value", "return"] as const).map((m) => (
        <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 ${mode === m ? "bg-accent font-medium text-ink" : "text-muted hover:text-fg"}`}>
          {m === "value" ? "Value" : "Return vs ACWI"}
        </button>
      ))}
    </div>
  );
  return mode === "value" ? (
    <TimeChart key="v" dates={dates} height={300} extraControls={toggle} series={[
      { key: "value", label: "Portfolio", values: value, color: "#d4ff3a", kind: "area" },
      { key: "invested", label: "Net invested", values: invested, color: "#8a91a2", kind: "dashed" },
    ]} />
  ) : (
    <TimeChart key="r" dates={dates} height={300} rebase format="pct" zero extraControls={toggle} series={[
      { key: "idx", label: "Portfolio (TWR)", values: idx, color: "#d4ff3a", kind: "area" },
      { key: "bidx", label: "MSCI ACWI", values: bidx, color: "#8f7cff", kind: "line" },
    ]} />
  );
}

export function Pulse({ recent, up, down, above50, total, newsSentiment, vol21, vol1y, currentDD }: { recent: number[]; up: number; down: number; above50: number; total: number; newsSentiment: number; vol21: number; vol1y: number; currentDD: number }) {
  const max = Math.max(...recent.map(Math.abs));
  const regime = vol21 / vol1y;
  const regimeLabel = regime < 0.8 ? "Calm" : regime < 1.2 ? "Normal" : "Elevated";
  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] text-dim"><span>Last 40 sessions</span><span className="num">today →</span></div>
        <div className="relative flex h-20 items-center gap-[2px]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-line2" />
          {recent.map((r, i) => (
            <div key={i} className="relative flex h-full flex-1 flex-col justify-center" title={pct(r, 2, true)}>
              <div className="w-full rounded-[2px]" style={{ height: `${(Math.abs(r) / max) * 50}%`, background: r >= 0 ? "#2fe39b" : "#ff5a78", transform: `translateY(${r >= 0 ? "-50%" : "50%"})`, opacity: 0.35 + (i / recent.length) * 0.65, boxShadow: i === recent.length - 1 ? `0 0 10px ${r >= 0 ? "#2fe39b" : "#ff5a78"}` : undefined }} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Breadth today</span><span className="num"><span className="text-pos">{up}↑</span> <span className="text-neg">{down}↓</span></span></div>
        <div className="flex h-2 overflow-hidden rounded-full">
          <div className="bg-pos" style={{ width: `${(up / total) * 100}%` }} />
          <div className="bg-neg" style={{ width: `${(down / total) * 100}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <PulseCell label="Trend" value={`${above50}/${total}`} sub="above 50-day avg" good={above50 / total > 0.5} />
        <PulseCell label="Vol regime" value={regimeLabel} sub={`${pct(vol21, 0)} vs ${pct(vol1y, 0)} 1Y`} good={regime < 1.2} />
        <PulseCell label="News mood" value={newsSentiment > 0.15 ? "Positive" : newsSentiment < -0.15 ? "Negative" : "Mixed"} sub={`${newsSentiment >= 0 ? "+" : ""}${newsSentiment.toFixed(2)} exposure-weighted`} good={newsSentiment >= 0} />
        <PulseCell label="From peak" value={pct(currentDD, 1)} sub={currentDD > -0.02 ? "near all-time high" : "in drawdown"} good={currentDD > -0.05} />
      </div>
    </div>
  );
}

function PulseCell({ label, value, sub, good }: { label: string; value: string; sub: string; good: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-ink/30 p-3">
      <div className="flex items-center justify-between"><span className="eyebrow">{label}</span><span className={`h-1.5 w-1.5 rounded-full ${good ? "bg-pos" : "bg-amber"}`} /></div>
      <div className="num mt-1 text-base">{value}</div>
      <div className="truncate text-[10.5px] text-dim">{sub}</div>
    </div>
  );
}

export function LeadersLaggards({ holdings }: { holdings: H[] }) {
  const [p, setP] = useState<"dayPct" | "r1m" | "rYtd">("dayPct");
  const sorted = [...holdings].sort((a, b) => b[p] - a[p]);
  const lead = sorted.slice(0, 4), lag = sorted.slice(-4).reverse();
  const max = Math.max(...sorted.map((h) => Math.abs(h[p])));
  const Row = ({ h }: { h: H }) => (
    <Link href={`/portfolio/holdings/${h.symbol}`} className="group grid grid-cols-[48px_1fr_60px] items-center gap-2 py-1.5 text-xs">
      <span className="font-semibold group-hover:text-accent">{h.symbol}</span>
      <div className="h-1.5 rounded-full bg-line">
        <div className={`h-full rounded-full ${h[p] >= 0 ? "bg-pos" : "bg-neg"}`} style={{ width: `${(Math.abs(h[p]) / max) * 100}%` }} />
      </div>
      <span className={`num text-right ${tone(h[p])}`}>{pct(h[p], 1, true)}</span>
    </Link>
  );
  return (
    <div>
      <div className="mb-3 flex gap-1 text-[11px]">
        {([["dayPct", "1D"], ["r1m", "1M"], ["rYtd", "YTD"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setP(k)} className={`num rounded-md px-2 py-0.5 ${p === k ? "bg-fg text-ink" : "text-muted hover:text-fg"}`}>{l}</button>
        ))}
      </div>
      <div className="eyebrow mb-1 text-pos/80">Leaders</div>
      {lead.map((h) => <Row key={h.symbol} h={h} />)}
      <div className="my-2 h-px bg-line" />
      <div className="eyebrow mb-1 text-neg/80">Laggards</div>
      {lag.map((h) => <Row key={h.symbol} h={h} />)}
    </div>
  );
}

export function TopHoldings({ holdings }: { holdings: H[] }) {
  const { fmt } = useMoney();
  return (
    <div className="-mx-5 overflow-x-auto scroll-thin">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-wider text-dim">
            <th className="px-5 pb-2 font-medium">Holding</th>
            <th className="pb-2 text-right font-medium">Value</th>
            <th className="pb-2 pl-4 font-medium">Weight</th>
            <th className="pb-2 text-right font-medium">Today</th>
            <th className="pb-2 text-right font-medium">P&L</th>
            <th className="px-5 pb-2 text-right font-medium">60d</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.symbol} className="border-t border-line/70 transition hover:bg-panel2/60">
              <td className="px-5 py-2.5">
                <Link href={`/portfolio/holdings/${h.symbol}`} className="flex items-center gap-3">
                  <SymbolBadge symbol={h.symbol} color={BUCKET_COLORS[h.bucket]} />
                  <div className="min-w-0">
                    <div className="font-medium">{h.symbol}</div>
                    <div className="truncate text-[11px] text-dim">{h.name}</div>
                  </div>
                </Link>
              </td>
              <td className="num text-right">{fmt(h.value)}</td>
              <td className="pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(h.weight / holdings[0].weight) * 100}%`, background: BUCKET_COLORS[h.bucket] }} /></div>
                  <span className="num text-xs text-muted">{pct(h.weight)}</span>
                </div>
              </td>
              <td className={`num text-right ${tone(h.dayPct)}`}>{pct(h.dayPct, 2, true)}</td>
              <td className="text-right">
                <div className={`num ${tone(h.pnl)}`}>{fmt(h.pnl, { compact: true, sign: true })}</div>
                <div className={`num text-[11px] ${tone(h.pnlPct)} opacity-70`}>{pct(h.pnlPct, 1, true)}</div>
              </td>
              <td className="px-5 text-right"><div className="flex justify-end"><Sparkline data={h.spark} w={84} h={26} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type NewsItem = { id: number; publishedAt: string; source: string; headline: string; summary: string; sentiment: number; category: string; exposure: number; parts: { symbol: string; direct: number; indirect: number; via: string[] }[] };

export function NewsList({ items, totalValue, compact = false }: { items: NewsItem[]; totalValue: number; compact?: boolean }) {
  return (
    <div className="space-y-1">
      {items.map((n) => {
        const s = n.sentiment;
        const col = s > 0.15 ? "#2fe39b" : s < -0.15 ? "#ff5a78" : "#8a91a2";
        return (
          <article key={n.id} className="group relative rounded-xl p-3 transition hover:bg-panel2/60">
            <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full" style={{ background: col }} />
            <div className="mb-1 flex items-center gap-2 pl-2 text-[10.5px] text-dim">
              <span className="font-medium text-muted">{n.source}</span>·<span>{timeAgo(n.publishedAt)}</span>·<span>{n.category}</span>
            </div>
            <h3 className="pl-2 text-[13.5px] leading-snug">{n.headline}</h3>
            {!compact && <p className="mt-1 pl-2 text-xs leading-relaxed text-muted">{n.summary}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-2">
              {n.parts.map((p) => (
                <span key={p.symbol} className="inline-flex items-center gap-1 rounded-md border border-line bg-ink/40 px-1.5 py-0.5 text-[10.5px]">
                  <span className="font-semibold">{p.symbol}</span>
                  {p.direct > 0 && <span className="num text-accent">{pct(p.direct, 1)}</span>}
                  {p.indirect > 0 && <span className="num text-violet" title={`via ${p.via.join(", ")}`}>+{pct(p.indirect, 1)} via {p.via.slice(0, 2).join("/")}</span>}
                  {p.direct + p.indirect === 0 && <span className="text-dim">not held</span>}
                </span>
              ))}
              {n.exposure > 0 && (
                <span className="ml-auto">
                  <Pill color={col}>Exposure <Money usd={n.exposure * totalValue} compact /></Pill>
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

type Ev = { id: number; date: string; symbol: string | null; kind: string; title: string; detail: string | null; position: number | null; weight: number | null };
const EV_COL: Record<string, string> = { Earnings: "#8f7cff", Dividend: "#2fe39b", Macro: "#ffb547", Meeting: "#3fd0ff", Split: "#ff7ad9" };

export function EventsTimeline({ events, asOf, limit = 8 }: { events: Ev[]; asOf: string; limit?: number }) {
  const { fmt } = useMoney();
  const today = new Date(asOf + "T00:00:00Z").getTime();
  return (
    <div className="relative">
      <div className="absolute bottom-2 left-[43px] top-2 w-px bg-gradient-to-b from-accent/60 via-line2 to-transparent" />
      <div className="space-y-2.5">
        {events.slice(0, limit).map((e) => {
          const days = Math.max(0, Math.round((new Date(e.date + "T00:00:00Z").getTime() - today) / 86400000));
          return (
            <div key={e.id} className="grid grid-cols-[36px_14px_1fr] items-start gap-2">
              <div className="text-right">
                <div className="num text-[11px] leading-tight">{shortDate(e.date).split(" ")[1]}</div>
                <div className="text-[9px] uppercase text-dim">{shortDate(e.date).split(" ")[0]}</div>
              </div>
              <div className="mt-1 h-3 w-3 rounded-full border-2 border-ink" style={{ background: EV_COL[e.kind] ?? "#8a91a2" }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {e.symbol ? <Link href={`/portfolio/holdings/${e.symbol}`} className="truncate text-[13px] hover:text-accent">{e.title}</Link> : <span className="truncate text-[13px]">{e.title}</span>}
                </div>
                <div className="flex items-center gap-2 text-[10.5px] text-dim">
                  <span style={{ color: EV_COL[e.kind] }}>{e.kind}</span>
                  <span>in {days}d</span>
                  {e.position ? <span className="num">· your stake {fmt(e.position, { compact: true })}</span> : e.symbol === null ? <span>· whole book</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SectorDot({ sector }: { sector: string }) {
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: SECTOR_COLORS[sector] ?? "#8a91a2" }} />;
}
