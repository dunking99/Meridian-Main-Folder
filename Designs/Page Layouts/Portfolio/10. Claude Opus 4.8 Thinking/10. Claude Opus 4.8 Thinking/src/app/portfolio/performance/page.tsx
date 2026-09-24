import { getPortfolio } from "@/lib/portfolio";
import { Card, CardHead } from "@/components/ui";
import { PctChart, ReturnsHeatmap, Histogram } from "@/components/charts";
import { fmtSignedPct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const d = await getPortfolio();
  const { series, monthly, trailing, risk } = d;

  const base = series[0].value;
  const bbase = series[0].bench;
  const cumPort = series.map((s) => ({ date: s.date, value: (s.value / base - 1) * 100 }));
  const cumBench = series.map((s) => ({ date: s.date, value: (s.bench / bbase - 1) * 100 }));

  // drawdown
  let peak = series[0].value;
  const drawdown = series.map((s) => {
    if (s.value > peak) peak = s.value;
    return { date: s.date, value: (s.value / peak - 1) * 100 };
  });
  const maxDD = Math.min(...drawdown.map((x) => x.value));

  const best = [...monthly].sort((a, b) => b.ret - a.ret)[0];
  const worst = [...monthly].sort((a, b) => a.ret - b.ret)[0];
  const posMonths = monthly.filter((m) => m.ret >= 0).length;
  const posPct = (posMonths / monthly.length) * 100;
  const alpha = trailing.find((t) => t.label === "Max")!;

  // histogram bins of monthly returns
  const edges = [-10, -6, -3, -1, 0, 1, 3, 6, 10];
  const labels = ["<-6", "-6:-3", "-3:-1", "-1:0", "0:1", "1:3", "3:6", ">6"];
  const bins = labels.map((label, i) => {
    const lo = edges[i];
    const hi = edges[i + 1];
    const count = monthly.filter((m) => m.ret >= lo && m.ret < hi).length + (i === labels.length - 1 ? monthly.filter((m) => m.ret >= hi).length : 0) + (i === 0 ? monthly.filter((m) => m.ret < lo).length : 0);
    return { label, count, color: (lo + hi) / 2 >= 0 ? "#34d399" : "#fb7185" };
  });

  const monthName = (m: number) => ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];

  const kpis = [
    { l: "Total Return", v: fmtSignedPct(alpha.port), pos: alpha.port >= 0 },
    { l: "Annualized (CAGR)", v: fmtSignedPct(risk.annualizedReturn), pos: risk.annualizedReturn >= 0 },
    { l: "Alpha vs ACWI", v: fmtSignedPct(alpha.port - alpha.bench), pos: alpha.port - alpha.bench >= 0 },
    { l: "Best Month", v: fmtSignedPct(best.ret), pos: true, sub: `${monthName(best.month)} ${best.year}` },
    { l: "Worst Month", v: fmtSignedPct(worst.ret), pos: false, sub: `${monthName(worst.month)} ${worst.year}` },
    { l: "Positive Months", v: `${posPct.toFixed(0)}%`, pos: true, sub: `${posMonths} of ${monthly.length}` },
  ];

  return (
    <div className="fade-up space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.l} className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">{k.l}</div>
            <div className={`tabnum mt-2 text-xl font-semibold ${k.pos ? "text-pos" : "text-neg"}`}>{k.v}</div>
            {k.sub && <div className="mt-0.5 text-[11px] text-ink-faint">{k.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="Cumulative Return" sub="Portfolio vs global benchmark (ACWI)" right={
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-ink-dim"><span className="h-0.5 w-3 rounded bg-accent" />Portfolio</span>
              <span className="flex items-center gap-1.5 text-ink-faint"><span className="h-0.5 w-3 rounded bg-[#4b5769]" />ACWI</span>
            </div>
          } />
          <div className="px-3 py-3">
            <PctChart primary={cumPort} secondary={cumBench} height={280} />
          </div>
        </Card>

        <Card className="lg:col-span-4">
          <CardHead title="Trailing Returns" sub="Portfolio vs benchmark" />
          <div className="space-y-1 px-5 py-3">
            {trailing.map((t) => {
              const excess = t.port - t.bench;
              return (
                <div key={t.label} className="flex items-center gap-3 py-1.5">
                  <span className="w-9 text-xs font-medium text-ink-dim">{t.label}</span>
                  <div className="relative flex h-5 flex-1 items-center">
                    <div className="absolute left-1/2 h-full w-px bg-[#232c39]" />
                    <div className="flex w-1/2 justify-end pr-px">
                      {t.port < 0 && <div className="h-2.5 rounded-l" style={{ width: `${Math.min(100, Math.abs(t.port) * 3)}%`, background: "#fb7185" }} />}
                    </div>
                    <div className="flex w-1/2 pl-px">
                      {t.port >= 0 && <div className="h-2.5 rounded-r" style={{ width: `${Math.min(100, t.port * 3)}%`, background: "#34d399" }} />}
                    </div>
                  </div>
                  <span className={`tabnum w-14 text-right text-xs font-semibold ${t.port >= 0 ? "text-pos" : "text-neg"}`}>{fmtSignedPct(t.port)}</span>
                  <span className={`tabnum w-12 text-right text-[11px] ${excess >= 0 ? "text-pos/70" : "text-neg/70"}`}>{fmtSignedPct(excess)}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-3 border-t border-line pt-2 text-[10px] uppercase tracking-wider text-ink-faint">
              <span className="w-9" /><span className="flex-1" /><span className="w-14 text-right">Return</span><span className="w-12 text-right">Excess</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Monthly Returns" sub="Calendar heatmap of month-over-month performance" />
        <ReturnsHeatmap monthly={monthly} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="Drawdown" sub={`Underwater equity curve · max drawdown ${maxDD.toFixed(1)}%`} />
          <div className="px-3 py-3">
            <PctChart primary={drawdown} height={220} color="#fb7185" fillNegative />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHead title="Return Distribution" sub="Monthly return frequency" />
          <div className="px-4 py-5">
            <Histogram bins={bins} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
        {[
          { l: "Volatility (ann.)", v: `${risk.volAnnual.toFixed(1)}%` },
          { l: "Sharpe Ratio", v: risk.sharpe.toFixed(2) },
          { l: "Sortino Ratio", v: risk.sortino.toFixed(2) },
          { l: "Max Drawdown", v: `${risk.maxDD.toFixed(1)}%` },
          { l: "Beta (ACWI)", v: risk.betaToBench.toFixed(2) },
          { l: "Correlation", v: risk.corrToBench.toFixed(2) },
          { l: "Best Month", v: fmtSignedPct(best.ret) },
          { l: "Worst Month", v: fmtSignedPct(worst.ret) },
        ].map((m) => (
          <div key={m.l} className="bg-panel px-4 py-3.5">
            <div className="text-[10px] uppercase tracking-wider text-ink-faint">{m.l}</div>
            <div className="tabnum mt-1 text-lg font-semibold text-ink">{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
