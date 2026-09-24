"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Treemap, Sparkline } from "@/components/charts";
import { Money } from "@/components/currency";
import { DeltaPill, Ticker } from "@/components/ui";
import { fmtSignedPct } from "@/lib/format";

export type HRow = {
  symbol: string;
  name: string;
  assetClass: string;
  sector: string;
  region: string;
  currency: string;
  quantity: number;
  currentPrice: number;
  avgCost: number;
  value: number;
  pnl: number;
  pnlPct: number;
  dayPct: number;
  weight: number;
  accent: string;
  beta: number;
  spark: number[];
};

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function heatHex(pct: number, max = 5) {
  const t = clamp(Math.abs(pct) / max, 0, 1);
  if (pct >= 0) return hex(lerp(20, 52, t), lerp(48, 211, t), lerp(40, 153, t));
  return hex(lerp(58, 251, t), lerp(22, 113, t), lerp(32, 133, t));
}

type SortKey = "value" | "weight" | "dayPct" | "pnlPct" | "name";

export function HoldingsExplorer({ rows }: { rows: HRow[] }) {
  const [view, setView] = useState<"table" | "map">("table");
  const [filter, setFilter] = useState<"all" | "win" | "lose">("all");
  const [basis, setBasis] = useState<"day" | "total">("day");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    let r = rows.filter((x) => x.symbol.toLowerCase().includes(q.toLowerCase()) || x.name.toLowerCase().includes(q.toLowerCase()));
    if (filter === "win") r = r.filter((x) => (basis === "day" ? x.dayPct : x.pnlPct) >= 0);
    if (filter === "lose") r = r.filter((x) => (basis === "day" ? x.dayPct : x.pnlPct) < 0);
    const dir = asc ? 1 : -1;
    r = [...r].sort((a, b) => {
      if (sortKey === "name") return a.symbol.localeCompare(b.symbol) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
    return r;
  }, [rows, q, filter, basis, sortKey, asc, rows.length]);

  const treeItems = filtered.map((h) => {
    const perf = basis === "day" ? h.dayPct : h.pnlPct;
    return {
      key: h.symbol,
      label: h.symbol,
      sub: h.sector,
      value: h.value,
      color: heatHex(perf),
      pct: h.weight,
      delta: perf,
      href: `/portfolio/holdings/${h.symbol}`,
    };
  });

  const th = (key: SortKey, label: string, align = "right") => (
    <th
      onClick={() => {
        if (sortKey === key) setAsc((a) => !a);
        else {
          setSortKey(key);
          setAsc(false);
        }
      }}
      className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-ink-dim text-${align}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        {sortKey === key && <span className="text-[8px] text-accent">{asc ? "▲" : "▼"}</span>}
      </span>
    </th>
  );

  const seg = (val: string, cur: string, set: (v: string) => void, label: string, color?: string) => (
    <button
      onClick={() => set(val)}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${cur === val ? "bg-[#1b2432] text-ink" : "text-ink-faint hover:text-ink-dim"}`}
      style={cur === val && color ? { color } : undefined}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search holdings…"
              className="w-28 bg-transparent text-xs text-ink outline-none placeholder:text-ink-faint sm:w-40"
            />
          </div>
          <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
            {seg("all", filter, (v) => setFilter(v as "all"), "All")}
            {seg("win", filter, (v) => setFilter(v as "win"), "Winners", "#34d399")}
            {seg("lose", filter, (v) => setFilter(v as "lose"), "Losers", "#fb7185")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
            {seg("day", basis, (v) => setBasis(v as "day"), "Today")}
            {seg("total", basis, (v) => setBasis(v as "total"), "Total")}
          </div>
          <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
            {seg("table", view, (v) => setView(v as "table"), "Table")}
            {seg("map", view, (v) => setView(v as "map"), "Treemap")}
          </div>
        </div>
      </div>

      {view === "map" ? (
        <div className="px-3 pb-4">
          <Treemap items={treeItems} height={420} />
          <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-ink-faint">
            <span>Loss</span>
            <span className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg,#fb7185,#3a1620,#123026,#34d399)" }} />
            <span>Gain</span>
            <span className="ml-2">· size = weight · color = {basis === "day" ? "today" : "total"} return</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                {th("name", "Holding", "left")}
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                {th("dayPct", "Day")}
                <th className="px-3 py-2 text-center font-medium">30d</th>
                {th("weight", "Weight")}
                {th("value", "Value")}
                {th("pnlPct", "P&L")}
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.symbol} className="group border-b border-line/60 transition hover:bg-panel2/50">
                  <td className="px-5 py-2.5">
                    <Link href={`/portfolio/holdings/${h.symbol}`} className="flex items-center gap-3">
                      <Ticker symbol={h.symbol} accent={h.accent} size={30} />
                      <div className="min-w-0">
                        <div className="font-medium text-ink group-hover:text-accent">{h.symbol}</div>
                        <div className="truncate text-[11px] text-ink-faint">{h.name}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="tabnum px-3 py-2.5 text-right text-ink-faint">{h.quantity < 1 ? h.quantity.toFixed(3) : h.quantity.toLocaleString()}</td>
                  <td className="tabnum px-3 py-2.5 text-right text-ink-dim"><Money value={h.currentPrice} decimals={2} /></td>
                  <td className="px-3 py-2.5 text-right"><DeltaPill pct={h.dayPct} arrow={false} /></td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <Sparkline data={h.spark} color={h.dayPct >= 0 ? "#34d399" : "#fb7185"} width={72} height={24} />
                    </div>
                  </td>
                  <td className="tabnum px-3 py-2.5 text-right text-ink">{h.weight.toFixed(1)}%</td>
                  <td className="tabnum px-3 py-2.5 text-right font-medium text-ink"><Money value={h.value} decimals={0} /></td>
                  <td className="px-3 py-2.5 pr-5 text-right">
                    <div className={`tabnum font-medium ${h.pnl >= 0 ? "text-pos" : "text-neg"}`}><Money value={h.pnl} sign decimals={0} /></div>
                    <div className={`tabnum text-[11px] ${h.pnl >= 0 ? "text-pos/70" : "text-neg/70"}`}>{fmtSignedPct(h.pnlPct)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No holdings match.</p>}
        </div>
      )}
    </div>
  );
}
