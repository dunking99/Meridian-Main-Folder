"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { fmtMoney, fmtPct, fmtPrice, fmtQty, tile } from "@/lib/format";
import { ACCOUNTS, REGION_COLORS, SECTOR_COLORS, SLEEVE_COLORS, type Ccy } from "@/lib/reference";
import { Seg } from "./client";

export type HoldingRow = {
  symbol: string; name: string; color: string; sector: string; sleeve: string; region: string; account: string; currency: string; country: string;
  qty: number; price: number; avgCost: number; value: number; weight: number; dayPct: number; dayChange: number;
  unrealized: number; unrealizedPct: number; realized: number; dividends: number; totalReturn: number; totalReturnPct: number;
  r1m: number | null; rytd: number | null; r1y: number | null; spark: number[]; yield: number;
};

const METRICS = ["1D", "1M", "YTD", "1Y", "Total"] as const;
const SCALE: Record<(typeof METRICS)[number], number> = { "1D": 0.03, "1M": 0.12, YTD: 0.35, "1Y": 0.5, Total: 1.2 };
const GROUPS = ["Sector", "Class", "Region", "Account"] as const;
const ACCOUNT_COLORS: Record<string, string> = { brokerage: "#f0b35b", ira: "#8b9dff", crypto: "#ff9b73" };

function metricOf(r: HoldingRow, m: (typeof METRICS)[number]) {
  return m === "1D" ? r.dayPct : m === "1M" ? r.r1m ?? 0 : m === "YTD" ? r.rytd ?? 0 : m === "1Y" ? r.r1y ?? 0 : r.totalReturnPct;
}
function groupOf(r: HoldingRow, g: (typeof GROUPS)[number]) {
  return g === "Sector" ? r.sector : g === "Class" ? r.sleeve : g === "Region" ? r.region : ACCOUNTS[r.account]?.short ?? r.account;
}
function groupColor(name: string, g: (typeof GROUPS)[number]) {
  if (g === "Sector") return SECTOR_COLORS[name] ?? "#9aa3b2";
  if (g === "Class") return SLEEVE_COLORS[name as keyof typeof SLEEVE_COLORS] ?? "#9aa3b2";
  if (g === "Region") return REGION_COLORS[name as keyof typeof REGION_COLORS] ?? "#9aa3b2";
  const key = Object.entries(ACCOUNTS).find(([, v]) => v.short === name)?.[0] ?? "";
  return ACCOUNT_COLORS[key] ?? "#9aa3b2";
}

type SortKey = "symbol" | "qty" | "price" | "value" | "weight" | "dayPct" | "unrealized" | "unrealizedPct" | "totalReturnPct" | "metric";
type TNode = { name: string; row?: HoldingRow; value?: number; children?: TNode[] };

