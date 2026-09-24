"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useCurrency } from "@/components/portfolio/CurrencyContext";
import Panel from "@/components/ui/Panel";
import Reveal from "@/components/ui/Reveal";
import CountUp from "@/components/ui/CountUp";
import Delta from "@/components/ui/Delta";
import Skel from "@/components/ui/Skel";
import Spark from "@/components/ui/Spark";
import Meter from "@/components/ui/Meter";
import Gauge from "@/components/charts/Gauge";
import Donut from "@/components/charts/Donut";
import LinePanel from "@/components/charts/LinePanel";
import EventsList from "@/components/portfolio/EventsList";
import NewsCard from "@/components/portfolio/NewsCard";
import { CLASS_LABELS } from "@/lib/format";
import type { OverviewPayload, Leader } from "@/lib/types";

const RANGES = [
  { label: "1M", days: 22 },
  { label: "3M", days: 64 },
  { label: "6M", days: 127 },
  { label: "1Y", days: 253 },
  { label: "3Y", days: 757 },
  { label: "5Y", days: null },
];

const CAP_COLORS: Record<string, string> = { Large: "#D9A648", Mid: "#64B6E8", Small: "#8FBF9F" };

function MoverRow({ m }: { m: Leader }) {
  return (
    <Link href={`/portfolio/holdings/${m.id}`} className="rowlink flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2">
      <span className="h-2 w-2 rounded-[3px] shrink-0" style={{ background: m.color }} />
      <span className="font-mono text-[12px] font-semibold w-14">{m.id}</span>
      <span className="text-[11px] text-tx-3 truncate flex-1">{m.name}</span>
      <Spark data={m.spark} w={64} h={20} color={m.color} />
      <Delta v={m.ret} className="w-16 justify-end" />
    </Link>
  );
}

