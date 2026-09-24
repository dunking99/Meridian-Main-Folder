import Link from "next/link";
import type { ReactNode } from "react";
import { fmtMoney, fmtPct, hexA, toneClass } from "@/lib/format";
import { flagOf } from "@/lib/reference";

export function Card({
  title, index, action, children, className = "", bodyClass = "", hero, id, subtitle, delay = 0,
}: {
  title?: ReactNode; index?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
  hero?: boolean; id?: string; subtitle?: ReactNode; delay?: number;
}) {
  return (
    <section id={id} className={`card ${hero ? "card-hero" : ""} rise flex min-w-0 flex-col ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {index && <span className="num text-[10px] text-gold-400/80">{index}</span>}
              {index && <span className="h-px w-3 bg-gold-400/30" />}
              <h3 className="label !text-mist-300">{title}</h3>
            </div>
            {subtitle && <p className="mt-1.5 text-[12px] leading-snug text-mist-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={`min-w-0 flex-1 px-5 pb-5 pt-4 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Money({ v, ccy, compact, sign, dp, className = "" }: { v: number; ccy: string; compact?: boolean; sign?: boolean; dp?: number; className?: string }) {
  return <span className={`money num ${className}`}>{fmtMoney(v, ccy, { compact, sign, dp })}</span>;
}
export function Pct({ v, dp = 1, sign = true, tone = true, className = "" }: { v: number | null | undefined; dp?: number; sign?: boolean; tone?: boolean; className?: string }) {
  return <span className={`num ${tone && v != null ? toneClass(v) : ""} ${className}`}>{fmtPct(v, dp, sign)}</span>;
}
export function Arrow({ v, className = "" }: { v: number; className?: string }) {
  if (Math.abs(v) < 1e-9) return <span className={`text-mist-400 ${className}`}>•</span>;
  return (
    <svg viewBox="0 0 10 10" className={`inline-block h-2.5 w-2.5 ${v > 0 ? "text-up" : "rotate-180 text-down"} ${className}`} aria-hidden>
      <path d="M5 1.5 9 8H1z" fill="currentColor" />
    </svg>
  );
}
export function Delta({ v, pct, ccy, compact, className = "" }: { v: number; pct?: number; ccy: string; compact?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${toneClass(v)} ${className}`}>
      <Arrow v={v} />
      <span className="money num">{fmtMoney(v, ccy, { compact, sign: true })}</span>
      {pct !== undefined && <span className="num opacity-80">({fmtPct(pct, 2)})</span>}
    </span>
  );
}

export function Monogram({ symbol, color, size = 28, className = "" }: { symbol: string; color: string; size?: number; className?: string }) {
  const txt = symbol === "7203" ? "TM" : symbol === "NOVO-B" ? "NOVO" : symbol.length <= 4 ? symbol : symbol.replace(/[^A-Z]/g, "").slice(0, 3) || symbol.slice(0, 2);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-[8px] font-mono font-semibold tracking-tight text-white ${className}`}
      style={{
        width: size, height: size, fontSize: size * (txt.length >= 4 ? 0.27 : txt.length === 3 ? 0.3 : 0.36),
        background: `linear-gradient(145deg, ${hexA(color, 0.95)}, ${hexA(color, 0.45)})`,
        boxShadow: `0 0 0 1px ${hexA(color, 0.5)} inset, 0 6px 16px -8px ${hexA(color, 0.9)}`,
        textShadow: "0 1px 1px rgba(0,0,0,.35)",
      }}
    >
      {txt}
    </span>
  );
}
export function Flag({ code, className = "" }: { code: string; className?: string }) {
  return <span className={`inline-block leading-none ${className}`}>{flagOf(code)}</span>;
}

const PILL: Record<string, string> = {
  up: "bg-up/10 text-up ring-up/20",
  down: "bg-down/10 text-down ring-down/20",
  gold: "bg-gold-400/10 text-gold-300 ring-gold-400/25",
  mute: "bg-white/[0.04] text-mist-300 ring-white/10",
  sky: "bg-sky/10 text-sky ring-sky/20",
  violet: "bg-violet/10 text-violet ring-violet/20",
};
export function Pill({ children, tone = "mute", className = "" }: { children: ReactNode; tone?: keyof typeof PILL | string; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${PILL[tone] ?? PILL.mute} ${className}`}>{children}</span>;
}

export function Meter({ value, color = "var(--color-gold-400)", className = "", track = true, marker }: { value: number; color?: string; className?: string; track?: boolean; marker?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`relative h-1.5 w-full overflow-visible rounded-full ${track ? "bg-white/[0.06]" : ""} ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: color, boxShadow: `0 0 12px -2px ${color}` }} />
      {marker !== undefined && <div className="absolute -top-1 h-3.5 w-px bg-mist-100/80" style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />}
    </div>
  );
}

export function StatTile({ label, value, sub, className = "", children }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="label">{label}</div>
      <div className="mt-2 text-[22px] font-medium leading-none tracking-tight text-mist-100">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-mist-400">{sub}</div>}
      {children}
    </div>
  );
}

export function SectionHeader({ id, index, title, kicker, children }: { id?: string; index: string; title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-28 flex flex-wrap items-end justify-between gap-4 pb-1 pt-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="num text-[11px] text-gold-400">{index}</span>
          <span className="h-px w-8 bg-gradient-to-r from-gold-400/60 to-transparent" />
          {kicker && <span className="label">{kicker}</span>}
        </div>
        <h2 className="serif mt-2 text-[34px] leading-none text-mist-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`} style={{ background: color, boxShadow: `0 0 8px ${hexA(color.startsWith("#") ? color : "#ffffff", 0.6)}` }} />;
}

export function HoldingLink({ symbol, children, className = "" }: { symbol: string; children: ReactNode; className?: string }) {
  return (
    <Link href={`/portfolio/holdings/${encodeURIComponent(symbol)}`} className={`transition-colors hover:text-gold-300 ${className}`}>
      {children}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid h-full min-h-24 place-items-center text-[12px] text-mist-500">{children}</div>;
}
