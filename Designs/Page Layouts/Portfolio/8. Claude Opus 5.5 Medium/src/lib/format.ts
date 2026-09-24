export const CCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF " };
export const DISPLAY_CCYS = ["USD", "EUR", "GBP", "CHF", "JPY"];

export const BUCKET_COLORS: Record<string, string> = {
  "US Equity": "#8f7cff",
  "Intl Equity": "#3fd0ff",
  "Fixed Income": "#ffb547",
  Alternatives: "#ff7ad9",
  Cash: "#6b7385",
};

export const SECTOR_COLORS: Record<string, string> = {
  Technology: "#8f7cff",
  Financials: "#3fd0ff",
  "Health Care": "#2fe39b",
  "Consumer Disc.": "#ff7ad9",
  Communication: "#b18cff",
  Industrials: "#7aa2ff",
  "Consumer Staples": "#ffd166",
  Energy: "#ff8a4c",
  Materials: "#c3a37a",
  Utilities: "#5fd3c7",
  "Real Estate": "#e08bb0",
  Diversified: "#5b6cff",
  Bonds: "#ffb547",
  Commodities: "#f5d547",
  "Digital Assets": "#ff9f1c",
};

export const CCY_COLORS: Record<string, string> = {
  USD: "#8f7cff", EUR: "#3fd0ff", GBP: "#2fe39b", JPY: "#ff7ad9", CHF: "#ffb547", CNY: "#ff5a78", INR: "#ff8a4c",
  TWD: "#b18cff", CAD: "#5fd3c7", AUD: "#7aa2ff", KRW: "#e08bb0", HKD: "#c3a37a", Other: "#4b5263",
};

export function pct(x: number | null | undefined, digits = 1, sign = false) {
  if (x === null || x === undefined || !isFinite(x)) return "—";
  const s = (x * 100).toFixed(digits);
  return (sign && x > 0 ? "+" : "") + s + "%";
}

export function num(x: number, digits = 2) {
  return x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function compact(x: number, digits = 1) {
  const a = Math.abs(x);
  const s = x < 0 ? "-" : "";
  if (a >= 1e9) return s + (a / 1e9).toFixed(digits) + "B";
  if (a >= 1e6) return s + (a / 1e6).toFixed(digits) + "M";
  if (a >= 1e3) return s + (a / 1e3).toFixed(digits) + "K";
  return s + a.toFixed(0);
}

export function fmtMoney(v: number, ccy: string, opts: { compact?: boolean; sign?: boolean; digits?: number } = {}) {
  const sym = CCY_SYMBOL[ccy] ?? ccy + " ";
  const neg = v < 0;
  const a = Math.abs(v);
  const digits = opts.digits ?? (ccy === "JPY" ? 0 : a >= 1000 ? 0 : 2);
  const body = opts.compact ? compact(a, a >= 1e6 ? 2 : 1) : a.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return (neg ? "−" : opts.sign ? "+" : "") + sym + body;
}

export function fmtLocal(v: number, ccy: string, digits = 2) {
  return fmtMoney(v, ccy, { digits: ccy === "JPY" ? 0 : digits });
}

export const gradeLetter = (s: number) => (s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "E");

export const tone = (x: number) => (x > 0 ? "text-pos" : x < 0 ? "text-neg" : "text-muted");

export function shortDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
export function longDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function timeAgo(iso: string) {
  const h = (Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 3600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
