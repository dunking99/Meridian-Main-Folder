import type { ReactNode } from "react";
import { fmtMoney, fmtPct, hexA } from "@/lib/format";
import { countryName } from "@/lib/reference";
import { COUNTRY_CENTROIDS, DOT_CODES, DOT_LAT_TOP, DOT_ROWS, DOT_STEP } from "@/lib/world-dots";

const UP = "#3ee0a1";
const DOWN = "#ff6b6b";
const GOLD = "#f5bd62";
const SKY = "#7cc4ff";
const GRID = "rgba(255,255,255,0.06)";
const AXIS = "#6b7384";

export function niceTicks(min: number, max: number, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo, hi, ticks };
}
function hid(...parts: (string | number)[]) {
  let h = 5381;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "g" + (h >>> 0).toString(36);
}
const pctTick = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(Math.abs(v) < 0.1 && v !== 0 ? 1 : 0)}%`;

// ————————————————————————————————— sparkline
export function Sparkline({ values, width = 96, height = 28, color, fill = true, className = "" }: { values: number[]; width?: number; height?: number; color?: string; fill?: boolean; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)]);
  const c = color ?? (values[values.length - 1] >= values[0] ? UP : DOWN);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  const id = hid(c, values.length, values[0], values[values.length - 1], width);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.28" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${line}L${width} ${height}L0 ${height}Z`} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={c} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={1.8} fill={c} />
    </svg>
  );
}

// ————————————————————————————————— arcs
const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
function ringPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r1, a0), [x1, y1] = polar(cx, cy, r1, a1), [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}
function arcStroke(cx: number, cy: number, r: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

type Seg = { label: string; value: number; color: string; title?: string };
export function Donut({ outer, inner, size = 200, thickness = 14, children }: { outer: Seg[]; inner?: Seg[]; size?: number; thickness?: number; children?: ReactNode }) {
  const cx = size / 2, cy = size / 2;
  const R = size / 2 - 3;
  const ring = (segs: Seg[], r1: number, r0: number, gap: number) => {
    const tot = segs.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
    let a = 0;
    return segs.filter((s) => s.value > 0).map((s, i) => {
      const span = (s.value / tot) * Math.PI * 2;
      const a0 = a + gap / 2, a1 = a + Math.max(span - gap / 2, gap / 2 + 0.001);
      a += span;
      return (
        <path key={i} d={ringPath(cx, cy, r0, r1, a0, a1)} fill={s.color} className="transition-opacity duration-200 hover:opacity-80">
          <title>{s.title ?? s.label}</title>
        </path>
      );
    });
  };
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={R + 1.5} fill="none" stroke="rgba(255,255,255,0.05)" />
        {ring(outer, R, R - thickness, 0.018)}
        {inner && ring(inner, R - thickness - 5, R - thickness - 5 - thickness * 0.55, 0.03)}
        <circle cx={cx} cy={cy} r={R - thickness * 1.9 - 10} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="1 3" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

// ————————————————————————————————— gauge (270° instrument dial)
export function Gauge({ value, size = 184, children }: { value: number; size?: number; children?: ReactNode }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 16;
  const a0 = (-135 * Math.PI) / 180, a1 = (135 * Math.PI) / 180;
  const v = Math.max(0, Math.min(100, value));
  const av = a0 + ((a1 - a0) * v) / 100;
  const id = hid("gauge", size, v);
  const ticks = Array.from({ length: 51 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / 50;
    const major = i % 5 === 0;
    const [x0, y0] = polar(cx, cy, r + 7, a), [x1, y1] = polar(cx, cy, r + (major ? 13 : 10), a);
    return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={i / 50 <= v / 100 ? "rgba(245,189,98,0.75)" : "rgba(255,255,255,0.14)"} strokeWidth={major ? 1.3 : 0.8} />;
  });
  const [mx, my] = polar(cx, cy, r, av);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.86 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={DOWN} />
            <stop offset="0.5" stopColor={GOLD} />
            <stop offset="1" stopColor={UP} />
          </linearGradient>
        </defs>
        {ticks}
        <path d={arcStroke(cx, cy, r, a0, a1)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} strokeLinecap="round" />
        <path d={arcStroke(cx, cy, r, a0, av)} fill="none" stroke={`url(#${id})`} strokeWidth={8} strokeLinecap="round" pathLength={1} className="draw" />
        <circle cx={mx} cy={my} r={6.5} fill="#0b0e14" stroke="#fff" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={r - 20} fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
      </svg>
      <div className="absolute inset-x-0 top-0 grid place-items-center text-center" style={{ height: size }}>{children}</div>
    </div>
  );
}

// ————————————————————————————————— SRRI signal bars
export function SignalBars({ level, max = 7 }: { level: number; max?: number }) {
  const colors = ["#3ee0a1", "#7ee08a", "#b8dc6e", "#f5d062", "#f5a85a", "#ff8a5c", "#ff6b6b"];
  return (
    <div className="flex items-end gap-1.5">
      {Array.from({ length: max }, (_, i) => {
        const on = i + 1 <= level;
        const active = i + 1 === level;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={`w-6 rounded-[4px] transition-all ${active ? "ring-2 ring-white/70" : ""}`}
              style={{ height: 12 + i * 7, background: on ? colors[i] : "rgba(255,255,255,0.06)", boxShadow: active ? `0 0 18px ${colors[i]}` : undefined, opacity: on ? (active ? 1 : 0.55) : 1 }}
            />
            <span className={`num text-[10px] ${active ? "text-mist-100" : "text-mist-500"}`}>{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

// ————————————————————————————————— radar
export function Radar({ axes, size = 280 }: { axes: { label: string; p: number; b: number }[]; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 42, n = axes.length;
  const pt = (i: number, v: number) => polar(cx, cy, R * v, (Math.PI * 2 * i) / n);
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-[300px]">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={poly(axes.map(() => k))} fill={k === 1 ? "rgba(255,255,255,0.015)" : "none"} stroke={GRID} strokeDasharray={k === 1 ? undefined : "2 3"} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.2);
        const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={a.label}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} />
            <text x={lx} y={ly + 3} textAnchor={anchor} fontSize={9.5} fill="#9ba3b2" fontFamily="var(--font-mono)" letterSpacing="0.06em">
              {a.label.toUpperCase()}
            </text>
          </g>
        );
      })}
      <polygon points={poly(axes.map((a) => a.b))} fill="rgba(124,196,255,0.06)" stroke={SKY} strokeWidth={1.2} strokeDasharray="4 3" />
      <polygon points={poly(axes.map((a) => a.p))} fill="rgba(245,189,98,0.16)" stroke={GOLD} strokeWidth={1.8} strokeLinejoin="round" className="fadein" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, a.p);
        return <circle key={i} cx={x} cy={y} r={2.6} fill={GOLD}><title>{`${a.label}: portfolio ${(a.p * 100).toFixed(0)} · ACWI ${(a.b * 100).toFixed(0)}`}</title></circle>;
      })}
    </svg>
  );
}

