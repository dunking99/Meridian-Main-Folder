import type { ReactNode } from "react";
import { getPortfolio } from "@/lib/engine";
import { concentration, costs, drift, exposures, fundOverlap, healthScore, projection, riskModel, scorecard, stressTests } from "@/lib/analytics";
import { fmtNum, fmtPct, hexA } from "@/lib/format";
import { ACWI_REF, EQUITY_SECTORS, SECTOR_COLORS, SLEEVE_COLORS } from "@/lib/reference";
import { Card, HoldingLink, Money, SectionHeader } from "@/components/ui";
import { Bubble, CompareBars, Fan, Lorenz, Matrix, StackBar, StyleBox } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analysis" };

const NAV = [
  ["scorecard", "Scorecard"], ["risk", "Risk"], ["overlap", "Overlap"], ["exposure", "Exposure"], ["scenarios", "Stress tests"], ["rebalance", "Rebalance"], ["projection", "Projection"],
];
const CCY_COLORS: Record<string, string> = { USD: "#f0b35b", EUR: "#8b9dff", JPY: "#ff7eb6", GBP: "#4fd8c4", CHF: "#c08bff", DKK: "#52b8ff", CNY: "#ff9b73", TWD: "#e0474a", INR: "#b5e36b", CAD: "#d9a06b", AUD: "#7ee8a0", KRW: "#9fb0c8", SEK: "#6fcfe8", Other: "#5d6575" };
const FUND_COLORS = ["#c8414f", "#7b6cf0", "#4fd8c4", "#d9a06b"];

