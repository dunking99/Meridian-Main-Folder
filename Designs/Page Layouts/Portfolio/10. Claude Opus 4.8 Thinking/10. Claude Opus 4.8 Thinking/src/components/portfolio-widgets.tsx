"use client";

import { useState } from "react";
import { ValueChart, Donut } from "@/components/charts";
import { Money, useCurrency } from "@/components/currency";
import { fmtSignedPct, fmtCompact } from "@/lib/format";

type SeriesPt = { date: string; value: number; bench: number };

const RANGES: { key: string; days: number | "ytd" | "all" }[] = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "YTD", days: "ytd" },
  { key: "1Y", days: 365 },
  { key: "MAX", days: "all" },
];

export function RangeChart({ series, height = 280 }: { series: SeriesPt[]; height?: number }) {
  const [range, setRange] = useState("6M");
  const [bench, setBench] = useState(true);

  const startIdx = (() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (r.days === "all") return 0;
    if (r.days === "ytd") {
      const y = new Date().getFullYear();
      const idx = series.findIndex((s) => s.date >= `${y}-01-01`);
      return idx === -1 ? 0 : idx;
    }
    return Math.max(0, series.length - r.days);
  })();

  const sliced = series.slice(startIdx);
  const ret = ((sliced[sliced.length - 1].value - sliced[0].value) / sliced[0].value) * 100;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-1">
        <div className="flex items-baseline gap-2">
          <span className={`tabnum text-lg font-semibold ${ret >= 0 ? "text-pos" : "text-neg"}`}>{fmtSignedPct(ret)}</span>
          <span className="text-xs text-ink-faint">this period</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBench((b) => !b)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition ${bench ? "text-ink-dim" : "text-ink-faint"}`}
          >
            <span className="h-0.5 w-3 rounded" style={{ background: bench ? "#4b5769" : "#2a3341" }} />
            ACWI
          </button>
          <div className="inline-flex rounded-lg border border-line bg-panel p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  range === r.key ? "bg-[#1b2432] text-ink" : "text-ink-faint hover:text-ink-dim"
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <ValueChart series={sliced} height={height} showBench={bench} />
      </div>
    </div>
  );
}

type Alloc = { byAssetClass: Seg[]; bySector: Seg[]; byRegion: Seg[]; byCurrency: Seg[] };
type Seg = { label: string; value: number; weight: number; color: string };

export function AllocationTabs({ alloc }: { alloc: Alloc }) {
  const tabs: { key: string; label: string; segs: Seg[] }[] = [
    { key: "asset", label: "Asset Class", segs: alloc.byAssetClass },
    { key: "sector", label: "Sector", segs: alloc.bySector },
    { key: "region", label: "Region", segs: alloc.byRegion },
    { key: "ccy", label: "Currency", segs: alloc.byCurrency },
  ];
  const [tab, setTab] = useState("asset");
  const active = tabs.find((t) => t.key === tab)!;
  const { rate } = useCurrency();

  return (
    <div className="px-5 pb-5 pt-3">
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              tab === t.key ? "bg-[#1b2432] text-ink" : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          <Donut segments={active.segs} size={168} thickness={19} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {active.segs.slice(0, 7).map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-ink-dim">{s.label}</span>
              <span className="tabnum text-ink-faint">
                {rate.symbol}
                {fmtCompact(s.value * rate.perUsd, 1)}
              </span>
              <span className="tabnum w-12 text-right font-semibold text-ink">{s.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
