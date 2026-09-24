import type { Ccy } from "./types";

export const FX_RATES: Record<Ccy, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 1.29,
  AUD: 1.52,
  JPY: 157.2,
  CHF: 0.885,
  CAD: 1.36,
};

export const CCYS: Ccy[] = ["USD", "EUR", "GBP", "AUD", "JPY", "CHF", "CAD"];

export function convert(usd: number, ccy: Ccy): number {
  return usd / FX_RATES[ccy];
}

export function fmtMoney(usd: number, ccy: Ccy = "USD", compact = false): string {
  const v = convert(usd, ccy);
  const abs = Math.abs(v);
  if (compact) {
    const sym = ccy === "USD" ? "$" : ccy + " ";
    if (abs >= 1e9) return `${sym}${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sym}${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e4) return `${sym}${(v / 1e3).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: ccy === "JPY" || abs >= 10000 ? 0 : 2,
  }).format(v);
}

export function fmtPct(x: number, digits = 1, signed = true): string {
  const s = signed && x > 0 ? "+" : "";
  return `${s}${(x * 100).toFixed(digits)}%`;
}

export function fmtNum(x: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(x);
}

export function timeAgo(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const d = Math.round(hours / 24);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

/* ---------- palette ---------- */
export const CLASS_COLORS: Record<string, string> = {
  stock: "#D9A648",
  etf: "#64B6E8",
  "bond-fund": "#8FBF9F",
  commodity: "#C77E54",
  cash: "#7B8794",
};

export const CLASS_LABELS: Record<string, string> = {
  stock: "Single stock",
  etf: "Index ETF",
  "bond-fund": "Bond fund",
  commodity: "Commodity",
  cash: "Cash",
};

export const HOLDING_PALETTE = [
  "#D9A648", "#64B6E8", "#8FBF9F", "#C77E54", "#7C9CD6", "#C98BA8",
  "#9BB56A", "#5FB8AE", "#B7A26C", "#8E7CC3", "#D68A6A", "#6AC4C0",
  "#A9B665", "#C4785A", "#7DA4A0", "#B98C9E",
];

export function holdingColor(i: number): string {
  return HOLDING_PALETTE[i % HOLDING_PALETTE.length];
}

/* ---------- color scales ---------- */
function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((x, i) => Math.round(x + (B[i] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const INK = "#151B21";
const GREEN = "#2FBF87";
const RED = "#E0564E";

/** monthly-return heatmap color, range clamped to ±5% */
export function heatColor(r: number): string {
  const t = Math.min(1, Math.abs(r) / 0.05);
  return r >= 0 ? mix(INK, GREEN, 0.12 + 0.88 * t) : mix(INK, RED, 0.12 + 0.88 * t);
}

export function corrColor(c: number): string {
  const t = Math.min(1, Math.abs(c));
  return c >= 0 ? mix(INK, "#2FBF87", 0.08 + 0.92 * t) : mix(INK, "#E0564E", 0.08 + 0.92 * t);
}

export function deltaColor(x: number): string {
  return x >= 0 ? "var(--up)" : "var(--down)";
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthShort(i: number): string {
  return MONTHS[i];
}
