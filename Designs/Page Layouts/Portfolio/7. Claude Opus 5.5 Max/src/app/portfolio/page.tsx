import Link from "next/link";
import { getEvents, getNews, getNotes, getPortfolio, shiftDate, twr, benchReturn, type Horizon } from "@/lib/engine";
import {
  concentration, drawdowns, drift, enrichNews, exposures, fundOverlap, healthScore, incomeModel, insights, leadersLaggards,
  moneyWeighted, riskModel, riskProfile, shapeOfBook, std, upcomingEvents,
} from "@/lib/analytics";
import { fmtDate, fmtMoney, fmtPct, hexA, relTime } from "@/lib/format";
import { EVENT_META, SLEEVES, SLEEVE_COLORS, DEFAULT_TARGETS } from "@/lib/reference";
import { Card, Delta, HoldingLink, Meter, Money, Monogram, Pct, Pill } from "@/components/ui";
import { Donut, Gauge, Radar, SignalBars, Sparkline } from "@/components/charts";
import { SwitchCard, TimeChart } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [core, events, news, notes] = await Promise.all([getPortfolio(), getEvents(), getNews(), getNotes()]);
  const ccy = core.ccy;
  const t = core.totals;
  const exp = exposures(core);
  const risk = riskModel(core);
  const dr = drift(core, exp);
  const health = healthScore(core, exp, risk, dr);
  const rp = riskProfile(core, risk);
  const conc = concentration(core);
  const shape = shapeOfBook(core, exp, conc);
  const ll = leadersLaggards(core);
  const overlap = fundOverlap(core);
  const ins = insights(core, exp, risk, dr, overlap);
  const upcoming = upcomingEvents(core, events, notes, 45);
  const enriched = enrichNews(core, news, exp).slice(0, 5);
  const income = incomeModel(core);
  const irr = moneyWeighted(core);
  const dd = drawdowns(core);
  const n = core.dates.length;
  const vol1m = std(core.ret.slice(n - 21)) * Math.sqrt(252);
  const last30 = core.value.slice(n - 30);

  const chartDates = core.dates;
  const series = [
    { key: "value", label: "Portfolio", values: core.value, color: "#f5bd62", style: "area" as const },
    { key: "invested", label: "Net invested", values: core.invested, color: "#9ba3b2", style: "dash" as const },
    { key: "index", label: "Portfolio (TWR)", values: core.index, color: "#f5bd62", style: "area" as const },
    { key: "acwi", label: "MSCI ACWI", values: core.bench.ACWI.index, color: "#7cc4ff", style: "line" as const },
    { key: "spx", label: "S&P 500", values: core.bench.SPX.index, color: "#b69cff", style: "dash" as const, hidden: true },
  ];

  const vitals: Horizon[] = ["1D", "1W", "1M", "3M", "YTD", "1Y"];
  const vit = vitals.map((h) => ({ h, p: h === "1D" ? t.dayPct : twr(core, h), b: benchReturn(core, "ACWI", h) }));
  const vmax = Math.max(...vit.map((v) => Math.abs(v.p)), 0.01);
  const breadth = [...core.positions].sort((a, b) => b.dayPct - a.dayPct);
  const ups = breadth.filter((p) => p.dayPct > 0).length;

  const splitTot = Math.abs(t.unrealized) + Math.abs(t.realized) + t.dividends + t.interest;

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* ——— vitals strip ——— */}
      <section className="card rise col-span-12 grid grid-cols-2 divide-white/[0.06] sm:grid-cols-3 xl:grid-cols-6 xl:divide-x">
        <Vital label="Net worth in book" value={<Money v={t.value} ccy={ccy} compact />} sub={<span className="flex items-center gap-2"><Sparkline values={last30} width={70} height={18} /> 30 days</span>} />
        <Vital label="Today" value={<Delta v={t.dayChange} ccy={ccy} compact className="!text-[20px]" />} sub={<><Pct v={t.dayPct} dp={2} /> · {ups} of {t.positions} up</>} />
        <Vital label="Cash balance" value={<Money v={t.cash} ccy={ccy} compact />} sub={<span className="flex items-center gap-2"><span className="w-16"><Meter value={exp.sleeves.Cash / 0.1} color="#7a8394" marker={DEFAULT_TARGETS.Cash / 0.1} /></span>{fmtPct(exp.sleeves.Cash, 1, false)} of book</span>} />
        <Vital label="Total gain" value={<Money v={t.totalGain} ccy={ccy} compact sign className="text-up" />} sub={
          <span className="flex items-center gap-2">
            <span className="flex h-1.5 w-20 overflow-hidden rounded-full bg-white/5">
              <span style={{ width: `${(Math.abs(t.unrealized) / splitTot) * 100}%`, background: "#f5bd62" }} />
              <span style={{ width: `${(Math.abs(t.realized) / splitTot) * 100}%`, background: "#8b9dff" }} />
              <span style={{ width: `${((t.dividends + t.interest) / splitTot) * 100}%`, background: "#3ee0a1" }} />
            </span>
            <Pct v={t.totalGainPct} />
          </span>
        } />
        <Vital label="Forward income" value={<Money v={income.fwdTotal} ccy={ccy} compact />} sub={<>{fmtPct(income.yield, 2, false)} yield · <Money v={income.fwdTotal / 12} ccy={ccy} compact />/mo</>} />
        <Vital label="Return p.a. (IRR)" value={<Pct v={irr} dp={1} className="!text-[22px]" />} sub={<>since {fmtDate(core.dates[0], "month")} · money-weighted</>} />
      </section>

      {/* ——— value chart ——— */}
      <Card hero className="col-span-12 xl:col-span-8" title="Value over time" index="01" delay={40}>
        <TimeChart
          dates={chartDates}
          series={series}
          ccy={ccy}
          defaultRange="1Y"
          ranges={["1M", "3M", "YTD", "1Y", "3Y", "ALL"]}
          views={[
            { key: "value", label: "Value", series: ["value", "invested"], format: "money" },
            { key: "return", label: "Return", series: ["index", "acwi", "spx"], format: "pct", rebase: "pct" },
          ]}
          height={300}
        />
      </Card>

      {/* ——— pulse ——— */}
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Portfolio pulse" index="02" delay={80} action={<Pill tone={vol1m < risk.realizedVol ? "up" : "gold"}>{vol1m < risk.realizedVol ? "Calm" : "Choppy"}</Pill>}>
        <div className="label mb-2 flex justify-between"><span>Breadth today</span><span className="num normal-case tracking-normal"><span className="text-up">{ups}▲</span> <span className="text-down">{t.positions - ups}▼</span></span></div>
        <div className="relative flex h-16 items-center gap-[3px]">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
          {breadth.map((p) => {
            const h = Math.max(2, Math.min(1, Math.abs(p.dayPct) / 0.03) * 30);
            return (
              <Link key={p.symbol} href={`/portfolio/holdings/${encodeURIComponent(p.symbol)}`} title={`${p.symbol} ${fmtPct(p.dayPct, 2)}`} className="relative flex h-full flex-1 flex-col justify-center">
                <span className="mx-auto w-full max-w-[9px] rounded-[2px] transition-transform hover:scale-y-110" style={{ height: h, transform: `translateY(${p.dayPct >= 0 ? -h / 2 : h / 2}px)`, background: p.dayPct >= 0 ? "#3ee0a1" : "#ff6b6b", opacity: 0.35 + Math.min(0.65, p.weight * 8) }} />
              </Link>
            );
          })}
        </div>
        <div className="mt-4 space-y-2">
          {vit.map((v) => (
            <div key={v.h} className="grid grid-cols-[2.2rem_4.2rem_1fr_4.2rem] items-center gap-2 text-[12px]">
              <span className="num text-mist-500">{v.h}</span>
              <Pct v={v.p} dp={2} className="text-right" />
              <div className="relative h-3">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={v.p >= 0 ? { left: "50%", width: `${(Math.abs(v.p) / vmax) * 50}%`, background: "#3ee0a1" } : { right: "50%", width: `${(Math.abs(v.p) / vmax) * 50}%`, background: "#ff6b6b" }} />
                <div className="absolute top-0 h-3 w-0.5 rounded bg-sky" style={{ left: `${50 + Math.max(-50, Math.min(50, (v.b / vmax) * 50))}%` }} title={`ACWI ${fmtPct(v.b, 2)}`} />
              </div>
              <span className={`num text-right text-[11px] ${v.p - v.b >= 0 ? "text-up/80" : "text-down/80"}`}>{fmtPct(v.p - v.b, 1)}</span>
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-0.5 text-[10px] text-mist-500"><span className="flex items-center gap-1"><span className="h-2 w-0.5 bg-sky" /> ACWI</span><span>excess →</span></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3 text-[12px]">
          <div><div className="label">From peak</div><div className={`num mt-1.5 text-[15px] ${dd.current < -0.001 ? "text-down" : "text-up"}`}>{dd.current < -0.001 ? fmtPct(dd.current, 1) : "At high"}</div><div className="text-[11px] text-mist-500">{dd.current < -0.001 ? `${dd.daysSincePeak}d since ATH` : "new all-time high"}</div></div>
          <div><div className="label">Vol 1M / 1Y</div><div className="num mt-1.5 text-[15px] text-mist-100">{fmtPct(vol1m, 1, false)} <span className="text-mist-500">/ {fmtPct(risk.realizedVol, 1, false)}</span></div><div className="text-[11px] text-mist-500">annualised</div></div>
        </div>
      </Card>

      {/* ——— health ——— */}
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Health score" index="03" delay={120} action={<Link href="/portfolio/analysis#scorecard" className="text-[11px] text-mist-400 hover:text-gold-300">Scorecard →</Link>}>
        <div className="flex items-center gap-4">
          <Gauge value={health.score} size={170}>
            <div className="-mt-3">
              <div className="serif text-[52px] leading-none text-white">{health.score}</div>
              <div className="label mt-1 !text-gold-300">{health.label}</div>
            </div>
          </Gauge>
          <div className="min-w-0 flex-1 space-y-2.5">
            {health.parts.map((p) => (
              <div key={p.key} title={p.note}>
                <div className="flex justify-between text-[11.5px]"><span className="text-mist-300">{p.key}</span><span className="num text-mist-100">{p.score}</span></div>
                <Meter className="mt-1" value={p.score / 100} color={p.score >= 75 ? "#3ee0a1" : p.score >= 55 ? "#f5bd62" : "#ff8a5c"} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ——— risk ——— */}
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Risk level" index="04" delay={160} action={<Link href="/portfolio/analysis#risk" className="text-[11px] text-mist-400 hover:text-gold-300">Risk model →</Link>}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="serif text-[40px] italic leading-none text-mist-100">{rp.label}</div>
            <div className="mt-2 text-[12px] text-mist-400">SRRI class <span className="num text-mist-100">{rp.srri}</span> of 7 · risk score <span className="num text-mist-100">{rp.score}</span>/100</div>
          </div>
          <SignalBars level={rp.srri} />
        </div>
        <div className="mt-5">
          <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg,#3ee0a1,#b8dc6e,#f5d062,#f5a85a,#ff6b6b)" }}>
            <div className="absolute -top-1.5 h-5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,.8)]" style={{ left: `${rp.score}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-mist-500"><span>Conservative</span><span>Balanced</span><span>Aggressive</span></div>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-3 border-t border-white/[0.06] pt-4">
          <Mini label="Vol 1Y" value={fmtPct(rp.vol, 1, false)} />
          <Mini label="Max DD 3Y" value={fmtPct(rp.maxDD3y, 1)} tone="down" />
          <Mini label="Beta" value={rp.beta.toFixed(2)} />
          <Mini label="1-day VaR" value={<Money v={-rp.var95} ccy={ccy} compact />} tone="down" />
        </div>
      </Card>

      {/* ——— allocation ——— */}
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Allocation at a glance" index="05" delay={200} action={<Link href="/portfolio/analysis#rebalance" className="text-[11px] text-mist-400 hover:text-gold-300">Rebalance →</Link>}>
        <div className="flex items-center gap-5">
          <Donut
            size={168}
            thickness={14}
            outer={core.positions.map((p, i) => ({ label: p.symbol, value: p.value, color: hexA(SLEEVE_COLORS[p.sleeve], i % 2 ? 0.62 : 0.95), title: `${p.symbol} · ${fmtPct(p.weight, 1, false)}` })).concat([{ label: "Cash", value: t.cash, color: SLEEVE_COLORS.Cash, title: `Cash · ${fmtPct(exp.sleeves.Cash, 1, false)}` }])}
            inner={SLEEVES.map((s) => ({ label: s, value: exp.sleeves[s], color: SLEEVE_COLORS[s], title: `${s} · ${fmtPct(exp.sleeves[s], 1, false)}` }))}
          >
            <div>
              <div className="num text-[26px] leading-none text-white">{t.positions}</div>
              <div className="label mt-1">positions</div>
            </div>
          </Donut>
          <div className="min-w-0 flex-1 space-y-1.5">
            {dr.rows.map((r) => (
              <div key={r.sleeve} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-[11.5px]">
                <span className="flex min-w-0 items-center gap-2 truncate text-mist-300"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: SLEEVE_COLORS[r.sleeve] }} />{r.sleeve}</span>
                <span className="num text-mist-100">{fmtPct(r.actual, 1, false)}</span>
                <span className={`num w-11 text-right text-[10.5px] ${Math.abs(r.diff) < 0.02 ? "text-mist-500" : r.diff > 0 ? "text-gold-300" : "text-sky"}`}>{r.diff >= 0 ? "+" : "−"}{Math.abs(r.diff * 100).toFixed(1)}</span>
              </div>
            ))}
            <div className="pt-1 text-[10.5px] text-mist-500">pts vs target · drift {fmtPct(dr.total, 1, false)}</div>
          </div>
        </div>
      </Card>

      {/* ——— leaders / laggards ——— */}
      <SwitchCard className="col-span-12 xl:col-span-7" title="Leaders & laggards" index="06" labels={ll.map((x) => x.h)} defaultIndex={2} subtitle="P&L contribution to the book, including dividends">
        {ll.map((p) => (
          <div key={p.h} className="grid gap-6 md:grid-cols-2">
            {[{ list: p.leaders, up: true }, { list: p.laggards, up: false }].map(({ list, up }) => {
              const max = Math.max(1, ...p.leaders.map((r) => Math.abs(r.pnl)), ...p.laggards.map((r) => Math.abs(r.pnl)));
              return (
                <div key={String(up)}>
                  <div className={`label mb-3 ${up ? "!text-up" : "!text-down"}`}>{up ? "Leaders" : "Laggards"}</div>
                  <div className="space-y-2.5">
                    {list.length === 0 && <div className="text-[12px] text-mist-500">Nothing here — {up ? "no gains" : "no losses"} this period.</div>}
                    {list.map((r) => (
                      <HoldingLink key={r.symbol} symbol={r.symbol} className="group grid grid-cols-[auto_1fr_auto] items-center gap-3">
                        <Monogram symbol={r.symbol} color={r.color} size={26} />
                        <div className="min-w-0">
                          <div className="flex items-baseline justify-between gap-2"><span className="num text-[12px] text-mist-100">{r.symbol}</span><span className="truncate text-[10.5px] text-mist-500">{r.name}</span></div>
                          <div className="mt-1 h-1.5 rounded-full bg-white/[0.04]"><div className="h-full rounded-full" style={{ width: `${(Math.abs(r.pnl) / max) * 100}%`, background: up ? "linear-gradient(90deg,rgba(62,224,161,.3),#3ee0a1)" : "linear-gradient(90deg,rgba(255,107,107,.3),#ff6b6b)" }} /></div>
                        </div>
                        <div className="text-right">
                          <Money v={r.pnl} ccy={ccy} compact sign className={`block text-[12px] ${up ? "text-up" : "text-down"}`} />
                          <span className="num text-[10px] text-mist-500">{fmtPct(r.contrib, 2)}</span>
                        </div>
                      </HoldingLink>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </SwitchCard>

      {/* ——— shape of the book ——— */}
      <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Shape of the book" index="07" delay={240} subtitle="Your portfolio's silhouette vs the global market">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
          <Radar axes={shape} size={270} />
          <div className="w-full space-y-3 sm:w-40">
            <div className="flex gap-4 text-[11px] text-mist-400">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-gold-400" />Book</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 border-t border-dashed border-sky" />ACWI</span>
            </div>
            <Mini label="Top 10 weight" value={fmtPct(conc.top10, 0, false)} />
            <Mini label="Effective N" value={conc.effN.toFixed(1)} />
            <Mini label="Equity / defensive" value={`${Math.round(exp.equityW * 100)} / ${Math.round((1 - exp.equityW) * 100)}`} />
            <Mini label="Growth tilt" value={fmtPct(exp.growth, 0, false)} />
          </div>
        </div>
      </Card>

      {/* ——— top holdings ——— */}
      <Card className="col-span-12 xl:col-span-8" title="Top holdings" index="08" delay={280} action={<Link href="/portfolio/holdings" className="text-[11px] text-mist-400 hover:text-gold-300">All {t.positions} →</Link>} bodyClass="!px-0 !pb-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead>
              <tr className="label text-left">
                <th className="px-5 pb-2 font-normal">Holding</th>
                <th className="pb-2 font-normal">Weight</th>
                <th className="pb-2 text-right font-normal">Value</th>
                <th className="pb-2 text-right font-normal">Today</th>
                <th className="pb-2 text-right font-normal">Total return</th>
                <th className="px-5 pb-2 text-right font-normal">1Y</th>
              </tr>
            </thead>
            <tbody>
              {core.positions.slice(0, 10).map((p) => (
                <tr key={p.symbol} className="group border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-2">
                    <HoldingLink symbol={p.symbol} className="flex items-center gap-3">
                      <Monogram symbol={p.symbol} color={p.inst.meta.color} size={26} />
                      <span className="min-w-0"><span className="num block text-mist-100">{p.symbol}</span><span className="block truncate text-[11px] text-mist-500">{p.inst.name}</span></span>
                    </HoldingLink>
                  </td>
                  <td className="w-40 py-2 pr-4"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.min(100, (p.weight / core.positions[0].weight) * 100)}%` }} /></div><span className="num w-10 text-right text-mist-300">{fmtPct(p.weight, 1, false)}</span></div></td>
                  <td className="py-2 text-right"><Money v={p.value} ccy={ccy} dp={0} className="text-mist-100" /></td>
                  <td className="py-2 text-right"><Pct v={p.dayPct} dp={2} /></td>
                  <td className="py-2 text-right"><Pct v={p.totalReturnPct} dp={1} /><Money v={p.totalReturn} ccy={ccy} compact sign className="block text-[10.5px] text-mist-500" /></td>
                  <td className="px-5 py-2"><div className="flex justify-end"><Sparkline values={p.spark} width={84} height={24} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ——— upcoming events ——— */}
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Upcoming · 45 days" index="09" delay={320}>
        <EventStrip asOf={core.asOf} events={upcoming} />
        <div className="mt-4 max-h-[300px] space-y-1 overflow-y-auto pr-1">
          {upcoming.filter((e) => e.type !== "macro" || e.importance >= 3).slice(0, 12).map((e, i) => (
            <div key={`${e.date}-${e.symbol}-${e.type}-${i}`} className="grid grid-cols-[3rem_auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
              <div className="leading-tight"><div className="num text-[12px] text-mist-100">{fmtDate(e.date, "short")}</div><div className="text-[10px] text-mist-500">in {e.days}d</div></div>
              <span className="h-6 w-1 rounded-full" style={{ background: EVENT_META[e.type]?.color ?? "#999" }} />
              <div className="min-w-0">
                <div className="truncate text-[12px] text-mist-200">{e.symbol ? <span className="num mr-1.5 text-mist-100">{e.symbol}</span> : null}{e.title}</div>
                <div className="truncate text-[10.5px] text-mist-500">{e.detail}</div>
              </div>
              <div className="text-right text-[11px]">
                {e.amount ? <Money v={e.amount} ccy={ccy} compact className="text-up" /> : e.weight ? <span className="num text-mist-500">{fmtPct(e.weight, 1, false)}</span> : <Pill tone="violet">macro</Pill>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ——— news ——— */}
      <Card className="col-span-12 xl:col-span-8" title="Relevant news · scored against your book" index="10" delay={360} action={<Link href="/news" className="text-[11px] text-mist-400 hover:text-gold-300">Newsroom →</Link>}>
        <div className="divide-y divide-white/[0.05]">
          {enriched.map((nw) => (
            <article key={nw.id} className="grid grid-cols-[4px_1fr_auto] gap-4 py-3 first:pt-0 last:pb-0">
              <div className="rounded-full bg-white/[0.05]"><div className="w-full rounded-full" style={{ height: `${Math.max(12, nw.relevance * 100)}%`, background: nw.sentiment >= 0 ? "#3ee0a1" : "#ff6b6b" }} /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-mist-500">
                  <span className="text-mist-400">{nw.source}</span><span>·</span><span>{relTime(nw.hours)}</span>
                  {nw.impact === "high" && <Pill tone="gold">high impact</Pill>}
                </div>
                <h4 className="mt-1 text-[13.5px] font-medium leading-snug text-mist-100">{nw.headline}</h4>
                <p className="mt-1 line-clamp-1 text-[12px] text-mist-400">{nw.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {nw.syms.filter((s) => s.direct + s.via > 0.0005).map((s) => (
                    <HoldingLink key={s.symbol} symbol={s.symbol} className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10.5px] ring-1 ring-inset ring-white/[0.06]">
                      <span className="num text-mist-100">{s.symbol}</span>
                      <span className="num text-gold-300">{fmtPct(s.direct + s.via, 1, false)}</span>
                      {s.via > 0.001 && <span className="text-mist-500">incl. {fmtPct(s.via, 1, false)} via ETFs</span>}
                    </HoldingLink>
                  ))}
                  {nw.topics.filter((x) => x.weight > 0.001).map((x) => (
                    <span key={x.topic} className="inline-flex items-center gap-1.5 rounded-md bg-violet/[0.07] px-1.5 py-0.5 text-[10.5px] text-violet ring-1 ring-inset ring-violet/15">{x.label} <span className="num">{fmtPct(x.weight, 1, false)}</span></span>
                  ))}
                </div>
              </div>
              <div className="w-24 text-right">
                <div className="label">Book at stake</div>
                <div className="num mt-1.5 text-[18px] text-mist-100">{fmtPct(nw.exposure, 1, false)}</div>
                <Money v={nw.exposure * t.value} ccy={ccy} compact className="text-[10.5px] text-mist-500" />
              </div>
            </article>
          ))}
        </div>
      </Card>

      {/* ——— insights ——— */}
      <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Insights" index="11" delay={400}>
        <div className="space-y-2">
          {ins.slice(0, 6).map((x, i) => (
            <Link key={i} href={x.href} className="group flex gap-3 rounded-xl p-2.5 ring-1 ring-inset ring-transparent transition hover:bg-white/[0.03] hover:ring-white/[0.06]">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[12px] ${x.tone === "warn" ? "bg-gold-400/12 text-gold-300" : x.tone === "good" ? "bg-up/10 text-up" : "bg-sky/10 text-sky"}`}>
                {x.tone === "warn" ? "!" : x.tone === "good" ? "✓" : "i"}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] leading-snug text-mist-100 group-hover:text-white">{x.title}</span>
                <span className="mt-0.5 block text-[11px] text-mist-500">{x.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Vital({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <div className="label">{label}</div>
      <div className="mt-2 text-[22px] font-light leading-none tracking-tight text-white">{value}</div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-mist-500">{sub}</div>
    </div>
  );
}
function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="min-w-0">
      <div className="label !text-[9.5px]">{label}</div>
      <div className={`num mt-1.5 text-[14px] ${tone === "down" ? "text-down" : tone === "up" ? "text-up" : "text-mist-100"}`}>{value}</div>
    </div>
  );
}

function EventStrip({ asOf, events }: { asOf: string; events: { date: string; type: string; symbol: string | null; title: string }[] }) {
  const days = Array.from({ length: 45 }, (_, i) => shiftDate(asOf, { days: i + 1 }));
  const by = new Map<string, typeof events>();
  for (const e of events) by.set(e.date, [...(by.get(e.date) ?? []), e]);
  return (
    <div>
      <div className="flex h-14 items-end gap-[2px]">
        {days.map((d) => {
          const list = by.get(d) ?? [];
          const wd = new Date(d + "T00:00:00Z").getUTCDay();
          return (
            <div key={d} className="flex h-full flex-1 flex-col-reverse items-center gap-[2px]" title={list.length ? `${fmtDate(d, "short")}: ${list.map((e) => `${e.symbol ?? ""} ${e.title}`).join(" · ")}` : fmtDate(d, "short")}>
              <div className={`h-1 w-full rounded-sm ${wd === 0 || wd === 6 ? "bg-white/[0.03]" : "bg-white/[0.09]"}`} />
              {list.slice(0, 6).map((e, j) => <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: EVENT_META[e.type]?.color ?? "#999" }} />)}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-mist-500"><span>{fmtDate(days[0], "short")}</span><span>{fmtDate(days[22], "short")}</span><span>{fmtDate(days[44], "short")}</span></div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-mist-400">
        {Object.entries(EVENT_META).map(([k, v]) => <span key={k} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: v.color }} />{v.label}</span>)}
      </div>
    </div>
  );
}
