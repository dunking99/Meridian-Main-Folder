"use client";
import { useEffect, useState } from "react";

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

export default function Gauge({ value, grade, label, size = 220 }: { value: number; grade?: string; label?: string; size?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(value);
      return;
    }
    const t = setTimeout(() => setV(value), 80);
    return () => clearTimeout(t);
  }, [value]);

  const w = size;
  const cx = w / 2;
  const cy = w * 0.62;
  const r = w * 0.42;
  const angle = (v - 50) * 1.8;

  return (
    <div className="relative mx-auto" style={{ width: w, height: w * 0.72 }}>
      <svg width={w} height={w * 0.72} viewBox={`0 0 ${w} ${w * 0.72}`}>
        <path d={arc(cx, cy, r, 180, 360)} fill="none" stroke="#1B222B" strokeWidth={10} strokeLinecap="round" />
        <path d={arc(cx, cy, r, 180, 252)} fill="none" stroke="#3FD68F" strokeOpacity={0.3} strokeWidth={10} strokeLinecap="round" />
        <path d={arc(cx, cy, r, 252, 306)} fill="none" stroke="#D9A648" strokeOpacity={0.3} strokeWidth={10} />
        <path d={arc(cx, cy, r, 306, 360)} fill="none" stroke="#F0655F" strokeOpacity={0.35} strokeWidth={10} strokeLinecap="round" />
        {Array.from({ length: 11 }, (_, i) => {
          const a = 180 + i * 18;
          const [x0, y0] = polar(cx, cy, r - 12, a);
          const [x1, y1] = polar(cx, cy, r - (i % 5 === 0 ? 20 : 16), a);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#3A4654" strokeWidth={i % 5 === 0 ? 1.4 : 1} />;
        })}
        <g
          style={{
            transform: `rotate(${angle - 180}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: "transform 1.1s cubic-bezier(.2,.7,.2,1)",
          }}
        >
          <line x1={cx} y1={cy} x2={cx} y2={cy - r + 16} stroke="#F0C576" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={5} fill="#0D1116" stroke="#D9A648" strokeWidth={2} />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-2.5 pointer-events-none">
        <div className="font-display text-[40px] leading-none text-brass2 num">{Math.round(value)}</div>
        {grade && (
          <span className="mb-0.5 text-[13px] font-semibold text-tx-1 border border-line2 rounded-md px-2 py-0.5 bg-ink-800">
            {grade}
          </span>
        )}
      </div>
      {label && <div className="text-center text-[11px] uppercase tracking-[0.16em] text-tx-3 -mt-2">{label}</div>}
    </div>
  );
}
