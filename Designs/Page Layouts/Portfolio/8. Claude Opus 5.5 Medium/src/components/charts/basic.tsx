"use client";

import { useState } from "react";
import { pct } from "@/lib/format";
import { useMoney } from "@/components/money";

export function heat(x: number, max = 0.08, alpha = 0.9) {
  const t = Math.min(1, Math.abs(x) / max);
  const a = 0.08 + t * alpha;
  return x >= 0 ? `rgba(47,227,155,${a})` : `rgba(255,90,120,${a})`;
}

export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
}

export function Sparkline({ data, w = 110, h = 30, color, fill = true, strokeWidth = 1.5 }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean; strokeWidth?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const c = color ?? (data[data.length - 1] >= data[0] ? "#2fe39b" : "#ff5a78");
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
  const id = "sg" + Math.round(Math.abs(data[0] * 1000 + data.length + h)) % 100000;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.35" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d}L${w},${h}L0,${h}Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2" fill={c} />
    </svg>
  );
}

export function ScoreRing({ score, size = 132, label, sub }: { score: number; size?: number; label?: string; sub?: string }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const col = score >= 70 ? "#2fe39b" : score >= 55 ? "#d4ff3a" : score >= 40 ? "#ffb547" : "#ff5a78";
  const ticks = Array.from({ length: 48 });
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {ticks.map((_, i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const on = i / ticks.length < score / 100;
          return (
            <line key={i} x1={size / 2 + (r + 5) * Math.cos(a)} y1={size / 2 + (r + 5) * Math.sin(a)} x2={size / 2 + (r + 8) * Math.cos(a)} y2={size / 2 + (r + 8) * Math.sin(a)} stroke={on ? col : "#272c38"} strokeWidth="1.5" />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r - 4} fill="none" stroke="#1d212b" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r - 4} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`} style={{ filter: `drop-shadow(0 0 6px ${col}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-serif text-4xl leading-none" style={{ color: col }}>{score}</div>
        {label && <div className="eyebrow mt-1">{label}</div>}
        {sub && <div className="text-[10px] text-dim">{sub}</div>}
      </div>
    </div>
  );
}

export function RiskGauge({ level, label }: { level: number; label: string }) {
  const w = 220, h = 160, cx = 110, cy = 108, r0 = 72, r1 = 96;
  const cols = ["#2fe39b", "#7eea78", "#c4f25a", "#d4ff3a", "#ffd166", "#ff9f4c", "#ff5a78"];
  const seg = Math.PI / 7;
  const a = Math.PI + (level - 0.5) * seg;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[240px]">
      {cols.map((c, i) => (
        <path key={i} d={arcPath(cx, cy, r0, r1, Math.PI + i * seg + 0.02, Math.PI + (i + 1) * seg - 0.02)} fill={c} opacity={i + 1 === level ? 1 : 0.16} />
      ))}
      {cols.map((_, i) => (
        <text key={i} x={cx + (r1 + 9) * Math.cos(Math.PI + (i + 0.5) * seg)} y={cy + (r1 + 9) * Math.sin(Math.PI + (i + 0.5) * seg) + 3} fontSize="9" fill={i + 1 === level ? "#e8ebf1" : "#565d6e"} textAnchor="middle" className="num">
          {i + 1}
        </text>
      ))}
      <line x1={cx} y1={cy} x2={cx + (r0 - 8) * Math.cos(a)} y2={cy + (r0 - 8) * Math.sin(a)} stroke="#e8ebf1" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#0d0f14" stroke="#e8ebf1" strokeWidth="2" />
      <text x={cx} y={cy + 36} textAnchor="middle" fontSize="30" fill="#e8ebf1" className="font-serif">{level}<tspan fontSize="14" fill="#565d6e">/7</tspan></text>
      <text x={cx} y={cy + 50} textAnchor="middle" fontSize="9" fill="#8a91a2" letterSpacing="1.5">{label.toUpperCase()}</text>
    </svg>
  );
}

export type SunNode = { name: string; value: number; color: string; children?: { name: string; value: number }[] };

export function Sunburst({ data, size = 260 }: { data: SunNode[]; size?: number }) {
  const [hover, setHover] = useState<{ name: string; value: number } | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2;
  let a = -Math.PI / 2;
  const inner: React.ReactNode[] = [], outer: React.ReactNode[] = [];
  data.forEach((d) => {
    const span = (d.value / total) * Math.PI * 2;
    const a0 = a;
    inner.push(
      <path key={d.name} d={arcPath(cx, cy, size * 0.2, size * 0.3, a0 + 0.006, a0 + span - 0.006)} fill={d.color} opacity={hover && hover.name !== d.name ? 0.55 : 0.95}
        onMouseEnter={() => setHover({ name: d.name, value: d.value / total })} onMouseLeave={() => setHover(null)} className="cursor-pointer transition-opacity" />
    );
    let b = a0;
    (d.children ?? []).forEach((c) => {
      const sp = (c.value / total) * Math.PI * 2;
      outer.push(
        <path key={d.name + c.name} d={arcPath(cx, cy, size * 0.31, size * 0.31 + Math.min(size * 0.17, 14 + (c.value / total) * size * 1.4), b + 0.004, b + sp - 0.004)} fill={d.color}
          opacity={hover?.name === c.name ? 1 : 0.42} onMouseEnter={() => setHover({ name: c.name, value: c.value / total })} onMouseLeave={() => setHover(null)} className="cursor-pointer transition-opacity" />
      );
      b += sp;
    });
    a += span;
  });
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={size * 0.19} fill="none" stroke="#1d212b" strokeDasharray="2 4" />
        {inner}
        {outer}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="eyebrow max-w-[90px] truncate">{hover ? hover.name : "Book"}</div>
        <div className="num text-lg">{hover ? pct(hover.value) : data.reduce((s, d) => s + (d.children?.length ?? 0), 0)}</div>
        {!hover && <div className="text-[10px] text-dim">positions</div>}
      </div>
    </div>
  );
}

