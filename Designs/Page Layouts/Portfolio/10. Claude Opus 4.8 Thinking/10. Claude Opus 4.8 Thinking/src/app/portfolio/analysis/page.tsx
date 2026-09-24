import { getPortfolio } from "@/lib/portfolio";
import { Card, CardHead, Badge } from "@/components/ui";
import { BubbleChart, CorrelationMatrix, HBars, Gauge, DivergingBars } from "@/components/charts";
import { fmtSignedPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
function scoreColor(s: number) {
  return s >= 70 ? "#34d399" : s >= 45 ? "#e8c489" : "#fb7185";
}
function gradeFor(s: number) {
  const g = ["D", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
  return g[Math.min(g.length - 1, Math.floor(s / 10))];
}

const BENCH_SECTORS: Record<string, number> = {
  Technology: 24,
  Financials: 15,
  "Consumer Discretionary": 11,
  "Health Care": 11,
  "Communication Services": 8,
  "Consumer Staples": 6,
};

export default async function AnalysisPage() {
  const d = await getPortfolio();
  const { risk, bubbles, correlation, overlap, alloc } = d;

  const scores = [
    { l: "Diversification", s: clamp(risk.effHoldings * 6.2), hint: `${risk.effHoldings.toFixed(1)} effective holdings` },
    { l: "Risk-Adjusted", s: clamp((risk.sharpe + 0.4) * 46), hint: `Sharpe ${risk.sharpe.toFixed(2)}` },
    { l: "Drawdown Resilience", s: clamp(100 - Math.abs(risk.maxDD) * 2.4), hint: `Max DD ${risk.maxDD.toFixed(1)}%` },
    { l: "Concentration", s: clamp(112 - risk.top5Concentration * 1.05), hint: `Top 5 = ${risk.top5Concentration.toFixed(0)}%` },
    { l: "Geo Balance", s: clamp(100 - Math.abs(risk.homeBias) * 1.35), hint: `Home bias ${fmtSignedPct(risk.homeBias)}` },
    { l: "Income", s: clamp(risk.dividendYield * 26), hint: `${risk.dividendYield.toFixed(2)}% yield` },
  ];
  const overall = Math.round(scores.reduce((a, b) => a + b.s, 0) / scores.length);

  // risk contribution (weight * vol)
  const contrib = bubbles.map((b) => ({ symbol: b.symbol, val: (b.weight * b.vol) / 100, accent: b.accent }));
  const totalContrib = contrib.reduce((s, c) => s + c.val, 0);
  const riskBars = contrib
    .map((c) => ({ label: c.symbol, weight: (c.val / totalContrib) * 100, color: c.accent }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  // sector active tilt
  const sectorTilt = alloc.bySector
    .filter((s) => s.label !== "Cash")
    .map((s) => ({ label: s.label, value: s.weight - (BENCH_SECTORS[s.label] ?? 0) }))
    .sort((a, b) => b.value - a.value);

  const currencyBars = alloc.byCurrency.map((c) => ({ label: c.label, weight: c.weight, color: c.color }));

  return (
    <div className="fade-up space-y-4">
      {/* Scorecard */}
      <Card>
        <CardHead
          title="Portfolio Scorecard"
          sub="A multi-factor grade of construction quality"
          right={
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-ink-faint">Overall</span>
              <span className="font-serif text-2xl leading-none" style={{ color: scoreColor(overall) }}>{gradeFor(overall)}</span>
              <span className="tabnum text-sm text-ink-dim">{overall}</span>
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-3 lg:grid-cols-6">
          {scores.map((s) => (
            <div key={s.l} className="flex flex-col items-center text-center">
              <Gauge value={s.s} grade={gradeFor(s.s)} color={scoreColor(s.s)} size={104} />
              <div className="mt-2 text-xs font-medium text-ink">{s.l}</div>
              <div className="mt-0.5 text-[10px] text-ink-faint">{s.hint}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Bubbles + risk contribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHead title="Risk vs Return" sub="Annualized volatility (x) vs return (y) · bubble size = weight" />
          <div className="px-4 py-3">
            <BubbleChart bubbles={bubbles} height={360} />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHead title="Risk Contribution" sub="Share of total portfolio risk" />
          <div className="px-5 py-4">
            <HBars items={riskBars} />
          </div>
        </Card>
      </div>

      {/* Correlation + diversification */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHead title="Correlation Matrix" sub="Daily-return correlation across top holdings · warm = moves together" />
          <CorrelationMatrix labels={correlation.labels} matrix={correlation.matrix} />
        </Card>
        <Card className="lg:col-span-5">
          <CardHead title="Diversification" sub="Concentration diagnostics" />
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-panel2/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint">Effective holdings</div>
                <div className="tabnum mt-1 text-2xl font-semibold text-ink">{risk.effHoldings.toFixed(1)}</div>
                <div className="text-[11px] text-ink-faint">of {d.holdings.length} positions</div>
              </div>
              <div className="rounded-xl border border-line bg-panel2/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-faint">Herfindahl index</div>
                <div className="tabnum mt-1 text-2xl font-semibold text-ink">{(risk.hhi * 100).toFixed(0)}</div>
                <div className="text-[11px] text-ink-faint">lower = more diverse</div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-ink-dim">Asset-class mix</div>
              <HBars items={alloc.byAssetClass.map((a) => ({ label: a.label, weight: a.weight, color: a.color }))} />
            </div>
          </div>
        </Card>
      </div>

      {/* Fund overlap + currency */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHead
            title="Fund Overlap"
            sub="Look-through: names you hold directly AND inside your ETFs"
            right={<Badge color="#e8c489">{overlap.total.toFixed(1)}% hidden</Badge>}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="px-5 py-2 text-left font-medium">Company</th>
                  <th className="px-3 py-2 text-right font-medium">Direct</th>
                  <th className="px-3 py-2 text-right font-medium">Via ETF</th>
                  <th className="px-3 py-2 text-right font-medium">Combined</th>
                  <th className="px-5 py-2 text-left font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {overlap.rows.map((o) => (
                  <tr key={o.ticker} className="border-b border-line/60">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-ink">{o.ticker}</div>
                      <div className="truncate text-[11px] text-ink-faint">{o.name}</div>
                    </td>
                    <td className="tabnum px-3 py-2.5 text-right text-ink-dim">{o.direct.toFixed(2)}%</td>
                    <td className="tabnum px-3 py-2.5 text-right text-gold">{o.viaEtf.toFixed(2)}%</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="tabnum font-semibold text-ink">{o.combined.toFixed(2)}%</div>
                      <div className="ml-auto mt-1 h-1 w-16 overflow-hidden rounded-full bg-[#141b26]">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, o.combined * 6)}%`, background: "#e8c489" }} />
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex gap-1">
                        {o.etfSources.map((s) => (
                          <span key={s} className="rounded bg-[#1b2432] px-1.5 py-0.5 text-[10px] font-medium text-ink-dim">{s}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overlap.rows.length === 0 && <p className="px-5 py-6 text-sm text-ink-faint">No overlap detected.</p>}
          </div>
          <p className="px-5 py-3 text-[11px] leading-relaxed text-ink-faint">
            Your effective exposure to these names is higher than the direct weight suggests — the difference sits inside your index funds.
          </p>
        </Card>

        <Card className="lg:col-span-5">
          <CardHead title="Currency & Home Bias" sub="FX exposure and geographic tilt" />
          <div className="space-y-4 px-5 py-4">
            <HBars items={currencyBars} />
            <div className="rounded-xl border border-line bg-panel2/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-dim">North America weight</span>
                <span className="tabnum text-lg font-semibold text-ink">{risk.naWeight.toFixed(0)}%</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-ink-dim">Home bias vs global (~63%)</span>
                <span className={`tabnum text-lg font-semibold ${risk.homeBias > 15 ? "text-neg" : risk.homeBias > 0 ? "text-gold" : "text-pos"}`}>
                  {fmtSignedPct(risk.homeBias)}
                </span>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
                {risk.homeBias > 15
                  ? "Meaningfully overweight North America. International and EM exposure would reduce single-region dependence."
                  : "Geographic balance is within a reasonable band relative to a global market portfolio."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sector tilt */}
      <Card>
        <CardHead title="Sector Tilts" sub="Active weight vs a global equity benchmark" />
        <div className="px-5 py-5">
          <DivergingBars items={sectorTilt} />
        </div>
      </Card>
    </div>
  );
}
