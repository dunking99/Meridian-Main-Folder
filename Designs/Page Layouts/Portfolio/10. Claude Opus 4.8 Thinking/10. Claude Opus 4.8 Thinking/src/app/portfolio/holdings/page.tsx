import { getPortfolio } from "@/lib/portfolio";
import { Money } from "@/components/currency";
import { Card, CardHead } from "@/components/ui";
import { HoldingsExplorer, type HRow } from "@/components/holdings-explorer";
import { HBars } from "@/components/charts";
import { fmtSignedPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HoldingsPage() {
  const d = await getPortfolio();
  const rows: HRow[] = d.holdings.map((h) => ({
    symbol: h.symbol,
    name: h.name,
    assetClass: h.assetClass,
    sector: h.sector,
    region: h.region,
    currency: h.currency,
    quantity: h.quantity,
    currentPrice: h.currentPrice,
    avgCost: h.avgCost,
    value: h.value,
    pnl: h.pnl,
    pnlPct: h.pnlPct,
    dayPct: h.dayPct,
    weight: h.weight,
    accent: h.accent,
    beta: h.beta,
    spark: h.series.slice(-30),
  }));

  const upToday = d.holdings.filter((h) => h.dayPct >= 0);
  const downToday = d.holdings.filter((h) => h.dayPct < 0);
  const best = [...d.holdings].sort((a, b) => b.dayPct - a.dayPct)[0];
  const worst = [...d.holdings].sort((a, b) => a.dayPct - b.dayPct)[0];
  const avgPos = d.summary.investedValue / d.holdings.length;

  const upValue = upToday.reduce((s, h) => s + h.value, 0);
  const downValue = downToday.reduce((s, h) => s + h.value, 0);

  const currencyBars = d.alloc.byCurrency.map((c) => ({ label: c.label, weight: c.weight, color: c.color }));
  const sectorBars = d.alloc.bySector.filter((s) => s.label !== "Cash").map((s) => ({ label: s.label, weight: s.weight, color: s.color }));
  const regionBars = d.alloc.byRegion.filter((s) => s.label !== "Cash").map((s) => ({ label: s.label, weight: s.weight, color: s.color }));

  return (
    <div className="fade-up space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint">Positions</div>
          <div className="tabnum mt-2 text-2xl font-semibold text-ink">{d.holdings.length}</div>
          <div className="mt-1 text-[11px] text-ink-dim">avg <Money value={avgPos} compact /> each</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint">Up / Down Today</div>
          <div className="tabnum mt-2 text-2xl font-semibold text-ink">
            <span className="text-pos">{upToday.length}</span>
            <span className="text-ink-faint"> / </span>
            <span className="text-neg">{downToday.length}</span>
          </div>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[#141b26]">
            <div style={{ width: `${(upValue / (upValue + downValue)) * 100}%`, background: "#34d399" }} />
            <div style={{ width: `${(downValue / (upValue + downValue)) * 100}%`, background: "#fb7185" }} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint">Top Gainer Today</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-semibold text-ink">{best.symbol}</span>
            <span className="tabnum text-sm font-semibold text-pos">{fmtSignedPct(best.dayPct)}</span>
          </div>
          <div className="mt-1 truncate text-[11px] text-ink-dim">{best.name}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-faint">Top Decliner Today</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-semibold text-ink">{worst.symbol}</span>
            <span className="tabnum text-sm font-semibold text-neg">{fmtSignedPct(worst.dayPct)}</span>
          </div>
          <div className="mt-1 truncate text-[11px] text-ink-dim">{worst.name}</div>
        </Card>
      </div>

      <Card>
        <CardHead title="All Holdings" sub="Sort, filter or switch to a performance treemap · click any name for detail" />
        <div className="mt-2" />
        <HoldingsExplorer rows={rows} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHead title="Sector Exposure" />
          <div className="px-5 py-4">
            <HBars items={sectorBars} />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHead title="Geographic Exposure" />
          <div className="px-5 py-4">
            <HBars items={regionBars} />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHead title="Currency Exposure" />
          <div className="px-5 py-4">
            <HBars items={currencyBars} />
          </div>
        </Card>
      </div>
    </div>
  );
}