export function Donut({ data, size = 150, thickness = 16, center }: { data: { name: string; value: number; color: string }[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const [h, setH] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  let a = -Math.PI / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {data.map((d, i) => {
          const span = (d.value / total) * Math.PI * 2;
          const p = arcPath(size / 2, size / 2, size / 2 - thickness - (h === i ? 2 : 0), size / 2 - (h === i ? 0 : 2), a + 0.01, a + span - 0.01);
          a += span;
          return <path key={d.name} d={p} fill={d.color} opacity={h === null || h === i ? 1 : 0.35} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} className="transition-all" />;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {h !== null ? (
          <>
            <div className="eyebrow">{data[h].name}</div>
            <div className="num text-base">{pct(data[h].value / total)}</div>
          </>
        ) : (
          center
        )}
      </div>
    </div>
  );
}

export function Radar({ data, size = 280 }: { data: { axis: string; p: number; b: number }[]; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 38;
  const n = data.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + (R * v) / 100 * Math.cos(a), cy + (R * v) / 100 * Math.sin(a)];
  };
  const poly = (k: "p" | "b") => data.map((d, i) => pt(i, d[k]).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: size }}>
      {[25, 50, 75, 100].map((l) => (
        <polygon key={l} points={data.map((_, i) => pt(i, l).join(",")).join(" ")} fill="none" stroke="#1d212b" />
      ))}
      {data.map((d, i) => {
        const [x, y] = pt(i, 100);
        const [lx, ly] = pt(i, 122);
        return (
          <g key={d.axis}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#1d212b" />
            <text x={lx} y={ly + 3} fontSize="10" fill="#8a91a2" textAnchor="middle">{d.axis}</text>
          </g>
        );
      })}
      <polygon points={poly("b")} fill="rgba(138,145,162,0.08)" stroke="#565d6e" strokeDasharray="3 3" />
      <polygon points={poly("p")} fill="rgba(212,255,58,0.14)" stroke="#d4ff3a" strokeWidth="1.5" style={{ filter: "drop-shadow(0 0 8px rgba(212,255,58,.35))" }} />
      {data.map((d, i) => {
        const [x, y] = pt(i, d.p);
        return <circle key={i} cx={x} cy={y} r="3" fill="#d4ff3a" />;
      })}
    </svg>
  );
}

export function StackBar({ data, h = 10 }: { data: { name: string; value: number; color: string }[]; h?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height: h }}>
      {data.map((d) => (
        <div key={d.name} title={`${d.name} ${pct(d.value / total)}`} style={{ width: `${(d.value / total) * 100}%`, background: d.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
      ))}
    </div>
  );
}

