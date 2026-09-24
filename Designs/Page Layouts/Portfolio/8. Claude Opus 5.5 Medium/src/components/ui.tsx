import type { ReactNode } from "react";
import { pct, tone } from "@/lib/format";

export function Card({ title, eyebrow, action, children, className = "", glow, pad = true, id }: { title?: ReactNode; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string; glow?: boolean; pad?: boolean; id?: string }) {
  return (
    <section id={id} className={`card rise ${glow ? "card-glow" : ""} ${className}`}>
      {(title || eyebrow || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? "p-5 pt-4" : ""}>{children}</div>
    </section>
  );
}

export function Delta({ value, digits = 2, className = "" }: { value: number; digits?: number; className?: string }) {
  return <span className={`num ${tone(value)} ${className}`}>{pct(value, digits, true)}</span>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow truncate">{label}</div>
      <div className={`num mt-1 truncate text-xl ${accent ? "text-accent" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-dim">{sub}</div>}
    </div>
  );
}

export function Grade({ g, size = "md" }: { g: string; size?: "sm" | "md" | "lg" }) {
  const col: Record<string, string> = { A: "#2fe39b", B: "#9be86a", C: "#d4ff3a", D: "#ffb547", E: "#ff5a78" };
  const s = size === "lg" ? "h-14 w-14 text-3xl" : size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-base";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg font-serif ${s}`} style={{ background: col[g] + "1f", color: col[g], boxShadow: `inset 0 0 0 1px ${col[g]}55` }}>
      {g}
    </span>
  );
}

export function Pill({ children, color = "#8a91a2" }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: color + "1a", color }}>
      {children}
    </span>
  );
}

export function Meter({ value, color = "#d4ff3a", className = "" }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function SymbolBadge({ symbol, color = "#8f7cff" }: { symbol: string; color?: string }) {
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold tracking-tight" style={{ background: `linear-gradient(135deg, ${color}40, ${color}10)`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}>
      {symbol.slice(0, 4)}
    </span>
  );
}
