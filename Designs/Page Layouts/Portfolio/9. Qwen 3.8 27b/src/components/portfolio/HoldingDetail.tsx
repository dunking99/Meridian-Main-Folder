"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useCurrency } from "./CurrencyContext";
import Panel from "@/components/ui/Panel";
import Reveal from "@/components/ui/Reveal";
import Skel from "@/components/ui/Skel";
import Delta from "@/components/ui/Delta";
import Donut from "@/components/charts/Donut";
import LinePanel from "@/components/charts/LinePanel";
import NewsCard from "./NewsCard";
import { CLASS_LABELS } from "@/lib/format";
import type { HoldingDetail as D } from "@/lib/types";

const RANGES = [
  { label: "1Y", n: 252 },
  { label: "3Y", n: 756 },
  { label: "5Y", n: null },
];

export default function HoldingDetail({ id }: { id: string }) {
  const { data, error } = useApi<D>(`/api/portfolio/holdings/${id}`);
  const { money } = useCurrency();
  const [range, setRange] = useState("1Y");

  const series = useMemo(() => {
    if (!data) return [];
    const n = RANGES.find((r) => r.label === range)?.n ?? null;
    const s = n ? data.series.slice(-n) : data.series;
    if (!s.length) return [];
    const p0 = s[0].close || 1;
    const b0 = s[0].bench || 1;
    return s.map((p) => ({ t: p.t, px: (p.close / p0) * 100, bench: (p.bench / b0) * 100 }));
  }, [data, range]);

  if (error) {
    return (
      <div className="panel px-6 py-10 text-center">
        <div className="font-display text-xl">Position not found</div>
        <Link href="/portfolio/holdings" className="text-brass2 text-sm mt-2 inline-block hover:text-brass">
          ← back to holdings
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skel className="h-40 w-full" />
        <div className="grid grid-cols-12 gap-4">
          <Skel className="col-span-12 xl:col-span-8 h-80" />
          <Skel className="col-span-12 xl:col-span-4 h-80" />
        </div>
      </div>
    );
  }

  const h = data.holding;
  const st = data.stats;
  const pos = data.position;
  const bookSet = new Set([h.id, ...data.fundsHolding.map((f) => f.id)]);

  return (
    <div className="space-y-4">
      <Reveal>
        <section className="panel panel-hero px-6 py-6 lg:px-8">
          <Link href="/portfolio/holdings" className="inline-flex items-center gap-1.5 text-[11.5px] text-tx-3 hover:text-brass2 transition-colors">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M8.5 3L5 7l3.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All holdings
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-[4px]" style={{ background: h.color }} />
                <h2 className="font-display text-[42px] leading-none tracking-tight">{h.id}</h2>
              </div>
              <p className="text-tx-2 mt-2.5 text-[13px] max-w-2xl">
                <span className="text-tx-1 font-medium">{h.name}</span>
                <span className="text-tx-3"> — {h.description}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip">{CLASS_LABELS[h.assetClass]}</span>
                <span className="chip">{h.sector}</span>
                <span className="chip">{h.country} · {h.countryIso}</span>
                <span className="chip">{h.currency}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="num text-[34px] leading-none">${h.price.toFixed(2)}</div>
              <div className="mt-2 flex justify-end"><Delta v={h.dayChange} /></div>
              <div className="mt-2.5 flex justify-end gap-1.5">
                {h.pe != null && <span className="chip">P/E {h.pe.toFixed(1)}</span>}
                {h.divYield != null && <span className="chip">div {h.divYield.toFixed(1)}%</span>}
                {h.mcapB != null && <span className="chip">mcap ${h.mcapB}B</span>}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-8">
          <Panel
            kicker="Price"
            title="Performance"
            className="h-full"
            right={
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r.label} onClick={() => setRange(r.label)} className={`seg ${range === r.label ? "seg-on" : ""}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            }
          >
            <LinePanel
              data={series}
              lines={[
                { key: "px", label: h.id, color: h.color, width: 2 },
                { key: "bench", label: "S&P 500", color: "#5F6D79", dash: true },
              ]}
              height={300}
              fmt={(v) => v.toFixed(0)}
              areaKey="px"
            />
            <div className="mt-1 text-[10.5px] text-tx-3">indexed to 100 at start of range · dashed: S&P 500</div>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-4" delay={80}>
          <Panel kicker="Position" title="Your stake" className="h-full" bodyClassName="px-5 pb-4 pt-1">
            {[
              { l: "Quantity", v: h.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 }) },
              { l: "Avg cost", v: `$${h.avgCost.toFixed(2)}` },
              { l: "Cost basis", v: money(pos.cost, true) },
              { l: "Market value", v: money(pos.value, true), strong: true },
            ].map((r) => (
              <div key={r.l} className="flex justify-between items-center py-2.5 border-b border-line/60 text-[12.5px]">
                <span className="text-tx-2">{r.l}</span>
                <span className={`num ${r.strong ? "font-semibold text-brass2 text-[13.5px]" : "text-tx-1"}`}>{r.v}</span>
              </div>
            ))}
            <div className="py-2.5 border-b border-line/60">
              <div className="flex justify-between text-[12.5px] mb-1.5">
                <span className="text-tx-2">Weight in book</span>
                <span className="num text-tx-1">{(pos.weight * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pos.weight * 100 * 5)}%`, background: h.color }} />
              </div>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-line/60 text-[12.5px]">
              <span className="text-tx-2">Unrealized P&L</span>
              <span className={`num font-medium ${pos.pl >= 0 ? "text-up" : "text-down"}`}>
                {pos.pl >= 0 ? "+" : "−"}{money(Math.abs(pos.pl), true)} ({(pos.plPct >= 0 ? "+" : "") + (pos.plPct * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 text-[12.5px]">
              <span className="text-tx-2">Share of book P&L</span>
              <span className="num text-tx-1">{pos.contributionPct.toFixed(0)}%</span>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* stat strip */}
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5">
          {[
            { l: "1M", v: <Delta v={st.ret1M} /> },
            { l: "3M", v: <Delta v={st.ret3M} /> },
            { l: "6M", v: <Delta v={st.ret6M} /> },
            { l: "1Y", v: <Delta v={st.ret1Y} /> },
            { l: "52W vol", v: <span className="num text-[15px] text-tx-1">{(st.vol52w * 100).toFixed(1)}%</span> },
            { l: "Beta", v: <span className="num text-[15px] text-tx-1">{st.beta.toFixed(2)}</span> },
            { l: "Corr to book", v: <span className="num text-[15px] text-tx-1">{st.corrToBook.toFixed(2)}</span> },
          ].map((t) => (
            <div key={t.l} className="panel px-4 py-3">
              <div className="text-[9.5px] uppercase tracking-[0.15em] text-tx-3 font-semibold">{t.l}</div>
              <div className="mt-1.5">{t.v}</div>
            </div>
          ))}
          <div className="panel px-4 py-3 col-span-2 md:col-span-1">
            <div className="text-[9.5px] uppercase tracking-[0.15em] text-tx-3 font-semibold">52W range</div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-down/60 via-ink-800 to-up/60 mt-3">
              <span
                className="absolute -top-[3px] h-4 w-[3px] rounded-full bg-brass2"
                style={{ left: `calc(${(st.posIn52 * 100).toFixed(1)}% - 1px)` }}
              />
            </div>
            <div className="flex justify-between num text-[9.5px] text-tx-3 mt-1.5">
              <span>${st.lo52.toFixed(0)}</span>
              <span>${st.hi52.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-4">
          <Panel kicker="Cross-reference" title="Held inside your funds" className="h-full">
            {data.fundsHolding.length === 0 ? (
              <p className="text-[12.5px] text-tx-2 leading-relaxed">
                Not wrapped in any of your ETFs — this is a pure single-name position.
              </p>
            ) : (
              <>
                {data.fundsHolding.map((f) => (
                  <Link key={f.id} href={`/portfolio/holdings/${f.id}`} className="rowlink flex items-center gap-3 rounded-lg px-2 py-2.5 -mx-2 border-b border-line/50 last:border-0">
                    <span className="font-mono text-[12.5px] font-semibold">{f.id}</span>
                    <span className="text-[11.5px] text-tx-3 truncate flex-1">{f.name}</span>
                    <span className="chip chip-hot">{(f.sharedWeight * 100).toFixed(1)}% of book</span>
                  </Link>
                ))}
                <p className="mt-3 text-[10.5px] text-tx-3 leading-relaxed">
                  These funds list {h.id} among their largest constituents — your effective exposure is position + fund weight.
                </p>
              </>
            )}
            <div className="mt-4 border-t border-line/70 pt-3">
              <div className="text-[10px] uppercase tracking-[0.15em] text-tx-3 font-semibold mb-2">Where it sits</div>
              <Donut
                data={[
                  { key: "h", label: h.id, value: pos.weight, pct: pos.weight, color: h.color },
                  { key: "r", label: "Rest of book", value: 1 - pos.weight, pct: 1 - pos.weight, color: "#242E38" },
                ]}
                size={160}
                thickness={20}
                centerTop={`${(pos.weight * 100).toFixed(1)}%`}
                centerSub="of your book"
              />
            </div>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-8" delay={80}>
          <Panel
            kicker="Intelligence"
            title="Signals about this name"
            className="h-full"
            right={<span className="chip">{data.news.length} recent</span>}
          >
            {data.news.length === 0 ? (
              <p className="text-[12.5px] text-tx-2">No recent signals tagged to this name.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {data.news.map((n) => (
                  <NewsCard key={n.id} n={n} bookSet={bookSet} />
                ))}
              </div>
            )}
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
