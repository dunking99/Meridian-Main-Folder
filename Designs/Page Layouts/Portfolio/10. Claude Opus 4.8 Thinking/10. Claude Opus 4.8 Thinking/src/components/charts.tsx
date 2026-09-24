"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fmtCompact, fmtDate, fmtSignedPct } from "@/lib/format";
import { useCurrency } from "@/components/currency";

function useMeasure() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function linePath(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

// ---------------- Sparkline ----------------
export function Sparkline({
  data,
  color = "#34e0c4",
  width = 120,
  height = 34,
  fill = true,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - 3 - ((v - min) / rng) * (height - 6),
  }));
  const id = `spk-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && (
        <path d={`${linePath(pts)} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      )}
      <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------------- Area/Value chart ----------------
type SeriesPt = { date: string; value: number; bench: number };
export function ValueChart({
  series,
  height = 260,
  showBench = true,
  color = "#34e0c4",
}: {
  series: SeriesPt[];
  height?: number;
  showBench?: boolean;
  color?: string;
}) {
  const [ref, w] = useMeasure();
  const { rate } = useCurrency();
  const [hover, setHover] = useState<number | null>(null);
  const width = w || 800;
  const padL = 8,
    padR = 8,
    padT = 14,
    padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const pv = series.map((s) => s.value);
  const base = pv[0] || 1;
  const benchScaled = series.map((s) => (base * s.bench) / (series[0].bench || 1));
  const all = showBench ? [...pv, ...benchScaled] : pv;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const rng = max - min || 1;
  const x = (i: number) => padL + (i / (series.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - ((v - min) / rng) * plotH;

  const pvPts = pv.map((v, i) => ({ x: x(i), y: y(v) }));
  const bPts = benchScaled.map((v, i) => ({ x: x(i), y: y(v) }));
  const grid = 4;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const i = Math.round(((mx - padL) / plotW) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  const hi = hover ?? series.length - 1;
  const cur = series[hi];
  const pRet = ((cur.value - base) / base) * 100;
  const bRet = ((cur.bench - series[0].bench) / series[0].bench) * 100;

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="pvfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {Array.from({ length: grid + 1 }).map((_, g) => {
          const val = min + (rng * g) / grid;
          const yy = y(val);
          return (
            <g key={g}>
              <line x1={padL} y1={yy} x2={width - padR} y2={yy} stroke="#161d29" strokeWidth={1} />
              <text x={padL + 2} y={yy - 3} fontSize={9} fill="#4b5769" className="tabnum">
                {rate.symbol}
                {fmtCompact(val * rate.perUsd)}
              </text>
            </g>
          );
        })}
        {showBench && (
          <path d={linePath(bPts)} fill="none" stroke="#4b5769" strokeWidth={1.3} strokeDasharray="3 3" />
        )}
        <path d={`${linePath(pvPts)} L${x(series.length - 1)},${padT + plotH} L${padL},${padT + plotH} Z`} fill="url(#pvfill)" />
        <path d={linePath(pvPts)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {/* x labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const i = Math.round(f * (series.length - 1));
          return (
            <text key={f} x={x(i)} y={height - 7} fontSize={9} fill="#4b5769" textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}>
              {fmtDate(series[i].date)}
            </text>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hi)} y1={padT} x2={x(hi)} y2={padT + plotH} stroke="#334155" strokeWidth={1} />
            <circle cx={x(hi)} cy={y(cur.value)} r={3.5} fill={color} stroke="#05070d" strokeWidth={1.5} />
            {showBench && <circle cx={x(hi)} cy={y(benchScaled[hi])} r={3} fill="#4b5769" />}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line2 bg-[#0c111b] px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(width - 150, Math.max(0, x(hi) + 8)) }}
        >
          <div className="mb-1 text-[10px] text-ink-faint">{fmtDate(cur.date)}</div>
          <div className="tabnum flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="font-semibold text-ink">
              {rate.symbol}
              {fmtCompact(cur.value * rate.perUsd, 2)}
            </span>
            <span className={pRet >= 0 ? "text-pos" : "text-neg"}>{fmtSignedPct(pRet)}</span>
          </div>
          {showBench && (
            <div className="tabnum mt-0.5 flex items-center gap-2 text-ink-dim">
              <span className="inline-block h-2 w-2 rounded-full bg-[#4b5769]" />
              <span>Benchmark</span>
              <span className={bRet >= 0 ? "text-pos" : "text-neg"}>{fmtSignedPct(bRet)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- Donut ----------------
type Seg = { label: string; value: number; weight: number; color: string };
export function Donut({
  segments,
  size = 180,
  thickness = 20,
  centerTitle = "Total",
}: {
  segments: Seg[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
}) {
  const { rate } = useCurrency();
  const [hi, setHi] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = s.value / total;
    const seg = { ...s, frac, dash: frac * circ, offset };
    offset += frac * circ;
    return seg;
  });
  const active = hi !== null ? segments[hi] : null;
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={hi === i ? thickness + 4 : thickness}
            strokeDasharray={`${a.dash} ${circ - a.dash}`}
            strokeDashoffset={-a.offset}
            opacity={hi === null || hi === i ? 1 : 0.35}
            onMouseEnter={() => setHi(i)}
            onMouseLeave={() => setHi(null)}
            style={{ transition: "opacity .15s, stroke-width .15s", cursor: "pointer" }}
          />
        ))}
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        <span className="text-[10px] uppercase tracking-wider text-ink-faint">{active ? active.label : centerTitle}</span>
        <span className="tabnum text-lg font-semibold text-ink">
          {active ? `${active.weight.toFixed(1)}%` : `${rate.symbol}${fmtCompact(total * rate.perUsd, 2)}`}
        </span>
        {active && (
          <span className="tabnum text-[11px] text-ink-dim">
            {rate.symbol}
            {fmtCompact(active.value * rate.perUsd, 2)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------- Treemap (squarified) ----------------
type TItem = { key: string; label: string; sub?: string; value: number; color: string; pct: number; href?: string; delta?: number };
function squarify(items: TItem[], x: number, y: number, w: number, h: number) {
  const out: (TItem & { x: number; y: number; w: number; h: number })[] = [];
  const total = items.reduce((s, i) => s + i.value, 0);
  let area = { x, y, w, h };
  let remaining = items.map((i) => ({ ...i, a: (i.value / total) * (w * h) }));
  const worst = (row: number[], len: number) => {
    const sum = row.reduce((s, r) => s + r, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((len * len * max) / (sum * sum), (sum * sum) / (len * len * min));
  };
  while (remaining.length) {
    const vertical = area.w >= area.h;
    const len = vertical ? area.h : area.w;
    const row: typeof remaining = [];
    const rowAreas: number[] = [];
    let i = 0;
    while (i < remaining.length) {
      const test = [...rowAreas, remaining[i].a];
      if (rowAreas.length === 0 || worst(test, len) <= worst(rowAreas, len)) {
        row.push(remaining[i]);
        rowAreas.push(remaining[i].a);
        i++;
      } else break;
    }
    const rowSum = rowAreas.reduce((s, r) => s + r, 0);
    const thick = rowSum / len;
    let pos = vertical ? area.y : area.x;
    row.forEach((item, idx) => {
      const frac = rowAreas[idx] / rowSum;
      if (vertical) {
        out.push({ ...item, x: area.x, y: pos, w: thick, h: len * frac });
        pos += len * frac;
      } else {
        out.push({ ...item, x: pos, y: area.y, w: len * frac, h: thick });
        pos += len * frac;
      }
    });
    if (vertical) area = { x: area.x + thick, y: area.y, w: area.w - thick, h: area.h };
    else area = { x: area.x, y: area.y + thick, w: area.w, h: area.h - thick };
    remaining = remaining.slice(row.length);
  }
  return out;
}
export function Treemap({ items, height = 320 }: { items: TItem[]; height?: number }) {
  const [ref, w] = useMeasure();
  const width = w || 700;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const cells = squarify(sorted, 0, 0, width, height);
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {cells.map((c) => {
        const big = c.w > 62 && c.h > 40;
        const mid = c.w > 42 && c.h > 26;
        const inner = (
          <div
            className="group absolute overflow-hidden rounded-[7px] p-2 transition"
            style={{
              left: c.x + 2,
              top: c.y + 2,
              width: Math.max(0, c.w - 4),
              height: Math.max(0, c.h - 4),
              background: `linear-gradient(150deg, ${c.color}30, ${c.color}12)`,
              border: `1px solid ${c.color}44`,
            }}
          >
            {mid && (
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold" style={{ color: c.color }}>
                    {c.key}
                  </span>
                  {big && c.delta !== undefined && (
                    <span className={`tabnum text-[10px] ${c.delta >= 0 ? "text-pos" : "text-neg"}`}>
                      {fmtSignedPct(c.delta)}
                    </span>
                  )}
                </div>
                {big && (
                  <div>
                    <div className="tabnum text-sm font-semibold text-ink">{c.pct.toFixed(1)}%</div>
                    <div className="truncate text-[10px] text-ink-dim">{c.sub}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
        return c.href ? (
          <Link key={c.key} href={c.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={c.key}>{inner}</div>
        );
      })}
    </div>
  );
}

// ---------------- Monthly heatmap ----------------
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
export function ReturnsHeatmap({ monthly }: { monthly: { year: number; month: number; ret: number }[] }) {
  const years = [...new Set(monthly.map((m) => m.year))].sort();
  const get = (y: number, m: number) => monthly.find((x) => x.year === y && x.month === m);
  const yearTotal = (y: number) => {
    const rows = monthly.filter((m) => m.year === y);
    return (rows.reduce((s, r) => s + Math.log(1 + r.ret / 100), 0) && (Math.exp(rows.reduce((s, r) => s + Math.log(1 + r.ret / 100), 0)) - 1) * 100) || 0;
  };
  const color = (v: number | undefined) => {
    if (v === undefined) return "#0d121b";
    const t = Math.max(-1, Math.min(1, v / 8));
    if (t >= 0) return `rgba(52, 211, 153, ${0.14 + t * 0.6})`;
    return `rgba(251, 113, 133, ${0.14 + Math.abs(t) * 0.6})`;
  };
  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="w-10" />
            {MONTHS.map((m, i) => (
              <th key={i} className="text-[10px] font-medium text-ink-faint">
                {m}
              </th>
            ))}
            <th className="pl-2 text-[10px] font-medium text-ink-faint">YR</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <td className="pr-1 text-[10px] font-medium text-ink-dim">{y}</td>
              {Array.from({ length: 12 }).map((_, m) => {
                const cell = get(y, m + 1);
                return (
                  <td key={m}>
                    <div
                      className="tabnum flex h-8 items-center justify-center rounded-[5px] text-[9px] font-medium text-ink"
                      style={{ background: color(cell?.ret) }}
                      title={cell ? `${y}-${String(m + 1).padStart(2, "0")}: ${fmtSignedPct(cell.ret)}` : ""}
                    >
                      {cell ? cell.ret.toFixed(1) : ""}
                    </div>
                  </td>
                );
              })}
              <td className="pl-2">
                <div className={`tabnum text-[11px] font-semibold ${yearTotal(y) >= 0 ? "text-pos" : "text-neg"}`}>
                  {fmtSignedPct(yearTotal(y))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Bubble (risk vs return) ----------------
type Bubble = { symbol: string; vol: number; ret: number; weight: number; accent: string; assetClass: string };
export function BubbleChart({ bubbles, height = 340 }: { bubbles: Bubble[]; height?: number }) {
  const [ref, w] = useMeasure();
  const [hi, setHi] = useState<string | null>(null);
  const width = w || 700;
  const padL = 40,
    padR = 16,
    padT = 16,
    padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxVol = Math.max(...bubbles.map((b) => b.vol)) * 1.1;
  const rets = bubbles.map((b) => b.ret);
  const minRet = Math.min(...rets, 0) * 1.1;
  const maxRet = Math.max(...rets) * 1.1;
  const rRng = maxRet - minRet || 1;
  const x = (v: number) => padL + (v / maxVol) * plotW;
  const y = (v: number) => padT + plotH - ((v - minRet) / rRng) * plotH;
  const rad = (wt: number) => 6 + Math.sqrt(wt) * 4.5;
  const zeroY = y(0);
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg width={width} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = f * maxVol;
          return (
            <g key={f}>
              <line x1={x(v)} y1={padT} x2={x(v)} y2={padT + plotH} stroke="#131a25" />
              <text x={x(v)} y={height - 12} fontSize={9} fill="#4b5769" textAnchor="middle" className="tabnum">
                {v.toFixed(0)}%
              </text>
            </g>
          );
        })}
        {[minRet, minRet + rRng * 0.5, maxRet].map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={y(v)} x2={width - padR} y2={y(v)} stroke="#131a25" />
            <text x={padL - 6} y={y(v) + 3} fontSize={9} fill="#4b5769" textAnchor="end" className="tabnum">
              {v.toFixed(0)}%
            </text>
          </g>
        ))}
        <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke="#2a3341" strokeDasharray="3 3" />
        {bubbles.map((b) => (
          <g key={b.symbol} onMouseEnter={() => setHi(b.symbol)} onMouseLeave={() => setHi(null)} style={{ cursor: "pointer" }}>
            <circle cx={x(b.vol)} cy={y(b.ret)} r={rad(b.weight)} fill={`${b.accent}30`} stroke={b.accent} strokeWidth={hi === b.symbol ? 2 : 1.2} />
            <text x={x(b.vol)} y={y(b.ret) + 3} fontSize={9} fill={b.accent} textAnchor="middle" className="font-bold">
              {b.symbol.length <= 4 ? b.symbol : ""}
            </text>
          </g>
        ))}
        <text x={padL} y={padT - 2} fontSize={9} fill="#4b5769">
          Return ▲
        </text>
        <text x={width - padR} y={height - 12} fontSize={9} fill="#4b5769" textAnchor="end">
          Volatility ▶
        </text>
      </svg>
      {hi && (() => {
        const b = bubbles.find((x) => x.symbol === hi)!;
        return (
          <div
            className="pointer-events-none absolute rounded-lg border border-line2 bg-[#0c111b] px-3 py-2 text-xs shadow-xl"
            style={{ left: Math.min(width - 140, x(b.vol) + 10), top: Math.max(0, y(b.ret) - 40) }}
          >
            <div className="font-semibold text-ink">{b.symbol}</div>
            <div className="tabnum text-ink-dim">Vol {b.vol.toFixed(1)}% · Ret {fmtSignedPct(b.ret)}</div>
            <div className="tabnum text-ink-faint">Weight {b.weight.toFixed(1)}%</div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------- Correlation matrix ----------------
export function CorrelationMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const [hi, setHi] = useState<[number, number] | null>(null);
  const color = (v: number) => {
    if (v >= 0) return `rgba(251, 113, 133, ${0.1 + v * 0.7})`; // high corr = warmer (more risk)
    return `rgba(52, 211, 153, ${0.1 + Math.abs(v) * 0.7})`;
  };
  return (
    <div className="overflow-x-auto px-5 pb-4">
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="w-9" />
            {labels.map((l) => (
              <th key={l} className="pb-1 text-[9px] font-medium text-ink-faint" style={{ height: 40 }}>
                <div className="rotate-[-55deg] whitespace-nowrap">{l}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={l}>
              <td className="pr-1 text-right text-[9px] font-medium text-ink-dim">{l}</td>
              {labels.map((_, j) => (
                <td key={j}>
                  <div
                    onMouseEnter={() => setHi([i, j])}
                    onMouseLeave={() => setHi(null)}
                    className="tabnum flex h-8 w-8 items-center justify-center rounded-[4px] text-[9px] font-medium"
                    style={{
                      background: i === j ? "#1b2432" : color(matrix[i][j]),
                      color: i === j ? "#4b5769" : "#e8edf5",
                      outline: hi && hi[0] === i && hi[1] === j ? "1px solid #64748b" : "none",
                    }}
                    title={`${labels[i]} · ${labels[j]}: ${matrix[i][j].toFixed(2)}`}
                  >
                    {matrix[i][j].toFixed(2)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Score gauge (radial arc) ----------------
export function Gauge({
  value,
  grade,
  label,
  color = "#34e0c4",
  size = 132,
}: {
  value: number;
  grade?: string;
  label?: string;
  color?: string;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circ;
  const val = Math.max(0, Math.min(100, value));
  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} style={{ transform: `rotate(${startAngle}deg)` }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#161d29" strokeWidth={stroke} strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${(val / 100) * arcLen} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray .6s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {grade && <span className="font-serif text-3xl leading-none" style={{ color }}>{grade}</span>}
        <span className="tabnum mt-0.5 text-sm font-semibold text-ink">{Math.round(val)}</span>
        {label && <span className="text-[9px] uppercase tracking-wider text-ink-faint">{label}</span>}
      </div>
    </div>
  );
}

// ---------------- Weight ribbon ----------------
export function WeightRibbon({ items }: { items: { label: string; weight: number; color: string }[] }) {
  const [hi, setHi] = useState<string | null>(null);
  const total = items.reduce((s, i) => s + i.weight, 0);
  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden rounded-lg">
        {items.map((it) => (
          <div
            key={it.label}
            onMouseEnter={() => setHi(it.label)}
            onMouseLeave={() => setHi(null)}
            className="relative h-full transition-all"
            style={{
              width: `${(it.weight / total) * 100}%`,
              background: it.color,
              opacity: hi === null || hi === it.label ? 1 : 0.4,
            }}
            title={`${it.label} · ${it.weight.toFixed(1)}%`}
          />
        ))}
      </div>
      {hi && (
        <div className="tabnum mt-2 text-xs text-ink-dim">
          <span className="font-semibold text-ink">{hi}</span> — {items.find((i) => i.label === hi)!.weight.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

// ---------------- Horizontal bars ----------------
export function HBars({ items, showValue = true }: { items: { label: string; weight: number; color: string; value?: number }[]; showValue?: boolean }) {
  const max = Math.max(...items.map((i) => i.weight), 1);
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-xs text-ink-dim">{it.label}</div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#141b26]">
            <div className="h-full rounded-full" style={{ width: `${(it.weight / max) * 100}%`, background: it.color }} />
          </div>
          {showValue && <div className="tabnum w-12 shrink-0 text-right text-xs font-medium text-ink">{it.weight.toFixed(1)}%</div>}
        </div>
      ))}
    </div>
  );
}

// ---------------- Percent chart (cumulative / drawdown) ----------------
type PctPt = { date: string; value: number };
export function PctChart({
  primary,
  secondary,
  height = 240,
  color = "#34e0c4",
  secondaryColor = "#4b5769",
  fillNegative = false,
}: {
  primary: PctPt[];
  secondary?: PctPt[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  fillNegative?: boolean;
}) {
  const [ref, w] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const width = w || 800;
  const padL = 34,
    padR = 10,
    padT = 12,
    padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const all = [...primary.map((p) => p.value), ...(secondary ? secondary.map((p) => p.value) : []), 0];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const rng = max - min || 1;
  const x = (i: number, n: number) => padL + (i / (n - 1)) * plotW;
  const y = (v: number) => padT + plotH - ((v - min) / rng) * plotH;
  const pPts = primary.map((p, i) => ({ x: x(i, primary.length), y: y(p.value) }));
  const sPts = secondary?.map((p, i) => ({ x: x(i, secondary.length), y: y(p.value) }));
  const zeroY = y(0);
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - padL) / plotW) * (primary.length - 1));
    setHover(Math.max(0, Math.min(primary.length - 1, i)));
  };
  const hi = hover;
  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`pct-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillNegative ? 0 : 0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={fillNegative ? 0.28 : 0} />
          </linearGradient>
        </defs>
        {[min, min + rng * 0.5, max].map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={y(v)} x2={width - padR} y2={y(v)} stroke="#131a25" />
            <text x={padL - 5} y={y(v) + 3} fontSize={9} fill="#4b5769" textAnchor="end" className="tabnum">
              {v.toFixed(0)}%
            </text>
          </g>
        ))}
        <line x1={padL} y1={zeroY} x2={width - padR} y2={zeroY} stroke="#2a3341" strokeDasharray="3 3" />
        <path
          d={
            fillNegative
              ? `${linePath(pPts)} L${pPts[pPts.length - 1].x},${zeroY} L${pPts[0].x},${zeroY} Z`
              : `${linePath(pPts)} L${pPts[pPts.length - 1].x},${zeroY} L${pPts[0].x},${zeroY} Z`
          }
          fill={`url(#pct-${color.replace("#", "")})`}
        />
        {sPts && <path d={linePath(sPts)} fill="none" stroke={secondaryColor} strokeWidth={1.3} strokeDasharray="3 3" />}
        <path d={linePath(pPts)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {[0, 0.5, 1].map((f) => {
          const i = Math.round(f * (primary.length - 1));
          return (
            <text key={f} x={x(i, primary.length)} y={height - 6} fontSize={9} fill="#4b5769" textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}>
              {fmtDate(primary[i].date)}
            </text>
          );
        })}
        {hi !== null && (
          <g>
            <line x1={pPts[hi].x} y1={padT} x2={pPts[hi].x} y2={padT + plotH} stroke="#334155" />
            <circle cx={pPts[hi].x} cy={pPts[hi].y} r={3.5} fill={color} stroke="#05070d" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {hi !== null && (
        <div className="pointer-events-none absolute top-1 rounded-lg border border-line2 bg-[#0c111b] px-2.5 py-1.5 text-xs shadow-xl" style={{ left: Math.min(width - 120, Math.max(0, pPts[hi].x + 8)) }}>
          <div className="text-[10px] text-ink-faint">{fmtDate(primary[hi].date)}</div>
          <div className={`tabnum font-semibold ${primary[hi].value >= 0 ? "text-pos" : "text-neg"}`}>{fmtSignedPct(primary[hi].value)}</div>
          {secondary && <div className="tabnum text-ink-dim">bench {fmtSignedPct(secondary[hi].value)}</div>}
        </div>
      )}
    </div>
  );
}

// ---------------- Histogram ----------------
export function Histogram({ bins }: { bins: { label: string; count: number; color: string }[] }) {
  const max = Math.max(...bins.map((b) => b.count), 1);
  return (
    <div className="flex items-end justify-between gap-1.5 px-1" style={{ height: 150 }}>
      {bins.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="tabnum text-[9px] text-ink-faint">{b.count || ""}</div>
          <div className="flex w-full items-end justify-center" style={{ height: 110 }}>
            <div className="w-full rounded-t-[3px] transition-all" style={{ height: `${(b.count / max) * 100}%`, background: b.color, minHeight: b.count ? 3 : 0 }} title={`${b.label}: ${b.count}`} />
          </div>
          <div className="text-[8px] text-ink-faint">{b.label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Diverging bars (returns distribution) ----------------
export function DivergingBars({ items }: { items: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const pos = it.value >= 0;
        return (
          <div key={it.label} className="flex items-center gap-2">
            <div className="w-10 shrink-0 text-right text-[11px] font-medium text-ink-dim">{it.label}</div>
            <div className="relative flex h-5 flex-1 items-center">
              <div className="absolute left-1/2 top-0 h-full w-px bg-[#232c39]" />
              <div className="flex w-1/2 justify-end pr-px">
                {!pos && <div className="h-2.5 rounded-l-sm" style={{ width: `${(Math.abs(it.value) / max) * 100}%`, background: it.color ?? "#fb7185" }} />}
              </div>
              <div className="flex w-1/2 pl-px">
                {pos && <div className="h-2.5 rounded-r-sm" style={{ width: `${(Math.abs(it.value) / max) * 100}%`, background: it.color ?? "#34d399" }} />}
              </div>
            </div>
            <div className={`tabnum w-14 shrink-0 text-right text-[11px] font-semibold ${pos ? "text-pos" : "text-neg"}`}>{fmtSignedPct(it.value)}</div>
          </div>
        );
      })}
    </div>
  );
}
