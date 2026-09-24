import { getPortfolio } from "@/lib/engine";
import { Card } from "@/components/ui";
import { GroupedBars, RollingPanel, Bridge, DrawdownChart, CumulativeChart } from "@/components/performance";
import { MonthlyHeatmap, MoneyDiverging } from "@/components/charts/advanced";
import { Histogram } from "@/components/charts/basic";
import { Money } from "@/components/money";
import { pct, longDate, tone } from "@/lib/format";

function Metric({ label, value, bench, better, hint }: { label: string; value: string; bench?: string; better?: boolean; hint?: string }) {
  return (
    <div className="group relative bg-panel p-4" title={hint}>
      <div className="eyebrow truncate">{label}</div>
      <div className="num mt-1.5 text-2xl leading-none">{value}</div>
      {bench !== undefined && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px]">
          <span className={`h-1.5 w-1.5 rounded-full ${better ? "bg-pos" : "bg-neg"}`} />
          <span className="text-dim">ACWI</span><span className="num text-muted">{bench}</span>
        </div>
      )}
      {hint && bench === undefined && <div className="mt-1.5 truncate text-[10.5px] text-dim">{hint}</div>}
    </div>
  );
}

export default async function PerformancePage() {
  const p = await getPortfolio();
  const s = p.stats;
  const oneY = p.trailing.find((t) => t.label === "1Y")!;
  const ddDays = s.maxDDRecovery ? Math.round((new Date(s.maxDDRecovery).getTime() - new Date(s.maxDDStart).getTime()) / 86400000) : null;
  const metrics = [
    { label: "Time-weighted (SI)", value: pct(p.totals.twr, 1, true), bench: pct(p.series.bidx[p.series.bidx.length - 1] - 1, 1, true), better: p.totals.twr > p.series.bidx[p.series.bidx.length - 1] - 1 },
    { label: "CAGR", value: pct(s.cagr, 1), bench: pct(s.bcagr, 1), better: s.cagr > s.bcagr },
    { label: "1Y return", value: pct(oneY.p, 1, true), bench: pct(oneY.b, 1, true), better: oneY.p > oneY.b },
    { label: "Volatility", value: pct(s.vol, 1), bench: pct(s.bvol, 1), better: s.vol < s.bvol },
    { label: "Sharpe", value: s.sharpe.toFixed(2), bench: ((s.bcagr - 0.04) / s.bvol).toFixed(2), better: s.sharpe > (s.bcagr - 0.04) / s.bvol },
    { label: "Sortino", value: s.sortino.toFixed(2), hint: "Downside-risk adjusted" },
    { label: "Max drawdown", value: pct(s.maxDD, 1), bench: pct(s.bmaxDD, 1), better: s.maxDD > s.bmaxDD },
    { label: "Calmar", value: s.calmar.toFixed(2), hint: "CAGR ÷ max drawdown" },
    { label: "Beta", value: s.beta.toFixed(2), hint: "Sensitivity to ACWI" },
    { label: "Jensen's alpha", value: pct(s.alpha, 1, true), hint: "Annualised, CAPM" },
    { label: "Tracking error", value: pct(s.te, 1), hint: "Active risk vs ACWI" },
    { label: "Information ratio", value: s.ir.toFixed(2), hint: "Excess return ÷ TE" },
    { label: "R²", value: s.r2.toFixed(2), hint: "Explained by benchmark" },
    { label: "Up capture", value: pct(s.upCapture, 0), hint: "Monthly, when ACWI rises" },
    { label: "Down capture", value: pct(s.downCapture, 0), hint: "Monthly, when ACWI falls" },
    { label: "Positive months", value: pct(s.posMonths, 0), hint: `Best ${pct(s.bestMonth, 1)} · worst ${pct(s.worstMonth, 1)}` },
  ];
  const b = p.pnlBreakdown;

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line sm:grid-cols-4 lg:grid-cols-8">
        {metrics.map((m) => <Metric key={m.label} {...m} />)}
      </div>

      <Card className="col-span-12 xl:col-span-8" eyebrow="Time-weighted, cash-flow neutral" title="Cumulative return" glow>
        <CumulativeChart dates={p.dates} idx={p.series.idx} bidx={p.series.bidx} />
      </Card>
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Where the gains came from" title="Value bridge">
        <Bridge start={p.totals.netDeposits} end={p.totals.value} steps={[{ label: "Unrealised", value: b.unrealized }, { label: "Realised", value: b.realized }, { label: "Dividends", value: b.dividends }, { label: "Interest", value: b.interest }, { label: "Fees", value: b.fees }]} />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
          <div><div className="text-dim">Total gain</div><Money usd={p.totals.totalGain} sign colored className="text-lg" /></div>
          <div><div className="text-dim">Money-weighted gain</div><span className={`num text-lg ${tone(p.totals.totalGainPct)}`}>{pct(p.totals.totalGainPct, 1, true)}</span></div>
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-6" eyebrow="Periods to date" title="Trailing returns">
        <GroupedBars rows={p.trailing} />
      </Card>
      <Card className="col-span-12 xl:col-span-6" eyebrow="Calendar years" title="Annual returns">
        <GroupedBars rows={p.yearly.map((y) => ({ label: String(y.year) + (y.year === Number(p.asOf.slice(0, 4)) ? " YTD" : ""), p: y.ret, b: y.bench }))} />
      </Card>

      <Card className="col-span-12" eyebrow="Month by month" title="Monthly returns">
        <MonthlyHeatmap monthly={p.monthly} yearly={p.yearly} />
      </Card>

      <Card className="col-span-12 xl:col-span-8" eyebrow="Distance below the previous peak" title="Underwater chart">
        <DrawdownChart dates={p.dates} dd={p.series.dd} bdd={p.series.bdd} />
      </Card>
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Worst episode" title="Drawdown anatomy">
        <div className="font-serif text-6xl text-neg">{pct(s.maxDD, 1)}</div>
        <div className="mt-4 space-y-3">
          {[["Peak", longDate(s.maxDDStart)], ["Trough", longDate(s.maxDDTrough)], ["Recovered", s.maxDDRecovery ? longDate(s.maxDDRecovery) : "Not yet"], ["Peak → recovery", ddDays ? `${ddDays} days` : "—"], ["Current", pct(s.currentDD, 1)]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-line/60 pb-2 text-sm"><span className="text-muted">{k}</span><span className="num">{v}</span></div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-ink/40 p-3 text-xs text-muted">ACWI fell <span className="num text-fg">{pct(s.bmaxDD, 1)}</span> at worst — you captured <span className="num text-fg">{pct(s.maxDD / s.bmaxDD, 0)}</span> of the benchmark&apos;s decline.</div>
      </Card>

      <Card className="col-span-12 xl:col-span-7" eyebrow="How risk & return evolve" title="Rolling metrics">
        <RollingPanel rolling={p.rolling} />
      </Card>
      <Card className="col-span-12 md:col-span-6 xl:col-span-5" eyebrow="Daily returns, since inception" title="Return distribution">
        <Histogram bins={p.histogram} />
        <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
          {[["Best day", pct(s.bestDay, 2, true)], ["Worst day", pct(s.worstDay, 2)], ["Up days", pct(s.posDays, 0)], ["Skew", s.skew.toFixed(2)], ["Excess kurt.", s.kurt.toFixed(2)], ["1d CVaR 95", pct(-s.cvar95, 2)]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-ink/40 py-2"><div className="text-[10px] text-dim">{k}</div><div className="num">{v}</div></div>
          ))}
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-6" eyebrow="Total return incl. realised & income, since inception" title="Contribution by holding">
        <MoneyDiverging rows={p.attribution.map((a) => ({ label: a.symbol, value: a.value, href: p.holdings.some((h) => h.symbol === a.symbol) ? `/portfolio/holdings/${a.symbol}` : undefined }))} limit={16} />
      </Card>
      <Card className="col-span-12 xl:col-span-6" eyebrow="Monthly, vs ACWI" title="Up & down capture">
        <div className="grid grid-cols-2 gap-6">
          {[["Up markets", s.upCapture, "#2fe39b", "higher is better"], ["Down markets", s.downCapture, "#ff5a78", "lower is better"]].map(([l, v, c, h]) => (
            <div key={l as string}>
              <div className="eyebrow">{l as string}</div>
              <div className="num mt-1 text-4xl" style={{ color: c as string }}>{pct(v as number, 0)}</div>
              <div className="relative mt-3 h-3 rounded-full bg-line">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (v as number) / 1.5 * 100)}%`, background: c as string }} />
                <div className="absolute -inset-y-1 w-0.5 bg-fg" style={{ left: `${100 / 1.5}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-dim"><span>0%</span><span>100% = ACWI</span><span>150%</span></div>
              <div className="mt-2 text-[11px] text-muted">{h as string}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-line bg-ink/30 p-4 text-sm leading-relaxed text-muted">
          Capture ratio <span className="num text-accent">{(s.upCapture / s.downCapture).toFixed(2)}×</span> — you&apos;ve historically kept {pct(s.upCapture, 0)} of rallies while absorbing only {pct(s.downCapture, 0)} of sell-offs.
        </div>
      </Card>
    </div>
  );
}
