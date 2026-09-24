"use client";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type LineDef = { key: string; label: string; color: string; dash?: boolean; width?: number };

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { value: number; dataKey: string; color: string }[]; label?: string; fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const date = new Date(label ?? "");
  const dstr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className="rounded-lg border border-line2 bg-ink-800/95 px-3 py-2 shadow-xl backdrop-blur">
      <div className="text-[10px] uppercase tracking-widest text-tx-3 mb-1">{dstr}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-tx-2 w-16">{p.dataKey === "bench" || p.dataKey === "benchN" ? "S&P 500" : p.dataKey === "port" ? "Portfolio" : p.dataKey}</span>
          <span className="num text-tx-1 ml-auto pl-3">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function LinePanel({
  data,
  lines,
  height = 260,
  fmt,
  areaKey,
  zeroLine = false,
}: {
  data: Record<string, unknown>[];
  lines: LineDef[];
  height?: number;
  fmt: (v: number) => string;
  areaKey?: string;
  zeroLine?: boolean;
}) {
  const isArea = lines.some((l) => l.key === areaKey);
  const xTick = (v: string) => {
    const d = new Date(v);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", " ’");
  };
  const common = {
    data,
    margin: { top: 6, right: 6, bottom: 0, left: 0 },
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      {isArea ? (
        <AreaChart {...common}>
          <defs>
            {lines.map((l) => (
              <linearGradient key={l.key} id={`fill-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={l.color} stopOpacity={0.24} />
                <stop offset="100%" stopColor={l.color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#161D25" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="t" tickFormatter={xTick} tick={{ fill: "#5F6D79", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#1E2630" }} tickLine={false} minTickGap={48} />
          <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fill: "#5F6D79", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }} axisLine={false} tickLine={false} width={58} domain={["auto", "auto"]} />
          {zeroLine && <ReferenceLine y={0} stroke="#3A4654" strokeDasharray="4 4" />}
          <Tooltip content={<Tip fmt={fmt} />} cursor={{ stroke: "#2A3542" }} />
          {lines.map((l) => (
            <Area
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={l.width ?? (l.key === areaKey ? 2 : 1.5)}
              strokeDasharray={l.dash ? "5 5" : undefined}
              fill={l.dash ? "transparent" : `url(#fill-${l.key})`}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart {...common}>
          <CartesianGrid stroke="#161D25" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="t" tickFormatter={xTick} tick={{ fill: "#5F6D79", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }} axisLine={{ stroke: "#1E2630" }} tickLine={false} minTickGap={48} />
          <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fill: "#5F6D79", fontSize: 10, fontFamily: "IBM Plex Mono, monospace" }} axisLine={false} tickLine={false} width={58} domain={["auto", "auto"]} />
          {zeroLine && <ReferenceLine y={0} stroke="#3A4654" strokeDasharray="4 4" />}
          <Tooltip content={<Tip fmt={fmt} />} cursor={{ stroke: "#2A3542" }} />
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={l.width ?? 1.8} strokeDasharray={l.dash ? "5 5" : undefined} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