export default async function AnalysisPage() {
  const core = await getPortfolio();
  const ccy = core.ccy;
  const exp = exposures(core);
  const risk = riskModel(core);
  const dr = drift(core, exp);
  const health = healthScore(core, exp, risk, dr);
  const sc = scorecard(core, exp, risk, health);
  const conc = concentration(core);
  const ov = fundOverlap(core);
  const st = stressTests(core, exp);
  const cost = costs(core, exp);
  const proj = projection(core, exp, risk);
  const topN = risk.symbols.slice(0, 12);
  const corrTop = topN.map((_, i) => topN.map((__, j) => risk.corr[i][j]));
  const rcRows = [...risk.holdings].sort((a, b) => b.rc - a.rc).slice(0, 12);
  const rcMax = Math.max(...rcRows.map((r) => Math.max(r.rc, r.weight)));
  const issuers = exp.issuers.slice(0, 10);
  const issMax = issuers[0]?.total ?? 1;
  const fundIdx = new Map(ov.funds.map((f, i) => [f.symbol, i]));
  const ccys = Object.entries(exp.ccyEconomic).filter(([, v]) => v > 0.001).sort((a, b) => b[1] - a[1]);
  const listing = Object.entries(exp.ccyListing).filter(([, v]) => v > 0.001).sort((a, b) => b[1] - a[1]);
  const foreign = 1 - (exp.ccyEconomic[ccy] ?? 0);
  const caps = { Large: 0, Mid: 0, Small: 0 };
  for (const [k, v] of Object.entries(exp.styleN)) caps[k[0] === "L" ? "Large" : k[0] === "M" ? "Mid" : "Small"] += v;
  const hist = st.filter((s) => s.kind === "historical");
  const hypo = st.filter((s) => s.kind === "hypothetical");
  const stMax = Math.max(...st.map((s) => Math.abs(s.impact)));
  const gradeColor = (g: string) => (g.startsWith("A") ? "#3ee0a1" : g.startsWith("B") ? "#b8dc6e" : g.startsWith("C") ? "#f5bd62" : "#ff6b6b");

  return (
    <div>
      <nav className="sticky top-0 z-20 -mx-4 mb-2 border-b border-white/[0.06] bg-ink-950/80 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {NAV.map(([id, label], i) => (
            <a key={id} href={`#${id}`} className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] text-mist-400 transition hover:bg-white/[0.04] hover:text-mist-100">
              <span className="num text-[9.5px] text-gold-400/70">0{i + 1}</span>{label}
            </a>
          ))}
        </div>
      </nav>

      {/* ——— 01 scorecard ——— */}
      <SectionHeader id="scorecard" index="01" kicker="Portfolio scorecard" title="How the book grades out" />
      <div className="mt-4 grid grid-cols-12 gap-4">
        <section className="card card-hero rise col-span-12 flex flex-col items-center justify-center p-6 text-center lg:col-span-3">
          <div className="label">Overall grade</div>
          <div className="serif mt-3 text-[120px] leading-[0.8]" style={{ color: gradeColor(sc.grade), textShadow: `0 0 60px ${hexA(gradeColor(sc.grade), 0.35)}` }}>{sc.grade}</div>
          <div className="num mt-4 text-[13px] text-mist-300">{sc.overall} / 100</div>
          <div className="mt-2 text-[12px] text-mist-500">Health {health.score} · {health.label}</div>
        </section>
        <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-9">
          {sc.items.map((it) => (
            <div key={it.key} className="card rise p-4">
              <div className="flex items-start justify-between">
                <div className="label">{it.key}</div>
                <div className="serif text-[34px] leading-none" style={{ color: gradeColor(it.grade) }}>{it.grade}</div>
              </div>
              <div className="mt-3 h-1 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${it.score}%`, background: gradeColor(it.grade) }} /></div>
              <div className="mt-2 text-[11.5px] text-mist-400">{it.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ——— 02 risk ——— */}
      <SectionHeader id="risk" index="02" kicker="Risk model · trailing 1Y" title="Where the risk really sits" />
      <div className="mt-4 grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-7" title="Risk vs return · bubbles sized by weight" subtitle="Click a bubble to open the holding · ◆ marks the portfolio and benchmark">
          <Bubble
            xLabel="Volatility (1Y)"
            yLabel="Return (1Y)"
            points={risk.holdings.map((h) => ({ key: h.symbol, x: h.vol, y: h.ret, r: h.weight, color: SECTOR_COLORS[h.sector] ?? h.color, label: h.symbol, href: `/portfolio/holdings/${encodeURIComponent(h.symbol)}`, title: `${h.name}: return ${fmtPct(h.ret, 1)}, vol ${fmtPct(h.vol, 1, false)}, weight ${fmtPct(h.weight, 1, false)}` }))}
            refs={[
              { key: "p", x: risk.realizedVol, y: core.index[core.index.length - 1] / core.index[Math.max(0, core.index.length - 253)] - 1, label: "BOOK", color: "#f5bd62" },
              { key: "b", x: risk.holdings.length ? Math.sqrt(252) * 0 + (core.bench.ACWI.ret.slice(-252).reduce((a, v) => a + v * v, 0) / 252) ** 0.5 * Math.sqrt(252) : 0, y: core.bench.ACWI.index[core.bench.ACWI.index.length - 1] / core.bench.ACWI.index[Math.max(0, core.bench.ACWI.index.length - 253)] - 1, label: "ACWI", color: "#7cc4ff" },
            ]}
          />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Risk contribution vs capital" subtitle="Bars above their weight punch above their size">
          <div className="mb-3 flex gap-4 text-[11px] text-mist-400">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-gold-400" />Capital</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-[#ff8a5c]" />Share of risk</span>
          </div>
          <div className="space-y-2">
            {rcRows.map((r) => (
              <div key={r.symbol} className="grid grid-cols-[3.2rem_1fr_3.4rem] items-center gap-3 text-[12px]">
                <HoldingLink symbol={r.symbol} className="num text-mist-200">{r.symbol}</HoldingLink>
                <div className="space-y-[3px]">
                  <div className="h-1.5 rounded-full bg-gold-400" style={{ width: `${(r.weight / rcMax) * 100}%` }} />
                  <div className="h-1.5 rounded-full bg-[#ff8a5c]" style={{ width: `${(Math.max(0, r.rc) / rcMax) * 100}%`, boxShadow: "0 0 10px -2px #ff8a5c" }} />
                </div>
                <span className={`num text-right text-[11px] ${r.rc > r.weight * 1.25 ? "text-[#ff8a5c]" : "text-mist-400"}`}>{(r.rc / Math.max(r.weight, 1e-9)).toFixed(1)}×</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
            <Mini k="Portfolio vol" v={fmtPct(risk.volP, 1, false)} />
            <Mini k="Diversification" v={`${fmtNum(risk.divRatio, 2)}×`} />
            <Mini k="Avg correlation" v={fmtNum(risk.avgCorr, 2)} />
          </div>
        </Card>
        <Card className="col-span-12 xl:col-span-8" title="Correlation matrix · top 12 positions" subtitle="Daily returns, trailing year · warm = move together, cool = diversify">
          <Matrix labels={topN} values={corrTop} kind="corr" />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Pairs to know">
          <div className="label mb-2">Most correlated</div>
          {risk.top.map((p) => <Pair key={p.a + p.b} a={p.a} b={p.b} c={p.c} />)}
          <div className="label mb-2 mt-5">Best diversifiers</div>
          {risk.bottom.map((p) => <Pair key={p.a + p.b} a={p.a} b={p.b} c={p.c} />)}
        </Card>
      </div>

      {/* ——— 03 overlap ——— */}
      <SectionHeader id="overlap" index="03" kicker="Diversification" title="Overlap & hidden concentration" />
      <div className="mt-4 grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-7" title="True exposure · direct + inside your funds" subtitle="The companies you really own once ETFs are looked through">
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-mist-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-gold-400" />Direct</span>
            {ov.funds.map((f, i) => <span key={f.symbol} className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: FUND_COLORS[i % 4] }} />via {f.symbol}</span>)}
          </div>
          <div className="space-y-2.5">
            {issuers.map((it) => (
              <div key={it.key} className="grid grid-cols-[8rem_1fr_3.2rem] items-center gap-3 text-[12px]">
                <div className="min-w-0"><span className="num text-mist-100">{it.key}</span> <span className="truncate text-[11px] text-mist-500">{it.name}</span></div>
                <div className="flex h-3 overflow-hidden rounded-sm" style={{ width: `${(it.total / issMax) * 100}%` }}>
                  {it.direct > 0 && <div className="h-full bg-gold-400" style={{ width: `${(it.direct / it.total) * 100}%` }} title={`Direct ${fmtPct(it.direct, 2, false)}`} />}
                  {Object.entries(it.via).map(([f, w]) => <div key={f} className="h-full" style={{ width: `${(w / it.total) * 100}%`, background: FUND_COLORS[(fundIdx.get(f) ?? 3) % 4] }} title={`via ${f} ${fmtPct(w, 2, false)}`} />)}
                </div>
                <span className="num text-right text-mist-100">{fmtPct(it.total, 1, false)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Fund overlap" subtitle="Share of holdings two funds have in common (top positions)">
          {ov.funds.length > 1 ? <Matrix labels={ov.funds.map((f) => f.symbol)} values={ov.matrix} kind="overlap" /> : <p className="text-[12px] text-mist-500">Only one equity fund held.</p>}
          <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
            <div className="label">Stocks you hold twice</div>
            {ov.direct.slice(0, 6).map((d) => (
              <div key={d.symbol} className="flex items-center justify-between gap-3 text-[12px]">
                <HoldingLink symbol={d.symbol} className="num text-mist-100">{d.symbol}</HoldingLink>
                <span className="truncate text-[11px] text-mist-500">also in {d.inFunds.map((f) => `${f.fund} (${f.pct.toFixed(1)}%)`).join(", ")}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Concentration curve">
          <Lorenz points={conc.lorenz} />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Concentration stats">
          <div className="grid grid-cols-2 gap-4">
            <Mini k="Positions" v={String(conc.count)} />
            <Mini k="Effective N" v={fmtNum(conc.effN, 1)} />
            <Mini k="HHI" v={fmtNum(conc.hhi * 10000, 0)} />
            <Mini k="Top 5 weight" v={fmtPct(conc.top5, 0, false)} />
            <Mini k="Top 10 weight" v={fmtPct(conc.top10, 0, false)} />
            <Mini k="Largest look-through" v={`${exp.issuers[0]?.key} ${fmtPct(exp.issuers[0]?.total ?? 0, 1, false)}`} />
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-mist-500">Effective N is how many equal-sized positions would give the same concentration. Broad ETFs count as one position here — see “true exposure” for look-through.</p>
        </Card>
        <Card className="col-span-12 xl:col-span-4" title="Style box · equity sleeve" subtitle="Blue figures: MSCI ACWI">
          <div className="flex flex-col items-center gap-4">
            <StyleBox cells={exp.styleN} bench={ACWI_REF.style} />
            <div className="w-full"><StackBar segments={[{ key: "L", label: "Large", value: caps.Large, color: "#f5bd62" }, { key: "M", label: "Mid", value: caps.Mid, color: "#8b9dff" }, { key: "S", label: "Small", value: caps.Small, color: "#4fd8c4" }]} />
              <div className="mt-1.5 flex justify-between text-[10.5px] text-mist-500"><span>Large {fmtPct(caps.Large, 0, false)}</span><span>Mid {fmtPct(caps.Mid, 0, false)}</span><span>Small {fmtPct(caps.Small, 0, false)}</span></div>
            </div>
          </div>
        </Card>
      </div>

      {/* ——— 04 exposure ——— */}
      <SectionHeader id="exposure" index="04" kicker="Look-through exposure" title="Sectors, home bias & currency" />
      <div className="mt-4 grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-6" title="Sector exposure vs MSCI ACWI" subtitle="Equity sleeve, funds looked through · right column is over/underweight in pts">
          <CompareBars items={EQUITY_SECTORS.map((s) => ({ key: s, label: <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: SECTOR_COLORS[s] }} />{s}</span>, a: exp.sectorN[s] ?? 0, b: ACWI_REF.sectors[s] ?? 0 }))} bLabel="MSCI ACWI" />
        </Card>
        <div className="col-span-12 grid gap-4 xl:col-span-6">
          <Card title="Home bias">
            <div className="flex flex-wrap items-end gap-8">
              <div><div className="label">US share of equity</div><div className="serif mt-2 text-[56px] leading-none text-gold-300">{Math.round(exp.homeUS * 100)}%</div></div>
              <div><div className="label">World index</div><div className="serif mt-2 text-[56px] leading-none text-sky">{Math.round(ACWI_REF.countries.US * 100)}%</div></div>
              <div className="pb-2"><div className="label">Bias</div><div className={`num mt-2 text-[22px] ${exp.homeBias > 0 ? "text-gold-300" : "text-sky"}`}>{exp.homeBias >= 0 ? "+" : "−"}{Math.abs(exp.homeBias * 100).toFixed(1)} pts</div></div>
            </div>
            <div className="relative mt-5 h-3 rounded-full bg-gradient-to-r from-white/[0.04] to-white/[0.08]">
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-600/40 to-gold-400" style={{ width: `${exp.homeUS * 100}%` }} />
              <div className="absolute -top-1.5 h-6 w-0.5 rounded bg-sky shadow-[0_0_10px_#7cc4ff]" style={{ left: `${ACWI_REF.countries.US * 100}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-mist-500"><span>0%</span><span>100% US</span></div>
          </Card>
          <Card title="Currency exposure" subtitle={`${fmtPct(foreign, 0, false)} of your book is exposed to currencies other than ${ccy}`}>
            <div className="space-y-4">
              <div>
                <div className="label mb-2">By listing currency</div>
                <StackBar height={12} segments={listing.map(([c, v]) => ({ key: c, label: c, value: v, color: CCY_COLORS[c] ?? "#5d6575" }))} />
              </div>
              <div>
                <div className="label mb-2">Economic · look-through</div>
                <StackBar height={12} segments={ccys.map(([c, v]) => ({ key: c, label: c, value: v, color: CCY_COLORS[c] ?? "#5d6575" }))} />
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                {ccys.slice(0, 12).map(([c, v]) => (
                  <div key={c} className="flex items-center justify-between gap-2 text-[11.5px]"><span className="flex items-center gap-1.5 text-mist-300"><span className="h-2 w-2 rounded-sm" style={{ background: CCY_COLORS[c] ?? "#5d6575" }} />{c}</span><span className="num text-mist-100">{fmtPct(v, 1, false)}</span></div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ——— 05 scenarios ——— */}
      <SectionHeader id="scenarios" index="05" kicker="Stress tests" title="If history repeats — or something new breaks" />
      <div className="mt-4 grid grid-cols-12 gap-4">
        {[{ title: "Historical replays", list: hist }, { title: "Hypothetical shocks", list: hypo }].map((g) => (
          <Card key={g.title} className="col-span-12 xl:col-span-6" title={g.title} subtitle="Estimated from sector & asset-class moves applied to today's look-through weights">
            <div className="space-y-3.5">
              {g.list.map((s) => (
                <div key={s.key} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
                  <div className="min-w-0"><span className="text-[12.5px] text-mist-100">{s.name}</span> <span className="text-[11px] text-mist-500">{s.period}</span></div>
                  <div className="text-right"><span className={`num text-[13px] ${s.impact >= 0 ? "text-up" : "text-down"}`}>{fmtPct(s.impact, 1)}</span> <Money v={s.money} ccy={ccy} compact sign className="text-[11px] text-mist-500" /></div>
                  <div className="relative col-span-2 h-2 rounded-full bg-white/[0.04]">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
                    <div className="absolute inset-y-0 rounded-full" style={s.impact < 0 ? { right: "50%", width: `${(Math.abs(s.impact) / stMax) * 50}%`, background: "linear-gradient(270deg, rgba(255,107,107,.35), #ff6b6b)" } : { left: "50%", width: `${(s.impact / stMax) * 50}%`, background: "#3ee0a1" }} />
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-1.5 text-[10.5px] text-mist-500">
                    hit hardest: {s.worst.map((w) => <span key={w.symbol} className="num rounded bg-white/[0.04] px-1.5 text-mist-300">{w.symbol} {fmtPct(w.impact, 1)}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* ——— 06 rebalance ——— */}
      <SectionHeader id="rebalance" index="06" kicker="Allocation discipline" title="Drift, rebalancing & costs" />
      <div className="mt-4 grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-7" title="Actual vs target" subtitle={`Total drift ${fmtPct(dr.total, 1, false)} — trades below would restore the targets exactly`}>
          <div className="space-y-3">
            {dr.rows.map((r) => (
              <div key={r.sleeve} className="grid grid-cols-[7.5rem_1fr_3.5rem_6.5rem] items-center gap-3 text-[12px]">
                <span className="flex items-center gap-2 text-mist-200"><span className="h-2 w-2 rounded-sm" style={{ background: SLEEVE_COLORS[r.sleeve] }} />{r.sleeve}</span>
                <div className="relative h-4 rounded bg-white/[0.04]">
                  <div className="absolute inset-y-1 left-0 rounded-sm" style={{ width: `${(r.actual / 0.7) * 100}%`, background: SLEEVE_COLORS[r.sleeve] }} />
                  <div className="absolute -top-0.5 h-5 w-0.5 rounded bg-white" style={{ left: `${(r.target / 0.7) * 100}%` }} title={`Target ${fmtPct(r.target, 0, false)}`} />
                </div>
                <span className={`num text-right text-[11px] ${Math.abs(r.diff) < 0.01 ? "text-mist-500" : r.diff > 0 ? "text-gold-300" : "text-sky"}`}>{r.diff >= 0 ? "+" : "−"}{Math.abs(r.diff * 100).toFixed(1)}</span>
                <span className={`text-right text-[11.5px] ${Math.abs(r.trade) < 500 ? "text-mist-500" : r.trade > 0 ? "text-up" : "text-down"}`}>
                  {Math.abs(r.trade) < 500 ? "hold" : <>{r.trade > 0 ? "Buy" : "Sell"} <Money v={Math.abs(r.trade)} ccy={ccy} compact /> <span className="text-mist-500">{r.vehicle !== "Cash" ? r.vehicle : ""}</span></>}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10.5px] text-mist-500"><span className="h-3 w-0.5 bg-white" /> target weight</div>
        </Card>
        <Card className="col-span-12 xl:col-span-5" title="What you pay">
          <div className="grid grid-cols-2 gap-4">
            <Mini k="Weighted fund fee" v={fmtPct(cost.ter / 100, 3, false)} />
            <Mini k="Fund fees / year" v={<Money v={cost.annualFundFees} ccy={ccy} dp={0} />} />
            <Mini k="Trading fees 12M" v={<Money v={cost.tradingFees} ccy={ccy} dp={0} />} />
            <Mini k="20-yr fee drag" v={<Money v={cost.drag20} ccy={ccy} compact className="text-down" />} />
          </div>
          <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
            {cost.byFund.map((f) => (
              <div key={f.symbol} className="grid grid-cols-[3.5rem_1fr_4rem_4.5rem] items-center gap-3 text-[12px]">
                <HoldingLink symbol={f.symbol} className="num text-mist-100">{f.symbol}</HoldingLink>
                <div className="h-1 rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-down/70" style={{ width: `${(f.cost / cost.byFund[0].cost) * 100}%` }} /></div>
                <span className="num text-right text-mist-500">{f.ter.toFixed(2)}%</span>
                <Money v={f.cost} ccy={ccy} dp={0} className="text-right text-mist-200" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ——— 07 projection ——— */}
      <SectionHeader id="projection" index="07" kicker="Forward look · Monte Carlo" title="Where this could go in 20 years" />
      <div className="mt-4 grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-8" title="Projected value · 700 simulated paths" subtitle={`Assumes ${fmtPct(proj.muP, 1, false)} expected return, ${fmtPct(proj.sigma, 1, false)} volatility and ${ccy} ${Math.round(proj.monthly).toLocaleString("en-US")}/month of new money — nominal, before tax`}>
          <Fan bands={proj.bands} startYear={proj.startYear} ccy={ccy} />
          <div className="mt-2 flex gap-4 text-[10.5px] text-mist-500"><span className="flex items-center gap-1.5"><span className="h-2 w-3 bg-gold-400/40" />25–75th pct</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 bg-gold-400/15" />10–90th pct</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-gold-400" />median</span></div>
        </Card>
        <Card className="col-span-12 xl:col-span-4" title="Milestones">
          <div className="space-y-5">
            {[10, 20].map((y) => (
              <div key={y}>
                <div className="label">Median in {y} years · {proj.startYear + y}</div>
                <Money v={proj.bands[y].p50} ccy={ccy} compact className="serif mt-2 block text-[40px] leading-none text-gold-300" />
                <div className="mt-1 text-[11px] text-mist-500">range <Money v={proj.bands[y].p10} ccy={ccy} compact /> – <Money v={proj.bands[y].p90} ccy={ccy} compact /></div>
              </div>
            ))}
            <div className="space-y-2.5 border-t border-white/[0.06] pt-4">
              <div className="label">Chance of reaching by {proj.startYear + 20}</div>
              {proj.goals.map((g) => (
                <div key={g.goal} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3 text-[12px]">
                  <Money v={g.goal} ccy={ccy} compact className="text-mist-200" />
                  <div className="h-1.5 rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300" style={{ width: `${g.prob * 100}%` }} /></div>
                  <span className="num text-right text-mist-100">{Math.round(g.prob * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label !text-[9.5px]">{k}</div>
      <div className="num mt-1.5 truncate text-[14px] text-mist-100">{v}</div>
    </div>
  );
}
function Pair({ a, b, c }: { a: string; b: string; c: number }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 text-[12px]">
      <HoldingLink symbol={a} className="num text-mist-100">{a}</HoldingLink>
      <span className="text-mist-500">×</span>
      <HoldingLink symbol={b} className="num text-mist-100">{b}</HoldingLink>
      <div className="mx-2 h-1 flex-1 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${Math.abs(c) * 100}%`, background: c > 0.5 ? "#ff8a5c" : c > 0 ? "#f5bd62" : "#7cc4ff" }} /></div>
      <span className="num w-10 text-right text-mist-300">{c.toFixed(2)}</span>
    </div>
  );
}
