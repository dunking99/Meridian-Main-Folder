"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fmtDate, fmtMoney, fmtPct, fmtPrice } from "@/lib/format";
import { setCurrency } from "@/lib/actions";
import { CCY_META, CURRENCIES, type Ccy } from "@/lib/reference";

// ————————————————————————————————— segmented control
export function Seg({ options, value, onChange, className = "" }: { options: string[]; value: number; onChange: (i: number) => void; className?: string }) {
  return (
    <div className={`inline-flex rounded-lg bg-white/[0.035] p-0.5 ring-1 ring-inset ring-white/[0.07] ${className}`}>
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(i)}
          className={`num whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] tracking-wide transition-all ${i === value ? "bg-gold-400/15 text-gold-200 shadow-[0_0_12px_-4px_rgba(245,189,98,.6)] ring-1 ring-inset ring-gold-400/30" : "text-mist-400 hover:text-mist-100"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/** Card whose body swaps between server-rendered variants. */
export function SwitchCard({ title, index, labels, children, subtitle, className = "", defaultIndex = 0, id }: { title: ReactNode; index?: string; labels: string[]; children: ReactNode[]; subtitle?: ReactNode; className?: string; defaultIndex?: number; id?: string }) {
  const [i, setI] = useState(defaultIndex);
  return (
    <section id={id} className={`card rise flex min-w-0 flex-col ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {index && <span className="num text-[10px] text-gold-400/80">{index}</span>}
            {index && <span className="h-px w-3 bg-gold-400/30" />}
            <h3 className="label !text-mist-300">{title}</h3>
          </div>
          {subtitle && <p className="mt-1.5 text-[12px] leading-snug text-mist-400">{subtitle}</p>}
        </div>
        <Seg options={labels} value={i} onChange={setI} />
      </header>
      <div key={i} className="fadein min-w-0 flex-1 px-5 pb-5 pt-4">{children[i]}</div>
    </section>
  );
}

// ————————————————————————————————— interactive time-series chart
export type TSeries = { key: string; label: string; values: (number | null)[]; color: string; style?: "area" | "line" | "dash"; hidden?: boolean };
export type TView = { key: string; label: string; series: string[]; format: "money" | "pct" | "price"; rebase?: "pct" | "10k" };
export type TMarker = { date: string; kind: "buy" | "sell" | "div" | "earn"; label: string };

