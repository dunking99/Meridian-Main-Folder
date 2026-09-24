"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type TreemapItem = { id: string; value: number; color: string; ret: number };

type Rect = { x: number; y: number; w: number; h: number };

/** squarified treemap */
function squarify(items: TreemapItem[], x: number, y: number, w: number, h: number): { rect: Rect; item: TreemapItem }[] {
  const total = items.reduce((s, d) => s + d.value, 0) || 1;
  const areas = items.map((d) => (d.value / total) * w * h);
  const out: { rect: Rect; item: TreemapItem }[] = [];
  let rect: Rect = { x, y, w, h };
  let row: number[] = [];
  let rowItems: TreemapItem[] = [];

  const worst = (rowA: number[], side: number) => {
    const s = rowA.reduce((a, b) => a + b, 0);
    const rmax = Math.max(...rowA);
    const rmin = Math.min(...rowA);
    const s2 = s * s;
    const l2 = side * side;
    return Math.max((l2 * rmax) / s2, s2 / (l2 * rmin));
  };

  const layoutRow = () => {
    if (!row.length) return;
    const s = row.reduce((a, b) => a + b, 0);
    if (rect.w >= rect.h) {
      const stripW = s / rect.h;
      let yy = rect.y;
      row.forEach((a, i) => {
        const hh = a / stripW;
        out.push({ rect: { x: rect.x, y: yy, w: stripW, h: hh }, item: rowItems[i] });
        yy += hh;
      });
      rect = { x: rect.x + stripW, y: rect.y, w: rect.w - stripW, h: rect.h };
    } else {
      const stripH = s / rect.w;
      let xx = rect.x;
      row.forEach((a, i) => {
        const ww = a / stripH;
        out.push({ rect: { x: xx, y: rect.y, w: ww, h: stripH }, item: rowItems[i] });
        xx += ww;
      });
      rect = { x: rect.x, y: rect.y + stripH, w: rect.w, h: rect.h - stripH };
    }
    row = [];
    rowItems = [];
  };

  items.forEach((item, i) => {
    const side = Math.min(rect.w, rect.h);
    if (row.length === 0 || worst([...row, areas[i]], side) <= worst(row, side)) {
      row.push(areas[i]);
      rowItems.push(item);
    } else {
      layoutRow();
      row = [areas[i]];
      rowItems = [item];
    }
  });
  layoutRow();
  return out;
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function Treemap({ items, height = 430 }: { items: TreemapItem[]; height?: number }) {
  const router = useRouter();
  const [hot, setHot] = useState<string | null>(null);
  const W = 1000;
  const H = 600;
  const cells = useMemo(() => squarify(items, 0, 0, W, H), [items]);
  const hotItem = items.find((i) => i.id === hot);

  return (
    <div>
      <div className="relative w-full overflow-hidden rounded-lg border border-line" style={{ height, aspectRatio: `${W}/${H}`, maxWidth: height * (W / H) }}>
        {cells.map(({ rect, item }) => {
          const showName = rect.w > 150 && rect.h > 70;
          const showRet = rect.w > 90 && rect.h > 84;
          return (
            <button
              key={item.id}
              onClick={() => router.push(`/portfolio/holdings/${item.id}`)}
              onMouseEnter={() => setHot(item.id)}
              onMouseLeave={() => setHot(null)}
              className="absolute text-left transition-[filter,opacity] duration-150 focus:outline-none"
              style={{
                left: `${(rect.x / W) * 100}%`,
                top: `${(rect.y / H) * 100}%`,
                width: `${(rect.w / W) * 100}%`,
                height: `${(rect.h / H) * 100}%`,
                background: hot === item.id ? hexToRgba(item.color, 0.24) : hexToRgba(item.color, 0.11),
                boxShadow: `inset 0 0 0 1px ${hexToRgba(item.color, hot === item.id ? 0.65 : 0.28)}`,
              }}
            >
              <span className="absolute inset-0 p-[1.6%] flex flex-col gap-[0.5%]">
                {rect.w > 34 && rect.h > 20 && (
                  <span className="font-mono font-semibold text-[12px] leading-none" style={{ color: hexToRgba(item.color, 1) }}>
                    {item.id}
                  </span>
                )}
                {rect.w > 40 && rect.h > 34 && (
                  <span className="num text-[10px] text-tx-2 leading-none">{((item.value / items.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)}%</span>
                )}
                {showRet && (
                  <span className={`num text-[10px] leading-none ${item.ret >= 0 ? "text-up" : "text-down"}`}>
                    {item.ret >= 0 ? "▲" : "▼"} {(Math.abs(item.ret) * 100).toFixed(1)}% 1M
                  </span>
                )}
                {showName && <span className="text-[10px] text-tx-3 leading-tight truncate">{item.id === "GLD" ? "Gold" : ""}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 h-4 text-[11px] text-tx-3 flex items-center">
        {hotItem ? (
          <span>
            <span className="font-mono font-semibold" style={{ color: hotItem.color }}>{hotItem.id}</span>
            <span className="num ml-2">{((hotItem.value / items.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)}% of book</span>
            <span className={`num ml-2 ${hotItem.ret >= 0 ? "text-up" : "text-down"}`}>{(hotItem.ret * 100).toFixed(1)}% 1M</span>
            <span className="ml-2">— click to open</span>
          </span>
        ) : (
          <span>Hover for detail · click a tile to open the holding</span>
        )}
      </div>
    </div>
  );
}
