"use client";

import { useState } from "react";
import { TimeChart } from "./charts/advanced";

export function HoldingChart({ dates, price, position, idx, markers, symbol }: { dates: string[]; price: number[]; position: number[]; idx: number[]; markers: { date: string; label: string; color: string }[]; symbol: string }) {
  const [mode, setMode] = useState<"price" | "rel" | "position">("price");
  const toggle = (
    <div className="flex rounded-full border border-line bg-ink/40 p-0.5 text-[11px]">
      {([["price", "Price"], ["rel", "vs Portfolio"], ["position", "Position value"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1 ${mode === k ? "bg-accent font-medium text-ink" : "text-muted hover:text-fg"}`}>{l}</button>
      ))}
    </div>
  );
  if (mode === "price")
    return <TimeChart key="p" dates={dates} format="num" defaultRange="ALL" markers={markers} extraControls={toggle} series={[{ key: "px", label: `${symbol} price (local)`, values: price, color: "#d4ff3a", kind: "area" }]} />;
  if (mode === "rel")
    return <TimeChart key="r" dates={dates} format="pct" rebase zero defaultRange="1Y" extraControls={toggle} series={[{ key: "px", label: symbol, values: price, color: "#d4ff3a", kind: "area" }, { key: "pf", label: "Your portfolio", values: idx, color: "#8f7cff" }]} />;
  return <TimeChart key="v" dates={dates} defaultRange="ALL" extraControls={toggle} series={[{ key: "pv", label: "Position value", values: position.map((v) => (v > 0 ? v : null)), color: "#3fd0ff", kind: "area" }]} />;
}
