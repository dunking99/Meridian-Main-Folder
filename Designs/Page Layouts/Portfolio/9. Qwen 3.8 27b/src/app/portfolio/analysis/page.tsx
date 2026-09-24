"use client";
import Panel from "@/components/ui/Panel";
import Reveal from "@/components/ui/Reveal";
import Skel from "@/components/ui/Skel";
import Meter from "@/components/ui/Meter";
import CorrMatrix from "@/components/charts/CorrMatrix";
import Bubbles from "@/components/charts/Bubbles";
import { useApi } from "@/hooks/useApi";
import { useCurrency } from "@/components/portfolio/CurrencyContext";
import type { AnalysisPayload } from "@/lib/types";

export default function AnalysisPage() {
  const { data, error } = useApi<AnalysisPayload>("/api/portfolio/analysis");
  const { money } = useCurrency();

  if (error) {
    return (
      <div className="panel px-6 py-10 text-center">
        <div className="font-display text-xl">Something drifted off course</div>
        <p className="text-tx-3 text-sm mt-2">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skel className="h-48 w-full" />
        <div className="grid grid-cols-12 gap-4">
          <Skel className="col-span-12 xl:col-span-7 h-96" />
          <Skel className="col-span-12 xl:col-span-5 h-96" />
        </div>
      </div>
    );
  }

  const maxSector = Math.max(...data.sectors.map((s) => Math.max(s.port, s.bench ?? 0)), 1);
  const maxCcy = Math.max(...data.currency.map((c) => c.pct), 1);
  const maxAttr = Math.max(...data.attribution.map((a) => a.contrib), 1);
  const usGap = data.homeBias.us - data.homeBias.globalUs;

  return (
    <div className="space-y-4">
      {/* SCORECARD */}
      <Reveal>
        <Panel kicker="Verdict" title="Portfolio scorecard">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.scorecard.map((sc) => (
              <div key={sc.key} className="rounded-xl border border-line bg-ink-850/40 p-4 hover:border-line2 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold">{sc.label}</span>
                  <span className={`chip ${sc.score >= 70 ? "chip-hot" : ""}`}>{sc.grade}</span>
                </div>
                <Meter score={sc.score} className="mt-3" />
                <div className="num text-[21px] mt-2 leading-none">
                  {sc.score}
                  <span className="text-[10px] text-tx-3">/100</span>
                </div>
                <p className="text-[11px] text-tx-3 mt-2 leading-relaxed">{sc.note}</p>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* SECTORS + CONCENTRATION */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-7">
          <Panel
            kicker="Exposure"
            title="Sectors vs S&P 500"
            className="h-full"
            right={
              <div className="flex items-center gap-3 text-[10.5px] text-tx-3">
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-brass/80" /> your book</span>
                <span className="flex items-center gap-1.5"><span className="h-1 w-3 rounded-sm bg-tx-3/60" /> S&P 500</span>
              </div>
            }
          >
            <div>
              {data.sectors.map((s) => (
                <div key={s.sector} className="grid grid-cols-[120px_1fr_96px] gap-3 items-center py-[7px] border-b border-line/50 last:border-0">
                  <span className="text-[12px] text-tx-2 truncate">{s.sector}</span>
                  <div className="space-y-[3px]">
                    <div className="h-[9px] rounded-full bg-ink-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(s.port / maxSector) * 100}%`, background: "rgba(217,166,72,0.85)" }} />
                    </div>
                    <div className="h-[4px] rounded-full bg-ink-800 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${((s.bench ?? 0) / maxSector) * 100}%`, background: "rgba(95,109,121,0.6)" }} />
                    </div>
                  </div>
                  <span className="num text-[11.5px] text-right">
                    {s.port.toFixed(1)}%
                    <span className="text-tx-3 block text-[9.5px]">{s.bench != null ? `bench ${s.bench.toFixed(1)}%` : "no bench"}</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-5" delay={80}>
          <Panel kicker="Structure" title="Concentration" className="h-full">
            <div className="flex items-center gap-4">
              <div>
                <div className="font-display text-[40px] leading-none text-brass2 num">{data.concentration.hhi}</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-tx-3 mt-1.5">HHI index</div>
              </div>
              <span className="chip chip-hot">{data.concentration.grade} concentration</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { l: "Top 3", v: data.concentration.top3 },
                { l: "Top 5", v: data.concentration.top5 },
                { l: "Top 10", v: data.concentration.top10 },
                { l: "Single largest", v: data.concentration.maxSingle },
              ].map((r) => (
                <div key={r.l}>
                  <div className="flex justify-between text-[11.5px] mb-1.5">
                    <span className="text-tx-2">{r.l}</span>
                    <span className="num text-tx-1">{(r.v * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.v * 100}%`, background: "rgba(217,166,72,0.7)" }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10.5px] text-tx-3 leading-relaxed">
              A well-diversified book sits near 900–1,200. ETF wrappers compound — effective single-name exposure runs higher than nominal.
            </p>
          </Panel>
        </Reveal>
      </div>

      {/* CORRELATION + BUBBLES */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-6">
          <Panel kicker="Linked movement" title="Correlation matrix" className="h-full">
            <CorrMatrix labels={data.correlation.labels} matrix={data.correlation.matrix} />
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-6" delay={80}>
          <Panel kicker="Risk vs return" title="Each position on the frontier" className="h-full">
            <Bubbles items={data.bubbles} />
          </Panel>
        </Reveal>
      </div>

      {/* OVERLAP + HOME BIAS */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-7">
          <Panel kicker="Fund overlap" title="How much is it really one index?" className="h-full">
            {data.overlap.map((o) => (
              <div key={o.id} className="py-3 border-b border-line/50 last:border-0">
                <div className="flex items-baseline gap-2 text-[12px]">
                  <span className="font-mono font-semibold text-[12.5px]">{o.id}</span>
                  <span className="text-tx-3 truncate">{o.name}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-[9px] flex-1 rounded-full bg-ink-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${o.overlap * 100}%`, background: "rgba(100,182,232,0.75)" }} />
                  </div>
                  <span className="num text-[11.5px] w-14 text-right">{(o.overlap * 100).toFixed(0)}% of S&P</span>
                </div>
                {o.shared.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-[10px] text-tx-3 self-center mr-1">overlaps your singles:</span>
                    {o.shared.map((s) => (
                      <span key={s} className="chip chip-hot">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <p className="mt-3 text-[10.5px] text-tx-3 leading-relaxed">
              Your four equity ETFs together overlap ~90% of the S&P 500 — combined with AAPL / NVDA / MSFT / TSM / LLY singles, several names are double-dipped.
            </p>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-5" delay={80}>
          <Panel kicker="Home bias" title="US vs the rest of the world" className="h-full">
            {[
              { l: "Your book", us: data.homeBias.us, intl: data.homeBias.intl, hot: true },
              { l: "Global benchmark", us: data.homeBias.globalUs, intl: data.homeBias.globalIntl, hot: false },
            ].map((r) => (
              <div key={r.l} className="mb-5">
                <div className="flex justify-between text-[11.5px] mb-1.5">
                  <span className={r.hot ? "text-tx-1 font-medium" : "text-tx-3"}>{r.l}</span>
                  <span className="num text-tx-2">
                    US {r.us.toFixed(0)}% · int&apos;l {r.intl.toFixed(0)}%
                  </span>
                </div>
                <div className="flex h-6 rounded-lg overflow-hidden border border-line">
                  <div className="h-full" style={{ width: `${r.us}%`, background: r.hot ? "rgba(217,166,72,0.8)" : "rgba(95,109,121,0.5)" }} />
                  <div className="h-full" style={{ width: `${r.intl}%`, background: r.hot ? "rgba(100,182,232,0.6)" : "rgba(95,109,121,0.3)" }} />
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-line bg-ink-850/50 px-3.5 py-3 text-[11.5px] text-tx-2 leading-relaxed">
              You are <span className={`num font-semibold ${usGap > 0 ? "text-brass2" : "text-sky"}`}>{usGap > 0 ? "+" : ""}{usGap.toFixed(0)}pp</span> more US-heavy
              than a global benchmark. That is a view, not an accident — keep it written down.
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* CURRENCY + FACTORS */}
      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-6">
          <Panel kicker="Currency exposure" title="Underlying currencies (unhedged)" className="h-full">
            {data.currency.map((c) => (
              <div key={c.ccy} className="grid grid-cols-[44px_1fr_92px] gap-3 items-center py-[7px] border-b border-line/50 last:border-0">
                <span className="font-mono text-[11.5px] text-tx-1">{c.ccy}</span>
                <div className="h-[9px] rounded-full bg-ink-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.pct / maxCcy) * 100}%`, background: c.ccy === "USD" ? "rgba(217,166,72,0.8)" : "rgba(100,182,232,0.65)" }} />
                </div>
                <span className="num text-[11px] text-right text-tx-2">
                  {(c.pct * 100).toFixed(1)}% <span className="text-tx-3">{money(c.value, true)}</span>
                </span>
              </div>
            ))}
            <p className="mt-3 text-[10.5px] text-tx-3 leading-relaxed">
              FX drift has historically added ~1.5pp/yr to unhedged international equity — you are long the weak-dollar trade.
            </p>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-6" delay={80}>
          <Panel kicker="Style" title="Factor tilt vs market cap-weighted" className="h-full">
            {data.factors.map((f) => (
              <div key={f.name} className="grid grid-cols-[112px_1fr_48px] gap-3 items-center py-[7px]">
                <span className="text-[11.5px] text-tx-2">{f.name}</span>
                <div className="relative h-3 rounded-full bg-ink-800 overflow-hidden">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-line2" />
                  <div
                    className="absolute inset-y-0 rounded-full"
                    style={
                      f.tilt >= 0
                        ? { left: "50%", width: `${f.tilt * 50}%`, background: "rgba(63,214,143,0.75)" }
                        : { right: "50%", width: `${-f.tilt * 50}%`, background: "rgba(240,101,95,0.75)" }
                    }
                  />
                </div>
                <span className={`num text-[11px] text-right ${f.tilt >= 0 ? "text-up" : "text-down"}`}>
                  {f.tilt >= 0 ? "+" : ""}
                  {f.tilt.toFixed(1)}
                </span>
              </div>
            ))}
            <p className="mt-3 text-[10.5px] text-tx-3 leading-relaxed">
              A growth / high-beta / low-yield book. It will outshines in risk-on tapes and under-deliver in value rotations.
            </p>
          </Panel>
        </Reveal>
      </div>

      {/* ATTRIBUTION */}
      <Reveal>
        <Panel kicker="Risk attribution" title="Who drives the portfolio&apos;s volatility">
          <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
            {data.attribution.slice(0, 10).map((a) => (
              <div key={a.id} className="grid grid-cols-[64px_1fr_52px] gap-3 items-center">
                <span className="font-mono text-[11.5px] font-semibold" style={{ color: a.color }}>{a.label}</span>
                <div className="h-[10px] rounded-full bg-ink-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(a.contrib / maxAttr) * 100}%`, background: a.color, opacity: 0.75 }} />
                </div>
                <span className="num text-[11.5px] text-right">{(a.contrib * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10.5px] text-tx-3">Share of total portfolio volatility, via weight × correlation × individual vol.</p>
        </Panel>
      </Reveal>
    </div>
  );
}
