import Link from "next/link";
import { getPortfolio } from "@/lib/engine";
import { Card, Stat } from "@/components/ui";
import { Ledger, CashChart, KIND_COL } from "@/components/activity";
import { MoneyBars } from "@/components/charts/basic";
import { Money } from "@/components/money";
import { MONTHS } from "@/lib/format";

export default async function ActivityPage() {
  const p = await getPortfolio();
  const tx = p.txns;
  const year = p.asOf.slice(0, 4);
  const sumK = (k: string, pred: (d: string) => boolean = () => true) => tx.filter((t) => t.kind === k && pred(t.date)).reduce((s, t) => s + t.usd, 0);

  // monthly flows, last 24 months
  const months: string[] = [];
  const end = new Date(p.asOf + "T00:00:00Z");
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const flows = months.map((m) => ({ m, dep: tx.filter((t) => t.date.startsWith(m) && t.kind === "DEPOSIT").reduce((s, t) => s + t.usd, 0), buys: -tx.filter((t) => t.date.startsWith(m) && t.kind === "BUY").reduce((s, t) => s + t.usd, 0) }));

  // dividend calendar: symbol × last 12 months
  const last12 = months.slice(-12);
  const divs = tx.filter((t) => t.kind === "DIVIDEND" && last12.includes(t.date.slice(0, 7)));
  const syms = Array.from(new Set(divs.map((d) => d.symbol!)));
  const cal = syms.map((s) => ({ s, cells: last12.map((m) => divs.filter((d) => d.symbol === s && d.date.startsWith(m)).reduce((a, d) => a + d.usd, 0)) })).sort((a, b) => b.cells.reduce((x, y) => x + y, 0) - a.cells.reduce((x, y) => x + y, 0));
  const calMax = Math.max(...cal.flatMap((c) => c.cells), 1);

  const kindMix = Object.keys(KIND_COL).map((k) => ({ k, n: tx.filter((t) => t.kind === k).length }));

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="card col-span-12 grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Net deposits" value={<Money usd={p.totals.netDeposits} compact />} sub="since inception" />
        <Stat label={`Contributed ${year}`} value={<Money usd={sumK("DEPOSIT", (d) => d.startsWith(year))} compact />} sub="deposits YTD" />
        <Stat label="Dividends TTM" value={<Money usd={p.totals.ttmIncome} compact />} sub="incl. cash interest" />
        <Stat label="Realised P&L" value={<Money usd={p.pnlBreakdown.realized} compact sign colored />} sub={`${tx.filter((t) => t.kind === "SELL").length} sales`} />
        <Stat label="Fees paid" value={<Money usd={p.pnlBreakdown.fees} compact />} sub="platform fees" />
        <Stat label="Transactions" value={tx.length} sub={`${tx.filter((t) => t.kind === "BUY").length} buys`} />
      </div>

      <Card className="col-span-12 xl:col-span-7" eyebrow="Last 24 months · deposits" title="Money in">
        <MoneyBars data={flows.map((f) => ({ label: `${MONTHS[Number(f.m.slice(5)) - 1]} ${f.m.slice(0, 4)} · bought ${Math.round(f.buys).toLocaleString()} USD`, value: f.dep, sub: f.m.slice(5) === "01" ? f.m.slice(2, 4) : MONTHS[Number(f.m.slice(5)) - 1][0] }))} />
      </Card>
      <Card className="col-span-12 xl:col-span-5" eyebrow="Uninvested, all currencies" title="Cash over time">
        <CashChart dates={p.dates} cash={p.series.cash} invested={p.series.invested} />
      </Card>

      <Card className="col-span-12 xl:col-span-8" eyebrow="Every cash movement, newest first" title="Ledger">
        <Ledger txns={tx} />
      </Card>

      <div className="col-span-12 space-y-4 xl:col-span-4">
        <Card eyebrow="Trailing 12 months, by payer" title="Dividend calendar">
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: "48px repeat(12, minmax(0,1fr))" }}>
            <div />
            {last12.map((m) => <div key={m} className="text-center text-[9px] text-dim">{MONTHS[Number(m.slice(5)) - 1][0]}</div>)}
            {cal.map((c) => (
              <div key={c.s} className="contents">
                <Link href={`/portfolio/holdings/${c.s}`} className="truncate pr-1 text-[10.5px] leading-5 text-muted hover:text-accent">{c.s}</Link>
                {c.cells.map((v, i) => <div key={i} className="h-5 rounded-[3px]" title={v ? `${c.s} ${last12[i]}: ${v.toFixed(2)} USD` : ""} style={{ background: v ? `rgba(63,208,255,${0.2 + (v / calMax) * 0.8})` : "#12151c" }} />)}
              </div>
            ))}
          </div>
        </Card>
        <Card eyebrow="Composition of ledger" title="Activity mix">
          <div className="space-y-2">
            {kindMix.filter((k) => k.n).map((k) => (
              <div key={k.k} className="grid grid-cols-[82px_1fr_36px] items-center gap-2 text-xs">
                <span className="text-muted">{k.k[0] + k.k.slice(1).toLowerCase()}</span>
                <div className="h-2 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(k.n / Math.max(...kindMix.map((x) => x.n))) * 100}%`, background: KIND_COL[k.k] }} /></div>
                <span className="num text-right">{k.n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
