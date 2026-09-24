import Link from "next/link";
import { getPortfolio } from "@/lib/engine";
import { Card, Grade, Meter } from "@/components/ui";
import { ScoreRing, Radar, CompareBars, DivergingBars, Donut, Lorenz, MoneyBars } from "@/components/charts/basic";
import { BubbleChart, Matrix } from "@/components/charts/advanced";
import { Money } from "@/components/money";
import { pct, SECTOR_COLORS, CCY_COLORS, BUCKET_COLORS, MONTHS, gradeLetter } from "@/lib/format";

const SECTIONS = [
  ["scorecard", "Scorecard"], ["exposure", "Exposure"], ["risk", "Risk"], ["overlap", "Overlap & look-through"], ["stress", "Stress tests"], ["rebalance", "Rebalance & income"],
];

export default async function AnalysisPage() {
  const p = await getPortfolio();
  const a = p.allocation;
  const rc = [...p.holdings].sort((x, y) => y.riskContribution - x.riskContribution).slice(0, 14);
  const rcMax = Math.max(...rc.map((h) => Math.max(h.riskContribution, h.weight)));
  const ltMax = p.lookThrough[0].total;
  const hb = a.homeBias;

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto scroll-thin">
        {SECTIONS.map(([id, l]) => (
          <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-accent">{l}</a>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Scorecard */}
        <Card id="scorecard" className="col-span-12 scroll-mt-32" eyebrow="Ten independent checks, scored 0–100" title="Portfolio scorecard" glow>
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-ink/40 p-5">
              <ScoreRing score={p.health} size={150} label="health" />
              <div className="flex items-center gap-2"><Grade g={gradeLetter(p.health)} size="lg" /><div className="text-xs text-muted">Overall<br />grade</div></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {p.scorecard.map((s) => (
                <div key={s.key} className="rounded-xl border border-line bg-ink/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[12.5px] font-medium">{s.key}</span><Grade g={s.grade} size="sm" /></div>
                  <Meter value={s.score} color={s.score >= 70 ? "#2fe39b" : s.score >= 50 ? "#d4ff3a" : "#ffb547"} />
                  <div className="mt-2 text-[11px] leading-snug text-fg/80">{s.value}</div>
                  <div className="mt-0.5 text-[10px] text-dim">{s.hint}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Exposure */}
        <Card id="exposure" className="col-span-12 scroll-mt-32 md:col-span-6 xl:col-span-4" eyebrow="Equity sleeve style factors vs ACWI (dashed)" title="Factor fingerprint">
          <div className="flex justify-center"><Radar data={p.fingerprint} size={300} /></div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Look-through, equity sleeve · white tick = ACWI" title="Exposure by sector">
          <CompareBars rows={a.sectorExposure.map((s) => ({ label: s.sector, value: s.weight, bench: s.bench, color: SECTOR_COLORS[s.sector] }))} />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Over / underweight vs ACWI" title="Active sector bets">
          <DivergingBars rows={[...a.sectorExposure].map((s) => ({ label: s.sector, value: s.weight - s.bench })).sort((x, y) => y.value - x.value)} />
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-5" eyebrow="Equity sleeve, look-through" title="Home bias">
          <div className="space-y-4">
            {[["You", hb.share], ["World (ACWI)", hb.global]].map(([l, v]) => (
              <div key={l as string}>
                <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">{l as string}</span><span className="num">{pct(v as number, 0)} US · {pct(1 - (v as number), 0)} rest of world</span></div>
                <div className="flex h-7 overflow-hidden rounded-lg">
                  <div className="flex items-center pl-2 text-[10px] font-semibold text-ink" style={{ width: `${(v as number) * 100}%`, background: BUCKET_COLORS["US Equity"] }}>🇺🇸 US</div>
                  <div className="flex items-center pl-2 text-[10px] font-semibold text-ink" style={{ width: `${(1 - (v as number)) * 100}%`, background: BUCKET_COLORS["Intl Equity"] }}>World</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 rounded-xl bg-ink/40 p-4">
            <div className={`font-serif text-5xl ${Math.abs(hb.tilt) > 0.1 ? "text-amber" : "text-pos"}`}>{hb.tilt > 0 ? "+" : ""}{(hb.tilt * 100).toFixed(0)}<span className="text-2xl">pp</span></div>
            <div className="text-xs leading-relaxed text-muted">Your US equity weight is {Math.abs(hb.tilt * 100).toFixed(0)} points {hb.tilt > 0 ? "above" : "below"} its share of global market cap. {hb.tilt > 0.1 ? "A meaningful home bias — outcomes hinge more on one economy and one currency." : "Close to market-neutral."}</div>
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-7" eyebrow="Economic = underlying revenue currency via look-through; listing = trading currency" title="Currency exposure">
          <div className="grid items-center gap-6 sm:grid-cols-[170px_1fr]">
            <Donut size={170} thickness={20} data={a.currencyEconomic.map((c) => ({ name: c.ccy, value: c.weight, color: CCY_COLORS[c.ccy] ?? "#4b5263" }))} center={<><div className="num text-lg">{pct(a.currencyEconomic[0].weight, 0)}</div><div className="text-[10px] text-dim">{a.currencyEconomic[0].ccy}</div></>} />
            <div className="space-y-2">
              <div className="grid grid-cols-[44px_1fr_1fr] gap-3 text-[10px] uppercase tracking-wider text-dim"><span /><span>Listing</span><span>Economic</span></div>
              {a.currencyEconomic.slice(0, 9).map((c) => {
                const l = a.currencyListing.find((x) => x.ccy === c.ccy)?.weight ?? 0;
                return (
                  <div key={c.ccy} className="grid grid-cols-[44px_1fr_1fr] items-center gap-3 text-xs">
                    <span className="num font-semibold" style={{ color: CCY_COLORS[c.ccy] ?? "#8a91a2" }}>{c.ccy}</span>
                    <div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-line"><div className="h-full rounded-full bg-dim" style={{ width: `${l * 100}%` }} /></div><span className="num w-10 text-right text-muted">{pct(l, 0)}</span></div>
                    <div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${c.weight * 100}%`, background: CCY_COLORS[c.ccy] ?? "#4b5263" }} /></div><span className="num w-10 text-right">{pct(c.weight, 0)}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Risk */}
        <Card id="risk" className="col-span-12 scroll-mt-32 xl:col-span-7" eyebrow="Bubble size = weight · colour = asset class" title="Risk vs return">
          <BubbleChart data={p.bubbles} />
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">{Object.entries(BUCKET_COLORS).filter(([k]) => k !== "Cash").map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>)}</div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-5" eyebrow="Share of portfolio variance vs share of capital" title="Risk contribution">
          <div className="mb-3 flex gap-4 text-[11px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-violet" />Weight</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-neg" />Risk</span></div>
          <div className="space-y-2">
            {rc.map((h) => (
              <Link key={h.symbol} href={`/portfolio/holdings/${h.symbol}`} className="group grid grid-cols-[52px_1fr_70px] items-center gap-3 text-xs">
                <span className="font-semibold group-hover:text-accent">{h.symbol}</span>
                <div className="space-y-[3px]">
                  <div className="h-1.5 rounded-full bg-violet/80" style={{ width: `${(h.weight / rcMax) * 100}%` }} />
                  <div className="h-1.5 rounded-full bg-neg/90" style={{ width: `${(Math.max(0, h.riskContribution) / rcMax) * 100}%` }} />
                </div>
                <span className={`num text-right ${h.riskContribution > h.weight * 1.2 ? "text-neg" : h.riskContribution < h.weight * 0.8 ? "text-pos" : "text-muted"}`}>{(h.riskContribution / h.weight).toFixed(2)}×</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-7" eyebrow={`Top 14 holdings · average pairwise ρ = ${p.risk.avgCorr.toFixed(2)}`} title="Correlation matrix">
          <Matrix labels={p.corrMatrix.symbols} matrix={p.corrMatrix.matrix} />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-5" eyebrow="How evenly capital is spread" title="Concentration">
          <div className="grid items-center gap-4 sm:grid-cols-[1fr_1fr]">
            <Lorenz points={p.concentration.lorenz} gini={p.concentration.gini} />
            <div className="space-y-3">
              {[["Effective positions", p.concentration.effN.toFixed(1), `of ${p.holdings.length} held`], ["Herfindahl (HHI)", (p.concentration.hhi * 10000).toFixed(0), "<1500 = unconcentrated"], ["Top 5 weight", pct(p.concentration.top5, 0), "of invested"], ["Top 10 weight", pct(p.concentration.top10, 0), "of invested"]].map(([k, v, s]) => (
                <div key={k} className="border-b border-line/60 pb-2"><div className="text-[10.5px] text-dim">{k}</div><div className="num text-xl">{v}</div><div className="text-[10px] text-dim">{s}</div></div>
              ))}
            </div>
          </div>
        </Card>

        {/* Overlap */}
        <Card id="overlap" className="col-span-12 scroll-mt-32 md:col-span-6 xl:col-span-5" eyebrow="Pairwise weight in common" title="Fund overlap">
          <Matrix labels={p.fundOverlap.funds} matrix={p.fundOverlap.matrix} mode="overlap" />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-7" eyebrow="Single-name exposure after unpacking your funds" title="True exposure (look-through)">
          <div className="mb-3 flex gap-4 text-[11px] text-muted"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" />Direct</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-violet" />Via funds</span></div>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {p.lookThrough.slice(0, 16).map((l) => (
              <div key={l.symbol} className="grid grid-cols-[56px_1fr_48px] items-center gap-2 text-xs" title={l.via.map((v) => `${v.fund}: ${pct(v.weight, 2)}`).join(" · ")}>
                <span className={l.direct > 0 ? "font-semibold" : "text-muted"}>{l.symbol}</span>
                <div className="flex h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-accent" style={{ width: `${(l.direct / ltMax) * 100}%` }} />
                  <div className="h-full bg-violet" style={{ width: `${(l.indirect / ltMax) * 100}%` }} />
                </div>
                <span className="num text-right">{pct(l.total, 1)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Stress */}
        <Card id="stress" className="col-span-12 scroll-mt-32" eyebrow="Instant shock applied to today's book · simplified factor model" title="Stress tests">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {p.stress.map((s) => (
              <div key={s.name} className="rounded-xl border border-line bg-ink/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-sm font-medium">{s.name}</div><div className="text-[11px] text-dim">{s.desc}</div></div>
                  <div className="text-right"><div className={`num text-xl ${s.pct >= 0 ? "text-pos" : "text-neg"}`}>{pct(s.pct, 1, true)}</div><Money usd={s.total} compact sign className="text-xs text-muted" /></div>
                </div>
                <div className="relative mt-3 h-2 rounded-full bg-line">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-fg/40" />
                  <div className="absolute inset-y-0 rounded-full" style={s.pct >= 0 ? { left: "50%", width: `${Math.min(50, s.pct * 125)}%`, background: "#2fe39b" } : { right: "50%", width: `${Math.min(50, -s.pct * 125)}%`, background: "#ff5a78" }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px]">
                  <span className="text-dim">Most hit:</span>
                  {s.worst.map((w) => <span key={w.symbol} className="rounded-md bg-panel2 px-1.5 py-0.5">{w.symbol} <Money usd={w.impact} compact className={w.impact < 0 ? "text-neg" : "text-pos"} /></span>)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Rebalance & income */}
        <Card id="rebalance" className="col-span-12 scroll-mt-32 xl:col-span-7" eyebrow={`Total drift ${pct(a.totalDrift, 1)}`} title="Rebalance to target">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-[10.5px] uppercase tracking-wider text-dim"><th className="px-5 pb-2 font-medium">Sleeve</th><th className="pb-2 font-medium">Actual vs target</th><th className="pb-2 text-right font-medium">Drift</th><th className="px-5 pb-2 text-right font-medium">Trade to fix</th></tr></thead>
              <tbody>
                {a.drift.map((d) => (
                  <tr key={d.bucket} className="border-t border-line/60">
                    <td className="px-5 py-3"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLORS[d.bucket] }} />{d.bucket}</span></td>
                    <td className="w-[40%] pr-4">
                      <div className="relative h-2.5 rounded-full bg-line">
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${d.weight * 140}%`, background: BUCKET_COLORS[d.bucket] }} />
                        <div className="absolute -inset-y-1 w-0.5 bg-fg" style={{ left: `${d.target * 140}%` }} />
                      </div>
                      <div className="num mt-1 text-[10px] text-dim">{pct(d.weight, 1)} / {pct(d.target, 0)}</div>
                    </td>
                    <td className={`num text-right ${Math.abs(d.diff) > 0.03 ? "text-amber" : "text-muted"}`}>{pct(d.diff, 1, true)}</td>
                    <td className="px-5 text-right"><span className={`rounded-md px-2 py-1 text-xs ${d.trade >= 0 ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg"}`}>{d.trade >= 0 ? "Buy " : "Sell "}<Money usd={Math.abs(d.trade)} compact /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="col-span-12 xl:col-span-5" eyebrow={`Forward yield ${pct(p.totals.portYield, 2)} · yield on cost ${pct(p.income.yieldOnCost, 2)}`} title="Income received (24 months)">
          <MoneyBars data={p.income.byMonth.map((m) => ({ label: `${MONTHS[Number(m.month.slice(5)) - 1]} ${m.month.slice(0, 4)}`, value: m.amount, sub: m.month.slice(5) === "01" ? m.month.slice(2, 4) : MONTHS[Number(m.month.slice(5)) - 1][0] }))} />
          <div className="mt-2 grid grid-cols-3 gap-3 border-t border-line pt-3 text-xs">
            <div><div className="text-dim">Next 12m (est.)</div><Money usd={p.income.annual} compact className="text-base" /></div>
            <div><div className="text-dim">Trailing 12m</div><Money usd={p.totals.ttmIncome} compact className="text-base" /></div>
            <div><div className="text-dim">Per month</div><Money usd={p.income.annual / 12} compact className="text-base" /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
