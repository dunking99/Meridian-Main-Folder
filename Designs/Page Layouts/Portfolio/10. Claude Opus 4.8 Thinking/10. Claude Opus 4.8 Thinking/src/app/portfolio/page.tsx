import Link from "next/link";
import { getPortfolio } from "@/lib/portfolio";
import { Money } from "@/components/currency";
import { Card, CardHead, DeltaPill, Badge, Ticker, Progress } from "@/components/ui";
import { RangeChart, AllocationTabs } from "@/components/portfolio-widgets";
import { Sparkline, Gauge, WeightRibbon, HBars } from "@/components/charts";
import { fmtSignedPct, fmtDate, fmtDateFull, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

function Kpi({ label, children, hint, accent }: { label: string; children: React.ReactNode; hint?: React.ReactNode; accent?: string }) {
  return (
    <Card className="p-4" hover>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-faint">
        {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
        {label}
      </div>
      <div className="mt-2">{children}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-dim">{hint}</div>}
    </Card>
  );
}

export default async function OverviewPage() {
  const d = await getPortfolio();
  const { summary, risk, alloc, leaders, laggards, topHoldings, trailing, events, news } = d;
  const riskColor = risk.riskScore < 40 ? "#34d399" : risk.riskScore < 70 ? "#e8c489" : "#fb7185";

  return (
    <div className="fade-up space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Invested" hint={<>Cost basis <Money value={summary.totalCost} compact /></>} accent="#60a5fa">
          <Money value={summary.investedValue} decimals={0} className="tabnum text-2xl font-semibold text-ink" />
        </Kpi>
        <Kpi label="Total Return" accent={summary.totalPnl >= 0 ? "#34d399" : "#fb7185"} hint={`across ${summary.holdingsCount} positions`}>
          <div className="flex items-center gap-2">
            <Money value={summary.totalPnl} sign decimals={0} className={`tabnum text-2xl font-semibold ${summary.totalPnl >= 0 ? "text-pos" : "text-neg"}`} />
            <DeltaPill pct={summary.totalPnlPct} arrow={false} />
          </div>
        </Kpi>
        <Kpi label="Cash" hint={`${((summary.cash / summary.totalValue) * 100).toFixed(1)}% · buying power`} accent="#475569">
          <Money value={summary.cash} decimals={0} className="tabnum text-2xl font-semibold text-ink" />
        </Kpi>
        <Kpi label="Est. Income / yr" hint={`${summary.dividendYield.toFixed(2)}% blended yield`} accent="#e8c489">
          <Money value={summary.annualIncome} decimals={0} className="tabnum text-2xl font-semibold text-ink" />
        </Kpi>
      </div>

      {/* Chart + Pulse */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="Portfolio Value" sub="Net worth over time vs global benchmark" />
          <RangeChart series={d.series} />
          <div className="grid grid-cols-3 gap-px border-t border-line bg-line sm:grid-cols-6">
            {trailing.map((t) => (
              <div key={t.label} className="bg-panel px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint">{t.label}</div>
                <div className={`tabnum mt-0.5 text-sm font-semibold ${t.port >= 0 ? "text-pos" : "text-neg"}`}>{fmtSignedPct(t.port)}</div>
                <div className="tabnum text-[10px] text-ink-faint">vs {fmtSignedPct(t.bench)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHead title="Portfolio Pulse" sub="Risk & health at a glance" />
          <div className="flex items-center justify-around px-5 py-4">
            <div className="flex flex-col items-center gap-1">
              <Gauge value={risk.riskScore} grade={risk.riskGrade} label="Risk" color={riskColor} size={118} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <Gauge value={risk.healthScore} grade={risk.healthGrade} label="Health" color="#34e0c4" size={118} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-line bg-line text-xs">
            {[
              { l: "Volatility", v: `${risk.volAnnual.toFixed(1)}%` },
              { l: "Sharpe", v: risk.sharpe.toFixed(2) },
              { l: "Max Drawdown", v: `${risk.maxDD.toFixed(1)}%`, neg: true },
              { l: "Beta (ACWI)", v: risk.betaToBench.toFixed(2) },
              { l: "Diversification", v: `${risk.effHoldings.toFixed(1)} eff.` },
              { l: "Corr. to ACWI", v: risk.corrToBench.toFixed(2) },
            ].map((m) => (
              <div key={m.l} className="bg-panel px-4 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint">{m.l}</div>
                <div className={`tabnum mt-0.5 text-sm font-semibold ${m.neg ? "text-neg" : "text-ink"}`}>{m.v}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Allocation / Shape / Movers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHead title="Allocation at a Glance" sub="Where the capital sits" />
          <AllocationTabs alloc={alloc} />
        </Card>

        <Card className="lg:col-span-4">
          <CardHead title="Shape of the Book" sub="Position weights & concentration" />
          <div className="space-y-4 px-5 py-4">
            <WeightRibbon items={topHoldings.map((h) => ({ label: h.symbol, weight: h.weight, color: h.accent }))} />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-panel2/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint">Top 5 weight</div>
                <div className="tabnum mt-1 text-xl font-semibold text-ink">{risk.top5Concentration.toFixed(1)}%</div>
                <Progress value={risk.top5Concentration} color="#7c9bff" />
              </div>
              <div className="rounded-xl border border-line bg-panel2/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint">Largest position</div>
                <div className="tabnum mt-1 text-xl font-semibold text-ink">{topHoldings[0].weight.toFixed(1)}%</div>
                <div className="mt-1 text-[11px] text-ink-dim">{topHoldings[0].symbol}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHead title="Today's Movers" />
          <div className="grid grid-cols-1 gap-px bg-line">
            <div className="bg-panel px-5 py-2 text-[10px] uppercase tracking-wider text-pos">Leaders</div>
            {leaders.slice(0, 3).map((h) => (
              <div key={h.symbol} className="flex items-center justify-between bg-panel px-5 py-1.5 text-xs">
                <span className="font-medium text-ink">{h.symbol}</span>
                <DeltaPill pct={h.dayPct} />
              </div>
            ))}
            <div className="bg-panel px-5 py-2 text-[10px] uppercase tracking-wider text-neg">Laggards</div>
            {laggards.slice(0, 3).map((h) => (
              <div key={h.symbol} className="flex items-center justify-between bg-panel px-5 py-1.5 text-xs">
                <span className="font-medium text-ink">{h.symbol}</span>
                <DeltaPill pct={h.dayPct} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top holdings + events */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="Top Holdings" sub="Largest positions by market value" right={<Link href="/portfolio/holdings" className="text-xs font-medium text-accent hover:underline">View all →</Link>} />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-5 py-2 text-left font-medium">Holding</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Day</th>
                  <th className="px-3 py-2 text-center font-medium">30d</th>
                  <th className="px-3 py-2 text-right font-medium">Weight</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-5 py-2 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {topHoldings.slice(0, 8).map((h) => (
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
                    <td className="tabnum px-3 py-2.5 text-right text-ink-dim"><Money value={h.currentPrice} decimals={2} /></td>
                    <td className="px-3 py-2.5 text-right"><DeltaPill pct={h.dayPct} arrow={false} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <Sparkline data={h.series.slice(-30)} color={h.dayPct >= 0 ? "#34d399" : "#fb7185"} width={78} height={26} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="tabnum text-ink">{h.weight.toFixed(1)}%</div>
                      <div className="ml-auto mt-1 w-16"><Progress value={h.weight * 4} color={h.accent} /></div>
                    </td>
                    <td className="tabnum px-3 py-2.5 text-right font-medium text-ink"><Money value={h.value} decimals={0} /></td>
                    <td className="px-5 py-2.5 text-right">
                      <div className={`tabnum font-medium ${h.pnl >= 0 ? "text-pos" : "text-neg"}`}><Money value={h.pnl} sign decimals={0} /></div>
                      <div className={`tabnum text-[11px] ${h.pnl >= 0 ? "text-pos/70" : "text-neg/70"}`}>{fmtSignedPct(h.pnlPct)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHead title="Upcoming Events" sub="Earnings, dividends & catalysts" />
          <div className="space-y-px px-0 py-2">
            {events.length === 0 && <p className="px-5 py-6 text-sm text-ink-faint">No scheduled events.</p>}
            {events.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                <div className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-line bg-panel2/60 py-1">
                  <span className="text-[9px] uppercase text-ink-faint">{fmtDate(e.d).split(" ")[0]}</span>
                  <span className="tabnum text-sm font-semibold text-ink">{fmtDate(e.d).split(" ")[1]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">{e.symbol}</span>
                    <Badge color={e.impact === "high" ? "#fb7185" : e.impact === "medium" ? "#e8c489" : "#64748b"}>{e.type}</Badge>
                  </div>
                  <div className="truncate text-[11px] text-ink-dim">{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* News + geographic tilt */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="Relevant News" sub="Cross-referenced against your holdings" right={<Link href="/news" className="text-xs font-medium text-accent hover:underline">All news →</Link>} />
          <div className="divide-y divide-line/60 px-0 py-1">
            {news.slice(0, 5).map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: n.sentiment > 0.15 ? "#34d399" : n.sentiment < -0.15 ? "#fb7185" : "#94a3b8" }}
                  title={`sentiment ${n.sentiment.toFixed(2)}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-ink">{n.headline}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                    <span>{n.source}</span>
                    <span>·</span>
                    <span>{timeAgo(n.publishedAt)}</span>
                    {n.held.length > 0 && (
                      <span className="ml-1 flex flex-wrap gap-1">
                        {n.held.map((t) => (
                          <Link key={t} href={`/portfolio/holdings/${t}`} className="rounded bg-[#12202b] px-1.5 py-0.5 font-medium text-accent hover:bg-[#163041]">
                            {t}
                          </Link>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHead title="Geographic Tilt" sub={`${risk.naWeight.toFixed(0)}% North America`} />
          <div className="px-5 py-4">
            <HBars items={alloc.byRegion.map((r) => ({ label: r.label, weight: r.weight, color: r.color }))} />
            <div className="mt-4 rounded-xl border border-line bg-panel2/60 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-dim">Home bias vs global</span>
                <span className={`tabnum font-semibold ${risk.homeBias > 0 ? "text-gold" : "text-pos"}`}>{fmtSignedPct(risk.homeBias)}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
                Overweight US relative to a global neutral (~63%). Consider ex-US exposure to diversify.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <p className="pt-2 text-center text-[11px] text-ink-faint">
        Data as of {fmtDateFull(d.series[d.series.length - 1].date)} · illustrative figures
      </p>
    </div>
  );
}