// ————————————————————————————————— bars
export function BarList({ items, max }: { items: { key: string; label: ReactNode; value: number; display: ReactNode; color?: string; marker?: number; sub?: ReactNode }[]; max?: number }) {
  const m = max ?? Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.key} className="group">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate text-mist-200">{i.label}</span>
            <span className="num shrink-0 text-mist-100">{i.display}</span>
          </div>
          <div className="relative mt-1.5 h-1.5 rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full transition-all group-hover:brightness-125" style={{ width: `${Math.min(100, (Math.abs(i.value) / m) * 100)}%`, background: i.color ?? GOLD, boxShadow: `0 0 10px -3px ${i.color ?? GOLD}` }} />
            {i.marker !== undefined && <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-mist-100" style={{ left: `${Math.min(100, (i.marker / m) * 100)}%` }} />}
          </div>
          {i.sub && <div className="mt-1 text-[11px] text-mist-500">{i.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function DivergingBars({ items, max, labelClass = "w-24" }: { items: { key: string; label: ReactNode; value: number; display: ReactNode }[]; max?: number; labelClass?: string }) {
  const m = max ?? Math.max(1e-9, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="space-y-1.5">
      {items.map((i) => {
        const w = Math.min(50, (Math.abs(i.value) / m) * 50);
        return (
          <div key={i.key} className="group flex items-center gap-3 text-[12px]">
            <div className={`${labelClass} shrink-0 truncate text-mist-200`}>{i.label}</div>
            <div className="relative h-5 flex-1">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
              <div
                className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm transition-all group-hover:brightness-125"
                style={i.value >= 0 ? { left: "50%", width: `${w}%`, background: `linear-gradient(90deg, ${hexA(UP, 0.35)}, ${UP})` } : { right: "50%", width: `${w}%`, background: `linear-gradient(270deg, ${hexA(DOWN, 0.35)}, ${DOWN})` }}
              />
            </div>
            <div className={`num w-16 shrink-0 text-right ${i.value >= 0 ? "text-up" : "text-down"}`}>{i.display}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CompareBars({ items, aLabel = "Portfolio", bLabel = "Benchmark", aColor = GOLD, bColor = SKY }: { items: { key: string; label: ReactNode; a: number; b: number }[]; aLabel?: string; bLabel?: string; aColor?: string; bColor?: string }) {
  const m = Math.max(1e-9, ...items.flatMap((i) => [Math.abs(i.a), Math.abs(i.b)]));
  return (
    <div>
      <div className="mb-3 flex gap-4 text-[11px] text-mist-400">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm" style={{ background: aColor }} />{aLabel}</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm" style={{ background: bColor, opacity: 0.7 }} />{bLabel}</span>
      </div>
      <div className="space-y-2.5">
        {items.map((i) => {
          const d = i.a - i.b;
          return (
            <div key={i.key} className="grid grid-cols-[7.5rem_1fr_3.2rem_3.2rem] items-center gap-3 text-[12px]">
              <div className="truncate text-mist-200">{i.label}</div>
              <div className="space-y-1">
                <div className="h-2 rounded-sm" style={{ width: `${(Math.abs(i.a) / m) * 100}%`, background: aColor, boxShadow: `0 0 10px -3px ${aColor}` }} />
                <div className="h-1 rounded-sm opacity-70" style={{ width: `${(Math.abs(i.b) / m) * 100}%`, background: bColor }} />
              </div>
              <div className="num text-right text-mist-100">{(i.a * 100).toFixed(1)}%</div>
              <div className={`num text-right text-[11px] ${d > 0.005 ? "text-gold-300" : d < -0.005 ? "text-sky" : "text-mist-500"}`}>{d >= 0 ? "+" : "−"}{Math.abs(d * 100).toFixed(1)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StackBar({ segments, height = 10 }: { segments: { key: string; label: string; value: number; color: string }[]; height?: number }) {
  const tot = segments.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height }}>
      {segments.filter((s) => s.value > 0).map((s) => (
        <div key={s.key} title={`${s.label} · ${((s.value / tot) * 100).toFixed(1)}%`} className="h-full transition-all hover:brightness-125" style={{ width: `${(s.value / tot) * 100}%`, background: s.color }} />
      ))}
    </div>
  );
}

// ————————————————————————————————— columns
export function Columns({ groups, series, width = 560, height = 220, fmt = "pct", ccy = "USD", labels = true }: { groups: { label: string; values: (number | null)[] }[]; series: { label: string; color: string }[]; width?: number; height?: number; fmt?: "pct" | "money"; ccy?: string; labels?: boolean }) {
  const all = groups.flatMap((g) => g.values.filter((v): v is number => v !== null));
  const { lo, hi, ticks } = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
  const pl = 44, pr = 8, pt = 16, pb = 26;
  const iw = width - pl - pr, ih = height - pt - pb;
  const y = (v: number) => pt + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const gw = iw / groups.length;
  const bw = Math.min(26, (gw * 0.7) / series.length);
  const f = (v: number) => (fmt === "pct" ? pctTick(v) : fmtMoney(v, ccy, { compact: true }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={width - pr} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,0.22)" : GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
          <text x={pl - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS} fontFamily="var(--font-mono)">{f(t)}</text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const x0 = pl + gi * gw + (gw - bw * series.length - (series.length - 1) * 3) / 2;
        return (
          <g key={g.label}>
            {g.values.map((v, si) => {
              if (v === null) return null;
              const x = x0 + si * (bw + 3);
              const y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v));
              const c = series[si].color;
              return (
                <g key={si}>
                  <rect x={x} y={y0} width={bw} height={Math.max(1, y1 - y0)} rx={2} fill={c} opacity={si === 0 ? 1 : 0.55}>
                    <title>{`${g.label} · ${series[si].label}: ${fmt === "pct" ? fmtPct(v) : fmtMoney(v, ccy)}`}</title>
                  </rect>
                  {labels && si === 0 && (
                    <text x={x + bw / 2} y={v >= 0 ? y0 - 4 : y1 + 10} textAnchor="middle" fontSize={9} fill={v >= 0 ? UP : DOWN} fontFamily="var(--font-mono)">
                      {fmt === "pct" ? `${(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}` : fmtMoney(v, ccy, { compact: true })}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={pl + gi * gw + gw / 2} y={height - 8} textAnchor="middle" fontSize={10} fill="#9ba3b2" fontFamily="var(--font-mono)">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function StackedColumns({ items, width = 640, height = 200, ccy }: { items: { label: string; parts: { value: number; color: string; name?: string }[]; hatched?: boolean; tick?: boolean }[]; width?: number; height?: number; ccy: string }) {
  const tot = items.map((i) => i.parts.reduce((a, p) => a + Math.max(0, p.value), 0));
  const { hi, ticks } = niceTicks(0, Math.max(1, ...tot), 3);
  const pl = 48, pr = 6, pt = 10, pb = 24;
  const iw = width - pl - pr, ih = height - pt - pb;
  const y = (v: number) => pt + ih - (v / hi) * ih;
  const gw = iw / items.length, bw = Math.max(3, gw * 0.62);
  const pid = hid("hatch", width, items.length);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      <defs>
        <pattern id={pid} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="rgba(255,255,255,0.02)" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.6" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={width - pr} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,0.18)" : GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
          <text x={pl - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS} fontFamily="var(--font-mono)" className="money">{fmtMoney(t, ccy, { compact: true })}</text>
        </g>
      ))}
      {items.map((it, i) => {
        let acc = 0;
        const x = pl + i * gw + (gw - bw) / 2;
        return (
          <g key={it.label + i}>
            {it.parts.map((p, j) => {
              if (p.value <= 0) return null;
              const y0 = y(acc + p.value), h = y(acc) - y0;
              acc += p.value;
              return (
                <g key={j}>
                  <rect x={x} y={y0} width={bw} height={Math.max(0.5, h)} rx={1.5} fill={p.color} opacity={it.hatched ? 0.35 : 0.95}>
                    <title>{`${it.label}${p.name ? " · " + p.name : ""}: ${fmtMoney(p.value, ccy)}`}</title>
                  </rect>
                  {it.hatched && <rect x={x} y={y0} width={bw} height={Math.max(0.5, h)} fill={`url(#${pid})`} pointerEvents="none" />}
                </g>
              );
            })}
            {(it.tick ?? true) && <text x={x + bw / 2} y={height - 7} textAnchor="middle" fontSize={9} fill={it.hatched ? "#6b7384" : "#9ba3b2"} fontFamily="var(--font-mono)">{it.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ————————————————————————————————— waterfall
export function Waterfall({ steps, ccy, width = 640, height = 240 }: { steps: { label: string; value: number; kind: "total" | "delta" }[]; ccy: string; width?: number; height?: number }) {
  let run = 0;
  const bars = steps.map((s) => {
    if (s.kind === "total") { run = s.value; return { ...s, y0: 0, y1: s.value }; }
    const y0 = run; run += s.value;
    return { ...s, y0, y1: run };
  });
  const vals = bars.flatMap((b) => [b.y0, b.y1]);
  const { lo, hi, ticks } = niceTicks(Math.min(0, ...vals), Math.max(...vals), 4);
  const pl = 52, pr = 8, pt = 20, pb = 28;
  const iw = width - pl - pr, ih = height - pt - pb;
  const y = (v: number) => pt + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const gw = iw / bars.length, bw = gw * 0.56;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={width - pr} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray="2 4" />
          <text x={pl - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS} fontFamily="var(--font-mono)" className="money">{fmtMoney(t, ccy, { compact: true })}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = pl + i * gw + (gw - bw) / 2;
        const top = y(Math.max(b.y0, b.y1)), bot = y(Math.min(b.y0, b.y1));
        const c = b.kind === "total" ? "#c4cad5" : b.value >= 0 ? UP : DOWN;
        const next = bars[i + 1];
        return (
          <g key={b.label}>
            <rect x={x} y={top} width={bw} height={Math.max(1, bot - top)} rx={2} fill={c} opacity={b.kind === "total" ? 0.9 : 0.85}>
              <title>{`${b.label}: ${fmtMoney(b.value, ccy)}`}</title>
            </rect>
            {next && <line x1={x + bw} x2={x + gw} y1={y(b.y1)} y2={y(b.y1)} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 2" />}
            <text x={x + bw / 2} y={top - 5} textAnchor="middle" fontSize={9.5} fill={b.kind === "total" ? "#e7eaef" : c} fontFamily="var(--font-mono)" className="money">
              {b.kind === "delta" && b.value > 0 ? "+" : ""}{fmtMoney(b.value, ccy, { compact: true })}
            </text>
            <text x={x + bw / 2} y={height - 9} textAnchor="middle" fontSize={10} fill="#9ba3b2" fontFamily="var(--font-mono)">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ————————————————————————————————— histogram
export function Histogram({ bins, width = 560, height = 190, markers = [] }: { bins: { x0: number; x1: number; n: number }[]; width?: number; height?: number; markers?: { x: number; label: string; color?: string }[] }) {
  if (!bins.length) return null;
  const pl = 10, pr = 10, pt = 18, pb = 24;
  const iw = width - pl - pr, ih = height - pt - pb;
  const maxN = Math.max(...bins.map((b) => b.n));
  const lo = bins[0].x0, hi = bins[bins.length - 1].x1;
  const x = (v: number) => pl + ((v - lo) / (hi - lo)) * iw;
  const bw = iw / bins.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {bins.map((b, i) => {
        const h = (b.n / maxN) * ih;
        const mid = (b.x0 + b.x1) / 2;
        return (
          <g key={i}>
            <rect x={pl + i * bw + 1} y={pt + ih - h} width={bw - 2} height={h} rx={1.5} fill={mid >= 0 ? UP : DOWN} opacity={0.35 + 0.6 * (b.n / maxN)}>
              <title>{`${fmtPct(b.x0)} to ${fmtPct(b.x1)}: ${b.n} months`}</title>
            </rect>
            {b.n > 0 && <text x={pl + i * bw + bw / 2} y={pt + ih - h - 4} textAnchor="middle" fontSize={8.5} fill="#7d8595" fontFamily="var(--font-mono)">{b.n}</text>}
          </g>
        );
      })}
      <line x1={x(0)} x2={x(0)} y1={pt - 6} y2={pt + ih} stroke="rgba(255,255,255,0.3)" />
      {markers.map((m) => (
        <g key={m.label}>
          <line x1={x(m.x)} x2={x(m.x)} y1={pt - 8} y2={pt + ih} stroke={m.color ?? GOLD} strokeDasharray="3 3" />
          <text x={x(m.x) + 4} y={pt - 1} fontSize={9} fill={m.color ?? GOLD} fontFamily="var(--font-mono)">{m.label}</text>
        </g>
      ))}
      {bins.filter((_, i) => i % Math.ceil(bins.length / 8) === 0).map((b) => (
        <text key={b.x0} x={x(b.x0)} y={height - 7} textAnchor="middle" fontSize={9.5} fill={AXIS} fontFamily="var(--font-mono)">{pctTick(b.x0)}</text>
      ))}
    </svg>
  );
}

// ————————————————————————————————— bubbles & scatter
export function Bubble({ points, refs = [], width = 680, height = 380, xLabel, yLabel }: { points: { key: string; x: number; y: number; r: number; color: string; label: string; href?: string; title?: string }[]; refs?: { key: string; x: number; y: number; label: string; color: string }[]; width?: number; height?: number; xLabel: string; yLabel: string }) {
  const xs = [...points.map((p) => p.x), ...refs.map((r) => r.x)];
  const ys = [...points.map((p) => p.y), ...refs.map((r) => r.y)];
  const X = niceTicks(0, Math.max(...xs) * 1.05, 5), Y = niceTicks(Math.min(0, ...ys), Math.max(...ys) * 1.08, 5);
  const pl = 50, pr = 16, pt = 16, pb = 38;
  const iw = width - pl - pr, ih = height - pt - pb;
  const x = (v: number) => pl + ((v - X.lo) / (X.hi - X.lo)) * iw;
  const y = (v: number) => pt + ih - ((v - Y.lo) / (Y.hi - Y.lo)) * ih;
  const maxR = Math.max(...points.map((p) => p.r));
  const rad = (r: number) => 4 + Math.sqrt(r / maxR) * 24;
  const port = refs[0];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {Y.ticks.map((t) => (
        <g key={"y" + t}>
          <line x1={pl} x2={width - pr} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,0.25)" : GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
          <text x={pl - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS} fontFamily="var(--font-mono)">{pctTick(t)}</text>
        </g>
      ))}
      {X.ticks.map((t) => (
        <g key={"x" + t}>
          <line x1={x(t)} x2={x(t)} y1={pt} y2={pt + ih} stroke={GRID} strokeDasharray="2 4" />
          <text x={x(t)} y={pt + ih + 14} textAnchor="middle" fontSize={10} fill={AXIS} fontFamily="var(--font-mono)">{(t * 100).toFixed(0)}%</text>
        </g>
      ))}
      <text x={pl + iw / 2} y={height - 4} textAnchor="middle" fontSize={10} fill="#9ba3b2" fontFamily="var(--font-mono)" letterSpacing="0.1em">{xLabel.toUpperCase()}</text>
      <text x={12} y={pt + ih / 2} textAnchor="middle" fontSize={10} fill="#9ba3b2" fontFamily="var(--font-mono)" letterSpacing="0.1em" transform={`rotate(-90 12 ${pt + ih / 2})`}>{yLabel.toUpperCase()}</text>
      {port && (
        <g opacity={0.5}>
          <line x1={x(port.x)} x2={x(port.x)} y1={pt} y2={pt + ih} stroke={GOLD} strokeDasharray="3 4" />
          <line x1={pl} x2={width - pr} y1={y(port.y)} y2={y(port.y)} stroke={GOLD} strokeDasharray="3 4" />
        </g>
      )}
      {[...points].sort((a, b) => b.r - a.r).map((p) => {
        const r = rad(p.r);
        const body = (
          <g className="cursor-pointer transition-opacity hover:opacity-100" opacity={0.92}>
            <circle cx={x(p.x)} cy={y(p.y)} r={r} fill={hexA(p.color, 0.22)} stroke={p.color} strokeWidth={1.2} />
            {r > 9 && <text x={x(p.x)} y={y(p.y) + 3} textAnchor="middle" fontSize={Math.min(10, r * 0.6)} fill="#fff" fontFamily="var(--font-mono)" fontWeight={600}>{p.label}</text>}
            {r <= 9 && <text x={x(p.x) + r + 3} y={y(p.y) + 3} fontSize={9} fill="#c4cad5" fontFamily="var(--font-mono)">{p.label}</text>}
            <title>{p.title ?? p.label}</title>
          </g>
        );
        return p.href ? <a key={p.key} href={p.href}>{body}</a> : <g key={p.key}>{body}</g>;
      })}
      {refs.map((r) => (
        <g key={r.key}>
          <rect x={x(r.x) - 6} y={y(r.y) - 6} width={12} height={12} transform={`rotate(45 ${x(r.x)} ${y(r.y)})`} fill={r.color} stroke="#05070a" strokeWidth={2} />
          <text x={x(r.x) + 11} y={y(r.y) - 8} fontSize={10} fill={r.color} fontFamily="var(--font-mono)" fontWeight={600}>{r.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function Scatter({ points, beta, alpha, width = 420, height = 300 }: { points: [number, number][]; beta: number; alpha: number; width?: number; height?: number }) {
  const all = points.flat();
  const m = Math.max(0.02, ...all.map(Math.abs)) * 1.1;
  const T = niceTicks(-m, m, 4);
  const pl = 42, pr = 10, pt = 10, pb = 30;
  const iw = width - pl - pr, ih = height - pt - pb;
  const x = (v: number) => pl + ((v - T.lo) / (T.hi - T.lo)) * iw;
  const y = (v: number) => pt + ih - ((v - T.lo) / (T.hi - T.lo)) * ih;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {T.ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={width - pr} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,0.22)" : GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
          <line x1={x(t)} x2={x(t)} y1={pt} y2={pt + ih} stroke={t === 0 ? "rgba(255,255,255,0.22)" : GRID} strokeDasharray={t === 0 ? undefined : "2 4"} />
          <text x={pl - 6} y={y(t) + 3} textAnchor="end" fontSize={9.5} fill={AXIS} fontFamily="var(--font-mono)">{pctTick(t)}</text>
          <text x={x(t)} y={pt + ih + 13} textAnchor="middle" fontSize={9.5} fill={AXIS} fontFamily="var(--font-mono)">{pctTick(t)}</text>
        </g>
      ))}
      <line x1={x(T.lo)} y1={y(T.lo)} x2={x(T.hi)} y2={y(T.hi)} stroke="rgba(255,255,255,0.12)" strokeDasharray="1 3" />
      {points.map(([a, b], i) => (
        <circle key={i} cx={x(a)} cy={y(b)} r={3} fill={b >= a ? hexA(UP, 0.7) : hexA(DOWN, 0.7)} />
      ))}
      <line x1={x(T.lo)} y1={y(alpha + beta * T.lo)} x2={x(T.hi)} y2={y(alpha + beta * T.hi)} stroke={GOLD} strokeWidth={1.8} />
      <text x={width - pr - 4} y={pt + 12} textAnchor="end" fontSize={10} fill={GOLD} fontFamily="var(--font-mono)">β {beta.toFixed(2)} · α {(alpha * 100).toFixed(2)}%/mo</text>
      <text x={pl + iw / 2} y={height - 3} textAnchor="middle" fontSize={9.5} fill="#9ba3b2" fontFamily="var(--font-mono)">BENCHMARK MONTH</text>
    </svg>
  );
}

// ————————————————————————————————— projection fan
export function Fan({ bands, startYear, ccy, width = 680, height = 280 }: { bands: { p10: number; p25: number; p50: number; p75: number; p90: number }[]; startYear: number; ccy: string; width?: number; height?: number }) {
  const { hi, ticks } = niceTicks(0, Math.max(...bands.map((b) => b.p90)), 4);
  const pl = 58, pr = 90, pt = 14, pb = 26;
  const iw = width - pl - pr, ih = height - pt - pb;
  const x = (i: number) => pl + (i / (bands.length - 1)) * iw;
  const y = (v: number) => pt + ih - (v / hi) * ih;
  const area = (a: keyof (typeof bands)[number], b: keyof (typeof bands)[number]) =>
    bands.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[a]).toFixed(1)}`).join("") + [...bands].reverse().map((d, i) => `L${x(bands.length - 1 - i).toFixed(1)} ${y(d[b]).toFixed(1)}`).join("") + "Z";
  const med = bands.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.p50).toFixed(1)}`).join("");
  const last = bands[bands.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={pl + iw} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray="2 4" />
          <text x={pl - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS} fontFamily="var(--font-mono)" className="money">{fmtMoney(t, ccy, { compact: true })}</text>
        </g>
      ))}
      {bands.map((_, i) => i % 5 === 0 && (
        <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={10} fill={AXIS} fontFamily="var(--font-mono)">{startYear + i}</text>
      ))}
      <path d={area("p90", "p10")} fill="rgba(245,189,98,0.08)" />
      <path d={area("p75", "p25")} fill="rgba(245,189,98,0.16)" />
      <path d={med} fill="none" stroke={GOLD} strokeWidth={2} pathLength={1} className="draw" />
      {(["p90", "p50", "p10"] as const).map((k) => (
        <g key={k}>
          <circle cx={x(bands.length - 1)} cy={y(last[k])} r={2.5} fill={k === "p50" ? GOLD : "#9ba3b2"} />
          <text x={x(bands.length - 1) + 8} y={y(last[k]) + 3} fontSize={10} fill={k === "p50" ? GOLD : "#9ba3b2"} fontFamily="var(--font-mono)" className="money">
            {k === "p90" ? "P90 " : k === "p50" ? "P50 " : "P10 "}{fmtMoney(last[k], ccy, { compact: true })}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ————————————————————————————————— style box, lorenz, matrix
export function StyleBox({ cells, bench }: { cells: Record<string, number>; bench?: Record<string, number> }) {
  const rows: [string, string][] = [["L", "Large"], ["M", "Mid"], ["S", "Small"]];
  const cols: [string, string][] = [["V", "Value"], ["B", "Blend"], ["G", "Growth"]];
  const max = Math.max(0.0001, ...Object.values(cells));
  return (
    <div className="inline-grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1.5 text-[11px]">
      <div />
      {cols.map(([, l]) => <div key={l} className="label pb-1 text-center">{l}</div>)}
      {rows.map(([r, rl]) => (
        <div key={r} className="contents">
          <div className="label flex items-center pr-2">{rl}</div>
          {cols.map(([c]) => {
            const v = cells[r + c] ?? 0;
            const b = bench?.[r + c] ?? 0;
            return (
              <div key={c} className="relative grid aspect-square min-w-16 place-items-center rounded-lg ring-1 ring-inset ring-white/[0.06]" style={{ background: `rgba(245,189,98,${(0.04 + 0.7 * Math.pow(v / max, 0.8)).toFixed(3)})` }}>
                <span className="num text-[15px] font-medium text-white">{Math.round(v * 100)}%</span>
                {bench && <span className="num absolute bottom-1 right-1.5 text-[9px] text-sky/80">{Math.round(b * 100)}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Lorenz({ points, width = 260, height = 200 }: { points: { x: number; y: number }[]; width?: number; height?: number }) {
  const p = 24;
  const x = (v: number) => p + v * (width - p * 1.5);
  const y = (v: number) => height - p - v * (height - p * 1.6);
  const d = points.map((q, i) => `${i ? "L" : "M"}${x(q.x).toFixed(1)} ${y(q.y).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
      <path d={`M${x(0)} ${y(0)}L${x(1)} ${y(1)}`} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
      <path d={`${d}L${x(1)} ${y(0)}Z`} fill="rgba(245,189,98,0.08)" />
      <path d={d} fill="none" stroke={GOLD} strokeWidth={1.8} />
      {[5, 10].map((k) => points[k] && (
        <g key={k}>
          <circle cx={x(points[k].x)} cy={y(points[k].y)} r={3} fill={GOLD} />
          <text x={x(points[k].x) + 6} y={y(points[k].y) + 12} fontSize={9.5} fill="#c4cad5" fontFamily="var(--font-mono)">Top {k}: {(points[k].y * 100).toFixed(0)}%</text>
        </g>
      ))}
      <text x={x(0.5)} y={height - 4} textAnchor="middle" fontSize={9} fill={AXIS} fontFamily="var(--font-mono)">HOLDINGS, LARGEST FIRST →</text>
    </svg>
  );
}

function corrColor(v: number) {
  if (v >= 0.999) return "rgba(255,255,255,0.08)";
  if (v < 0) return `rgba(124,196,255,${(0.15 + Math.min(1, -v * 2) * 0.55).toFixed(3)})`;
  if (v < 0.5) return `rgba(245,189,98,${(0.05 + v * 0.7).toFixed(3)})`;
  const t = (v - 0.5) / 0.5;
  return `rgba(${Math.round(245 + 10 * t)},${Math.round(189 - 80 * t)},${Math.round(98 + 9 * t)},${(0.4 + t * 0.5).toFixed(3)})`;
}
export function Matrix({ labels, values, kind = "corr" }: { labels: string[]; values: number[][]; kind?: "corr" | "overlap" }) {
  const n = labels.length;
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `3.4rem repeat(${n}, minmax(2.1rem, 1fr))` }}>
        <div />
        {labels.map((l) => <div key={"h" + l} className="num truncate pb-1 text-center text-[9.5px] text-mist-400">{l}</div>)}
        {values.map((row, i) => (
          <div key={labels[i]} className="contents">
            <div className="num flex items-center truncate pr-1 text-[9.5px] text-mist-400">{labels[i]}</div>
            {row.map((v, j) => (
              <div
                key={j}
                title={`${labels[i]} × ${labels[j]}: ${kind === "corr" ? v.toFixed(2) : v.toFixed(1) + "%"}`}
                className="num grid aspect-square place-items-center rounded-[4px] text-[9.5px] text-white/90 transition-transform hover:z-10 hover:scale-125 hover:ring-1 hover:ring-white/60"
                style={{ background: kind === "corr" ? corrColor(v) : i === j ? "rgba(255,255,255,0.06)" : `rgba(245,189,98,${(0.05 + Math.min(1, v / 60) * 0.75).toFixed(3)})` }}
              >
                {i === j ? "—" : kind === "corr" ? v.toFixed(2).replace("0.", ".") : Math.round(v)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ————————————————————————————————— dot-matrix world map
export function WorldDots({ weights, labels = 7 }: { weights: Record<string, number>; labels?: number }) {
  const cell = 6;
  const cols = DOT_ROWS[0].length, rows = DOT_ROWS.length;
  const W = cols * cell, H = rows * cell;
  const max = Math.max(1e-9, ...Object.values(weights));
  let base = "";
  const byC: Record<string, string> = {};
  DOT_ROWS.forEach((row, r) => {
    for (let c = 0; c < cols; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      const px = c * cell + cell / 2, py = r * cell + cell / 2;
      const iso = DOT_CODES[ch];
      if (iso && (weights[iso] ?? 0) > 0) byC[iso] = (byC[iso] ?? "") + `M${px} ${py}h0`;
      else base += `M${px} ${py}h0`;
    }
  });
  const proj = (lon: number, lat: number) => [((lon + 180) / DOT_STEP) * cell, ((DOT_LAT_TOP - lat) / DOT_STEP) * cell];
  const top = Object.entries(weights).filter(([k]) => COUNTRY_CENTROIDS[k]).sort((a, b) => b[1] - a[1]).slice(0, labels);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      <path d={base} stroke="#232a37" strokeWidth={3.1} strokeLinecap="round" />
      {Object.entries(byC).map(([iso, d]) => {
        const t = Math.pow((weights[iso] ?? 0) / max, 0.45);
        return (
          <path key={iso} d={d} stroke={`rgba(245,189,98,${(0.28 + 0.72 * t).toFixed(3)})`} strokeWidth={3.4} strokeLinecap="round">
            <title>{`${countryName(iso)} · ${((weights[iso] ?? 0) * 100).toFixed(1)}%`}</title>
          </path>
        );
      })}
      {top.map(([iso, w], i) => {
        const [lon, lat] = COUNTRY_CENTROIDS[iso];
        const [x, y] = proj(lon, lat);
        const r = 3 + Math.sqrt(w / max) * 16;
        const left = x > W * 0.78;
        return (
          <g key={iso}>
            <circle cx={x} cy={y} r={r} fill="rgba(245,189,98,0.12)" stroke="rgba(245,189,98,0.7)" strokeWidth={1}>
              <animate attributeName="r" values={`${r};${r + 5};${r}`} dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.35;1" dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={x} cy={y} r={2.2} fill="#ffe2b0" />
            <g transform={`translate(${left ? x - r - 6 : x + r + 6} ${y + 4})`}>
              <text textAnchor={left ? "end" : "start"} fontSize={12} fill="#e7eaef" fontFamily="var(--font-mono)" fontWeight={600} stroke="#05070a" strokeWidth={3} paintOrder="stroke">
                {iso} {(w * 100).toFixed(w < 0.1 ? 1 : 0)}%
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
