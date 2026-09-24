import type { ReactNode } from "react";
import { getEvents, getPortfolio } from "@/lib/engine";
import { incomeModel } from "@/lib/analytics";
import { fmtDate, fmtPct } from "@/lib/format";
import { EVENT_META, SECTOR_COLORS } from "@/lib/reference";
import { Card, HoldingLink, Money, Monogram } from "@/components/ui";
import { BarList, Columns, StackedColumns } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Income" };

export default async function IncomePage() {
  const [core, events] = await Promise.all([getPortfolio(), getEvents()]);
  const ccy = core.ccy;
  const inc = incomeModel(core);
  const pos = new Map(core.positions.map((p) => [p.symbol, p]));
  const chart = [
    ...inc.history.map((h, i) => ({ label: fmtDate(h.m + "-01", "month").slice(0, 3), parts: [{ value: h.div, color: "#f5bd62", name: "Dividends" }, { value: h.int, color: "#4fd8c4", name: "Interest" }], tick: i % 3 === 0 })),
    ...inc.months.map((m, i) => ({ label: fmtDate(m + "-01", "month").slice(0, 3), parts: [{ value: inc.projected[m].reduce((a, x) => a + x.amount, 0), color: "#f5bd62", name: "Projected dividends" }, { value: inc.interestAnnual / 12, color: "#4fd8c4", name: "Projected interest" }], hatched: true, tick: i % 3 === 0 })),
  ];
  const years = Object.entries(inc.yearly).sort((a, b) => a[0].localeCompare(b[0]));
  const upcoming = events
    .filter((e) => e.type === "dividend" && e.date > core.asOf && e.symbol && pos.has(e.symbol))
    .slice(0, 10)
    .map((e) => {
      const p = pos.get(e.symbol!)!;
      return { ...e, amount: (p.value * p.inst.meta.divYield) / 100 / p.inst.meta.divFreq, color: p.inst.meta.color };
    });
  const growth = years.length >= 3 ? Number(years[years.length - 2][1]) / Number(years[years.length - 3][1]) - 1 : 0;

  return (
    <div className="grid grid-cols-12 gap-4">
      <section className="card rise col-span-12 grid grid-cols-2 gap-y-4 px-5 py-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Forward 12M income" value={<Money v={inc.fwdTotal} ccy={ccy} compact className="text-up" />} sub="dividends + cash interest" />
        <Stat label="Received · trailing 12M" value={<Money v={inc.ttm} ccy={ccy} compact />} sub={<>{fmtPct(inc.fwdTotal / Math.max(1, inc.ttm) - 1, 1)} forward vs trailing</>} />
        <Stat label="Portfolio yield" value={fmtPct(inc.yield, 2, false)} sub="forward, on market value" />
        <Stat label="Yield on cost" value={fmtPct(inc.yoc, 2, false)} sub="dividends ÷ cost basis" />
        <Stat label="Per month" value={<Money v={inc.fwdTotal / 12} ccy={ccy} compact />} sub={<>≈ <Money v={inc.fwdTotal / 365} ccy={ccy} dp={0} /> a day</>} />
        <Stat label="Income growth" value={fmtPct(growth, 1)} sub={years.length >= 3 ? `${years[years.length - 2][0]} vs ${years[years.length - 3][0]}` : "—"} />
      </section>

      <Card hero className="col-span-12" title="Monthly income · received and projected" index="01" subtitle="Solid bars were paid into your account · hatched bars are the next 12 months, projected from current positions and yields">
        <StackedColumns items={chart} ccy={ccy} width={1200} height={250} />
        <div className="mt-2 flex gap-4 text-[10.5px] text-mist-500"><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gold-400" />Dividends</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#4fd8c4]" />Interest</span><span className="flex items-center gap-1.5"><span className="hatch h-2 w-3 rounded-sm bg-white/10" />Projected</span></div>
      </Card>

      <Card className="col-span-12 xl:col-span-5" title="Who pays you" index="02" subtitle="Projected annual income by holding">
        <BarList
          items={inc.bySymbol.slice(0, 14).map((b) => ({
            key: b.symbol,
            label: <HoldingLink symbol={b.symbol} className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: SECTOR_COLORS[b.sector] ?? "#999" }} /><span className="num text-mist-100">{b.symbol}</span><span className="text-[11px] text-mist-500">{b.yield.toFixed(2)}% · YoC {fmtPct(b.yoc, 1, false)}</span></HoldingLink>,
            value: b.annual,
            display: <Money v={b.annual} ccy={ccy} dp={0} />,
            color: SECTOR_COLORS[b.sector] ?? "#f5bd62",
          }))}
        />
        <div className="mt-4 flex justify-between border-t border-white/[0.06] pt-3 text-[12px]"><span className="text-mist-400">Cash interest @ {fmtPct(inc.cashRate, 2, false)}</span><Money v={inc.interestAnnual} ccy={ccy} dp={0} className="text-mist-100" /></div>
      </Card>

      <Card className="col-span-12 xl:col-span-7" title="Dividend calendar · next 12 months" index="03">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {inc.months.map((m) => {
            const list = inc.projected[m];
            const tot = list.reduce((a, x) => a + x.amount, 0);
            return (
              <div key={m} className="rounded-xl bg-white/[0.02] p-2.5 ring-1 ring-inset ring-white/[0.05]">
                <div className="flex items-baseline justify-between"><span className="label">{fmtDate(m + "-01", "mshort")}</span></div>
                <Money v={tot} ccy={ccy} compact className="mt-1.5 block text-[15px] text-mist-100" />
                <div className="mt-2 flex flex-wrap gap-1">
                  {list.sort((a, b) => b.amount - a.amount).slice(0, 8).map((x, i) => {
                    const p = pos.get(x.symbol);
                    return <span key={x.symbol + i} className="num rounded px-1 py-px text-[9px] text-ink-950" style={{ background: p?.inst.meta.color ?? "#999" }} title={`${x.symbol}`}>{x.symbol}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Income by year" index="04">
        <Columns groups={years.map(([y, v]) => ({ label: y === core.asOf.slice(0, 4) ? `${y}*` : y, values: [Number(v)] }))} series={[{ label: "Income", color: "#3ee0a1" }]} fmt="money" ccy={ccy} width={480} height={230} />
        <div className="mt-1 text-[10.5px] text-mist-500">* year to date</div>
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-7" title="Next payments" index="05">
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {upcoming.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
              <Monogram symbol={e.symbol!} color={e.color} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2"><HoldingLink symbol={e.symbol!} className="num text-[12.5px] text-mist-100">{e.symbol}</HoldingLink><Money v={e.amount} ccy={ccy} dp={0} className="text-[12.5px] text-up" /></div>
                <div className="flex justify-between text-[10.5px] text-mist-500"><span style={{ color: EVENT_META.dividend.color }}>{fmtDate(e.date, "dow")}</span><span>{e.detail}</span></div>
              </div>
            </div>
          ))}
          {upcoming.length === 0 && <p className="text-[12px] text-mist-500">No payments scheduled.</p>}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub: ReactNode }) {
  return (
    <div className="min-w-0 xl:border-r xl:border-white/[0.06] xl:pl-2 xl:last:border-r-0">
      <div className="label">{label}</div>
      <div className="num mt-2 text-[22px] font-light leading-none text-white">{value}</div>
      <div className="mt-1.5 text-[11px] text-mist-500">{sub}</div>
    </div>
  );
}
