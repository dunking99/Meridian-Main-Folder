import { CCY_META, type Ccy } from "./reference";

const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, opts: Intl.NumberFormatOptions) {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-US", opts);
    cache.set(key, f);
  }
  return f;
}
const MINUS = "−";

export function fmtMoney(v: number, ccy: Ccy | string, o: { compact?: boolean; sign?: boolean; dp?: number } = {}) {
  if (!Number.isFinite(v)) return "—";
  const meta = CCY_META[ccy as Ccy];
  const abs = Math.abs(v);
  let s: string;
  if (o.compact && abs >= 10_000) {
    s = nf(`c-${ccy}-${abs >= 1e6 ? 2 : 1}`, { style: "currency", currency: ccy, notation: "compact", maximumFractionDigits: abs >= 1e6 ? 2 : 1 }).format(abs);
  } else {
    const dp = o.dp ?? (o.compact && abs >= 1000 ? 0 : meta?.dp ?? 2);
    s = nf(`m-${ccy}-${dp}`, { style: "currency", currency: ccy, minimumFractionDigits: dp, maximumFractionDigits: dp }).format(abs);
  }
  const sign = v < 0 && abs >= 0.005 ? MINUS : o.sign && v > 0 ? "+" : "";
  return sign + s;
}

export function fmtPct(v: number | null | undefined, dp = 1, sign = true) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const x = v * 100;
  const s = Math.abs(x).toFixed(dp);
  const zero = Number(s) === 0;
  return `${!zero && x < 0 ? MINUS : sign && !zero && x > 0 ? "+" : ""}${s}%`;
}
export function fmtNum(v: number, dp = 2) {
  if (!Number.isFinite(v)) return "—";
  return (v < 0 ? MINUS : "") + nf(`n-${dp}`, { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(Math.abs(v));
}
export function fmtQty(q: number) {
  return Number.isInteger(q) ? nf("q0", { maximumFractionDigits: 0 }).format(q) : nf("q4", { maximumFractionDigits: 4 }).format(q);
}
export function fmtPrice(p: number, ccy: string) {
  const dp = ccy === "JPY" ? 0 : Math.abs(p) < 1 ? 4 : 2;
  const sym: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF ", DKK: "kr " };
  return `${p < 0 ? MINUS : ""}${sym[ccy] ?? ccy + " "}${nf(`p-${dp}`, { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(Math.abs(p))}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function fmtDate(d: string, style: "short" | "medium" | "month" | "dow" | "year" | "mshort" = "medium") {
  if (!d) return "—";
  const y = d.slice(0, 4);
  const m = MONTHS[Number(d.slice(5, 7)) - 1];
  const day = Number(d.slice(8, 10));
  switch (style) {
    case "short": return `${m} ${day}`;
    case "month": return `${m} ${y}`;
    case "mshort": return `${m} ’${y.slice(2)}`;
    case "year": return y;
    case "dow": return `${DOWS[new Date(d.slice(0, 10) + "T00:00:00Z").getUTCDay()]}, ${m} ${day}`;
    default: return `${m} ${day}, ${y}`;
  }
}
export const MONTH_LABELS = MONTHS;

export function relTime(hours: number) {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const d = Math.round(hours / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export function toneClass(v: number) {
  return v > 0.0000001 ? "text-up" : v < -0.0000001 ? "text-down" : "text-mist-300";
}

/** Diverging heat colour for returns (green up / red down) on a dark canvas. */
export function heat(v: number | null | undefined, max: number, strength = 0.85) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "rgba(255,255,255,0.03)";
  const t = Math.min(1, Math.abs(v) / max);
  const a = 0.07 + strength * Math.pow(t, 0.75);
  return v >= 0 ? `rgba(62,224,161,${a.toFixed(3)})` : `rgba(255,107,107,${a.toFixed(3)})`;
}
/** Solid treemap tile colour: interpolates slate → green/red. */
export function tile(v: number, max: number) {
  const t = Math.min(1, Math.abs(v) / max);
  const base = [30, 35, 46];
  const to = v >= 0 ? [22, 150, 104] : [196, 64, 72];
  const e = Math.pow(t, 0.7);
  const c = base.map((b, i) => Math.round(b + (to[i] - b) * e));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
