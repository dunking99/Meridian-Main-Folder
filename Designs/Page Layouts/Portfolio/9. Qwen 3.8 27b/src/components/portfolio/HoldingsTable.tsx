"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Delta from "@/components/ui/Delta";
import Spark from "@/components/ui/Spark";
import { CLASS_LABELS } from "@/lib/format";
import { useCurrency } from "./CurrencyContext";
import type { HoldingRow } from "@/lib/types";

type SortKey = "value" | "weight" | "price" | "avgCost" | "dayChange" | "ret1M" | "pl" | "plPct";

const CLS_OPTS = ["all", "stock", "etf", "bond-fund", "commodity"];

export default function HoldingsTable({
  rows,
  cash,
  total,
}: {
  rows: HoldingRow[];
  cash: { value: number; pct: number };
  total: number;
}) {
  const router = useRouter();
  const { money } = useCurrency();
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("all");
  const [mode, setMode] = useState<"all" | "winners" | "losers">("all");
  const [sort, setSort] = useState<SortKey>("value");
  const [dir, setDir] = useState<-1 | 1>(-1);

  const filtered = useMemo(() => {
    let r = rows;
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((x) => x.id.toLowerCase().includes(s) || x.name.toLowerCase().includes(s) || x.country.toLowerCase().includes(s));
    }
    if (cls !== "all") r = r.filter((x) => x.assetClass === cls);
    if (mode === "winners") r = r.filter((x) => x.plPct > 0);
    if (mode === "losers") r = r.filter((x) => x.plPct <= 0);
    return [...r].sort((a, b) => ((a[sort] as number) - (b[sort] as number)) * dir);
  }, [rows, q, cls, mode, sort, dir]);

  const maxW = Math.max(...rows.map((r) => r.weight));

  const th = (label: string, key: SortKey | null, align: "left" | "right" = "right", hide = "") => (
    <th className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"} ${hide}`}>
      {key ? (
        <button
          onClick={() => {
            if (sort === key) setDir((d) => (d === -1 ? 1 : -1));
            else {
              setSort(key);
              setDir(-1);
            }
          }}
          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold transition-colors ${
            sort === key ? "text-brass2" : "text-tx-3 hover:text-tx-1"
          }`}
        >
          {label}
          {sort === key && <span className="text-[8px]">{dir === -1 ? "▼" : "▲"}</span>}
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-3">{label}</span>
      )}
    </th>
  );

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <label className="relative">
          <svg width="13" height="13" viewBox="0 0 14 14" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tx-3" aria-hidden>
            <circle cx="6" cy="6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9.4 9.4L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol, name, country…"
            className="w-56 rounded-lg border border-line bg-ink-900/70 pl-8 pr-3 py-1.5 text-[12.5px] placeholder:text-tx-3 focus:border-line2 outline-none transition-colors"
          />
        </label>
        <select
          value={cls}
          onChange={(e) => setCls(e.target.value)}
          className="rounded-lg border border-line bg-ink-900/70 px-2.5 py-1.5 text-[12px] text-tx-2 outline-none focus:border-line2"
        >
          {CLS_OPTS.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All classes" : CLASS_LABELS[c] ?? c}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-ink-900/70 p-0.5 ml-auto">
          {(["all", "winners", "losers"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`seg ${mode === m ? (m === "losers" ? "seg-on" : "seg-on") : ""}`} style={mode === m && m !== "all" ? { color: m === "winners" ? "var(--up)" : "var(--down)", borderColor: m === "winners" ? "rgba(63,214,143,.35)" : "rgba(240,101,95,.35)", background: m === "winners" ? "rgba(63,214,143,.08)" : "rgba(240,101,95,.08)" } : undefined}>
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr className="border-b border-line">
              {th("Holding", null, "left")}
              <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold text-tx-3 hidden 2xl:table-cell">Class</th>
              {th("Sector", null, "left", "hidden xl:table-cell")}
              {th("Qty", null, "right")}
              {th("Avg cost", "avgCost", "right", "hidden lg:table-cell")}
              {th("Price", "price", "right")}
              {th("Day", "dayChange", "right")}
              {th("1M", "ret1M", "right")}
              {th("Value", "value", "right")}
              {th("Weight", "weight", "right")}
              {th("Unrealized P&L", "pl", "right")}
              <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold text-tx-3 hidden lg:table-cell">60D</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(`/portfolio/holdings/${r.id}`)}
                className="rowlink border-b border-line/60"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: r.color }} />
                    <div className="min-w-0">
                      <div className="font-mono text-[12.5px] font-semibold tracking-wide">{r.id}</div>
                      <div className="text-[10.5px] text-tx-3 truncate max-w-[180px]">{r.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 hidden 2xl:table-cell">
                  <span className="chip">{CLASS_LABELS[r.assetClass] ?? r.assetClass}</span>
                </td>
                <td className="px-3 py-2.5 hidden xl:table-cell text-[11.5px] text-tx-2">{r.sector}</td>
                <td className="px-3 py-2.5 text-right num text-[12px] text-tx-2">{r.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                <td className="px-3 py-2.5 text-right num text-[12px] text-tx-2 hidden lg:table-cell">${r.avgCost.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right num text-[12px] text-tx-1">${r.price.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right"><Delta v={r.dayChange} /></td>
                <td className="px-3 py-2.5 text-right"><Delta v={r.ret1M} /></td>
                <td className="px-3 py-2.5 text-right num text-[12px] font-medium">{money(r.value, true)}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="h-1 w-14 rounded-full bg-ink-800 overflow-hidden hidden sm:block">
                      <span className="block h-full rounded-full" style={{ width: `${(r.weight / maxW) * 100}%`, background: r.color }} />
                    </span>
                    <span className="num text-[12px] w-11">{(r.weight * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className={`num text-[12px] font-medium ${r.pl >= 0 ? "text-up" : "text-down"}`}>
                    {r.pl >= 0 ? "+" : "−"}
                    {money(Math.abs(r.pl), true)}
                  </div>
                  <div className={`num text-[10px] ${r.pl >= 0 ? "text-up/70" : "text-down/70"}`}>{fmtPctShort(r.plPct)}</div>
                </td>
                <td className="px-3 py-2.5 hidden lg:table-cell">
                  <div className="flex justify-end"><Spark data={r.spark} w={72} h={22} color={r.color} /></div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-[12px]">
              <td className="px-3 py-3 font-medium text-tx-2">Cash</td>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
              <td className="px-3 py-3 text-right num font-medium text-tx-1">{money(cash.value, true)}</td>
              <td className="px-3 py-3 text-right num text-tx-2">{(cash.pct * 100).toFixed(1)}%</td>
              <td className="px-3 py-3 text-right num text-tx-3">—</td>
              <td />
            </tr>
            <tr className="border-t border-line2">
              <td className="px-3 py-3 font-semibold text-tx-1">Total portfolio</td>
              <td colSpan={7} />
              <td className="px-3 py-3 text-right num font-semibold text-brass2">{money(total, true)}</td>
              <td className="px-3 py-3 text-right num text-tx-2">100%</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function fmtPctShort(x: number) {
  return (x >= 0 ? "+" : "") + (x * 100).toFixed(0) + "%";
}