export default function OverviewPage() {
  const { data, error } = useApi<OverviewPayload>("/api/portfolio/overview");
  const { money, ccy } = useCurrency();
  const [range, setRange] = useState("1Y");
  const [bench, setBench] = useState(true);

  const series = useMemo(() => {
    if (!data) return [];
    const days = RANGES.find((r) => r.label === range)?.days ?? null;
    const raw = days ? data.series.slice(-days) : data.series;
    const b0 = raw[0]?.bench || 1;
    const v0 = raw[0]?.value || 1;
    return raw.map((p) => ({ t: p.t, value: p.value, benchN: ((p.bench ?? b0) / b0) * v0 }));
  }, [data, range]);

  const ytdSeries = useMemo(() => {
    if (!data) return [];
    const y = new Date().getUTCFullYear().toString();
    return data.series.filter((p) => p.t.slice(0, 4) >= y).map((p) => p.value);
  }, [data]);

  if (error) {
    return (
      <div className="panel px-6 py-10 text-center">
        <div className="font-display text-xl">Something drifted off course</div>
        <p className="text-tx-3 text-sm mt-2">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skel className="h-44 w-full" />
        <div className="grid grid-cols-12 gap-4">
          <Skel className="col-span-12 xl:col-span-8 h-80" />
          <Skel className="col-span-12 xl:col-span-4 h-80" />
        </div>
        <div className="grid grid-cols-12 gap-4">
          <Skel className="col-span-12 md:col-span-4 h-64" />
          <Skel className="col-span-12 md:col-span-4 h-64" />
          <Skel className="col-span-12 md:col-span-4 h-64" />
        </div>
      </div>
    );
  }

  const bookSet = new Set(data.symbols);
  const vals = data.series.map((p) => p.value);
  const down = vals.filter((_, i) => i % 6 === 0);
  const tiles = [
    { label: "Today", v: data.dayChangePct, spark: vals.slice(-7) },
    { label: "1 Month", v: data.ret1M, spark: vals.slice(-22) },
    { label: "YTD", v: data.retYTD, spark: ytdSeries.length > 2 ? ytdSeries : vals.slice(-40) },
    { label: "Since inception", v: data.retInception, spark: down },
  ];
  const top3 = data.topHoldings.slice(0, 3).reduce((s, h) => s + h.weight, 0);
  const maxH = Math.max(...data.topHoldings.map((h) => h.weight));

  return (
    <div className="space-y-4">
      {/* HERO */}
      <Reveal>
        <section className="panel panel-hero px-6 py-6 lg:px-8">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-5">
              <div className="kicker">Total portfolio value · {ccy}</div>
              <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                <CountUp value={data.value} fmt={(v) => money(v)} className="font-display text-[46px] sm:text-[56px] leading-none tracking-tight" />
              </div>
              <div className="mt-3.5 flex items-center gap-2.5 text-[13px] flex-wrap">
                <Delta v={data.dayChangePct} />
                <span className={`num ${data.dayChange >= 0 ? "text-up" : "text-down"}`}>
                  {data.dayChange >= 0 ? "+" : "−"}{money(Math.abs(data.dayChange))} today
                </span>
                <span className="text-tx-3">· {data.holdingsCount} holdings + cash</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="chip">Cash {money(data.cash, true)}</span>
                <span className="chip">({((data.cash / data.value) * 100).toFixed(1)}% of book)</span>
                <span className={`chip ${data.plTotal >= 0 ? "chip-hot" : ""}`}>
                  Unrealized {data.plTotal >= 0 ? "+" : "−"}{money(Math.abs(data.plTotal), true)} ({(data.plPct * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-xl border border-line bg-ink-900/60 px-4 py-3.5 hover:border-line2 transition-colors">
                  <div className="text-[9.5px] uppercase tracking-[0.15em] text-tx-3 font-semibold">{t.label}</div>
                  <div className={`num text-[17px] font-medium mt-1.5 ${t.v >= 0 ? "text-up" : "text-down"}`}>
                    {(t.v >= 0 ? "+" : "") + (t.v * 100).toFixed(t.label === "Today" ? 2 : 1)}%
                  </div>
                  <div className="mt-1.5">
                    <Spark data={t.spark} w={112} h={24} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* CHART + RISK */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-8">
          <Panel
            kicker="Portfolio pulse"
            title="Value over time"
            className="h-full"
            right={
              <div className="flex items-center gap-1">
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
                { key: "value", label: "Portfolio", color: "#D9A648", width: 2 },
                ...(bench ? [{ key: "benchN", label: "S&P 500", color: "#5F6D79", dash: true }] : []),
              ]}
              height={292}
              fmt={(v) => money(v, true)}
              areaKey="value"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-tx-3">
                <input type="checkbox" checked={bench} onChange={(e) => setBench(e.target.checked)} className="accent-[#D9A648]" />
                S&P 500, scaled to same start
              </label>
              <span className="text-[10.5px] text-tx-3 num">{series.length} daily points</span>
            </div>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-4" delay={80}>
          <Panel
            kicker="Risk"
            title="Risk profile"
            className="h-full"
            right={<span className="chip chip-hot">{data.risk.label}</span>}
          >
            <Gauge value={data.risk.score} grade={data.risk.grade} />
            <p className="text-center text-[11.5px] text-tx-2 leading-relaxed mt-3 min-h-[32px]">{data.risk.note}</p>
            <div className="mt-4 space-y-2">
              {[
                { l: "Equity exposure", v: `${(data.risk.equity * 100).toFixed(0)}%` },
                { l: "Annualized vol · 5Y", v: `${(data.risk.vol * 100).toFixed(1)}%` },
                { l: "Max drawdown · 5Y", v: `${(data.risk.maxDd * 100).toFixed(1)}%` },
                { l: "Beta vs S&P 500", v: data.risk.beta.toFixed(2) },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between border-b border-line/60 pb-2 text-[12px]">
                  <span className="text-tx-2">{r.l}</span>
                  <span className="num text-tx-1">{r.v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* ALLOCATION / SHAPE / HEALTH */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 md:col-span-6 xl:col-span-4">
          <Panel kicker="Allocation" title="At a glance" className="h-full">
            <Donut
              data={data.allocation}
              centerTop={money(data.value, true)}
              centerSub="total value"
            />
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 md:col-span-6 xl:col-span-4" delay={70}>
          <Panel kicker="Shape" title="Shape of the book" className="h-full">
            <div className="flex h-10 w-full overflow-hidden rounded-lg border border-line">
              {data.capShape.map((c) => (
                <div
                  key={c.key}
                  title={`${c.label} cap · ${(c.pct * 100).toFixed(0)}%`}
                  className="h-full transition-[filter] hover:brightness-125"
                  style={{ width: `${c.pct * 100}%`, background: CAP_COLORS[c.key] ?? "#7B8794", opacity: 0.8, boxShadow: "inset -1px 0 0 rgba(10,13,17,0.9)" }}
                >
                  {c.pct > 0.15 && (
                    <span className="flex h-full items-center justify-center font-mono text-[10.5px] font-semibold text-ink-950/80">
                      {(c.pct * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {data.capShape.map((c) => (
                <div key={c.key} className="flex items-center gap-2.5 text-[12px]">
                  <span className="h-2 w-2 rounded-[3px]" style={{ background: CAP_COLORS[c.key] ?? "#7B8794" }} />
                  <span className="text-tx-2 flex-1">{c.label} cap</span>
                  <span className="num text-tx-1">{(c.pct * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-line/70 pt-3 text-[11.5px] text-tx-3 leading-relaxed">
              Top 3 positions hold <span className="num text-tx-1">{(top3 * 100).toFixed(0)}%</span> · single largest{" "}
              <span className="num text-tx-1">{(data.topHoldings[0].weight * 100).toFixed(1)}%</span> ({data.topHoldings[0].id})
            </div>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-4" delay={140}>
          <Panel
            kicker="Score"
            title="Book health"
            className="h-full"
            right={
              <span className="font-display text-[15px] text-brass2 border border-brass/40 rounded-md px-2 py-0.5 bg-brass/10">
                {data.health.grade}
              </span>
            }
          >
            <div className="flex items-center gap-4">
              <div className="font-display text-[46px] leading-none text-brass2">{data.health.score}</div>
              <div className="text-[11.5px] text-tx-2 leading-snug">
                composite of five dimensions — structure, balance, currency, momentum
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {data.health.parts.map((p) => (
                <div key={p.key}>
                  <div className="flex justify-between text-[11.5px] mb-1.5">
                    <span className="text-tx-2">{p.label}</span>
                    <span className="num text-tx-1">{p.score}</span>
                  </div>
                  <Meter score={p.score} />
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* MOVERS + TOP HOLDINGS */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 lg:col-span-5">
          <Panel
            kicker="Movers"
            title="Leaders & laggards · 1M"
            className="h-full"
            right={<Link href="/portfolio/holdings" className="text-[11px] text-brass2 hover:text-brass font-medium">all holdings →</Link>}
          >
            <div className="text-[10px] uppercase tracking-[0.15em] text-tx-3 font-semibold mb-1.5">Leading</div>
            {data.leaders.map((m) => (
              <MoverRow key={m.id} m={m} />
            ))}
            <div className="text-[10px] uppercase tracking-[0.15em] text-tx-3 font-semibold mb-1.5 mt-4">Lagging</div>
            {data.laggards.map((m) => (
              <MoverRow key={m.id} m={m} />
            ))}
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 lg:col-span-7" delay={80}>
          <Panel kicker="Positions" title="Top holdings" className="h-full" bodyClassName="px-2 pb-3 pt-2">
            <div className="grid grid-cols-[16px_1.2fr_0.9fr_1fr_0.7fr_0.8fr_72px] items-center gap-2 px-3 pb-1.5 border-b border-line text-[9.5px] uppercase tracking-wider text-tx-3 font-semibold">
              <span />
              <span>Holding</span>
              <span className="hidden sm:block">Class</span>
              <span className="text-right">Weight</span>
              <span className="text-right hidden sm:block">Value</span>
              <span className="text-right">1M</span>
              <span className="text-right">60D</span>
            </div>
            {data.topHoldings.map((h) => (
              <Link
                key={h.id}
                href={`/portfolio/holdings/${h.id}`}
                className="grid grid-cols-[16px_1.2fr_0.9fr_1fr_0.7fr_0.8fr_72px] items-center gap-2 px-3 py-2 rounded-lg rowlink"
              >
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: h.color }} />
                <span className="min-w-0">
                  <span className="font-mono text-[12.5px] font-semibold">{h.id}</span>
                  <span className="block text-[10.5px] text-tx-3 truncate">{h.name}</span>
                </span>
                <span className="hidden sm:block">
                  <span className="chip">{CLASS_LABELS[h.assetClass]}</span>
                </span>
                <span className="flex items-center justify-end gap-2">
                  <span className="h-1 w-12 rounded-full bg-ink-800 overflow-hidden">
                    <span className="block h-full" style={{ width: `${(h.weight / maxH) * 100}%`, background: h.color }} />
                  </span>
                  <span className="num text-[12px] w-10 text-right">{(h.weight * 100).toFixed(1)}%</span>
                </span>
                <span className="num text-[12px] text-right hidden sm:block">{money(h.value, true)}</span>
                <span className="flex justify-end"><Delta v={h.ret1M} /></span>
                <span className="flex justify-end"><Spark data={h.spark} w={64} h={20} color={h.color} /></span>
              </Link>
            ))}
          </Panel>
        </Reveal>
      </div>

      {/* EVENTS + NEWS */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 lg:col-span-5">
          <Panel
            kicker="Calendar"
            title="Upcoming events"
            className="h-full"
            right={<span className="chip">next {Math.max(...data.events.map((e) => e.inDays), 0)}d</span>}
          >
            <EventsList events={data.events} />
            <div className="mt-2 px-2 text-[10.5px] text-tx-3">Importance ● dots · earnings, macro and fund events</div>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 lg:col-span-7" delay={80}>
          <Panel
            kicker="Intelligence"
            title="Signals that touch your book"
            className="h-full"
            right={
              <Link href="/news" className="text-[11px] text-brass2 hover:text-brass font-medium">
                open newsroom →
              </Link>
            }
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {data.news.slice(0, 6).map((n) => (
                <NewsCard key={n.id} n={n} bookSet={bookSet} />
              ))}
            </div>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
