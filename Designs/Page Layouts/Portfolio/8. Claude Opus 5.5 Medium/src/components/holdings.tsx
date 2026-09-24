"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Treemap } from "./charts/advanced";
import { Sparkline, heat } from "./charts/basic";
import { useMoney } from "./money";
import { pct, tone, BUCKET_COLORS, SECTOR_COLORS, fmtLocal } from "@/lib/format";
import { SymbolBadge } from "./ui";

export type HRow = {
  symbol: string; name: string; kind: string; bucket: string; sector: string; currency: string; qty: number; price: number; avgCost: number;
  value: number; cost: number; pnl: number; pnlPct: number; dayPct: number; dayChange: number; weight: number; income: number; realized: number;
  r1y: number; rYtd: number; spark: number[]; high52: number; low52: number; country: string;
};

type SortKey = "symbol" | "value" | "weight" | "dayPct" | "pnl" | "pnlPct" | "income" | "r1y";
const BUCKETS = ["All", "US Equity", "Intl Equity", "Fixed Income", "Alternatives"];

export function HoldingsExplorer({ rows, cash, total }: { rows: HRow[]; cash: number; total: number }) {
  const { fmt } = useMoney();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("All");
  const [wl, setWl] = useState<"all" | "win" | "lose">("all");
  const [colorBy, setColorBy] = useState<"dayPct" | "pnlPct" | "r1y" | "sector">("dayPct");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "value", dir: -1 });
  const [ribbonBy, setRibbonBy] = useState<"bucket" | "sector">("bucket");
  const [hoverRibbon, setHoverRibbon] = useState<HRow | null>(null);

  const filtered = useMemo(() => {
    let r = rows.filter((h) => (bucket === "All" || h.bucket === bucket) && (h.symbol + h.name).toLowerCase().includes(q.toLowerCase()));
    if (wl === "win") r = r.filter((h) => h.pnl > 0);
    if (wl === "lose") r = r.filter((h) => h.pnl <= 0);
    return [...r].sort((a, b) => {
      const av = a[sort.k], bv = b[sort.k];
      return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
    });
  }, [rows, q, bucket, wl, sort]);

  const winners = rows.filter((h) => h.pnl > 0).length;
  const sum = (k: "value" | "cost" | "pnl" | "dayChange" | "income") => filtered.reduce((s, h) => s + h[k], 0);
  const colorOf = (h: HRow) => {
    if (colorBy === "sector") return SECTOR_COLORS[h.sector] ?? "#5b6cff";
    const max = colorBy === "dayPct" ? 0.03 : colorBy === "pnlPct" ? 1.2 : 0.6;
    const v = h[colorBy];
    const t = Math.min(1, Math.abs(v) / max);
    return v >= 0 ? `rgba(22,${120 + t * 90},${90 + t * 40},${0.35 + t * 0.6})` : `rgba(${150 + t * 105},40,70,${0.35 + t * 0.6})`;
  };
  const Th = ({ k, label, right = true }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`cursor-pointer select-none pb-2 font-medium hover:text-fg ${right ? "text-right" : "text-left"}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {label}
      {sort.k === k && <span className="ml-1 text-accent">{sort.dir === -1 ? "↓" : "↑"}</span>}
    </th>
  );

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-line bg-ink/50 px-3 lg:max-w-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#565d6e" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter holdings…" className="w-full bg-transparent text-sm outline-none placeholder:text-dim" />
        </div>
        <div className="flex flex-wrap gap-1">
          {BUCKETS.map((b) => (
            <button key={b} onClick={() => setBucket(b)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${bucket === b ? "bg-panel2 text-fg ring-1 ring-line2" : "text-muted hover:text-fg"}`}>
              {b !== "All" && <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLORS[b] }} />}
              {b}
            </button>
          ))}
        </div>
        <div className="ml-auto flex rounded-lg border border-line p-0.5 text-xs">
          {([["all", `All ${rows.length}`], ["win", `Winners ${winners}`], ["lose", `Losers ${rows.length - winners}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setWl(k)} className={`rounded-md px-3 py-1 transition ${wl === k ? (k === "win" ? "bg-pos/15 text-pos" : k === "lose" ? "bg-neg/15 text-neg" : "bg-fg text-ink") : "text-muted"}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* weight ribbon */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="eyebrow">Weight ribbon</span>
            <span className="text-xs text-muted">{hoverRibbon ? <><span className="text-fg">{hoverRibbon.symbol}</span> · {pct(hoverRibbon.weight, 2)} · <span className="num">{fmt(hoverRibbon.value, { compact: true })}</span></> : "Every position, proportional to its weight — hover to inspect"}</span>
          </div>
          <div className="flex gap-1 text-[11px]">
            {(["bucket", "sector"] as const).map((k) => (
              <button key={k} onClick={() => setRibbonBy(k)} className={`rounded-md px-2 py-0.5 capitalize ${ribbonBy === k ? "bg-fg text-ink" : "text-muted"}`}>{k === "bucket" ? "Asset class" : "Sector"}</button>
            ))}
          </div>
        </div>
        <div className="flex h-12 w-full gap-[2px] overflow-hidden rounded-xl">
          {[...rows].sort((a, b) => (ribbonBy === "bucket" ? a.bucket.localeCompare(b.bucket) : a.sector.localeCompare(b.sector)) || b.weight - a.weight).map((h) => {
            const dim = !filtered.includes(h);
            return (
              <Link key={h.symbol} href={`/portfolio/holdings/${h.symbol}`} onMouseEnter={() => setHoverRibbon(h)} onMouseLeave={() => setHoverRibbon(null)}
                className="relative flex items-end justify-center overflow-hidden pb-1 text-[9px] font-semibold text-ink/80 transition-all hover:brightness-125"
                style={{ width: `${h.weight * 100}%`, background: ribbonBy === "bucket" ? BUCKET_COLORS[h.bucket] : SECTOR_COLORS[h.sector] ?? "#5b6cff", opacity: dim ? 0.18 : hoverRibbon && hoverRibbon !== h ? 0.6 : 1 }}>
                {h.weight > 0.035 ? h.symbol : ""}
              </Link>
            );
          })}
          <div className="flex items-end justify-center pb-1 text-[9px] font-semibold text-ink/70" style={{ width: `${(cash / total) * 100}%`, background: BUCKET_COLORS.Cash }}>{cash / total > 0.03 ? "CASH" : ""}</div>
        </div>
      </div>

      {/* treemap */}
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><div className="eyebrow">Treemap</div><div className="text-[15px] font-medium">Sized by value</div></div>
          <div className="flex rounded-lg border border-line p-0.5 text-[11px]">
            {([["dayPct", "Today"], ["pnlPct", "Total P&L"], ["r1y", "1Y price"], ["sector", "Sector"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setColorBy(k)} className={`rounded-md px-2.5 py-1 ${colorBy === k ? "bg-fg text-ink" : "text-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        <Treemap height={400} items={filtered.map((h) => ({ id: h.symbol, value: h.value, color: colorOf(h), label: h.symbol, sub: colorBy === "sector" ? h.sector : pct(h[colorBy], colorBy === "dayPct" ? 2 : 1, true), href: `/portfolio/holdings/${h.symbol}` }))} />
      </div>

      {/* table */}
      <div className="card overflow-x-auto p-0 scroll-thin">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-dim">
              <th className="px-5 pb-2 pt-4 text-left font-medium" onClick={() => setSort((s) => ({ k: "symbol", dir: s.k === "symbol" ? (s.dir === 1 ? -1 : 1) : 1 }))}>Holding</th>
              <th className="pb-2 pt-4 text-right font-medium">Qty</th>
              <th className="pb-2 pt-4 text-right font-medium">Price</th>
              <Th k="dayPct" label="Today" />
              <Th k="value" label="Value" />
              <Th k="weight" label="Weight" />
              <th className="pb-2 pt-4 text-right font-medium">Avg cost</th>
              <Th k="pnl" label="P&L" />
              <Th k="pnlPct" label="P&L %" />
              <Th k="income" label="Income" />
              <th className="pb-2 pt-4 pl-5 text-left font-medium">52w range</th>
              <th className="px-5 pb-2 pt-4 text-right font-medium">60d</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr key={h.symbol} onClick={() => router.push(`/portfolio/holdings/${h.symbol}`)} className="cursor-pointer border-t border-line/70 transition hover:bg-panel2/70">
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <SymbolBadge symbol={h.symbol} color={BUCKET_COLORS[h.bucket]} />
                    <div className="min-w-0">
                      <div className="font-medium">{h.symbol} <span className="ml-1 text-[10px] font-normal text-dim">{h.kind}</span></div>
                      <div className="max-w-[190px] truncate text-[11px] text-dim">{h.name}</div>
                    </div>
                  </div>
                </td>
                <td className="num text-right text-muted">{h.qty < 10 ? h.qty.toFixed(4) : h.qty.toLocaleString()}</td>
                <td className="num text-right">{fmtLocal(h.price, h.currency)}</td>
                <td className="text-right"><span className="num inline-block min-w-[62px] rounded-md px-1.5 py-0.5 text-right" style={{ background: heat(h.dayPct, 0.03, 0.4) }}>{pct(h.dayPct, 2, true)}</span></td>
                <td className="num text-right font-medium">{fmt(h.value)}</td>
                <td className="num text-right text-muted">{pct(h.weight, 1)}</td>
                <td className="num text-right text-muted">{fmtLocal(h.avgCost, h.currency)}</td>
                <td className={`num text-right ${tone(h.pnl)}`}>{fmt(h.pnl, { sign: true })}</td>
                <td className={`num text-right ${tone(h.pnlPct)}`}>{pct(h.pnlPct, 1, true)}</td>
                <td className="num text-right text-muted">{h.income ? fmt(h.income, { compact: true }) : "—"}</td>
                <td className="pl-5">
                  <div className="relative h-1 w-24 rounded-full bg-line">
                    <div className="absolute -top-1 h-3 w-1 rounded-full bg-accent" style={{ left: `${((h.price - h.low52) / (h.high52 - h.low52 || 1)) * 100}%` }} />
                  </div>
                </td>
                <td className="px-5"><div className="flex justify-end"><Sparkline data={h.spark} w={80} h={24} /></div></td>
              </tr>
            ))}
            <tr className="border-t border-line/70 text-muted">
              <td className="px-5 py-2.5"><div className="flex items-center gap-3"><SymbolBadge symbol="CASH" color="#6b7385" /><span>Cash · multi-currency</span></div></td>
              <td colSpan={3} />
              <td className="num text-right">{fmt(cash)}</td>
              <td className="num text-right">{pct(cash / total, 1)}</td>
              <td colSpan={6} />
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-line2 bg-panel2/50 text-sm">
              <td className="px-5 py-3 font-medium">Total · {filtered.length} positions</td>
              <td colSpan={2} />
              <td className={`num text-right ${tone(sum("dayChange"))}`}>{fmt(sum("dayChange"), { compact: true, sign: true })}</td>
              <td className="num text-right font-medium">{fmt(sum("value"))}</td>
              <td className="num text-right text-muted">{pct(sum("value") / total, 1)}</td>
              <td className="num text-right text-muted">{fmt(sum("cost"), { compact: true })}</td>
              <td className={`num text-right ${tone(sum("pnl"))}`}>{fmt(sum("pnl"), { sign: true, compact: true })}</td>
              <td className={`num text-right ${tone(sum("pnl"))}`}>{pct(sum("pnl") / (sum("cost") || 1), 1, true)}</td>
              <td className="num text-right text-muted">{fmt(sum("income"), { compact: true })}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