export function HoldingsExplorer({ rows, ccy, cash }: { rows: HoldingRow[]; ccy: Ccy; cash: number }) {
  const router = useRouter();
  const [show, setShow] = useState(0);
  const [mi, setMi] = useState(0);
  const [gi, setGi] = useState(0);
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: "value", d: -1 });
  const metric = METRICS[mi];
  const group = GROUPS[gi];

  const filtered = useMemo(() => rows.filter((r) => {
    const v = metricOf(r, metric);
    if (show === 1 && v <= 0) return false;
    if (show === 2 && v >= 0) return false;
    if (q && !`${r.symbol} ${r.name} ${r.sector}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, show, q, metric]);

  const W = 1200, H = 540;
  const layout = useMemo(() => {
    const groups = new Map<string, HoldingRow[]>();
    for (const r of filtered) {
      const g = groupOf(r, group);
      groups.set(g, [...(groups.get(g) ?? []), r]);
    }
    const data: TNode = { name: "root", children: [...groups.entries()].map(([name, list]) => ({ name, children: list.map((r) => ({ name: r.symbol, row: r, value: r.value })) })) };
    const root = hierarchy<TNode>(data).sum((d) => d.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const laid = treemap<TNode>().tile(treemapSquarify.ratio(1.15)).size([W, H]).paddingOuter(3).paddingTop((d) => (d.depth === 1 ? 20 : 0)).paddingInner(2).round(true)(root);
    return { leaves: laid.leaves(), groups: laid.children ?? [] };
  }, [filtered, group]);

  const ribbon = useMemo(() => {
    const byG = new Map<string, HoldingRow[]>();
    for (const r of rows) byG.set(groupOf(r, group), [...(byG.get(groupOf(r, group)) ?? []), r]);
    return [...byG.entries()].map(([g, list]) => ({ g, list: list.sort((a, b) => b.value - a.value), w: list.reduce((a, r) => a + r.weight, 0) })).sort((a, b) => b.w - a.w);
  }, [rows, group]);

  const sorted = useMemo(() => {
    const val = (r: HoldingRow) => (sort.k === "metric" ? metricOf(r, metric) : sort.k === "symbol" ? r.symbol : r[sort.k]);
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      return (typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * sort.d;
    });
  }, [filtered, sort, metric]);

  const winners = rows.filter((r) => metricOf(r, metric) > 0);
  const losers = rows.filter((r) => metricOf(r, metric) < 0);
  const pnlOf = (r: HoldingRow) => (metric === "Total" ? r.totalReturn : metric === "1D" ? r.dayChange : r.value - r.value / (1 + metricOf(r, metric)));
  const winSum = winners.reduce((a, r) => a + pnlOf(r), 0);
  const loseSum = losers.reduce((a, r) => a + pnlOf(r), 0);
  const tot = filtered.reduce((a, r) => ({ value: a.value + r.value, day: a.day + r.dayChange, un: a.un + r.unrealized, w: a.w + r.weight }), { value: 0, day: 0, un: 0, w: 0 });
  const hovered = hover ? rows.find((r) => r.symbol === hover) : null;
  const bookTotal = rows.reduce((a, r) => a + r.value, 0) / Math.max(1e-9, rows.reduce((a, r) => a + r.weight, 0));

  const th = (k: SortKey, label: string, right = true) => (
    <th className={`cursor-pointer select-none pb-2 font-normal transition-colors hover:text-mist-200 ${right ? "text-right" : "text-left"}`} onClick={() => setSort((s) => ({ k, d: s.k === k ? (s.d === 1 ? -1 : 1) : -1 }))}>
      {label}{sort.k === k ? (sort.d === -1 ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="space-y-4">
      {/* weight ribbon */}
      <section className="card rise px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><span className="num text-[10px] text-gold-400/80">01</span><span className="h-px w-3 bg-gold-400/30" /><h3 className="label !text-mist-300">Weight ribbon · every position, to scale</h3></div>
          <Seg options={[...GROUPS]} value={gi} onChange={setGi} />
        </div>
        <div className="flex h-14 w-full gap-[2px] overflow-hidden rounded-lg">
          {ribbon.flatMap(({ g, list }) =>
            list.map((r, i) => (
              <Link
                key={r.symbol}
                href={`/portfolio/holdings/${encodeURIComponent(r.symbol)}`}
                onMouseEnter={() => setHover(r.symbol)}
                onMouseLeave={() => setHover(null)}
                className="relative flex min-w-[3px] flex-col justify-end overflow-hidden transition-all duration-200"
                style={{ width: `${r.weight * 100}%`, background: groupColor(g, group), opacity: hover && hover !== r.symbol ? 0.35 : i % 2 ? 0.78 : 0.95 }}
              >
                {r.weight > 0.022 && <span className="num px-1.5 pb-1 text-[10px] font-semibold text-ink-950/85">{r.symbol}</span>}
              </Link>
            )),
          )}
          <div className="flex min-w-[3px] items-end bg-white/10" style={{ width: `${(cash / bookTotal) * 100}%` }} title="Cash">
            <span className="num px-1.5 pb-1 text-[10px] text-mist-300">CASH</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
          {ribbon.map(({ g, w }) => (
            <span key={g} className="flex items-center gap-1.5 text-mist-400"><span className="h-2 w-2 rounded-sm" style={{ background: groupColor(g, group) }} />{g}<span className="num text-mist-200">{fmtPct(w, 1, false)}</span></span>
          ))}
        </div>
      </section>

      {/* controls */}
      <div className="card rise flex flex-wrap items-center gap-3 px-4 py-3">
        <Seg options={["All", `Winners ${winners.length}`, `Losers ${losers.length}`]} value={show} onChange={setShow} />
        <div className="flex items-center gap-2"><span className="label">Colour by</span><Seg options={[...METRICS]} value={mi} onChange={setMi} /></div>
        <div className="hidden h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-white/[0.05] lg:flex" title="Winners vs losers P&L for the selected period">
          <div className="h-full bg-up" style={{ width: `${(winSum / (winSum - loseSum || 1)) * 100}%` }} />
          <div className="h-full bg-down" style={{ width: `${(-loseSum / (winSum - loseSum || 1)) * 100}%` }} />
        </div>
        <span className="hidden text-[11px] lg:inline"><span className="money num text-up">{fmtMoney(winSum, ccy, { compact: true, sign: true })}</span> <span className="text-mist-500">/</span> <span className="money num text-down">{fmtMoney(loseSum, ccy, { compact: true })}</span></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search holdings…" className="ml-auto w-44 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12px] text-mist-100 outline-none ring-1 ring-inset ring-white/[0.08] placeholder:text-mist-500 focus:ring-gold-400/40" />
      </div>

      {/* treemap */}
      <section className="card rise overflow-hidden p-3">
        <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
          {layout.groups.map((g) => (
            <div key={g.data.name} className="pointer-events-none absolute" style={{ left: `${(g.x0 / W) * 100}%`, top: `${(g.y0 / H) * 100}%`, width: `${((g.x1 - g.x0) / W) * 100}%`, height: `${((g.y1 - g.y0) / H) * 100}%` }}>
              <div className="flex items-center gap-1.5 truncate px-1 pt-[3px] text-[10px] uppercase tracking-[0.12em] text-mist-400">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: groupColor(g.data.name, group) }} />
                <span className="truncate">{g.data.name}</span>
                <span className="num text-mist-500">{fmtPct((g.value ?? 0) / bookTotal, 1, false)}</span>
              </div>
            </div>
          ))}
          {layout.leaves.map((l) => {
            const r = l.data.row!;
            const v = metricOf(r, metric);
            const w = l.x1 - l.x0, h = l.y1 - l.y0;
            const big = w > 90 && h > 56;
            const mid = w > 46 && h > 30;
            return (
              <button
                key={r.symbol}
                type="button"
                onClick={() => router.push(`/portfolio/holdings/${encodeURIComponent(r.symbol)}`)}
                onMouseEnter={() => setHover(r.symbol)}
                onMouseLeave={() => setHover(null)}
                className={`absolute overflow-hidden rounded-[5px] text-left transition-all duration-200 ${hover === r.symbol ? "z-10 ring-2 ring-white/80" : "ring-1 ring-black/30"}`}
                style={{ left: `${(l.x0 / W) * 100}%`, top: `${(l.y0 / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%`, background: tile(v, SCALE[metric]) }}
              >
                {mid && (
                  <div className="flex h-full flex-col justify-between p-1.5 sm:p-2">
                    <div className="num text-[11px] font-semibold leading-none text-white sm:text-[13px]">{r.symbol}</div>
                    <div>
                      <div className="num text-[10px] font-medium leading-none text-white/90 sm:text-[12px]">{fmtPct(v, 1)}</div>
                      {big && <div className="money num mt-1 text-[10px] leading-none text-white/60">{fmtMoney(r.value, ccy, { compact: true })}</div>}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
          {hovered && (
            <div className="pointer-events-none absolute right-2 top-2 z-20 w-56 rounded-xl border border-white/10 bg-ink-850/95 p-3 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between"><span className="num text-[13px] font-semibold text-white">{hovered.symbol}</span><span className="text-[10.5px] text-mist-400">{hovered.sector}</span></div>
              <div className="truncate text-[11px] text-mist-400">{hovered.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
                <span className="text-mist-500">Value</span><span className="money num text-right text-mist-100">{fmtMoney(hovered.value, ccy, { compact: true })}</span>
                <span className="text-mist-500">Weight</span><span className="num text-right text-mist-100">{fmtPct(hovered.weight, 2, false)}</span>
                <span className="text-mist-500">{metric}</span><span className={`num text-right ${metricOf(hovered, metric) >= 0 ? "text-up" : "text-down"}`}>{fmtPct(metricOf(hovered, metric), 2)}</span>
                <span className="text-mist-500">Unrealized</span><span className={`money num text-right ${hovered.unrealized >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(hovered.unrealized, ccy, { compact: true, sign: true })}</span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 px-1 text-[10px] text-mist-500">
          <span className="num">−{Math.round(SCALE[metric] * 100)}%</span>
          <span className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${tile(-1, 1)}, ${tile(0, 1)}, ${tile(1, 1)})` }} />
          <span className="num">+{Math.round(SCALE[metric] * 100)}%</span>
        </div>
      </section>

      {/* table */}
      <section className="card rise overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-[12.5px]">
            <thead>
              <tr className="label border-b border-white/[0.06]">
                <th className="px-5 pb-2 pt-4 text-left font-normal" onClick={() => setSort((s) => ({ k: "symbol", d: s.k === "symbol" ? (s.d === 1 ? -1 : 1) : 1 }))}>Holding</th>
                {th("qty", "Qty")}
                {th("price", "Price")}
                <th className="pb-2 text-right font-normal">Avg cost</th>
                {th("value", "Value")}
                {th("weight", "Weight")}
                {th("dayPct", "Today")}
                {th("metric", metric === "Total" ? "Total" : metric)}
                {th("unrealized", "Unrealized")}
                {th("totalReturnPct", "Total return")}
                <th className="px-5 pb-2 text-right font-normal">1Y</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.symbol}
                  onClick={() => router.push(`/portfolio/holdings/${encodeURIComponent(r.symbol)}`)}
                  onMouseEnter={() => setHover(r.symbol)}
                  onMouseLeave={() => setHover(null)}
                  className={`cursor-pointer border-t border-white/[0.04] transition-colors ${hover === r.symbol ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                >
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="h-7 w-1 rounded-full" style={{ background: groupColor(groupOf(r, group), group) }} />
                      <span className="min-w-0">
                        <Link href={`/portfolio/holdings/${encodeURIComponent(r.symbol)}`} className="num block text-mist-100 hover:text-gold-300" onClick={(e) => e.stopPropagation()}>{r.symbol}</Link>
                        <span className="block max-w-[180px] truncate text-[11px] text-mist-500">{r.name}</span>
                      </span>
                    </div>
                  </td>
                  <td className="num py-2.5 text-right text-mist-300">{fmtQty(r.qty)}</td>
                  <td className="num py-2.5 text-right text-mist-200">{fmtPrice(r.price, r.currency)}</td>
                  <td className="num py-2.5 text-right text-mist-500">{fmtPrice(r.avgCost, r.currency)}</td>
                  <td className="money num py-2.5 text-right text-mist-100">{fmtMoney(r.value, ccy, { dp: 0 })}</td>
                  <td className="py-2.5 pl-4 text-right"><div className="ml-auto flex w-24 items-center gap-2"><div className="h-1 flex-1 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.min(100, r.weight * 400)}%` }} /></div><span className="num text-mist-300">{fmtPct(r.weight, 1, false)}</span></div></td>
                  <td className={`num py-2.5 text-right ${r.dayPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.dayPct, 2)}</td>
                  <td className={`num py-2.5 text-right ${metricOf(r, metric) >= 0 ? "text-up" : "text-down"}`}>{fmtPct(metricOf(r, metric), 1)}</td>
                  <td className="py-2.5 text-right"><span className={`money num ${r.unrealized >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(r.unrealized, ccy, { compact: true, sign: true })}</span><span className="num block text-[10.5px] text-mist-500">{fmtPct(r.unrealizedPct, 1)}</span></td>
                  <td className={`num py-2.5 text-right ${r.totalReturnPct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.totalReturnPct, 1)}</td>
                  <td className="px-5 py-2.5"><MiniSpark values={r.spark} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/[0.1] bg-white/[0.02] text-[12px]">
                <td className="label px-5 py-3">{filtered.length} positions</td>
                <td colSpan={3} />
                <td className="money num py-3 text-right text-white">{fmtMoney(tot.value, ccy, { dp: 0 })}</td>
                <td className="num py-3 text-right text-mist-300">{fmtPct(tot.w, 1, false)}</td>
                <td className={`money num py-3 text-right ${tot.day >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(tot.day, ccy, { compact: true, sign: true })}</td>
                <td />
                <td className={`money num py-3 text-right ${tot.un >= 0 ? "text-up" : "text-down"}`}>{fmtMoney(tot.un, ccy, { compact: true, sign: true })}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniSpark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 84, h = 24;
  const min = Math.min(...values), max = Math.max(...values), s = max - min || 1;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - 2 - ((v - min) / s) * (h - 4)).toFixed(1)}`).join("");
  const c = values[values.length - 1] >= values[0] ? "#3ee0a1" : "#ff6b6b";
  return (
    <svg width={w} height={h} className="ml-auto block" aria-hidden>
      <path d={d} fill="none" stroke={c} strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  );
}
