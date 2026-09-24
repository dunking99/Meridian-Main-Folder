import type { ReactNode } from "react";
import { getPortfolio, shiftDate } from "@/lib/engine";
import { fmtPct } from "@/lib/format";
import { Card, Money } from "@/components/ui";
import { Columns } from "@/components/charts";
import { TimeChart } from "@/components/client";
import { Ledger, TransactionForm, type LedgerRow } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const core = await getPortfolio();
  const ccy = core.ccy;
  const year = core.asOf.slice(0, 4);
  const since12 = shiftDate(core.asOf, { years: -1 });
  let depYtd = 0, trades12 = 0, feesAll = 0;
  const quarters = new Map<string, { dep: number; wd: number }>();
  for (const t of core.txns) {
    if (t.type === "DEPOSIT" && t.date.startsWith(year)) depYtd += t.amountDisp;
    if ((t.type === "BUY" || t.type === "SELL") && t.date > since12) trades12++;
    if (t.fee) feesAll += t.fee / core.fxD[core.start + t.k];
    if (t.type === "DEPOSIT" || t.type === "WITHDRAWAL") {
      const q = `${t.date.slice(2, 4)}Q${Math.floor((Number(t.date.slice(5, 7)) - 1) / 3) + 1}`;
      const cur = quarters.get(q) ?? { dep: 0, wd: 0 };
      if (t.type === "DEPOSIT") cur.dep += t.amountDisp;
      else cur.wd += t.amountDisp;
      quarters.set(q, cur);
    }
  }
  const qList = [...quarters.entries()].slice(-12);
  const realizedByYear = new Map<string, { st: number; lt: number }>();
  for (const l of core.realizedLots) {
    const y = l.sellDate.slice(0, 4);
    const cur = realizedByYear.get(y) ?? { st: 0, lt: 0 };
    if (l.longTerm) cur.lt += l.gain;
    else cur.st += l.gain;
    realizedByYear.set(y, cur);
  }
  const realizedYtd = realizedByYear.get(year);
  const rows: LedgerRow[] = [...core.txns].reverse().map((t) => ({
    id: t.id, date: t.date, type: t.type, symbol: t.symbol, account: t.account, quantity: t.quantity, price: t.price, amountDisp: t.amountDisp, fee: t.fee,
    note: t.note, source: t.source, currency: t.symbol ? core.market.bySym[t.symbol]?.currency ?? "USD" : "USD",
  }));
  const tradables = core.market.instruments.filter((i) => i.kind !== "benchmark").sort((a, b) => a.symbol.localeCompare(b.symbol));
  const prices = Object.fromEntries(tradables.map((i) => [i.symbol, core.market.px[i.symbol][core.market.dates.length - 1]]));

  return (
    <div className="grid grid-cols-12 gap-4">
      <section className="card rise col-span-12 grid grid-cols-2 gap-y-4 px-5 py-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Net contributions" value={<Money v={core.totals.invested} ccy={ccy} compact />} sub={<>in {fmtPct(core.totals.value / core.totals.invested - 1, 0)} growth on top</>} />
        <Stat label={`Deposits ${year}`} value={<Money v={depYtd} ccy={ccy} compact />} sub="year to date" />
        <Stat label="Withdrawals" value={<Money v={-core.totals.withdrawals} ccy={ccy} compact />} sub="all time" />
        <Stat label="Trades · 12M" value={String(trades12)} sub="buys + sells" />
        <Stat label={`Realized ${year}`} value={<Money v={(realizedYtd?.st ?? 0) + (realizedYtd?.lt ?? 0)} ccy={ccy} compact sign />} sub={<>ST <Money v={realizedYtd?.st ?? 0} ccy={ccy} compact /> · LT <Money v={realizedYtd?.lt ?? 0} ccy={ccy} compact /></>} />
        <Stat label="Fees paid" value={<Money v={feesAll} ccy={ccy} compact />} sub={<>{fmtPct(feesAll / core.totals.invested, 2, false)} of contributions</>} />
      </section>

      <Card className="col-span-12 xl:col-span-7" title="Money in & out · by quarter" index="01">
        <Columns groups={qList.map(([q, v]) => ({ label: q, values: [v.dep, v.wd] }))} series={[{ label: "Deposits", color: "#f5bd62" }, { label: "Withdrawals", color: "#ff6b6b" }]} fmt="money" ccy={ccy} width={700} height={240} labels={false} />
      </Card>
      <Card className="col-span-12 xl:col-span-5" title="Cash balance" index="02">
        <TimeChart
          dates={core.dates}
          ccy={ccy}
          defaultRange="3Y"
          ranges={["1Y", "3Y", "ALL"]}
          series={[{ key: "cash", label: "Cash", values: core.cash, color: "#4fd8c4", style: "area" }]}
          views={[{ key: "cash", label: "Cash", series: ["cash"], format: "money" }]}
          height={200}
        />
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Record a transaction" index="03" subtitle="Writes to the ledger — every page recalculates from it">
        <TransactionForm instruments={tradables.map((i) => ({ symbol: i.symbol, name: i.name, currency: i.currency, account: i.meta.account }))} lastDate={core.asOf} prices={prices} />
      </Card>
      <Card className="col-span-12 md:col-span-6 xl:col-span-8" title="Realized gains by year" index="04" subtitle="FIFO lots · long-term = held more than a year">
        <Columns groups={[...realizedByYear.entries()].sort().map(([y, v]) => ({ label: y, values: [v.lt, v.st] }))} series={[{ label: "Long-term", color: "#3ee0a1" }, { label: "Short-term", color: "#f5bd62" }]} fmt="money" ccy={ccy} width={760} height={230} />
        <div className="mt-2 flex gap-4 text-[10.5px] text-mist-500"><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-up" />Long-term</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gold-400 opacity-60" />Short-term</span></div>
      </Card>

      <Card className="col-span-12" title="Ledger" index="05" bodyClass="!px-0">
        <Ledger rows={rows} ccy={ccy} />
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
