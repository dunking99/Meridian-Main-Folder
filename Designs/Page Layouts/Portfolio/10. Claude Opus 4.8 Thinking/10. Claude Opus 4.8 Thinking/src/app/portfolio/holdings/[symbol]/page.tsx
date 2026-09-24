import Link from "next/link";
import { notFound } from "next/navigation";
import { getHolding } from "@/lib/portfolio";
import { Money } from "@/components/currency";
import { Card, CardHead, DeltaPill, Badge, Ticker } from "@/components/ui";
import { RangeChart } from "@/components/portfolio-widgets";
import { fmtSignedPct, fmtCompact, fmtDate, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HoldingDetail({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const res = await getHolding(symbol);
  if (!res) notFound();
  const { holding: h, relatedNews, relatedEvents, data } = res;

  const series = data.series.map((s, i) => ({ date: s.date, value: h.series[i], bench: s.bench }));
  const lo = Math.min(...h.series);
  const hi = Math.max(...h.series);
  const rangePos = ((h.currentPrice - lo) / (hi - lo || 1)) * 100;
  const rank = [...data.holdings].sort((a, b) => b.value - a.value).findIndex((x) => x.symbol === h.symbol) + 1;
  const contribution = (h.pnl / data.summary.totalPnl) * 100;

  const stats = [
    { l: "Market Cap", v: h.marketCap > 0 ? `$${fmtCompact(h.marketCap * 1e9)}` : "—" },
    { l: "P/E Ratio", v: h.peRatio ? h.peRatio.toFixed(1) : "—" },
    { l: "Beta", v: h.beta.toFixed(2) },
    { l: "Div Yield", v: `${h.dividendYield.toFixed(2)}%` },
    { l: "Sector", v: h.sector },
    { l: "Region", v: h.region },
    { l: "Country", v: h.country },
    { l: "Currency", v: h.currency },
  ];

  return (
    <div className="fade-up space-y-4">
      <Link href="/portfolio/holdings" className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition hover:text-ink-dim">
        ← Back to holdings
      </Link>

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Ticker symbol={h.symbol} accent={h.accent} size={52} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold text-ink">{h.symbol}</h2>
              <Badge color={h.accent}>{h.assetClass}</Badge>
            </div>
            <p className="text-sm text-ink-dim">{h.name}</p>
          </div>
        </div>
        <div className="text-right">
          <Money value={h.currentPrice} decimals={2} className="tabnum text-2xl font-semibold text-ink" />
          <div className="mt-1 flex items-center justify-end gap-2">
            <DeltaPill pct={h.dayPct} />
            <span className="tabnum text-xs text-ink-faint"><Money value={h.dayAbs} sign decimals={0} /> today</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* chart */}
        <Card className="lg:col-span-8">
          <CardHead title="Price History" sub="Per-share price vs global benchmark (rebased)" />
          <RangeChart series={series} height={300} />
          <div className="flex items-center gap-3 px-5 pb-4 text-[11px] text-ink-faint">
            <span className="tabnum">52-period low <Money value={lo} decimals={2} className="text-ink-dim" /></span>
            <div className="relative h-1.5 flex-1 rounded-full bg-[#141b26]">
              <div className="absolute h-1.5 rounded-full" style={{ width: `${rangePos}%`, background: `linear-gradient(90deg,${h.accent}55,${h.accent})` }} />
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg" style={{ left: `${rangePos}%`, background: h.accent }} />
            </div>
            <span className="tabnum">high <Money value={hi} decimals={2} className="text-ink-dim" /></span>
          </div>
        </Card>

        {/* position */}
        <Card className="lg:col-span-4">
          <CardHead title="Your Position" />
          <div className="space-y-px px-0 py-2">
            {[
              { l: "Shares held", v: h.quantity < 1 ? h.quantity.toFixed(4) : h.quantity.toLocaleString(), raw: true },
              { l: "Average cost", v: <Money value={h.avgCost} decimals={2} /> },
              { l: "Market price", v: <Money value={h.currentPrice} decimals={2} /> },
              { l: "Cost basis", v: <Money value={h.cost} decimals={0} /> },
              { l: "Market value", v: <Money value={h.value} decimals={0} /> },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between px-5 py-2 text-sm">
                <span className="text-ink-faint">{r.l}</span>
                <span className="tabnum font-medium text-ink">{r.v}</span>
              </div>
            ))}
            <div className="mx-5 my-2 border-t border-line" />
            <div className="flex items-center justify-between px-5 py-2">
              <span className="text-sm text-ink-faint">Unrealized P&L</span>
              <div className="text-right">
                <div className={`tabnum font-semibold ${h.pnl >= 0 ? "text-pos" : "text-neg"}`}><Money value={h.pnl} sign decimals={0} /></div>
                <div className={`tabnum text-[11px] ${h.pnl >= 0 ? "text-pos/70" : "text-neg/70"}`}>{fmtSignedPct(h.pnlPct)}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-line bg-line text-center">
            <div className="bg-panel px-2 py-2.5">
              <div className="text-[10px] uppercase text-ink-faint">Weight</div>
              <div className="tabnum text-sm font-semibold text-ink">{h.weight.toFixed(1)}%</div>
            </div>
            <div className="bg-panel px-2 py-2.5">
              <div className="text-[10px] uppercase text-ink-faint">Rank</div>
              <div className="tabnum text-sm font-semibold text-ink">#{rank}</div>
            </div>
            <div className="bg-panel px-2 py-2.5">
              <div className="text-[10px] uppercase text-ink-faint">P&L Share</div>
              <div className="tabnum text-sm font-semibold text-ink">{contribution.toFixed(0)}%</div>
            </div>
          </div>
        </Card>
      </div>

      {/* stats */}
      <Card>
        <CardHead title="Key Statistics" />
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4 lg:grid-cols-8">
          {stats.map((s) => (
            <div key={s.l} className="bg-panel px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-ink-faint">{s.l}</div>
              <div className="mt-1 truncate text-sm font-semibold text-ink">{s.v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* news + events */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="Related News" sub={`Stories mentioning ${h.symbol}`} />
          <div className="divide-y divide-line/60 px-0 py-1">
            {relatedNews.length === 0 && <p className="px-5 py-6 text-sm text-ink-faint">No recent news for this holding.</p>}
            {relatedNews.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: n.sentiment > 0.15 ? "#34d399" : n.sentiment < -0.15 ? "#fb7185" : "#94a3b8" }} />
                <div>
                  <p className="text-sm leading-snug text-ink">{n.headline}</p>
                  <p className="mt-1 text-[11px] text-ink-dim">{n.summary}</p>
                  <div className="mt-1 text-[11px] text-ink-faint">{n.source} · {timeAgo(n.publishedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHead title="Events" />
          <div className="space-y-px px-0 py-2">
            {relatedEvents.length === 0 && <p className="px-5 py-6 text-sm text-ink-faint">No scheduled events.</p>}
            {relatedEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                <div className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-line bg-panel2/60 py-1">
                  <span className="text-[9px] uppercase text-ink-faint">{fmtDate(e.d).split(" ")[0]}</span>
                  <span className="tabnum text-sm font-semibold text-ink">{fmtDate(e.d).split(" ")[1]}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">{e.type}</span>
                    <Badge color={e.impact === "high" ? "#fb7185" : e.impact === "medium" ? "#e8c489" : "#64748b"}>{e.impact}</Badge>
                  </div>
                  <div className="text-[11px] text-ink-dim">{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
