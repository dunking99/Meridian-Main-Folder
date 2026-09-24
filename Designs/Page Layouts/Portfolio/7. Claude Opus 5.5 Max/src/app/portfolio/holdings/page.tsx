import { getPortfolio, daysBetween } from "@/lib/engine";
import { exposures } from "@/lib/analytics";
import { fmtDate, fmtPct } from "@/lib/format";
import { ACWI_REF, COUNTRIES, REGION_COLORS, countryName, type Region } from "@/lib/reference";
import { Card, Flag, HoldingLink, Money, Monogram, Pct } from "@/components/ui";
import { CompareBars, DivergingBars, WorldDots } from "@/components/charts";
import { SwitchCard } from "@/components/client";
import { HoldingsExplorer, type HoldingRow } from "@/components/holdings-explorer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Holdings" };

export default async function HoldingsPage() {
  const core = await getPortfolio();
  const ccy = core.ccy;
  const exp = exposures(core);
  const rows: HoldingRow[] = core.positions.map((p) => ({
    symbol: p.symbol, name: p.inst.name, color: p.inst.meta.color, sector: p.inst.sector, sleeve: p.sleeve, region: p.region, account: p.inst.meta.account,
    currency: p.inst.currency, country: p.inst.country, qty: p.qty, price: p.price, avgCost: p.avgCostLocal, value: p.value, weight: p.weight,
    dayPct: p.dayPct, dayChange: p.dayChange, unrealized: p.unrealized, unrealizedPct: p.unrealizedPct, realized: p.realized, dividends: p.dividends,
    totalReturn: p.totalReturn, totalReturnPct: p.totalReturnPct, r1m: p.ret["1M"] ?? null, rytd: p.ret.YTD ?? null, r1y: p.ret["1Y"] ?? null,
    spark: p.spark, yield: p.inst.meta.divYield,
  }));
  const winners = core.positions.filter((p) => p.unrealized > 0);
  const losers = core.positions.filter((p) => p.unrealized < 0);
  const avgHold = core.positions.reduce((a, p) => a + daysBetween(p.firstBuy, core.asOf) * p.weight, 0) / core.positions.reduce((a, p) => a + p.weight, 0);
  const pnlRows = [...core.positions].sort((a, b) => b.unrealized - a.unrealized);
  const maxAbs = Math.max(...pnlRows.map((p) => Math.abs(p.unrealized)));
  const bar = (list: typeof pnlRows) => (
    <DivergingBars
      max={maxAbs}
      labelClass="w-16"
      items={list.map((p) => ({ key: p.symbol, label: <HoldingLink symbol={p.symbol} className="num">{p.symbol}</HoldingLink>, value: p.unrealized, display: <Money v={p.unrealized} ccy={ccy} compact sign /> }))}
    />
  );

  const listing: Record<string, number> = {};
  for (const p of core.positions) listing[p.inst.country] = (listing[p.inst.country] ?? 0) + p.weight;
  const geo = (weights: Record<string, number>) => {
    const list = Object.entries(weights).filter(([c]) => c !== "GL" && c !== "OT").sort((a, b) => b[1] - a[1]);
    const other = Object.entries(weights).filter(([c]) => c === "GL" || c === "OT").reduce((a, [, v]) => a + v, 0);
    const max = list[0]?.[1] ?? 1;
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="relative">
          <WorldDots weights={Object.fromEntries(list)} />
        </div>
        <div className="space-y-2">
          {list.slice(0, 11).map(([c, w]) => (
            <div key={c} className="grid grid-cols-[1.4rem_1fr_3.2rem] items-center gap-2 text-[12px]">
              <Flag code={c} className="text-[14px]" />
              <div className="min-w-0">
                <div className="flex justify-between gap-2"><span className="truncate text-mist-200">{countryName(c)}</span><span className="text-[10px] text-mist-500">{COUNTRIES[c]?.ccy}</span></div>
                <div className="mt-1 h-1 rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gold-400" style={{ width: `${(w / max) * 100}%` }} /></div>
              </div>
              <span className="num text-right text-mist-100">{fmtPct(w, 1, false)}</span>
            </div>
          ))}
          {other > 0.0005 && <div className="flex justify-between pt-1 text-[11px] text-mist-500"><span>🌐 Global / unassigned (gold, crypto, other)</span><span className="num">{fmtPct(other, 1, false)}</span></div>}
        </div>
      </div>
    );
  };
  const regions = (Object.keys(exp.regions) as Region[]).filter((r) => r !== "Global");

  return (
    <div className="space-y-4">
      <section className="card rise grid grid-cols-2 gap-y-4 px-5 py-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Positions" value={String(core.positions.length)} sub={`${core.closed.length} closed`} />
        <Stat label="Winners" value={<span className="text-up">{winners.length}</span>} sub={<Money v={winners.reduce((a, p) => a + p.unrealized, 0)} ccy={ccy} compact sign className="text-up" />} />
        <Stat label="Losers" value={<span className="text-down">{losers.length}</span>} sub={<Money v={losers.reduce((a, p) => a + p.unrealized, 0)} ccy={ccy} compact className="text-down" />} />
        <Stat label="Largest" value={core.positions[0].symbol} sub={fmtPct(core.positions[0].weight, 1, false) + " of book"} />
        <Stat label="Top 10 weight" value={fmtPct(core.positions.slice(0, 10).reduce((a, p) => a + p.weight, 0), 0, false)} sub="concentration" />
        <Stat label="Avg holding period" value={`${(avgHold / 365).toFixed(1)}y`} sub="value-weighted" />
      </section>

      <HoldingsExplorer rows={rows} ccy={ccy} cash={core.totals.cash} />

      <div className="grid grid-cols-12 gap-4">
        <SwitchCard className="col-span-12 xl:col-span-5" title="Winners vs losers · unrealized P&L" index="02" labels={["All", "Winners", "Losers"]}>
          {bar(pnlRows)}
          {bar(pnlRows.filter((p) => p.unrealized > 0))}
          {bar(pnlRows.filter((p) => p.unrealized < 0))}
        </SwitchCard>

        <SwitchCard className="col-span-12 xl:col-span-7" title="Geography" index="03" labels={["Look-through", "Listing"]} subtitle="Look-through spreads each fund across the countries it actually owns">
          {geo(exp.countries)}
          {geo(listing)}
        </SwitchCard>

        <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Regions · equity vs MSCI ACWI" index="04">
          <CompareBars items={regions.map((r) => ({ key: r, label: <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: REGION_COLORS[r] }} />{r}</span>, a: exp.regions[r], b: exp.acwiRegions[r] }))} bLabel="MSCI ACWI" />
          <p className="mt-4 text-[11.5px] text-mist-500">US is <span className="num text-mist-200">{fmtPct(exp.homeUS, 0, false)}</span> of your equity vs <span className="num text-mist-200">{fmtPct(ACWI_REF.countries.US, 0, false)}</span> of the world index.</p>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-7" title="Closed positions · realized" index="05" bodyClass="!px-0 !pb-2">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="label text-left">
                <th className="px-5 pb-2 font-normal">Position</th>
                <th className="pb-2 font-normal">Held</th>
                <th className="pb-2 text-right font-normal">Cost</th>
                <th className="pb-2 text-right font-normal">Proceeds</th>
                <th className="px-5 pb-2 text-right font-normal">Realized</th>
              </tr>
            </thead>
            <tbody>
              {core.closed.map((c) => (
                <tr key={c.symbol} className="border-t border-white/[0.04]">
                  <td className="px-5 py-2.5"><HoldingLink symbol={c.symbol} className="flex items-center gap-3"><Monogram symbol={c.symbol} color={c.inst.meta.color} size={24} /><span><span className="num block text-mist-100">{c.symbol}</span><span className="text-[11px] text-mist-500">{c.inst.name}</span></span></HoldingLink></td>
                  <td className="py-2.5 text-[11.5px] text-mist-400">{fmtDate(c.firstBuy, "mshort")} → {fmtDate(c.lastSell, "mshort")}</td>
                  <td className="py-2.5 text-right"><Money v={c.cost} ccy={ccy} dp={0} className="text-mist-300" /></td>
                  <td className="py-2.5 text-right"><Money v={c.proceeds} ccy={ccy} dp={0} className="text-mist-300" /></td>
                  <td className="px-5 py-2.5 text-right"><Money v={c.realized} ccy={ccy} compact sign className={c.realized >= 0 ? "text-up" : "text-down"} /><Pct v={c.cost ? c.realized / c.cost : 0} className="block text-[10.5px]" /></td>
                </tr>
              ))}
              {core.closed.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-mist-500">No closed positions yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="min-w-0 border-white/[0.06] xl:border-r xl:last:border-r-0 xl:pl-2">
      <div className="label">{label}</div>
      <div className="num mt-2 text-[22px] font-light leading-none text-white">{value}</div>
      <div className="mt-1.5 text-[11px] text-mist-500">{sub}</div>
    </div>
  );
}