function ticksFor(min: number, max: number, count = 4) {
  if (min === max) { min -= Math.abs(min) * 0.05 || 1; max += Math.abs(max) * 0.05 || 1; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) t.push(Number(v.toFixed(10)));
  return { lo, hi, t };
}
function startIndex(dates: string[], r: string) {
  const last = dates[dates.length - 1];
  if (r === "ALL") return 0;
  let target: string;
  if (r === "YTD") target = `${Number(last.slice(0, 4)) - 1}-12-31`;
  else {
    const n = parseInt(r, 10);
    const d = new Date(last + "T00:00:00Z");
    if (r.endsWith("W")) d.setUTCDate(d.getUTCDate() - 7 * n);
    else if (r.endsWith("M")) d.setUTCMonth(d.getUTCMonth() - n);
    else d.setUTCFullYear(d.getUTCFullYear() - n);
    target = d.toISOString().slice(0, 10);
  }
  if (dates[0] > target) return 0;
  let lo = 0, hi = dates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (dates[mid] <= target) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function TimeChart({
  dates, series, views, ranges = ["1M", "3M", "YTD", "1Y", "3Y", "ALL"], defaultRange = "1Y", ccy, priceCcy = "USD", markers = [], refLines = [], height = 300, title,
}: {
  dates: string[]; series: TSeries[]; views: TView[]; ranges?: string[]; defaultRange?: string; ccy: Ccy; priceCcy?: string; markers?: TMarker[];
  refLines?: { value: number; label: string; color?: string; views?: string[] }[]; height?: number; title?: ReactNode;
}) {
  const [range, setRange] = useState(ranges.includes(defaultRange) ? defaultRange : ranges[ranges.length - 1]);
  const [vi, setVi] = useState(0);
  const [hidden, setHidden] = useState<Record<string, boolean>>(() => Object.fromEntries(series.filter((s) => s.hidden).map((s) => [s.key, true])));
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(820);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const view = views[vi] ?? views[0];
  const s0 = startIndex(dates, range);
  const idx = useMemo(() => {
    const n = dates.length - s0;
    const step = Math.max(1, Math.floor(n / 520));
    const out: number[] = [];
    for (let i = s0; i < dates.length; i += step) out.push(i);
    if (out[out.length - 1] !== dates.length - 1) out.push(dates.length - 1);
    return out;
  }, [s0, dates.length]);

  const data = series.filter((s) => view.series.includes(s.key)).map((s) => {
    let base = s.values[s0];
    if (base == null) base = s.values.find((v) => v != null) ?? 1;
    const vals = idx.map((i) => {
      const v = s.values[i];
      if (v == null) return null;
      if (view.rebase === "pct") return v / (base as number) - 1;
      if (view.rebase === "10k") return (v / (base as number)) * 10000;
      return v;
    });
    return { ...s, vals };
  });
  const visible = data.filter((d) => !hidden[d.key]);
  const refs = refLines.filter((r) => !r.views || r.views.includes(view.key));
  let min = Infinity, max = -Infinity;
  for (const d of visible) for (const v of d.vals) if (v != null) { if (v < min) min = v; if (v > max) max = v; }
  if (!Number.isFinite(min)) { min = 0; max = 1; }
  const span0 = max - min || Math.abs(max) || 1;
  const inRefs = refs.filter((r) => r.value >= min - span0 * 0.6 && r.value <= max + span0 * 0.6);
  const offRefs = refs.filter((r) => !inRefs.includes(r));
  for (const r of inRefs) { min = Math.min(min, r.value); max = Math.max(max, r.value); }
  const pad = (max - min) * 0.06 || Math.abs(max) * 0.04 || 1;
  const T = ticksFor(view.format !== "pct" && min >= 0 ? Math.max(0, min - pad) : min - pad, max + pad, 4);
  const pl = 8, pr = 70, pt = 14, pb = 26;
  const iw = width - pl - pr, ih = height - pt - pb;
  const x = (j: number) => pl + (idx.length > 1 ? (j / (idx.length - 1)) * iw : 0);
  const y = (v: number) => pt + ih - ((v - T.lo) / (T.hi - T.lo || 1)) * ih;
  const fmt = (v: number, axis = false) => {
    if (view.format === "pct") return fmtPct(v, axis ? 0 : 2);
    if (view.format === "price") return fmtPrice(v, priceCcy);
    return fmtMoney(v, ccy, { compact: axis });
  };
  const baseline = view.format === "pct" ? y(Math.max(T.lo, Math.min(T.hi, 0))) : pt + ih;
  const paths = visible.map((d) => {
    let line = "";
    let started = false;
    d.vals.forEach((v, j) => {
      if (v == null) { started = false; return; }
      line += `${started ? "L" : "M"}${x(j).toFixed(1)} ${y(v).toFixed(1)}`;
      started = true;
    });
    const firstJ = d.vals.findIndex((v) => v != null);
    const lastJ = d.vals.length - 1 - [...d.vals].reverse().findIndex((v) => v != null);
    const area = d.style === "area" && firstJ >= 0 ? `${line}L${x(lastJ).toFixed(1)} ${baseline}L${x(firstJ).toFixed(1)} ${baseline}Z` : null;
    return { d, line, area };
  });
  const xt = Math.min(6, Math.max(2, Math.floor(iw / 120)));
  const xLabels = Array.from({ length: xt }, (_, k) => Math.round((k / (xt - 1)) * (idx.length - 1)));
  const spanDays = (new Date(dates[dates.length - 1]).getTime() - new Date(dates[s0]).getTime()) / 864e5;
  const xFmt = (d: string) => (spanDays <= 100 ? fmtDate(d, "short") : spanDays <= 800 ? fmtDate(d, "mshort") : fmtDate(d, "mshort"));
  const hj = hover ?? idx.length - 1;
  const mk = markers
    .map((m) => {
      let lo = 0, hi = idx.length - 1;
      if (m.date < dates[idx[0]]) return null;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (dates[idx[mid]] < m.date) lo = mid + 1; else hi = mid; }
      return { ...m, j: lo };
    })
    .filter((m): m is TMarker & { j: number } => m !== null);
  const first = visible[0];
  const change = first ? (() => {
    const a = first.vals.find((v) => v != null) ?? 0, b = first.vals[hj] ?? 0;
    return view.rebase === "pct" || view.format === "pct" ? { abs: b - (view.rebase === "pct" ? 0 : a), pct: null } : { abs: b - a, pct: a ? b / a - 1 : 0 };
  })() : null;
  const gid = `tc-${view.key}`;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          {title}
          {data.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => data.length > 1 && setHidden((h) => ({ ...h, [d.key]: !h[d.key] }))}
              className={`group flex items-center gap-2 text-left transition-opacity ${hidden[d.key] ? "opacity-35" : ""}`}
            >
              <span className="h-[3px] w-4 rounded-full" style={{ background: d.color, opacity: d.style === "dash" ? 0.6 : 1 }} />
              <span className="text-[11px] text-mist-400 group-hover:text-mist-200">{d.label}</span>
              <span className="money num text-[12px] text-mist-100">{d.vals[hj] != null ? fmt(d.vals[hj] as number) : "—"}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {views.length > 1 && <Seg options={views.map((v) => v.label)} value={vi} onChange={setVi} />}
          <Seg options={ranges} value={Math.max(0, ranges.indexOf(range))} onChange={(i) => setRange(ranges[i])} />
        </div>
      </div>
      {change && (
        <div className="mt-2 flex items-baseline gap-2 text-[12px] text-mist-400">
          <span className={`money num text-[13px] ${change.abs >= 0 ? "text-up" : "text-down"}`}>
            {view.format === "pct" || view.rebase === "pct" ? fmtPct(change.abs, 2) : fmt(change.abs).replace(/^(?=[^−])/, change.abs > 0 ? "+" : "")}
          </span>
          {change.pct !== null && <span className={`num ${change.pct >= 0 ? "text-up" : "text-down"}`}>{fmtPct(change.pct, 2)}</span>}
          <span>{hover === null ? `over ${range === "ALL" ? "all time" : range}` : `to ${fmtDate(dates[idx[hj]], "medium")}`}</span>
        </div>
      )}
      <div ref={box} className="relative mt-3 select-none" style={{ height }}>
        <svg
          width={width}
          height={height}
          className="absolute inset-0 overflow-visible"
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const j = Math.round(((e.clientX - r.left - pl) / iw) * (idx.length - 1));
            setHover(Math.max(0, Math.min(idx.length - 1, j)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            {paths.map(({ d }) => (
              <linearGradient key={d.key} id={`${gid}-${d.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={d.color} stopOpacity={view.format === "pct" && d.key === "dd" ? 0.05 : 0.3} />
                <stop offset="1" stopColor={d.color} stopOpacity={view.format === "pct" && d.key === "dd" ? 0.35 : 0} />
              </linearGradient>
            ))}
            <filter id={`${gid}-glow`} x="-5%" y="-20%" width="110%" height="140%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {T.t.map((t) => (
            <g key={t}>
              <line x1={pl} x2={pl + iw} y1={y(t)} y2={y(t)} stroke={t === 0 && view.format === "pct" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.055)"} strokeDasharray={t === 0 && view.format === "pct" ? undefined : "2 5"} />
              <text x={pl + iw + 10} y={y(t) + 3} fontSize={10} fill="#6b7384" fontFamily="var(--font-mono)" className="money">{fmt(t, true)}</text>
            </g>
          ))}
          {xLabels.map((j, k) => (
            <text key={k} x={x(j)} y={height - 6} fontSize={10} fill="#6b7384" fontFamily="var(--font-mono)" textAnchor={k === 0 ? "start" : k === xLabels.length - 1 ? "end" : "middle"}>
              {xFmt(dates[idx[j]])}
            </text>
          ))}
          {offRefs.map((r, k) => (
            <text key={r.label} x={pl + 6} y={r.value < T.lo ? pt + ih - 6 - k * 13 : pt + 10 + k * 13} fontSize={10} fill={r.color ?? "#b69cff"} fontFamily="var(--font-mono)">
              {r.value < T.lo ? "↓ " : "↑ "}{r.label} · off scale
            </text>
          ))}
          {inRefs.map((r) => (
            <g key={r.label}>
              <line x1={pl} x2={pl + iw} y1={y(r.value)} y2={y(r.value)} stroke={r.color ?? "#b69cff"} strokeDasharray="5 4" opacity={0.8} />
              <text x={pl + 6} y={y(r.value) - 5} fontSize={10} fill={r.color ?? "#b69cff"} fontFamily="var(--font-mono)">{r.label}</text>
            </g>
          ))}
          <g key={`${range}-${view.key}`}>
            {paths.map(({ d, area }) => area && <path key={"a" + d.key} d={area} fill={`url(#${gid}-${d.key})`} className="fadein" />)}
            {paths.map(({ d, line }, k) => (
              <path
                key={"l" + d.key}
                d={line}
                fill="none"
                stroke={d.color}
                strokeWidth={k === 0 ? 2 : 1.4}
                strokeDasharray={d.style === "dash" ? "4 4" : undefined}
                strokeLinejoin="round"
                opacity={d.style === "dash" ? 0.75 : 1}
                filter={k === 0 && d.style !== "dash" ? `url(#${gid}-glow)` : undefined}
                pathLength={d.style === "dash" ? undefined : 1}
                className={d.style === "dash" ? "fadein" : "draw"}
              />
            ))}
          </g>
          {mk.map((m, k) => {
            const cx = x(m.j), cy = pt + ih - 4;
            const c = m.kind === "buy" ? "#3ee0a1" : m.kind === "sell" ? "#ff6b6b" : m.kind === "div" ? "#f5bd62" : "#8b9dff";
            return (
              <g key={k}>
                <line x1={cx} x2={cx} y1={pt} y2={pt + ih} stroke={c} strokeOpacity={0.12} />
                <path d={m.kind === "sell" ? `M${cx - 4} ${cy - 4}L${cx + 4} ${cy - 4}L${cx} ${cy + 2}Z` : `M${cx - 4} ${cy + 2}L${cx + 4} ${cy + 2}L${cx} ${cy - 5}Z`} fill={c}>
                  <title>{m.label}</title>
                </path>
              </g>
            );
          })}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hj)} x2={x(hj)} y1={pt} y2={pt + ih} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" />
              {visible.map((d) => d.vals[hj] != null && <circle key={d.key} cx={x(hj)} cy={y(d.vals[hj] as number)} r={4} fill="#05070a" stroke={d.color} strokeWidth={2} />)}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-lg border border-white/10 bg-ink-850/95 px-3 py-2 shadow-2xl backdrop-blur"
            style={{ left: Math.min(Math.max(0, x(hj) + 12), width - 190) }}
          >
            <div className="label mb-1.5">{fmtDate(dates[idx[hj]], "dow")} {dates[idx[hj]].slice(0, 4)}</div>
            {visible.map((d) => (
              <div key={d.key} className="flex items-center justify-between gap-4 text-[12px]">
                <span className="flex items-center gap-1.5 text-mist-400"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.label}</span>
                <span className="money num text-mist-100">{d.vals[hj] != null ? fmt(d.vals[hj] as number) : "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ————————————————————————————————— header controls
export function CurrencySwitch({ value }: { value: Ccy }) {
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(value);
  return (
    <div className={`inline-flex rounded-xl bg-white/[0.035] p-1 ring-1 ring-inset ring-white/[0.08] transition-opacity ${pending ? "opacity-70" : ""}`} aria-label="Display currency">
      {CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => start(async () => { setShown(c); await setCurrency(c); })}
          className={`num rounded-lg px-2.5 py-1.5 text-[11px] transition-all ${shown === c ? "bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 shadow-[0_4px_18px_-6px_rgba(245,189,98,.8)]" : "text-mist-400 hover:text-mist-100"}`}
          title={CCY_META[c].name}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function PrivacyToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const v = document.documentElement.dataset.privacy === "on";
    if (v) setOn(true);
  }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.dataset.privacy = next ? "on" : "off";
    try { localStorage.setItem("meridian-privacy", next ? "on" : "off"); } catch {}
  };
  return (
    <button type="button" onClick={toggle} title={on ? "Show values" : "Hide values"} className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ring-inset transition ${on ? "bg-gold-400/15 text-gold-300 ring-gold-400/30" : "bg-white/[0.035] text-mist-400 ring-white/[0.08] hover:text-mist-100"}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {on && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );
}

const TABS = [
  { href: "/portfolio", label: "Overview" },
  { href: "/portfolio/holdings", label: "Holdings" },
  { href: "/portfolio/performance", label: "Performance" },
  { href: "/portfolio/analysis", label: "Analysis" },
  { href: "/portfolio/income", label: "Income" },
  { href: "/portfolio/activity", label: "Activity" },
];
export function PortfolioTabs() {
  const path = usePathname();
  return (
    <nav className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
      {TABS.map((t, i) => {
        const active = t.href === "/portfolio" ? path === "/portfolio" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`group relative flex items-center gap-2 whitespace-nowrap px-3.5 pb-3 pt-2 text-[13px] transition-colors ${active ? "text-mist-100" : "text-mist-400 hover:text-mist-200"}`}>
            <span className={`num text-[9.5px] ${active ? "text-gold-400" : "text-mist-500 group-hover:text-mist-400"}`}>0{i + 1}</span>
            {t.label}
            <span className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-all ${active ? "bg-gold-400 shadow-[0_0_14px_2px_rgba(245,189,98,.55)]" : "bg-transparent group-hover:bg-white/10"}`} />
          </Link>
        );
      })}
    </nav>
  );
}

// ————————————————————————————————— app rail
const I = {
  portfolio: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12l6 6" /></>,
  markets: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M7 15l4-5 3 3 5-6" /></>,
  news: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 12.5h8M8 16h5" /></>,
  watch: <><path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2L12 16.4l-4.6 2.4.9-5.2-3.8-3.6 5.2-.8z" /></>,
  research: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M9 3.5v4M15 3.5v4" /></>,
  settings: <><path d="M5 7h14M5 17h14" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
};
const MODULES: { href: string; label: string; icon: keyof typeof I }[] = [
  { href: "/portfolio", label: "Portfolio", icon: "portfolio" },
  { href: "/markets", label: "Markets", icon: "markets" },
  { href: "/news", label: "News", icon: "news" },
  { href: "/watchlist", label: "Watchlist", icon: "watch" },
  { href: "/research", label: "Research", icon: "research" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];
export function Rail() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r border-white/[0.06] bg-ink-950/70 py-4 backdrop-blur md:flex">
      <Link href="/portfolio" className="group mb-6 grid h-11 w-11 place-items-center" title="Meridian">
        <svg viewBox="0 0 40 40" className="h-10 w-10">
          <defs>
            <linearGradient id="mlogo" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#ffe2b0" /><stop offset="1" stopColor="#e8a33d" /></linearGradient>
          </defs>
          <circle cx="20" cy="20" r="15" fill="none" stroke="url(#mlogo)" strokeWidth="1.6" />
          <ellipse cx="20" cy="20" rx="6.5" ry="15" fill="none" stroke="url(#mlogo)" strokeWidth="1.2" opacity="0.8" />
          <path d="M20 5v30" stroke="url(#mlogo)" strokeWidth="1.6" />
          <path d="M6.5 14h27M6.5 26h27" stroke="#f5bd62" strokeWidth="0.8" opacity="0.35" />
          <circle cx="20" cy="5" r="2.6" fill="#ffe2b0" className="transition-all group-hover:r-[3.4]" />
        </svg>
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {MODULES.map((m) => {
          const active = path.startsWith(m.href);
          return (
            <Link key={m.href} href={m.href} className={`group relative flex w-[60px] flex-col items-center gap-1 rounded-xl py-2 transition ${active ? "bg-gold-400/[0.09] text-gold-300" : "text-mist-500 hover:bg-white/[0.03] hover:text-mist-200"}`}>
              {active && <span className="absolute -left-2 top-2 bottom-2 w-[2px] rounded-full bg-gold-400 shadow-[0_0_12px_2px_rgba(245,189,98,.6)]" />}
              <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{I[m.icon]}</svg>
              <span className="text-[9.5px] tracking-wide">{m.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl text-mist-500" title="Settings">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">{I.settings}</svg>
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-[12px] font-semibold text-ink-950">JM</span>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/[0.06] px-4 py-2 md:hidden">
      {MODULES.map((m) => (
        <Link key={m.href} href={m.href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] ${path.startsWith(m.href) ? "bg-gold-400/10 text-gold-300" : "text-mist-400"}`}>{m.label}</Link>
      ))}
    </nav>
  );
}
