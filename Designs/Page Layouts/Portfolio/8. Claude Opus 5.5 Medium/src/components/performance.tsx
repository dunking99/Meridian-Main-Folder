"use client";

import { useState } from "react";
import { TimeChart } from "./charts/advanced";
import { useMoney } from "./money";
import { pct } from "@/lib/format";

export function GroupedBars({ rows, height = 200 }: { rows: { label: string; p: number; b: number }[]; height?: number }) {
  const [hv, setHv] = useState<number | null>(null);
  const max = Math.max(...rows.flatMap((r) => [Math.abs(r.p), Math.abs(r.b)]), 0.01);
  const hasNeg = rows.some((r) => r.p < 0 || r.b < 0);
  const zeroAt = hasNeg ? 50 : 100;
  const scale = hasNeg ? 50 : 100;
  return (
    <div>
      <div className="relative flex gap-3" style={{ height }}>
        <div className="absolute inset-x-0 h-px bg-line2" style={{ top: `${zeroAt}%` }} />
        {rows.map((r, i) => (
          <div key={r.label} className="relative flex flex-1 justify-center gap-1" onMouseEnter={() => setHv(i)} onMouseLeave={() => setHv(null)}>
            {[r.p, r.b].map((v, k) => (
              <div key={k} className="relative h-full w-full max-w-[26px]">
                <div className="absolute inset-x-0 rounded-[3px] transition-all" style={{
                  top: v >= 0 ? `${zeroAt - (v / max) * scale}%` : `${zeroAt}%`, height: `${(Math.abs(v) / max) * scale}%`,
                  background: k === 0 ? (v >= 0 ? "linear-gradient(180deg,#d4ff3a,#d4ff3a88)" : "#ff5a78") : "#8f7cff66", boxShadow: hv === i && k === 0 ? "0 0 12px #d4ff3a66" : undefined,
                }} />
                {k === 0 && <div className="num absolute inset-x-[-10px] text-center text-[9.5px] text-fg/80" style={{ top: v >= 0 ? `calc(${zeroAt - (v / max) * scale}% - 14px)` : `calc(${zeroAt + (Math.abs(v) / max) * scale}% + 2px)` }}>{pct(v, 1)}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">{rows.map((r) => <div key={r.label} className="num flex-1 text-center text-[10.5px] text-muted">{r.label}</div>)}</div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" />Portfolio</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-violet/60" />MSCI ACWI</span>
        {hv !== null && <span className="num ml-auto">{rows[hv].label}: excess <span className={rows[hv].p - rows[hv].b >= 0 ? "text-pos" : "text-neg"}>{pct(rows[hv].p - rows[hv].b, 2, true)}</span></span>}
      </div>
    </div>
  );
}

type Roll = { date: string; vol: number | null; bvol: number | null; ret1y: number | null; bret1y: number | null; beta: number | null; sharpe: number | null };

export function RollingPanel({ rolling }: { rolling: Roll[] }) {
  const [k, setK] = useState<"vol" | "ret" | "beta" | "sharpe">("vol");
  const dates = rolling.map((r) => r.date);
  const toggle = (
    <div className="flex rounded-full border border-line bg-ink/40 p-0.5 text-[11px]">
      {([["vol", "Volatility 3M"], ["ret", "Return 1Y"], ["beta", "Beta 6M"], ["sharpe", "Sharpe 1Y"]] as const).map(([key, l]) => (
        <button key={key} onClick={() => setK(key)} className={`rounded-full px-3 py-1 ${k === key ? "bg-accent font-medium text-ink" : "text-muted hover:text-fg"}`}>{l}</button>
      ))}
    </div>
  );
  const s =
    k === "vol" ? [{ key: "a", label: "Portfolio", values: rolling.map((r) => r.vol), color: "#d4ff3a", kind: "area" as const }, { key: "b", label: "ACWI", values: rolling.map((r) => r.bvol), color: "#8f7cff" }]
      : k === "ret" ? [{ key: "a", label: "Portfolio", values: rolling.map((r) => r.ret1y), color: "#d4ff3a", kind: "area" as const }, { key: "b", label: "ACWI", values: rolling.map((r) => r.bret1y), color: "#8f7cff" }]
        : k === "beta" ? [{ key: "a", label: "Rolling beta", values: rolling.map((r) => r.beta), color: "#3fd0ff", kind: "area" as const }]
          : [{ key: "a", label: "Rolling Sharpe", values: rolling.map((r) => r.sharpe), color: "#ff7ad9", kind: "area" as const }];
  return <TimeChart key={k} dates={dates} series={s} format={k === "beta" || k === "sharpe" ? "num" : "pct"} defaultRange="ALL" height={240} zero={k === "ret"} extraControls={toggle} />;
}

export function Bridge({ start, steps, end }: { start: number; steps: { label: string; value: number }[]; end: number }) {
  const { fmt } = useMoney();
  const items = [{ label: "Net deposits", value: start, kind: "total" as const }, ...steps.map((s) => ({ ...s, kind: "step" as const })), { label: "Value today", value: end, kind: "total" as const }];
  let run = 0;
  const bars = items.map((it) => {
    if (it.kind === "total") { run = it.value; return { ...it, lo: 0, hi: it.value }; }
    const lo = Math.min(run, run + it.value), hi = Math.max(run, run + it.value);
    run += it.value;
    return { ...it, lo, hi };
  });
  const max = Math.max(...bars.map((b) => b.hi));
  const min = Math.min(0, ...bars.map((b) => b.lo));
  const H = 220;
  const y = (v: number) => ((max - v) / (max - min)) * H;
  return (
    <div>
      <div className="relative flex gap-2" style={{ height: H }}>
        {bars.map((b, i) => (
          <div key={b.label} className="relative flex-1">
            <div className="absolute inset-x-1 rounded-[4px]" style={{ top: y(b.hi), height: Math.max(2, y(b.lo) - y(b.hi)), background: b.kind === "total" ? (i === 0 ? "#565d6e" : "linear-gradient(180deg,#d4ff3a,#8fbf1f)") : b.value >= 0 ? "#2fe39b" : "#ff5a78" }} />
            <div className="num absolute inset-x-0 text-center text-[10px]" style={{ top: y(b.hi) - 15 }}>{b.kind === "total" ? fmt(b.value, { compact: true }) : fmt(b.value, { compact: true, sign: true })}</div>
            {i < bars.length - 1 && <div className="absolute -right-1 h-px w-2 bg-dim" style={{ top: y(b.kind === "total" ? b.hi : b.value >= 0 ? b.hi : b.lo) }} />}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">{bars.map((b) => <div key={b.label} className="flex-1 text-center text-[10px] leading-tight text-muted">{b.label}</div>)}</div>
    </div>
  );
}

export function DrawdownChart({ dates, dd, bdd }: { dates: string[]; dd: number[]; bdd: number[] }) {
  return <TimeChart dates={dates} format="pct" defaultRange="ALL" height={220} series={[{ key: "dd", label: "Portfolio drawdown", values: dd, color: "#ff5a78", kind: "area" }, { key: "bdd", label: "ACWI", values: bdd, color: "#8f7cff" }]} />;
}

export function CumulativeChart({ dates, idx, bidx }: { dates: string[]; idx: number[]; bidx: number[] }) {
  const excess = idx.map((v, i) => v / bidx[i]);
  const [mode, setMode] = useState<"cum" | "excess">("cum");
  const toggle = (
    <div className="flex rounded-full border border-line bg-ink/40 p-0.5 text-[11px]">
      {([["cum", "Cumulative"], ["excess", "Relative to ACWI"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1 ${mode === k ? "bg-accent font-medium text-ink" : "text-muted hover:text-fg"}`}>{l}</button>
      ))}
    </div>
  );
  return mode === "cum" ? (
    <TimeChart key="c" dates={dates} rebase format="pct" zero defaultRange="ALL" height={300} extraControls={toggle} series={[{ key: "p", label: "Portfolio (TWR)", values: idx, color: "#d4ff3a", kind: "area" }, { key: "b", label: "MSCI ACWI", values: bidx, color: "#8f7cff" }]} />
  ) : (
    <TimeChart key="e" dates={dates} rebase format="pct" zero defaultRange="ALL" height={300} extraControls={toggle} series={[{ key: "x", label: "Excess vs ACWI (geometric)", values: excess, color: "#3fd0ff", kind: "area" }]} />
  );
}
