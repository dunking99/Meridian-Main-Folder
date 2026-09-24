"use client";
import { useState } from "react";

/* coarse dot-matrix world map: [startCol, endCol, regionChar] per row (46 × 20) */
const MAP: [number, number, string][][] = [
  [[17, 20, "G"]],
  [[17, 20, "G"], [24, 26, "E"], [29, 41, "A"]],
  [[4, 15, "C"], [16, 20, "G"], [23, 25, "E"], [27, 42, "A"]],
  [[4, 16, "C"], [22, 27, "E"], [28, 43, "A"]],
  [[5, 15, "C"], [22, 28, "E"], [29, 42, "A"]],
  [[6, 15, "C"], [9, 14, "U"], [22, 28, "E"], [29, 40, "A"]],
  [[7, 14, "U"], [22, 26, "E"], [29, 38, "A"], [41, 42, "A"]],
  [[8, 14, "U"], [22, 28, "E"], [30, 38, "A"], [40, 41, "A"], [23, 27, "F"]],
  [[9, 13, "M"], [24, 28, "E"], [21, 29, "F"], [31, 38, "A"]],
  [[12, 13, "M"], [20, 29, "F"], [32, 38, "A"]],
  [[13, 14, "M"], [20, 30, "F"], [33, 37, "A"]],
  [[14, 17, "M"], [22, 28, "F"], [36, 38, "A"]],
  [[14, 19, "M"], [23, 28, "F"], [36, 42, "A"]],
  [[15, 19, "M"], [24, 27, "F"], [38, 43, "O"]],
  [[16, 18, "M"], [25, 27, "F"], [38, 44, "O"]],
  [[16, 18, "M"], [25, 26, "F"], [38, 44, "O"]],
  [[16, 18, "M"], [26, 26, "F"], [38, 44, "O"]],
  [[16, 17, "M"], [44, 45, "O"]],
  [[16, 16, "M"], [45, 45, "O"]],
  [[15, 16, "M"], [45, 45, "O"]],
];

const REGION_META: Record<string, string> = {
  US: "United States",
  Canada: "Canada",
  LatAm: "Latin America",
  Europe: "Europe",
  Africa: "Africa",
  Asia: "Asia",
  Oceania: "Oceania",
};

const SPACING = 15;
const W = 46 * SPACING;
const H = 20 * SPACING;

export default function WorldDots({
  weights,
}: {
  weights: { key: string; label: string; pct: number; inPortfolio: boolean }[];
}) {
  const [hot, setHot] = useState<string | null>(null);
  const byKey = Object.fromEntries(weights.map((w) => [w.key, w]));
  const maxPct = Math.max(...weights.map((w) => w.pct), 1);
  const dots: { x: number; y: number; region: string }[] = [];
  MAP.forEach((segs, r) => {
    const grid: (string | null)[] = Array(46).fill(null);
    for (const [s, e, ch] of segs) {
      for (let c = s; c <= Math.min(e, 45); c++) grid[c] = ch;
    }
    grid.forEach((ch, c) => {
      if (!ch || ch === "G") return;
      dots.push({ x: c * SPACING + SPACING / 2, y: r * SPACING + SPACING / 2, region: ch });
    });
  });
  const hotMeta = byKey[hot ?? ""];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {dots.map((d, i) => {
          const w = byKey[d.region];
          const pct = w?.pct ?? 0;
          const active = (w?.inPortfolio ?? false) && pct > 0.05;
          const r = active ? 1.8 + 3.4 * Math.sqrt(pct / maxPct) : 1.1;
          const isHot = hot === d.region;
          return (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={isHot ? r + 1 : r}
              fill={active ? "#D9A648" : "#2A3542"}
              opacity={active ? (isHot ? 1 : 0.42 + 0.58 * (pct / maxPct)) : 0.5}
              onMouseEnter={() => setHot(d.region)}
              onMouseLeave={() => setHot(null)}
              style={{ transition: "r .15s ease, opacity .15s ease", cursor: active ? "pointer" : "default" }}
            />
          );
        })}
      </svg>
      <div className="mt-1 h-5 text-[11px] text-tx-3">
        {hot && hotMeta ? (
          hotMeta.inPortfolio ? (
            <span>
              <span className="font-semibold text-brass2">{hotMeta.label}</span>
              <span className="num ml-2">{hotMeta.pct.toFixed(1)}% of book</span>
            </span>
          ) : (
            <span>
              <span className="font-semibold text-tx-2">{hotMeta.label}</span>
              <span className="ml-2">no direct exposure</span>
            </span>
          )
        ) : (
          <span>Dot size ∝ regional exposure · hover a region</span>
        )}
      </div>
    </div>
  );
}
