"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMoney } from "@/components/money";
import { pct, shortDate, longDate, MONTHS, BUCKET_COLORS } from "@/lib/format";
import { heat } from "./basic";

/* ============================== TimeChart ============================== */

export type TSeries = { key: string; label: string; values: (number | null)[]; color: string; kind?: "area" | "line" | "dashed" };
const RANGES = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "ALL"] as const;
type Range = (typeof RANGES)[number];

function rangeStart(dates: string[], r: Range) {
  if (r === "ALL") return 0;
  const end = new Date(dates[dates.length - 1] + "T00:00:00Z");
  let target: string;
  if (r === "YTD") target = `${end.getUTCFullYear() - 1}-12-31`;
  else {
    const m = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36 }[r];
    end.setUTCMonth(end.getUTCMonth() - m);
    target = end.toISOString().slice(0, 10);
  }
  const i = dates.findIndex((d) => d > target);
  return Math.max(0, i - 1);
}

function niceTicks(min: number, max: number, n = 4) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export function TimeChart({
  dates, series, format = "money", height = 280, rebase = false, defaultRange = "1Y", markers = [], showRanges = true, zero = false, extraControls,
}: {
  dates: string[]; series: TSeries[]; format?: "money" | "pct" | "num"; height?: number; rebase?: boolean; defaultRange?: Range;
  markers?: { date: string; label: string; color: string }[]; showRanges?: boolean; zero?: boolean; extraControls?: React.ReactNode;
}) {
  const { fmt } = useMoney();
  const [range, setRange] = useState<Range>(defaultRange);
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const [cw, setCw] = useState(1000);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setCw(Math.max(320, Math.round(e[0].contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = cw, H = height, padL = 8, padR = 64, padT = 14, padB = 24;

  const { s0, view } = useMemo(() => {
    const s0 = rangeStart(dates, range);
    const view = series.map((s) => {
      const vals = s.values.slice(s0);
      if (!rebase) return { ...s, vals };
      const base = vals.find((v) => v !== null) ?? 1;
      return { ...s, vals: vals.map((v) => (v === null ? null : v / (base as number) - 1)) };
    });
    return { s0, view };
  }, [dates, series, range, rebase]);
  const d = dates.slice(s0);
  const n = d.length;
  const all = view.flatMap((s) => s.vals.filter((v): v is number => v !== null));
  let min = Math.min(...all, zero ? 0 : Infinity), max = Math.max(...all, zero ? 0 : -Infinity);
  const padV = (max - min) * 0.08 || 1;
  min -= padV; max += padV;
  const x = (i: number) => padL + (i / Math.max(n - 1, 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const f = (v: number) => (format === "money" ? fmt(v, { compact: true }) : format === "pct" ? pct(v, 1, true) : v.toFixed(2));
  const ticks = niceTicks(min, max);
  const xticks = Array.from({ length: 6 }, (_, k) => Math.round((k / 5) * (n - 1)));

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const hi = hover ?? n - 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {view.map((s) => {
            const v = s.vals[hi];
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-xs text-muted">{s.label}</span>
                <span className="num text-sm">{v === null || v === undefined ? "—" : f(v)}</span>
              </div>
            );
          })}
          <span className="num text-xs text-dim">{d[hi] ? longDate(d[hi]) : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          {extraControls}
          {showRanges && (
            <div className="flex rounded-full border border-line bg-ink/40 p-0.5">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`num rounded-full px-2.5 py-1 text-[11px] transition ${r === range ? "bg-fg text-ink" : "text-muted hover:text-fg"}`}>
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair select-none" style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {view.map((s) => (
            <linearGradient key={s.key} id={`tc-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#1d212b" strokeDasharray={t === 0 && zero ? "" : "2 4"} />
            <text x={W - padR + 8} y={y(t) + 3.5} fontSize="11" fill="#565d6e" className="num">{f(t)}</text>
          </g>
        ))}
        {xticks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize="11" fill="#565d6e" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="num">
            {d[i] ? (range === "ALL" || range === "3Y" ? longDate(d[i]) : shortDate(d[i])) : ""}
          </text>
        ))}
        {view.map((s) => {
          let path = "";
          let started = false;
          s.vals.forEach((v, i) => {
            if (v === null) return;
            path += (started ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1);
            started = true;
          });
          const firstI = s.vals.findIndex((v) => v !== null);
          return (
            <g key={s.key}>
              {s.kind === "area" && path && <path d={`${path}L${x(n - 1)},${H - padB}L${x(firstI)},${H - padB}Z`} fill={`url(#tc-${s.key})`} />}
              <path d={path} fill="none" stroke={s.color} strokeWidth={s.kind === "area" ? 2 : 1.4} strokeDasharray={s.kind === "dashed" ? "5 5" : undefined} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </g>
          );
        })}
        {markers.map((m, k) => {
          const i = d.indexOf(m.date);
          if (i < 0) return null;
          const v = view[0].vals[i];
          if (v === null) return null;
          return (
            <g key={k}>
              <circle cx={x(i)} cy={y(v)} r="5" fill="#07080b" stroke={m.color} strokeWidth="2" />
              <title>{m.label}</title>
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#d4ff3a" strokeOpacity="0.8" />
            {view.map((s) => {
              const v = s.vals[hover];
              return v === null ? null : <circle key={s.key} cx={x(hover)} cy={y(v)} r="4" fill={s.color} stroke="#07080b" strokeWidth="2" />;
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

/* ============================== Treemap ============================== */

type TItem = { id: string; value: number; color: string; label: string; sub: string; href?: string };
type Rect = { x: number; y: number; w: number; h: number };

function squarify(items: TItem[], rect: Rect): (TItem & Rect)[] {
  const total = items.reduce((s, i) => s + i.value, 0);
  const scaled = items.map((i) => ({ ...i, area: (i.value / total) * rect.w * rect.h }));
  const out: (TItem & Rect)[] = [];
  const worst = (row: { area: number }[], w: number) => {
    const s = row.reduce((a, r) => a + r.area, 0);
    const mx = Math.max(...row.map((r) => r.area)), mn = Math.min(...row.map((r) => r.area));
    return Math.max((w * w * mx) / (s * s), (s * s) / (w * w * mn));
  };
  const layoutRow = (row: typeof scaled, r: Rect): Rect => {
    const s = row.reduce((a, x) => a + x.area, 0);
    if (r.w >= r.h) {
      const cw = s / r.h;
      let yy = r.y;
      row.forEach((it) => { const hh = it.area / cw; out.push({ ...it, x: r.x, y: yy, w: cw, h: hh }); yy += hh; });
      return { x: r.x + cw, y: r.y, w: r.w - cw, h: r.h };
    }
    const rh = s / r.w;
    let xx = r.x;
    row.forEach((it) => { const ww = it.area / rh; out.push({ ...it, x: xx, y: r.y, w: ww, h: rh }); xx += ww; });
    return { x: r.x, y: r.y + rh, w: r.w, h: r.h - rh };
  };
  let r = { ...rect };
  let row: typeof scaled = [];
  const rem = [...scaled];
  while (rem.length) {
    const short = Math.min(r.w, r.h);
    const c = rem[0];
    if (!row.length || worst([...row, c], short) <= worst(row, short)) { row.push(c); rem.shift(); }
    else { r = layoutRow(row, r); row = []; }
  }
  if (row.length) layoutRow(row, r);
  return out;
}

export function Treemap({ items, height = 420 }: { items: TItem[]; height?: number }) {
  const rects = useMemo(() => squarify([...items].sort((a, b) => b.value - a.value), { x: 0, y: 0, w: 100, h: 100 }), [items]);
  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height }}>
      {rects.map((r) => {
        const big = r.w * r.h > 60;
        const inner = (
          <div className="absolute inset-[1.5px] flex flex-col justify-between overflow-hidden rounded-[6px] p-2 transition hover:brightness-125 hover:ring-1 hover:ring-fg/40" style={{ background: r.color }}>
            <div className={`font-semibold leading-none text-white ${big ? "text-sm" : "text-[10px]"}`}>{r.label}</div>
            {r.w * r.h > 25 && <div className={`num text-white/85 ${big ? "text-xs" : "text-[9px]"}`}>{r.sub}</div>}
          </div>
        );
        return (
          <div key={r.id} className="absolute" style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}>
            {r.href ? <Link href={r.href}>{inner}</Link> : inner}
          </div>
        );
      })}
    </div>
  );
}

/* ============================== Bubble ============================== */

export function BubbleChart({ data, height = 360 }: { data: { symbol: string; x: number; y: number; w: number; bucket: string }[]; height?: number }) {
  const [hv, setHv] = useState<string | null>(null);
  const W = 700, H = height, p = 44;
  const xs = data.map((d) => d.x), ys = data.map((d) => d.y);
  const x0 = 0, x1 = Math.max(...xs) * 1.1;
  const y0 = Math.min(0, Math.min(...ys)) - 0.08, y1 = Math.max(...ys) * 1.12;
  const X = (v: number) => p + ((v - x0) / (x1 - x0)) * (W - p * 1.5);
  const Y = (v: number) => H - p + -((v - y0) / (y1 - y0)) * (H - p * 1.6);
  const maxW = Math.max(...data.map((d) => d.w));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {niceTicks(y0, y1, 5).map((t) => (
        <g key={t}>
          <line x1={p} x2={W - p / 2} y1={Y(t)} y2={Y(t)} stroke="#1d212b" strokeDasharray={t === 0 ? "" : "2 4"} />
          <text x={p - 6} y={Y(t) + 3} fontSize="10" fill="#565d6e" textAnchor="end" className="num">{pct(t, 0)}</text>
        </g>
      ))}
      {niceTicks(x0, x1, 6).map((t) => (
        <text key={t} x={X(t)} y={H - p + 16} fontSize="10" fill="#565d6e" textAnchor="middle" className="num">{pct(t, 0)}</text>
      ))}
      <text x={W / 2} y={H - 6} fontSize="10" fill="#8a91a2" textAnchor="middle" letterSpacing="1">VOLATILITY (1Y, ANNUALISED) →</text>
      <text x={12} y={H / 2} fontSize="10" fill="#8a91a2" textAnchor="middle" letterSpacing="1" transform={`rotate(-90 12 ${H / 2})`}>RETURN (1Y) →</text>
      <line x1={X(0)} y1={Y(0)} x2={X(x1)} y2={Y(x1 * 1.0)} stroke="#d4ff3a" strokeOpacity="0.25" strokeDasharray="4 4" />
      <text x={X(x1) - 4} y={Y(x1) + 14} fontSize="9" fill="#d4ff3a" fillOpacity="0.5" textAnchor="end">return = risk</text>
      {[...data].sort((a, b) => b.w - a.w).map((d) => {
        const r = 5 + Math.sqrt(d.w / maxW) * 26;
        const c = BUCKET_COLORS[d.bucket];
        return (
          <g key={d.symbol} onMouseEnter={() => setHv(d.symbol)} onMouseLeave={() => setHv(null)} className="cursor-pointer">
            <circle cx={X(d.x)} cy={Y(d.y)} r={r} fill={c} fillOpacity={hv && hv !== d.symbol ? 0.12 : 0.35} stroke={c} strokeWidth={hv === d.symbol ? 2 : 1} />
            {(r > 13 || hv === d.symbol) && <text x={X(d.x)} y={Y(d.y) + 3} fontSize="9.5" fill="#e8ebf1" textAnchor="middle" fontWeight="600">{d.symbol}</text>}
            {hv === d.symbol && (
              <text x={X(d.x)} y={Y(d.y) - r - 6} fontSize="10" fill="#e8ebf1" textAnchor="middle" className="num">
                ret {pct(d.y, 1, true)} · vol {pct(d.x)} · wt {pct(d.w)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ============================== World tile map ============================== */

const TILES: Record<string, [number, number]> = {
  CA: [2, 1], US: [2, 2], MX: [2, 3], BR: [4, 5],
  SE: [9, 0], DK: [8, 0], GB: [7, 1], NL: [8, 1], DE: [9, 1], FR: [8, 2], CH: [9, 2], ES: [7, 3], IT: [9, 3],
  SA: [10, 4], AE: [11, 4], ZA: [9, 6],
  IN: [12, 4], TH: [13, 4], MY: [13, 5], SG: [14, 5], ID: [14, 6],
  CN: [13, 2], HK: [14, 3], TW: [15, 3], KR: [15, 2], JP: [16, 2], AU: [16, 6],
};

export function TileMap({ countries, names }: { countries: { code: string; weight: number; bench: number }[]; names: Record<string, string> }) {
  const [hv, setHv] = useState<string | null>(null);
  const m = new Map(countries.map((c) => [c.code, c]));
  const max = Math.max(...countries.filter((c) => TILES[c.code]).map((c) => c.weight));
  const cell = 40, gap = 4;
  const hc = hv ? m.get(hv) : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${17 * (cell + gap) + 8} ${7 * (cell + gap) + 8}`} className="w-full">
        {Array.from({ length: 17 * 7 }).map((_, k) => {
          const cx = k % 17, cy = Math.floor(k / 17);
          return <circle key={k} cx={4 + cx * (cell + gap) + cell / 2} cy={4 + cy * (cell + gap) + cell / 2} r="1.2" fill="#1d212b" />;
        })}
        {Object.entries(TILES).map(([code, [cx, cy]]) => {
          const c = m.get(code);
          const w = c?.weight ?? 0;
          const t = w / max;
          const fill = w > 0 ? `rgba(212,255,58,${0.1 + Math.pow(t, 0.55) * 0.85})` : "#12151c";
          return (
            <g key={code} onMouseEnter={() => setHv(code)} onMouseLeave={() => setHv(null)} className="cursor-pointer">
              <rect x={4 + cx * (cell + gap)} y={4 + cy * (cell + gap)} width={cell} height={cell} rx="8" fill={fill} stroke={hv === code ? "#e8ebf1" : "#1d212b"} />
              <text x={4 + cx * (cell + gap) + cell / 2} y={4 + cy * (cell + gap) + 17} fontSize="10" fontWeight="600" textAnchor="middle" fill={t > 0.45 ? "#07080b" : "#e8ebf1"}>{code}</text>
              <text x={4 + cx * (cell + gap) + cell / 2} y={4 + cy * (cell + gap) + 30} fontSize="8.5" textAnchor="middle" fill={t > 0.45 ? "#07080b" : "#8a91a2"} className="num">{w ? pct(w, w < 0.01 ? 1 : 0) : "—"}</text>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-1 left-2 rounded-lg border border-line bg-ink/80 px-3 py-2 text-xs backdrop-blur">
        {hc ? (
          <>
            <div className="font-medium">{names[hc.code] ?? hc.code}</div>
            <div className="num text-muted">You {pct(hc.weight, 1)} · World {pct(hc.bench, 1)} · <span className={hc.weight - hc.bench >= 0 ? "text-pos" : "text-neg"}>{pct(hc.weight - hc.bench, 1, true)}</span></div>
          </>
        ) : (
          <div className="text-muted">Look-through country exposure · hover a tile</div>
        )}
      </div>
    </div>
  );
}

/* ============================== Matrix (correlation / overlap) ============================== */

export function Matrix({ labels, matrix, mode = "corr" }: { labels: string[]; matrix: number[][]; mode?: "corr" | "overlap" }) {
  const [hv, setHv] = useState<[number, number] | null>(null);
  const n = labels.length;
  const color = (v: number, i: number, j: number) => {
    if (i === j) return "#1d212b";
    if (mode === "overlap") return `rgba(212,255,58,${0.06 + Math.min(1, v / 0.4) * 0.8})`;
    return v >= 0 ? `rgba(143,124,255,${0.08 + v * 0.85})` : `rgba(63,208,255,${0.08 + -v * 0.85})`;
  };
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `52px repeat(${n}, minmax(0,1fr))` }}>
        <div />
        {labels.map((l, j) => (
          <div key={l} className={`truncate pb-1 text-center text-[9px] ${hv && (hv[1] === j) ? "text-fg" : "text-dim"}`}>{l}</div>
        ))}
        {matrix.map((row, i) => (
          <div key={i} className="contents">
            <div className={`truncate pr-1 text-right text-[10px] leading-6 ${hv && hv[0] === i ? "text-fg" : "text-dim"}`}>{labels[i]}</div>
            {row.map((v, j) => (
              <div key={j} onMouseEnter={() => setHv([i, j])} onMouseLeave={() => setHv(null)} className="num flex aspect-square items-center justify-center rounded-[4px] text-[9px] text-fg/80 transition hover:ring-1 hover:ring-fg/60" style={{ background: color(v, i, j) }}>
                {n <= 8 && i !== j ? (mode === "overlap" ? pct(v, 0) : v.toFixed(2)) : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 h-4 text-xs text-muted">
        {hv ? (
          <span>
            <span className="text-fg">{labels[hv[0]]}</span> × <span className="text-fg">{labels[hv[1]]}</span> ·{" "}
            <span className="num">{mode === "overlap" ? `${pct(matrix[hv[0]][hv[1]])} holdings overlap` : `ρ = ${matrix[hv[0]][hv[1]].toFixed(2)}`}</span>
          </span>
        ) : mode === "corr" ? "Daily return correlation, trailing 1Y · violet = move together, cyan = diversify" : "Share of fund weight held in common (top holdings)"}
      </div>
    </div>
  );
}

/* ============================== Monthly heatmap ============================== */

export function MonthlyHeatmap({ monthly, yearly }: { monthly: { year: number; month: number; ret: number; bench: number }[]; yearly: { year: number; ret: number; bench: number }[] }) {
  const [mode, setMode] = useState<"abs" | "rel">("abs");
  const years = yearly.map((y) => y.year).reverse();
  const get = (y: number, m: number) => monthly.find((x) => x.year === y && x.month === m);
  const val = (x: { ret: number; bench: number }) => (mode === "abs" ? x.ret : x.ret - x.bench);
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-full border border-line p-0.5 text-[11px]">
          {(["abs", "rel"] as const).map((k) => (
            <button key={k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1 ${mode === k ? "bg-fg text-ink" : "text-muted"}`}>{k === "abs" ? "Absolute" : "vs Benchmark"}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "44px repeat(12, minmax(0,1fr)) 64px" }}>
        <div />
        {MONTHS.map((m) => <div key={m} className="pb-1 text-center text-[10px] text-dim">{m}</div>)}
        <div className="pb-1 text-center text-[10px] text-dim">Year</div>
        {years.map((y) => {
          const yr = yearly.find((x) => x.year === y)!;
          return (
            <div key={y} className="contents">
              <div className="num pr-1 text-right text-[11px] leading-8 text-muted">{y}</div>
              {MONTHS.map((_, k) => {
                const c = get(y, k + 1);
                return (
                  <div key={k} className="num flex h-8 items-center justify-center rounded-[5px] text-[10.5px]" style={{ background: c ? heat(val(c), 0.07) : "#0f1116" }} title={c ? `${MONTHS[k]} ${y}: ${pct(c.ret, 2)} (bench ${pct(c.bench, 2)})` : ""}>
                    {c ? pct(val(c), 1) : ""}
                  </div>
                );
              })}
              <div className="num flex h-8 items-center justify-center rounded-[5px] border border-line2 text-[11px] font-semibold" style={{ background: heat(val(yr), 0.3, 0.6) }}>{pct(val(yr), 1, true)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== Money diverging bars (attribution) ============================== */

export function MoneyDiverging({ rows, limit = 14 }: { rows: { label: string; value: number; href?: string }[]; limit?: number }) {
  const { fmt } = useMoney();
  const shown = rows.length > limit ? [...rows.slice(0, Math.ceil(limit / 2)), ...rows.slice(-Math.floor(limit / 2))] : rows;
  const m = Math.max(...shown.map((r) => Math.abs(r.value)), 1);
  return (
    <div className="space-y-1.5">
      {shown.map((r) => (
        <div key={r.label} className="grid grid-cols-[64px_1fr_78px] items-center gap-3 text-xs">
          {r.href ? <Link href={r.href} className="truncate font-medium hover:text-accent">{r.label}</Link> : <span className="truncate text-muted">{r.label}</span>}
          <div className="relative h-3.5">
            <div className="absolute inset-y-0 left-1/3 w-px bg-line2" />
            <div className="absolute inset-y-0.5 rounded-sm" style={r.value >= 0 ? { left: "33.33%", width: `${(r.value / m) * 66.6}%`, background: "linear-gradient(90deg,#2fe39b88,#2fe39b)" } : { right: "66.67%", width: `${(-r.value / m) * 33.3}%`, background: "linear-gradient(270deg,#ff5a7888,#ff5a78)" }} />
          </div>
          <span className={`num text-right ${r.value >= 0 ? "text-pos" : "text-neg"}`}>{fmt(r.value, { compact: true, sign: true })}</span>
        </div>
      ))}
    </div>
  );
}
