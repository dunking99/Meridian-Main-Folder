"use client";
import { useState } from "react";

export type DonutSeg = { key: string; label: string; value: number; pct: number; color: string };

export default function Donut({
  data,
  size = 200,
  thickness = 24,
  centerTop,
  centerSub,
  legend = true,
}: {
  data: DonutSeg[];
  size?: number;
  thickness?: number;
  centerTop: React.ReactNode;
  centerSub?: React.ReactNode;
  legend?: boolean;
}) {
  const [hot, setHot] = useState<number | null>(null);
  const r = (size - thickness - 8) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = data.map((d) => {
    const len = Math.max(0, d.pct * C - 2.5);
    const s = { ...d, len, off: acc * C + 1.25 };
    acc += d.pct;
    return s;
  });
  const active = hot !== null ? data[hot] : null;
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#151B21" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segs.map((s, i) => (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hot === i ? thickness + 6 : thickness}
                strokeDasharray={`${s.len} ${C - s.len}`}
                strokeDashoffset={-s.off}
                strokeLinecap="butt"
                style={{ transition: "stroke-width .25s ease, opacity .25s ease", opacity: hot === null || hot === i ? 1 : 0.35, cursor: "pointer" }}
                onMouseEnter={() => setHot(i)}
                onMouseLeave={() => setHot(null)}
              />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-display text-[26px] leading-none tracking-tight">
            {active ? (active.pct * 100).toFixed(1) + "%" : centerTop}
          </div>
          <div className="mt-1.5 text-[10.5px] uppercase tracking-[0.14em] text-tx-3 max-w-[120px] text-center leading-tight">
            {active ? active.label : centerSub}
          </div>
        </div>
      </div>
      {legend && (
        <ul className="flex-1 min-w-[150px] space-y-1">
          {data.map((d, i) => (
            <li
              key={d.key}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 cursor-default transition-colors ${hot === i ? "bg-ink-800" : ""}`}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
            >
              <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: d.color }} />
              <span className="text-[12.5px] text-tx-2 flex-1 truncate">{d.label}</span>
              <span className="num text-[12px] text-tx-1">{(d.pct * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
