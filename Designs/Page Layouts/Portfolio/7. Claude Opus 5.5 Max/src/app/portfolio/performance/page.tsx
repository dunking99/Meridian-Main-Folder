import type { ReactNode } from "react";
import { getPortfolio, type Horizon } from "@/lib/engine";
import { contributions, drawdowns, histogram, mean, monthlyGrid, moneyWeighted, performanceMetrics, rolling, trailing, valueBridge, type Metrics } from "@/lib/analytics";
import { MONTH_LABELS, fmtDate, fmtNum, fmtPct, heat } from "@/lib/format";
import { Card, HoldingLink, Money, Pct } from "@/components/ui";
import { Columns, DivergingBars, Histogram, Scatter, Waterfall } from "@/components/charts";
import { SwitchCard, TimeChart } from "@/components/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Performance" };

type MetricDef = { key: keyof Metrics; label: string; fmt: (v: number) => string; better: "high" | "low" | "abs1"; hint: string };
const METRICS: MetricDef[] = [
  { key: "ann", label: "Return p.a.", fmt: (v) => fmtPct(v, 1), better: "high", hint: "Annualised time-weighted" },
  { key: "vol", label: "Volatility", fmt: (v) => fmtPct(v, 1, false), better: "low", hint: "Annualised std. dev." },
  { key: "sharpe", label: "Sharpe", fmt: (v) => fmtNum(v, 2), better: "high", hint: "Excess return per unit of risk" },
  { key: "sortino", label: "Sortino", fmt: (v) => fmtNum(v, 2), better: "high", hint: "Penalises downside only" },
  { key: "maxDD", label: "Max drawdown", fmt: (v) => fmtPct(v, 1), better: "high", hint: "Worst peak-to-trough" },
  { key: "calmar", label: "Calmar", fmt: (v) => fmtNum(v, 2), better: "high", hint: "Return ÷ max drawdown" },
  { key: "beta", label: "Beta", fmt: (v) => fmtNum(v, 2), better: "abs1", hint: "Sensitivity to benchmark" },
  { key: "alpha", label: "Alpha p.a.", fmt: (v) => fmtPct(v, 1), better: "high", hint: "Jensen's alpha" },
  { key: "te", label: "Tracking error", fmt: (v) => fmtPct(v, 1, false), better: "low", hint: "Std. dev. of excess" },
  { key: "ir", label: "Information ratio", fmt: (v) => fmtNum(v, 2), better: "high", hint: "Excess ÷ tracking error" },
  { key: "upCapture", label: "Up capture", fmt: (v) => fmtPct(v, 0, false), better: "high", hint: "Of benchmark up-months" },
  { key: "downCapture", label: "Down capture", fmt: (v) => fmtPct(v, 0, false), better: "low", hint: "Of benchmark down-months" },
  { key: "var95", label: "Daily VaR 95%", fmt: (v) => fmtPct(-v, 2), better: "low", hint: "1-in-20 day loss" },
  { key: "cvar95", label: "CVaR 95%", fmt: (v) => fmtPct(-v, 2), better: "low", hint: "Avg of worst 5% days" },
  { key: "ulcer", label: "Ulcer index", fmt: (v) => fmtPct(v, 1, false), better: "low", hint: "Depth × duration of pain" },
  { key: "winRate", label: "Months beating", fmt: (v) => fmtPct(v, 0, false), better: "high", hint: "Share of months ahead" },
];