/** Horizontal bars with optional benchmark tick */
export function CompareBars({ rows, max }: { rows: { label: string; value: number; bench?: number; color?: string }[]; max?: number }) {
  const m = max ?? Math.max(...rows.map((r) => Math.max(r.value, r.bench ?? 0)));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[110px_1fr_52px] items-center gap-3 text-xs">
          <div className="truncate text-muted">{r.label}</div>
          <div className="relative h-2.5 rounded-full bg-line/60">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.value / m) * 100}%`, background: r.color ?? "#8f7cff" }} />
            {r.bench !== undefined && <div className="absolute -inset-y-1 w-[2px] rounded bg-fg/80" style={{ left: `${(r.bench / m) * 100}%` }} title={`Benchmark ${pct(r.bench)}`} />}
          </div>
          <div className="num text-right">{pct(r.value)}</div>
        </div>
      ))}
    </div>
  );
}

/** Diverging bars (active weight vs benchmark) */
export function DivergingBars({ rows }: { rows: { label: string; value: number }[] }) {
  const m = Math.max(...rows.map((r) => Math.abs(r.value)), 0.01);
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[110px_1fr_56px] items-center gap-3 text-xs">
          <div className="truncate text-muted">{r.label}</div>
          <div className="relative h-3">
            <div className="absolute inset-y-0 left-1/2 w-px bg-line2" />
            <div className="absolute inset-y-0.5 rounded-sm" style={{ [r.value >= 0 ? "left" : "right"]: "50%", width: `${(Math.abs(r.value) / m) * 50}%`, background: r.value >= 0 ? "#2fe39b" : "#ff5a78" }} />
          </div>
          <div className={`num text-right ${r.value >= 0 ? "text-pos" : "text-neg"}`}>{pct(r.value, 1, true)}</div>
        </div>
      ))}
    </div>
  );
}

export function Histogram({ bins }: { bins: { x: number; p: number; b: number }[] }) {
  const w = 520, h = 180, pad = 22;
  const max = Math.max(...bins.map((b) => Math.max(b.p, b.b)));
  const bw = (w - pad * 2) / bins.length;
  const [hv, setHv] = useState<number | null>(null);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {bins.map((b, i) => {
        const x = pad + i * bw;
        const ph = (b.p / max) * (h - 40), bh = (b.b / max) * (h - 40);
        return (
          <g key={i} onMouseEnter={() => setHv(i)} onMouseLeave={() => setHv(null)}>
            <rect x={x} y={0} width={bw} height={h} fill="transparent" />
            <rect x={x + 1} y={h - 20 - ph} width={bw - 2} height={ph} rx="1.5" fill={b.x < 0 ? "#ff5a78" : "#2fe39b"} opacity={hv === i ? 1 : 0.75} />
            <rect x={x + bw / 2 - 1} y={h - 20 - bh} width="2" height="2" fill="#e8ebf1" opacity="0.8" />
          </g>
        );
      })}
      <polyline fill="none" stroke="#e8ebf1" strokeOpacity="0.5" strokeDasharray="2 3" points={bins.map((b, i) => `${pad + i * bw + bw / 2},${h - 20 - (b.b / max) * (h - 40)}`).join(" ")} />
      {[-0.04, -0.02, 0, 0.02, 0.04].map((t) => (
        <text key={t} x={pad + ((t + 0.04) / 0.08) * (w - pad * 2)} y={h - 5} fontSize="9" fill="#565d6e" textAnchor="middle" className="num">{pct(t, 0)}</text>
      ))}
      {hv !== null && (
        <text x={w - pad} y={14} textAnchor="end" fontSize="10" fill="#e8ebf1" className="num">
          {pct(bins[hv].x, 2)} to {pct(bins[hv].x + 0.0025, 2)}: {bins[hv].p} days (bench {bins[hv].b})
        </text>
      )}
    </svg>
  );
}

export function Lorenz({ points, gini }: { points: number[]; gini: number }) {
  const s = 200, p = 24;
  const n = points.length - 1;
  const d = points.map((y, i) => `${i ? "L" : "M"}${p + (i / n) * (s - 2 * p)},${s - p - y * (s - 2 * p)}`).join("");
  return (
    <svg viewBox={`0 0 ${s} ${s}`} className="w-full max-w-[220px]">
      <rect x={p} y={p} width={s - 2 * p} height={s - 2 * p} fill="none" stroke="#1d212b" />
      <line x1={p} y1={s - p} x2={s - p} y2={p} stroke="#565d6e" strokeDasharray="3 3" />
      <path d={`${d}L${s - p},${s - p}Z`} fill="rgba(143,124,255,0.15)" />
      <path d={d} fill="none" stroke="#8f7cff" strokeWidth="2" />
      <text x={p + 6} y={p + 14} fontSize="10" fill="#8a91a2">Gini {gini.toFixed(2)}</text>
      <text x={s / 2} y={s - 6} fontSize="8" fill="#565d6e" textAnchor="middle">positions (smallest → largest)</text>
    </svg>
  );
}

export function MoneyBars({ data, h = 140 }: { data: { label: string; value: number; sub?: string }[]; h?: number }) {
  const { fmt } = useMoney();
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const [hv, setHv] = useState<number | null>(null);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: h }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHv(i)} onMouseLeave={() => setHv(null)}>
            <div className="rounded-t-[3px] transition-all" style={{ height: `${(Math.abs(d.value) / max) * 100}%`, background: d.value >= 0 ? (hv === i ? "#d4ff3a" : "linear-gradient(180deg,#8f7cff,#8f7cff55)") : "#ff5a78" }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[8.5px] text-dim">{d.sub ?? ""}</div>
        ))}
      </div>
      <div className="mt-2 h-4 text-xs text-muted">{hv !== null ? <span><span className="text-fg">{data[hv].label}</span> · <span className="num">{fmt(data[hv].value)}</span></span> : "Hover a bar"}</div>
    </div>
  );
}
