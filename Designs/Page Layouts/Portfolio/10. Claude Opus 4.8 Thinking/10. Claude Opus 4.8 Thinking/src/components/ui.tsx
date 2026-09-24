import type { ReactNode } from "react";
import { fmtSignedPct } from "@/lib/format";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return <div className={`card ${hover ? "card-hover" : ""} ${className}`}>{children}</div>;
}

export function CardHead({
  title,
  sub,
  right,
  icon,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-ink-faint">{icon}</span>}
        <div>
          <h3 className="text-[13px] font-semibold tracking-wide text-ink">{title}</h3>
          {sub && <p className="mt-0.5 text-[11px] text-ink-faint">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function DeltaPill({
  pct,
  className = "",
  arrow = true,
}: {
  pct: number;
  className?: string;
  arrow?: boolean;
}) {
  const up = pct >= 0;
  return (
    <span
      className={`tabnum inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${
        up ? "bg-[#0f2a22] text-pos" : "bg-[#2a1319] text-neg"
      } ${className}`}
    >
      {arrow && <span className="text-[9px]">{up ? "▲" : "▼"}</span>}
      {fmtSignedPct(pct)}
    </span>
  );
}

export function Badge({
  children,
  color = "#64748b",
  soft = true,
}: {
  children: ReactNode;
  color?: string;
  soft?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={
        soft
          ? { color, background: `${color}1f`, border: `1px solid ${color}33` }
          : { color: "#05070d", background: color }
      }
    >
      {children}
    </span>
  );
}

export function Progress({ value, color = "var(--color-accent)", track = "#161d29" }: { value: number; color?: string; track?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: track }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

export function Ticker({ symbol, accent, size = 32 }: { symbol: string; accent: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
      style={{
        width: size,
        height: size,
        background: `${accent}1c`,
        color: accent,
        border: `1px solid ${accent}3a`,
      }}
    >
      {symbol.slice(0, 4)}
    </span>
  );
}

export function StatBlock({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-faint">
        {accent && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
        {label}
      </div>
      <div className="mt-1 truncate text-lg font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-dim">{hint}</div>}
    </div>
  );
}