export default async function PerformancePage() {
  const core = await getPortfolio();
  const ccy = core.ccy;
  const n = core.dates.length;
  const itd = performanceMetrics(core, "ACWI", "ITD");
  const irr = moneyWeighted(core);
  const grid = monthlyGrid(core, "ACWI");
  const years = [...grid.rows].reverse();
  const best = [...years].sort((a, b) => b.total - a.total)[0];
  const worst = [...years].sort((a, b) => a.total - b.total)[0];
  const tr = trailing(core, "ACWI");
  const dd = drawdowns(core);
  const roll = rolling(core, "ACWI");
  const hist = histogram(grid.all, 0.01);
  const sortedM = [...grid.all].sort((a, b) => a - b);
  const monthlyB = grid.rows.flatMap((r) => r.bench).filter((v): v is number => v !== null);
  const monthlyP = grid.monthly.map((x) => x.r);
  const pairs: [number, number][] = [];
  const bm = grid.rows.slice().reverse().flatMap((r) => r.bench.map((b, i) => [b, r.months[i]] as const)).filter(([b, p]) => b !== null && p !== null) as [number, number][];
  for (const [b, p] of bm) pairs.push([b, p]);
  const mb = mean(pairs.map((x) => x[0])), mp = mean(pairs.map((x) => x[1]));
  let sxy = 0, sxx = 0;
  for (const [b, p] of pairs) { sxy += (b - mb) * (p - mp); sxx += (b - mb) ** 2; }
  const beta = sxx ? sxy / sxx : 1;
  const alpha = mp - beta * mb;
  const horizons: Horizon[] = ["1Y", "3Y", "ITD"];
  const metricSets = horizons.map((h) => performanceMetrics(core, "ACWI", h));
  const bridges = (["YTD", "1Y", "ITD"] as Horizon[]).map((h) => valueBridge(core, h));
  const contribs = (["YTD", "1Y", "ITD"] as Horizon[]).map((h) => contributions(core, h));

  return (
    <div className="grid grid-cols-12 gap-4">
      <section className="card rise col-span-12 grid grid-cols-2 gap-y-4 px-5 py-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="TWR since inception" value={<Pct v={itd.p.cum} dp={1} />} sub={<><Pct v={itd.p.ann} dp={1} /> p.a.</>} />
        <Stat label="Money-weighted (IRR)" value={<Pct v={irr} dp={1} />} sub="p.a. · reflects your timing" />
        <Stat label="Excess vs ACWI" value={<Pct v={itd.p.ann - itd.b.ann} dp={1} />} sub={<>ACWI <Pct v={itd.b.ann} dp={1} tone={false} /> p.a.</>} />
        <Stat label="Total gain" value={<Money v={core.totals.totalGain} ccy={ccy} compact sign className="text-up" />} sub={<>on <Money v={core.totals.invested} ccy={ccy} compact /> invested</>} />
        <Stat label="Best year" value={<Pct v={best.total} dp={1} />} sub={best.year} />
        <Stat label="Worst year" value={<Pct v={worst.total} dp={1} />} sub={worst.year} />
      </section>

      <Card hero className="col-span-12" title="Cumulative return" index="01" subtitle="Time-weighted, net of fees, including dividends — flows removed so only investment skill shows">
        <TimeChart
          dates={core.dates}
          ccy={ccy}
          defaultRange="ALL"
          ranges={["YTD", "1Y", "3Y", "5Y", "ALL"]}
          series={[
            { key: "p", label: "Portfolio", values: core.index, color: "#f5bd62", style: "area" },
            { key: "acwi", label: "MSCI ACWI", values: core.bench.ACWI.index, color: "#7cc4ff", style: "line" },
            { key: "spx", label: "S&P 500", values: core.bench.SPX.index, color: "#b69cff", style: "line" },
            { key: "6040", label: "60/40 Global", values: core.bench["6040"].index, color: "#9ba3b2", style: "dash" },
          ]}
          views={[
            { key: "cum", label: "Cumulative %", series: ["p", "acwi", "spx", "6040"], format: "pct", rebase: "pct" },
            { key: "10k", label: "Growth of 10k", series: ["p", "acwi", "spx", "6040"], format: "money", rebase: "10k" },
          ]}
          height={340}
        />
      </Card>

      <Card className="col-span-12 xl:col-span-7" title="Trailing returns vs MSCI ACWI" index="02" subtitle="Periods over one year are annualised">
        <Columns groups={tr.map((r) => ({ label: r.h, values: [r.p, r.b] }))} series={[{ label: "Portfolio", color: "#f5bd62" }, { label: "ACWI", color: "#7cc4ff" }]} width={680} height={230} />
        <div className="mt-3 grid grid-cols-8 gap-1 border-t border-white/[0.06] pt-3 text-center">
          {tr.map((r) => (
            <div key={r.h}>
              <div className="label !text-[9px]">{r.h}{r.ann ? " p.a." : ""}</div>
              <div className={`num mt-1 text-[11.5px] ${r.p - r.b >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.p - r.b, 1)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="col-span-12 xl:col-span-5" title="Calendar years" index="03">
        <Columns groups={years.map((y) => ({ label: y.year, values: [y.total, y.benchTotal] }))} series={[{ label: "Portfolio", color: "#f5bd62" }, { label: "ACWI", color: "#7cc4ff" }]} width={480} height={262} />
      </Card>

      <Card className="col-span-12" title="Monthly returns" index="04" subtitle="Hover any cell for exact figures · right-hand columns compare the year with MSCI ACWI" bodyClass="!pt-3 overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="grid grid-cols-[3.5rem_repeat(12,minmax(0,1fr))_4.5rem_4.5rem_3.5rem] gap-1 text-center">
            <div />
            {MONTH_LABELS.map((mn) => <div key={mn} className="label pb-1">{mn}</div>)}
            <div className="label pb-1">Year</div><div className="label pb-1">ACWI</div><div className="label pb-1">Δ</div>
            {grid.rows.map((r) => (
              <div key={r.year} className="contents">
                <div className="num flex items-center text-[12px] text-mist-300">{r.year}</div>
                {r.months.map((v, i) => (
                  <div key={i} title={v === null ? "" : `${MONTH_LABELS[i]} ${r.year}: ${fmtPct(v, 2)} · ACWI ${fmtPct(r.bench[i], 2)}`} className="num grid h-9 place-items-center rounded-md text-[11px] text-white/90 transition-transform hover:scale-110 hover:ring-1 hover:ring-white/50" style={{ background: heat(v, 0.07) }}>
                    {v === null ? <span className="text-mist-500">·</span> : (v * 100).toFixed(1)}
                  </div>
                ))}
                <div className="num grid h-9 place-items-center rounded-md text-[12px] font-medium text-white ring-1 ring-inset ring-white/10" style={{ background: heat(r.total, 0.3) }}>{fmtPct(r.total, 1)}</div>
                <div className="num grid h-9 place-items-center text-[11.5px] text-sky/90">{fmtPct(r.benchTotal, 1)}</div>
                <div className={`num grid h-9 place-items-center text-[11px] ${r.total - r.benchTotal >= 0 ? "text-up" : "text-down"}`}>{fmtPct(r.total - r.benchTotal, 1)}</div>
              </div>
            ))}
            <div className="label flex items-center !text-[9px]">Avg</div>
            {grid.seasonality.map((s, i) => (
              <div key={i} className="grid h-7 place-items-center" title={`Hit rate ${fmtPct(s.hit, 0, false)}`}>
                <div className="flex h-5 w-full items-end justify-center">
                  <div className="w-3 rounded-sm" style={{ height: `${Math.min(100, (Math.abs(s.avg) / 0.04) * 100)}%`, background: s.avg >= 0 ? "#3ee0a1" : "#ff6b6b", opacity: 0.8 }} />
                </div>
              </div>
            ))}
            <div className="col-span-3 flex items-center pl-2 text-[10.5px] text-mist-500">seasonality · avg month</div>
          </div>
        </div>
      </Card>

      <Card className="col-span-12 xl:col-span-8" title="Drawdowns · underwater" index="05" subtitle={`Currently ${dd.current < -0.001 ? fmtPct(dd.current, 1) + " below the peak" : "at an all-time high"}`}>
        <TimeChart
          dates={core.dates}
          ccy={ccy}
          defaultRange="ALL"
          ranges={["1Y", "3Y", "ALL"]}
          series={[
            { key: "dd", label: "Portfolio", values: dd.dd, color: "#ff6b6b", style: "area" },
            { key: "bdd", label: "MSCI ACWI", values: dd.bdd, color: "#7cc4ff", style: "dash" },
          ]}
          views={[{ key: "dd", label: "Drawdown", series: ["dd", "bdd"], format: "pct" }]}
          height={240}
        />
      </Card>
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Worst drawdowns" index="06">
        <div className="space-y-3">
          {dd.episodes.map((e, i) => (
            <div key={i} className="grid grid-cols-[1.2rem_1fr_auto] items-center gap-3">
              <span className="num text-[11px] text-mist-500">{i + 1}</span>
              <div className="min-w-0">
                <div className="text-[12px] text-mist-200">{fmtDate(e.start, "mshort")} → {fmtDate(e.trough, "mshort")}</div>
                <div className="mt-1 flex items-center gap-2 text-[10.5px] text-mist-500">
                  <span>{e.fallDays}d down</span><span>·</span><span>{e.recoveryDays !== null ? `${e.recoveryDays}d to recover` : "not yet recovered"}</span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <div className="bg-down" style={{ width: `${(e.fallDays / (e.fallDays + (e.recoveryDays ?? 0))) * 100}%` }} />
                  <div className="bg-up/60" style={{ width: `${((e.recoveryDays ?? 0) / (e.fallDays + (e.recoveryDays ?? 0))) * 100}%` }} />
                </div>
              </div>
              <span className="num text-[15px] text-down">{fmtPct(e.depth, 1)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="col-span-12 xl:col-span-8" title="Rolling 12 months" index="07" subtitle="How return, risk and risk-adjusted return have evolved">
        <TimeChart
          dates={roll.dates}
          ccy={ccy}
          defaultRange="ALL"
          ranges={["3Y", "ALL"]}
          series={[
            { key: "r", label: "Portfolio return", values: roll.ret.map((v) => v / 100), color: "#f5bd62", style: "line" },
            { key: "br", label: "ACWI return", values: roll.bret.map((v) => v / 100), color: "#7cc4ff", style: "dash" },
            { key: "v", label: "Portfolio vol", values: roll.vol.map((v) => v / 100), color: "#ff8a5c", style: "area" },
            { key: "bv", label: "ACWI vol", values: roll.bvol.map((v) => v / 100), color: "#7cc4ff", style: "dash" },
            { key: "s", label: "Sharpe", values: roll.sharpe.map((v) => v / 100), color: "#3ee0a1", style: "area" },
          ]}
          views={[
            { key: "ret", label: "Return", series: ["r", "br"], format: "pct" },
            { key: "vol", label: "Volatility", series: ["v", "bv"], format: "pct" },
            { key: "sh", label: "Sharpe ×100", series: ["s"], format: "pct" },
          ]}
          height={250}
        />
      </Card>
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Monthly return distribution" index="08">
        <Histogram bins={hist} markers={[{ x: mean(grid.all), label: `avg ${fmtPct(mean(grid.all), 1)}` }]} width={420} height={190} />
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
          <Mini k="Positive months" v={fmtPct(grid.all.filter((v) => v > 0).length / grid.all.length, 0, false)} />
          <Mini k="Median" v={fmtPct(sortedM[Math.floor(sortedM.length / 2)], 2)} />
          <Mini k="Skew" v={fmtNum(itd.p.skew, 2)} />
          <Mini k="Best month" v={<span className="text-up">{fmtPct(itd.p.bestMonth, 1)}</span>} />
          <Mini k="Worst month" v={<span className="text-down">{fmtPct(itd.p.worstMonth, 1)}</span>} />
          <Mini k="Excess kurtosis" v={fmtNum(itd.p.kurt, 2)} />
        </div>
      </Card>

      <SwitchCard className="col-span-12" title="Risk-adjusted scorecard · portfolio vs MSCI ACWI" index="09" labels={horizons} defaultIndex={2}>
        {metricSets.map((ms, hi) => (
          <div key={hi} className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {METRICS.map((d) => {
              const p = ms.p[d.key], b = ms.b[d.key];
              const vsBench = d.key === "beta" || d.key === "alpha" || d.key === "te" || d.key === "ir" || d.key === "upCapture" || d.key === "downCapture" || d.key === "winRate";
              const good = d.better === "high" ? p >= b : d.better === "low" ? p <= b : Math.abs(p - 1) <= 0.1;
              return (
                <div key={d.key} className="rounded-xl bg-white/[0.02] p-3 ring-1 ring-inset ring-white/[0.05]" title={d.hint}>
                  <div className="flex items-center justify-between"><span className="label !text-[9px]">{d.label}</span><span className={`h-1.5 w-1.5 rounded-full ${good ? "bg-up" : "bg-gold-400"}`} /></div>
                  <div className="num mt-2 text-[18px] text-white">{d.fmt(p)}</div>
                  <div className="mt-1 text-[10.5px] text-mist-500">{vsBench ? d.hint : <>ACWI <span className="num text-sky/80">{d.fmt(b)}</span></>}</div>
                </div>
              );
            })}
          </div>
        ))}
      </SwitchCard>

      <SwitchCard className="col-span-12 xl:col-span-7" title="Value bridge · where the money came from" index="10" labels={["YTD", "1Y", "Since start"]} defaultIndex={1}>
        {bridges.map((b, i) => <Waterfall key={i} steps={b.steps} ccy={ccy} width={700} height={260} />)}
      </SwitchCard>

      <SwitchCard className="col-span-12 xl:col-span-5" title="Contribution by holding" index="11" labels={["YTD", "1Y", "Since start"]} defaultIndex={1}>
        {contribs.map((c, i) => {
          const top = [...c.rows.slice(0, 7), ...c.rows.slice(-4).filter((r) => r.pnl < 0 && !c.rows.slice(0, 7).includes(r))];
          return (
            <div key={i}>
              <DivergingBars
                labelClass="w-14"
                items={[...top.map((r) => ({ key: r.symbol, label: <HoldingLink symbol={r.symbol} className="num">{r.symbol}</HoldingLink>, value: r.pnl, display: <Money v={r.pnl} ccy={ccy} compact sign /> })),
                  { key: "_res", label: <span className="text-mist-500">Cash & FX</span>, value: c.residual, display: <Money v={c.residual} ccy={ccy} compact sign /> }]}
              />
              <div className="mt-3 flex justify-between border-t border-white/[0.06] pt-3 text-[12px]"><span className="text-mist-400">Total investment gain</span><Money v={c.total} ccy={ccy} compact sign className={c.total >= 0 ? "text-up" : "text-down"} /></div>
            </div>
          );
        })}
      </SwitchCard>

      <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Monthly returns vs benchmark" index="12" subtitle="Each dot is a month — slope is your beta, dots above the diagonal beat ACWI">
        <Scatter points={pairs} beta={beta} alpha={alpha} width={440} height={300} />
      </Card>

      <Card className="col-span-12 md:col-span-6 xl:col-span-7" title="Up-market vs down-market behaviour" index="13">
        <div className="grid gap-6 sm:grid-cols-2">
          {[{ k: "Up capture", v: itd.p.upCapture, good: itd.p.upCapture >= 1, text: "of ACWI's gains captured in up-months" }, { k: "Down capture", v: itd.p.downCapture, good: itd.p.downCapture <= 1, text: "of ACWI's losses taken in down-months" }].map((x) => (
            <div key={x.k}>
              <div className="label">{x.k}</div>
              <div className={`serif mt-2 text-[56px] leading-none ${x.good ? "text-up" : "text-gold-300"}`}>{Math.round(x.v * 100)}<span className="text-[28px]">%</span></div>
              <div className="mt-1 text-[12px] text-mist-400">{x.text}</div>
              <div className="relative mt-4 h-2 rounded-full bg-white/[0.05]">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (x.v / 1.5) * 100)}%`, background: x.good ? "#3ee0a1" : "#f5bd62" }} />
                <div className="absolute -top-1 h-4 w-px bg-white/70" style={{ left: `${(1 / 1.5) * 100}%` }} />
              </div>
              <div className="mt-1 text-right text-[10px] text-mist-500" style={{ width: `${(1 / 1.5) * 100 + 8}%` }}>100%</div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
          <Mini k="Months ahead of ACWI" v={fmtPct(itd.p.winRate, 0, false)} />
          <Mini k="Avg month (you / ACWI)" v={<>{fmtPct(mean(monthlyP), 2)} <span className="text-mist-500">/ {fmtPct(mean(monthlyB), 2)}</span></>} />
          <Mini k="Correlation · R²" v={`${fmtNum(itd.p.corr, 2)} · ${fmtNum(itd.p.r2, 2)}`} />
        </div>
      </Card>
      <p className="col-span-12 text-[11px] text-mist-500">Data through {fmtDate(core.asOf, "medium")} · {n} trading days · returns in {ccy}, including FX translation.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub: ReactNode }) {
  return (
    <div className="min-w-0 xl:border-r xl:border-white/[0.06] xl:pl-2 xl:last:border-r-0">
      <div className="label">{label}</div>
      <div className="mt-2 text-[22px] font-light leading-none text-white">{value}</div>
      <div className="mt-1.5 text-[11px] text-mist-500">{sub}</div>
    </div>
  );
}
function Mini({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label !text-[9px]">{k}</div>
      <div className="num mt-1.5 text-[13px] text-mist-100">{v}</div>
    </div>
  );
}
