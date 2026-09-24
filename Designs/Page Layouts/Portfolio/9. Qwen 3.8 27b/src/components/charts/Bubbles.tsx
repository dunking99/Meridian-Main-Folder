"use client";
import { useMemo, useState } from "react";

export type Bubble = { id: string; label: string; vol: number; ret: number; weight: number; color: string; isPortfolio: boolean };

export default function Bubbles({ items }: { items: Bubble[] }) {
  const [hot, setHot] = useState<Bubble | null>(null);
  const W = 560, H = 360, P = { l: 46, r: 16, t: 16, b: 34 };
  const port = items.find((b) => b.isPortfolio)!;
  const xs = useMemo(() => {
    const maxV = Math.max(...items.map((b) => b.vol), 0.4) * 1.1;
    const minR = Math.min(...items.map((b) => b.ret), 0) - 0.06;
    const maxR = Math.max(...items.map((b) => b.ret), 0.3) + 0.05;
    const X = (v: number) => P.l + (v / maxV) * (W - P.l - P.r);
    const Y = (r: number) => H - P.b - ((r - minR) / (maxR - minR)) * (H - P.t - P.b);
    return { X, Y, minR, maxR, maxV };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const xTicks = [0, 0.1, 0.2, 0.3, 0.4].filter((t) => t < xs.maxV);
  const yStep = (xs.maxR - xs.minR) / 4;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* grid + axes */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={xs.X(t)} y1={P.t} x2={xs.X(t)} y2={H - P.b} stroke="#1A222B" />
            <text x={xs.X(t)} y={H - P.b + 16} textAnchor="middle" fontSize="10" fill="#5F6D79" fontFamily="IBM Plex Mono, monospace">
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((i) => {
          const v = xs.minR + i * yStep;
          return (
            <g key={`y${i}`}>
              <line x1={P.l} y1={xs.Y(v)} x2={W - P.r} y2={xs.Y(v)} stroke={Math.abs(v) < yStep / 2 ? "#3A4654" : "#1A222B"} strokeDasharray={Math.abs(v) < yStep / 2 ? "4 4" : undefined} />
              <text x={P.l - 7} y={xs.Y(v) + 3.5} textAnchor="end" fontSize="10" fill="#5F6D79" fontFamily="IBM Plex Mono, monospace">
                {(v * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <line x1={xs.X(port.vol)} y1={P.t} x2={xs.X(port.vol)} y2={H - P.b} stroke="#D9A648" strokeOpacity="0.35" strokeDasharray="3 5" />
        <text x={xs.X(port.vol) + 5} y={P.t + 10} fontSize="9.5" fill="#D9A648" fontFamily="IBM Plex Mono, monospace">
          your vol
        </text>
        <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="10" fill="#5F6D79" fontFamily="Instrument Sans, sans-serif">
          1-year annualized volatility →
        </text>
        <text x={P.l} y={12} fontSize="10" fill="#5F6D79" fontFamily="Instrument Sans, sans-serif">
          1-year return →
        </text>

        {items.map((b) => {
          const r = b.isPortfolio ? 13 : 5 + Math.sqrt(b.weight) * 13;
          return (
            <g key={b.id} onMouseEnter={() => setHot(b)} onMouseLeave={() => setHot(null)} style={{ cursor: "pointer" }}>
              <circle cx={xs.X(b.vol)} cy={xs.Y(b.ret)} r={r} fill={b.color} fillOpacity={b.isPortfolio ? 0.15 : 0.22} stroke={b.color} strokeWidth={b.isPortfolio ? 2 : 1.2} />
              {b.isPortfolio && (
                <>
                  <line x1={xs.X(b.vol) - r - 6} y1={xs.Y(b.ret)} x2={xs.X(b.vol) + r + 6} y2={xs.Y(b.ret)} stroke="#F0C576" strokeWidth="1" />
                  <line x1={xs.X(b.vol)} y1={xs.Y(b.ret) - r - 6} x2={xs.X(b.vol)} y2={xs.Y(b.ret) + r + 6} stroke="#F0C576" strokeWidth="1" />
                  <text x={xs.X(b.vol)} y={xs.Y(b.ret) - r - 10} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#F0C576" fontFamily="IBM Plex Mono, monospace">
                    PORTFOLIO
                  </text>
                </>
              )}
              {r > 9 && !b.isPortfolio && (
                <text x={xs.X(b.vol)} y={xs.Y(b.ret) + 3.5} textAnchor="middle" fontSize="9" fill="#E8ECF0" fontFamily="IBM Plex Mono, monospace" pointerEvents="none">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hot && !hot.isPortfolio && (
        <div
          className="pointer-events-none absolute rounded-lg border border-line2 bg-ink-800/95 px-3 py-2 text-[11px] shadow-xl"
          style={{
            left: `${(xs.X(hot.vol) / W) * 100}%`,
            top: `${(xs.Y(hot.ret) / H) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          <span className="font-mono font-semibold" style={{ color: hot.color }}>{hot.label}</span>
          <span className="num ml-2">{hot.weight * 100 >= 1 ? (hot.weight * 100).toFixed(1) + "%" : "—"} weight</span>
          <div className="num text-tx-2 mt-0.5">
            {(hot.ret * 100).toFixed(1)}% ret · {(hot.vol * 100).toFixed(1)}% vol
          </div>
        </div>
      )}
    </div>
  );
}
