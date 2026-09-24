import Link from "next/link";
import { getPortfolio, COUNTRY_NAMES } from "@/lib/engine";
import { Card, Stat } from "@/components/ui";
import { HoldingsExplorer } from "@/components/holdings";
import { TileMap } from "@/components/charts/advanced";
import { Donut, CompareBars } from "@/components/charts/basic";
import { Money } from "@/components/money";
import { pct, CCY_COLORS, fmtLocal } from "@/lib/format";

export default async function HoldingsPage() {
  const p = await getPortfolio();
  const hs = p.holdings;
  const best = [...hs].sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const worst = [...hs].sort((a, b) => a.pnlPct - b.pnlPct)[0];
  const rows = hs.map((h) => ({
    symbol: h.symbol, name: h.name, kind: h.kind, bucket: h.bucket, sector: h.sector, currency: h.currency, qty: h.qty, price: h.price, avgCost: h.avgCost,
    value: h.value, cost: h.cost, pnl: h.pnl, pnlPct: h.pnlPct, dayPct: h.dayPct, dayChange: h.dayChange, weight: h.weight, income: h.income, realized: h.realized,
    r1y: h.r1y, rYtd: h.rYtd, spark: h.spark, high52: h.high52, low52: h.low52, country: h.country,
  }));
  const kindColors: Record<string, string> = { Equity: "#8f7cff", ETF: "#3fd0ff", "Bond ETF": "#ffb547", Commodity: "#f5d547", Crypto: "#ff9f1c" };
  const avgHoldDays = hs.reduce((s, h) => s + h.weight * (new Date(p.asOf).getTime() - new Date(h.firstBuy).getTime()) / 86400000, 0) / (1 - p.allocation.buckets.Cash);

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Positions" value={hs.length} sub={`${hs.filter((h) => h.kind === "Equity").length} stocks · ${hs.filter((h) => h.kind !== "Equity").length} funds & other`} />
        <Stat label="Unrealised P&L" value={<Money usd={p.pnlBreakdown.unrealized} compact sign colored />} sub={`${pct(p.pnlBreakdown.unrealized / p.totals.cost, 1, true)} on cost`} />
        <Stat label="Winners / losers" value={<><span className="text-pos">{hs.filter((h) => h.pnl > 0).length}</span><span className="text-dim"> / </span><span className="text-neg">{hs.filter((h) => h.pnl <= 0).length}</span></>} sub="by unrealised P&L" />
        <Stat label="Best position" value={<Link href={`/portfolio/holdings/${best.symbol}`} className="hover:text-accent">{best.symbol}</Link>} sub={<span className="text-pos">{pct(best.pnlPct, 0, true)} since purchase</span>} />
        <Stat label="Worst position" value={<Link href={`/portfolio/holdings/${worst.symbol}`} className="hover:text-accent">{worst.symbol}</Link>} sub={<span className={worst.pnlPct < 0 ? "text-neg" : "text-muted"}>{pct(worst.pnlPct, 1, true)} since purchase</span>} />
        <Stat label="Avg holding period" value={`${(avgHoldDays / 365).toFixed(1)}y`} sub="value-weighted" />
      </div>

      <HoldingsExplorer rows={rows} cash={p.totals.cash} total={p.totals.value} />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-8" eyebrow="Look-through, incl. funds" title="Geography map">
          <TileMap countries={p.allocation.countries} names={COUNTRY_NAMES} />
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
            {p.allocation.countries.filter((c) => c.code === "OTHER" || c.code === "XX").map((c) => (
              <span key={c.code} className="rounded-md border border-line px-2 py-0.5">{COUNTRY_NAMES[c.code]} <span className="num text-fg">{pct(c.weight, 1)}</span></span>
            ))}
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Settled balances" title="Cash">
          <div className="mb-4 flex items-baseline justify-between">
            <Money usd={p.totals.cash} className="font-serif text-4xl" />
            <span className="text-xs text-muted">{pct(p.totals.cash / p.totals.value, 1)} of book · earning 3.8%</span>
          </div>
          <div className="space-y-3">
            {p.cashBalances.map((c) => (
              <div key={c.ccy} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 text-sm">
                <span className="num rounded-md py-0.5 text-center text-[11px] font-semibold" style={{ background: (CCY_COLORS[c.ccy] ?? "#888") + "22", color: CCY_COLORS[c.ccy] }}>{c.ccy}</span>
                <div>
                  <div className="num">{fmtLocal(c.amount, c.ccy)}</div>
                  <div className="mt-1 h-1 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(c.usd / p.cashBalances[0].usd) * 100}%`, background: CCY_COLORS[c.ccy] }} /></div>
                </div>
                <Money usd={c.usd} className="text-xs text-muted" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="By instrument type" title="Vehicle mix">
          <div className="flex items-center gap-5">
            <Donut data={p.allocation.byKind.map((k) => ({ name: k.name, value: k.weight, color: kindColors[k.name] ?? "#888" }))} center={<><div className="num text-lg">{hs.length}</div><div className="text-[10px] text-dim">holdings</div></>} />
            <div className="flex-1 space-y-1.5">
              {p.allocation.byKind.map((k) => (
                <div key={k.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: kindColors[k.name] }} />{k.name}</span>
                  <span className="num">{pct(k.weight)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="By listing region" title="Regions">
          <CompareBars rows={p.allocation.byRegion.map((r) => ({ label: r.name, value: r.weight, color: "#3fd0ff" }))} />
        </Card>
        <Card className="col-span-12 md:col-span-12 xl:col-span-4" eyebrow="By trading currency" title="Listing currency">
          <CompareBars rows={p.allocation.currencyListing.map((c) => ({ label: c.ccy, value: c.weight, color: CCY_COLORS[c.ccy] }))} />
        </Card>
      </div>
    </div>
  );
}
