"use client";
import Panel from "@/components/ui/Panel";
import Reveal from "@/components/ui/Reveal";
import Skel from "@/components/ui/Skel";
import Delta from "@/components/ui/Delta";
import HeatCalendar from "@/components/charts/HeatCalendar";
import LinePanel from "@/components/charts/LinePanel";
import { useApi } from "@/hooks/useApi";
import type { PerformancePayload } from "@/lib/types";

export default function PerformancePage() {
  const { data, error } = useApi<PerformancePayload>("/api/portfolio/performance");

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
        <Skel className="h-24 w-full" />
        <div className="grid grid-cols-12 gap-4">
          <Skel className="col-span-12 xl:col-span-8 h-80" />
          <Skel className="col-span-12 xl:col-span-4 h-80" />
        </div>
        <Skel className="h-64 w-full" />
      </div>
    );
  }

  const s = data.stats;
  const tiles = [
    { l: "CAGR · 5Y", v: `${(s.cagr * 100).toFixed(1)}%`, tone: s.cagr >= 0 ? "up" : "down", note: "since inception" },
    { l: "Sharpe", v: s.sharpe.toFixed(2), tone: s.sharpe >= 1 ? "up" : "flat", note: "rf 4.3%" },
    { l: "Sortino", v: s.sortino.toFixed(2), tone: s.sortino >= 1 ? "up" : "flat", note: "downside vol adj." },
    { l: "Annualized vol", v: `${(s.vol * 100).toFixed(1)}%`, tone: "flat", note: "5Y daily" },
    { l: "Max drawdown", v: `${(s.maxDd * 100).toFixed(1)}%`, tone: "down", note: "5Y peak to trough" },
    { l: "Beta", v: s.beta.toFixed(2), tone: "flat", note: "vs S&P 500" },
    { l: "Alpha · 5Y", v: `${s.alpha >= 0 ? "+" : "−"}${(Math.abs(s.alpha) * 100).toFixed(1)}pp`, tone: s.alpha >= 0 ? "up" : "down", note: "vs S&P 500 CAGR" },
    { l: "Up months", v: `${(s.upMonthPct * 100).toFixed(0)}%`, tone: s.upMonthPct >= 0.5 ? "up" : "down", note: `${(s.winRateDaily * 100).toFixed(0)}% of days green` },
  ];
  const histMax = Math.max(...data.hist.map((h) => h.count), 1);
  const m24max = Math.max(...data.monthly24.map((m) => Math.abs(m.ret)), 0.01);

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {tiles.map((t) => (
            <div key={t.l} className="panel px-4 py-3.5">
              <div className="text-[9.5px] uppercase tracking-[0.15em] text-tx-3 font-semibold">{t.l}</div>
              <div className={`num text-[19px] font-medium mt-1 ${t.tone === "up" ? "text-up" : t.tone === "down" ? "text-down" : "text-tx-1"}`}>{t.v}</div>
              <div className="text-[10.5px] text-tx-3 mt-0.5">{t.note}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-8">
          <Panel kicker="Growth" title="Cumulative return vs S&P 500" className="h-full">
            <LinePanel
              data={data.cumulative}
              lines={[
                { key: "port", label: "Portfolio", color: "#D9A648", width: 2 },
                { key: "bench", label: "S&P 500", color: "#5F6D79", dash: true },
              ]}
              height={300}
              fmt={(v) => (v * 100).toFixed(0) + "%"}
              areaKey="port"
              zeroLine
            />
            <div className="mt-1 flex justify-between text-[10.5px] text-tx-3">
              <span>both indexed to 100 at inception · 5 years</span>
              <span>
                best {s.bestMonth.label} <span className="text-up">+{(s.bestMonth.ret * 100).toFixed(1)}%</span> · worst {s.worstMonth.label}{" "}
                <span className="text-down">{(s.worstMonth.ret * 100).toFixed(1)}%</span>
              </span>
            </div>
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-4" delay={80}>
          <Panel kicker="Trailing" title="Trailing returns" className="h-full" bodyClassName="px-5 pb-4 pt-2">
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-2 pb-1.5 border-b border-line text-[9.5px] uppercase tracking-wider text-tx-3 font-semibold">
              <span>Window</span>
              <span className="text-right">Portfolio</span>
              <span className="text-right">S&P 500</span>
            </div>
            {data.trailing.map((t) => (
              <div key={t.window} className="grid grid-cols-[1fr_1fr_1fr] gap-x-2 items-center py-2 border-b border-line/50 last:border-0">
                <span className="text-[12px] text-tx-2">{t.window}</span>
                <span className="flex justify-end"><Delta v={t.port} digits={1} /></span>
                <span className={`num text-[12px] text-right ${t.bench >= 0 ? "text-tx-2" : "text-tx-3"}`}>
                  {(t.bench >= 0 ? "+" : "") + (t.bench * 100).toFixed(1)}%
                </span>
              </div>
            ))}
            <div className="mt-3 text-[10.5px] text-tx-3 leading-relaxed">
              Up-capture <span className="num text-tx-1">{s.upCapture.toFixed(2)}</span> · down-capture{" "}
              <span className="num text-tx-1">{s.downCapture.toFixed(2)}</span> · tracking error{" "}
              <span className="num text-tx-1">{(s.trackingErr * 100).toFixed(1)}%</span>
            </div>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel kicker="Rhythm" title="Monthly returns — five year heat calendar">
          <HeatCalendar years={[...data.monthly].reverse()} />
        </Panel>
      </Reveal>

      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-7">
          <Panel kicker="Drawdown" title="Time underwater" className="h-full">
            <LinePanel
              data={data.drawdown}
              lines={[{ key: "dd", label: "Drawdown", color: "#F0655F", width: 1.6 }]}
              height={230}
              fmt={(v) => (v * 100).toFixed(0) + "%"}
              areaKey="dd"
            />
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-5" delay={80}>
          <Panel kicker="Distribution" title="Daily returns · 5Y" className="h-full">
            <div className="flex items-end gap-[3px] h-44 mt-4">
              {data.hist.map((h) => {
                const neg = parseFloat(h.label) < 0;
                return (
                  <div key={h.label} className="flex-1 flex flex-col justify-end h-full" title={`${h.label} · ${h.count} days`}>
                    <div
                      className="rounded-t-[3px] transition-all duration-300 hover:brightness-150"
                      style={{
                        height: `${(h.count / histMax) * 100}%`,
                        background: neg ? "rgba(240,101,95,0.55)" : "rgba(63,214,143,0.55)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 num text-[10px] text-tx-3">
              <span>{data.hist[0].label}</span>
              <span>0%</span>
              <span>{data.hist[data.hist.length - 1].label}</span>
            </div>
            <p className="mt-2 text-[10.5px] text-tx-3">
              Green days {(s.winRateDaily * 100).toFixed(0)}% · right tail does the heavy lifting
            </p>
          </Panel>
        </Reveal>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-7">
          <Panel kicker="Consistency" title="Rolling 12-month return" className="h-full">
            <LinePanel
              data={data.rolling}
              lines={[{ key: "ret", label: "Trailing 12M", color: "#64B6E8", width: 1.6 }]}
              height={230}
              fmt={(v) => (v * 100).toFixed(0) + "%"}
              zeroLine
            />
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-5" delay={80}>
          <Panel kicker="By year" title="Calendar year scoreboard" className="h-full" bodyClassName="px-5 pb-4 pt-2">
            {data.yearly.map((y) => (
              <div key={y.year} className="grid grid-cols-[44px_1fr_1fr_1fr_48px] items-center gap-2 py-2 border-b border-line/50 last:border-0">
                <span className="num text-[12px] text-tx-2">{y.year}</span>
                <span className="num text-[12.5px] font-medium text-right w-full">{(y.ret >= 0 ? "+" : "") + (y.ret * 100).toFixed(1)}%</span>
                <span className="num text-[11px] text-tx-3 text-right">σ {(y.vol * 100).toFixed(0)}%</span>
                <span className="num text-[11px] text-tx-3 text-right">DD {(y.maxDd * 100).toFixed(0)}%</span>
                <span className="num text-[11px] text-right text-tx-2">{y.sharpe.toFixed(2)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[44px_1fr_1fr_1fr_48px] gap-2 pt-2 text-[9px] uppercase tracking-wider text-tx-3 font-semibold">
              <span />
              <span className="text-right">Return</span>
              <span className="text-right">Vol</span>
              <span className="text-right">Max DD</span>
              <span className="text-right">Sharpe</span>
            </div>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel kicker="Cadence" title="Monthly returns · last 24 months">
          <div className="flex items-end gap-[4px] h-28 mt-2">
            {data.monthly24.map((m) => (
              <div key={m.t} className="flex-1 flex flex-col justify-end h-full" title={`${m.t} · ${(m.ret * 100).toFixed(1)}%`}>
                <div
                  className="rounded-t-[3px] hover:brightness-150 transition-all"
                  style={{ height: `${(Math.abs(m.ret) / m24max) * 100}%`, background: m.ret >= 0 ? "rgba(63,214,143,0.6)" : "rgba(240,101,95,0.6)" }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between num text-[10px] text-tx-3 mt-1.5">
            <span>{data.monthly24[0]?.t}</span>
            <span>{data.monthly24[data.monthly24.length - 1]?.t}</span>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
