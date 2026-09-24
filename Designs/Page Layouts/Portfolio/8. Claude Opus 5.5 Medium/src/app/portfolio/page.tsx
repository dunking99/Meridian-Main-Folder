import Link from "next/link";
import { getPortfolio } from "@/lib/engine";
import { Card, Grade, Meter } from "@/components/ui";
import { PortfolioChart, Pulse, LeadersLaggards, TopHoldings, NewsList, EventsTimeline } from "@/components/overview";
import { ScoreRing, RiskGauge, Sunburst, StackBar } from "@/components/charts/basic";
import { Money } from "@/components/money";
import { pct, BUCKET_COLORS, SECTOR_COLORS, CCY_COLORS } from "@/lib/format";

export default async function OverviewPage() {
  const p = await getPortfolio();
  const { totals, stats, allocation: a } = p;
  const ytd = p.trailing.find((t) => t.label === "YTD")!;
  const topName = p.lookThrough[0];
  const worstDrift = [...a.drift].sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))[0];

  const sun = Object.keys(BUCKET_COLORS)
    .filter((b) => b !== "Cash")
    .map((b) => ({ name: b, color: BUCKET_COLORS[b], value: p.holdings.filter((h) => h.bucket === b).reduce((s, h) => s + h.weight, 0), children: p.holdings.filter((h) => h.bucket === b).map((h) => ({ name: h.symbol, value: h.weight })) }))
    .concat([{ name: "Cash", color: BUCKET_COLORS.Cash, value: a.buckets.Cash, children: [{ name: "Cash", value: a.buckets.Cash }] }]);

  const insights = [
    { tag: "Look-through", color: "#8f7cff", title: `${topName.symbol} is your biggest true exposure`, body: <>{pct(topName.total)} of the book — {pct(topName.direct)} direct plus {pct(topName.indirect)} hidden inside {topName.via.map((v) => v.fund).join(", ")}.</> },
    { tag: "Drift", color: "#ffb547", title: `${worstDrift.bucket} is ${worstDrift.diff > 0 ? "over" : "under"} target`, body: <>{pct(worstDrift.weight)} vs {pct(worstDrift.target)} target. Rebalancing means {worstDrift.trade > 0 ? "buying" : "selling"} ~<Money usd={Math.abs(worstDrift.trade)} compact />.</> },
    { tag: "Benchmark", color: ytd.p >= ytd.b ? "#2fe39b" : "#ff5a78", title: `${ytd.p >= ytd.b ? "Ahead of" : "Behind"} the world YTD`, body: <>Portfolio {pct(ytd.p, 1, true)} vs ACWI {pct(ytd.b, 1, true)} — a {pct(Math.abs(ytd.p - ytd.b), 1)} {ytd.p >= ytd.b ? "lead" : "gap"}, with beta of {stats.beta.toFixed(2)}.</> },
    { tag: "Income", color: "#3fd0ff", title: <>~<Money usd={totals.annualIncome} compact /> a year in passive income</>, body: <>Forward yield {pct(totals.portYield, 2)}, yield on cost {pct(p.income.yieldOnCost, 2)}. Trailing 12m received: <Money usd={totals.ttmIncome} compact />.</> },
  ];

  const allocRows = [
    { label: "Asset mix", data: Object.entries(a.buckets).map(([k, v]) => ({ name: k, value: v, color: BUCKET_COLORS[k] })) },
    { label: "Sector (look-through)", data: a.sectorExposure.slice(0, 8).map((s) => ({ name: s.sector, value: s.weight, color: SECTOR_COLORS[s.sector] })) },
    { label: "Currency (economic)", data: a.currencyEconomic.slice(0, 7).map((c) => ({ name: c.ccy, value: c.weight, color: CCY_COLORS[c.ccy] ?? "#4b5263" })) },
  ];

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 xl:col-span-8" eyebrow="Value over time" title="Portfolio" glow>
        <PortfolioChart dates={p.dates} value={p.series.value} invested={p.series.invested} idx={p.series.idx} bidx={p.series.bidx} />
      </Card>
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Right now" title="Portfolio pulse">
        <Pulse recent={p.pulse.recent} up={p.pulse.up} down={p.pulse.down} above50={p.pulse.above50} total={p.holdings.length} newsSentiment={p.pulse.newsSentiment} vol21={stats.vol21} vol1y={stats.vol1y} currentDD={stats.currentDD} />
      </Card>

      <div className="col-span-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {insights.map((i, k) => (
          <div key={k} className="card rise p-4" style={{ animationDelay: `${k * 60}ms` }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: i.color, boxShadow: `0 0 8px ${i.color}` }} />
              <span className="eyebrow" style={{ color: i.color }}>{i.tag}</span>
            </div>
            <div className="text-[13.5px] font-medium leading-snug">{i.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted">{i.body}</div>
          </div>
        ))}
      </div>

      <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Composite of 10 checks" title="Health score" action={<Link href="/portfolio/analysis#scorecard" className="text-xs text-muted hover:text-accent">Scorecard →</Link>}>
        <div className="flex items-center gap-5">
          <ScoreRing score={p.health} label="of 100" />
          <div className="flex-1 space-y-2">
            {[...p.scorecard].sort((x, y) => x.score - y.score).slice(0, 5).map((s) => (
              <div key={s.key}>
                <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-muted">{s.key}</span><span className="num">{s.score}</span></div>
                <Meter value={s.score} color={s.score >= 70 ? "#2fe39b" : s.score >= 50 ? "#d4ff3a" : "#ffb547"} />
              </div>
            ))}
            <div className="text-[10.5px] text-dim">Weakest five shown</div>
          </div>
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="SRRI-style, from 1Y volatility" title="Risk level">
        <div className="flex flex-col items-center">
          <RiskGauge level={p.risk.level} label={p.risk.label} />
          <div className="mt-3 grid w-full grid-cols-4 gap-2 text-center">
            {[["Volatility", pct(stats.vol1y)], ["Beta", stats.beta.toFixed(2)], ["Max DD", pct(stats.maxDD)], ["1d VaR 95", null]].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-ink/40 py-2">
                <div className="text-[9.5px] uppercase tracking-wider text-dim">{k}</div>
                <div className="num text-sm">{v ?? <Money usd={-stats.var95Usd} compact />}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Who's moving the book" title="Leaders & laggards">
        <LeadersLaggards holdings={p.holdings} />
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-5" eyebrow="Allocation at a glance" title="Where the money sits" action={<Link href="/portfolio/analysis" className="text-xs text-muted hover:text-accent">Deep dive →</Link>}>
        <div className="space-y-5">
          {allocRows.map((r) => (
            <div key={r.label}>
              <div className="eyebrow mb-2">{r.label}</div>
              <StackBar data={r.data} h={12} />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {r.data.slice(0, 6).map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />{d.name} <span className="num text-fg/80">{pct(d.value, 0)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="eyebrow mb-2">Drift vs target</div>
            <div className="space-y-1.5">
              {a.drift.map((d) => (
                <div key={d.bucket} className="grid grid-cols-[92px_1fr_48px] items-center gap-2 text-[11px]">
                  <span className="text-muted">{d.bucket}</span>
                  <div className="relative h-2 rounded-full bg-line">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${d.weight * 140}%`, background: BUCKET_COLORS[d.bucket] }} />
                    <div className="absolute -inset-y-1 w-0.5 bg-fg" style={{ left: `${d.target * 140}%` }} />
                  </div>
                  <span className={`num text-right ${Math.abs(d.diff) > 0.03 ? "text-amber" : "text-muted"}`}>{pct(d.diff, 1, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-3" eyebrow="Shape of the book" title="Anatomy">
        <div className="flex flex-col items-center gap-4">
          <Sunburst data={sun} size={250} />
          <div className="grid w-full grid-cols-3 gap-2 text-center">
            <div><div className="num text-lg">{p.concentration.effN.toFixed(1)}</div><div className="text-[10px] text-dim">effective positions</div></div>
            <div><div className="num text-lg">{pct(p.concentration.top5, 0)}</div><div className="text-[10px] text-dim">in top 5</div></div>
            <div><div className="flex justify-center"><Grade g={p.scorecard[0].grade} size="sm" /></div><div className="mt-1 text-[10px] text-dim">diversification</div></div>
          </div>
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-12 xl:col-span-4" eyebrow="Next 5 weeks" title="Upcoming events">
        <EventsTimeline events={p.events} asOf={p.asOf} limit={9} />
      </Card>

      <Card className="col-span-12 xl:col-span-8" eyebrow={`${p.holdings.length} positions · top 10 shown`} title="Top holdings" action={<Link href="/portfolio/holdings" className="text-xs text-muted hover:text-accent">All holdings →</Link>}>
        <TopHoldings holdings={p.holdings.slice(0, 10)} />
      </Card>

      <Card className="col-span-12 xl:col-span-4" eyebrow="Matched to your holdings, incl. fund look-through" title="Relevant news" action={<Link href="/news" className="text-xs text-muted hover:text-accent">All news →</Link>}>
        <NewsList items={[...p.news].sort((x, y) => y.relevance - x.relevance).slice(0, 5)} totalValue={totals.value} compact />
      </Card>
    </div>
  );
}
