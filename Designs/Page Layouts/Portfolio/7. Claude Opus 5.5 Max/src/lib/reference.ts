// Client-safe reference data shared by the seed, the analytics engine and the UI.

export const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY"] as const;
export type Ccy = (typeof CURRENCIES)[number];
export const CCY_META: Record<Ccy, { symbol: string; name: string; dp: number; flag: string }> = {
  USD: { symbol: "$", name: "US Dollar", dp: 2, flag: "US" },
  EUR: { symbol: "€", name: "Euro", dp: 2, flag: "EU" },
  GBP: { symbol: "£", name: "Pound Sterling", dp: 2, flag: "GB" },
  CHF: { symbol: "CHF", name: "Swiss Franc", dp: 2, flag: "CH" },
  JPY: { symbol: "¥", name: "Japanese Yen", dp: 0, flag: "JP" },
};
export function isCcy(v: unknown): v is Ccy {
  return typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);
}

export const SECTOR_COLORS: Record<string, string> = {
  Technology: "#8b9dff",
  Communication: "#c08bff",
  "Consumer Disc.": "#ff9b73",
  Staples: "#f2cc6b",
  "Health Care": "#4fd8c4",
  Financials: "#52b8ff",
  Industrials: "#9fb0c8",
  Energy: "#ff7eb6",
  Materials: "#b5e36b",
  Utilities: "#7ee8a0",
  "Real Estate": "#d9a06b",
  Diversified: "#d4dbe6",
  "Fixed Income": "#6fcfe8",
  Commodities: "#e9d27c",
  Crypto: "#f7931a",
  Cash: "#7a8394",
};
export const EQUITY_SECTORS = [
  "Technology",
  "Financials",
  "Health Care",
  "Consumer Disc.",
  "Communication",
  "Industrials",
  "Staples",
  "Energy",
  "Materials",
  "Utilities",
  "Real Estate",
];

export const SLEEVES = [
  "US Equity",
  "Intl Equity",
  "Fixed Income",
  "Real Estate",
  "Commodities",
  "Crypto",
  "Cash",
] as const;
export type Sleeve = (typeof SLEEVES)[number];
export const SLEEVE_COLORS: Record<Sleeve, string> = {
  "US Equity": "#f0b35b",
  "Intl Equity": "#8b9dff",
  "Fixed Income": "#5fd0e6",
  "Real Estate": "#c08bff",
  Commodities: "#b5e36b",
  Crypto: "#ff9b73",
  Cash: "#7a8394",
};
export const DEFAULT_TARGETS: Record<Sleeve, number> = {
  "US Equity": 0.5,
  "Intl Equity": 0.22,
  "Fixed Income": 0.14,
  "Real Estate": 0.04,
  Commodities: 0.04,
  Crypto: 0.02,
  Cash: 0.04,
};

export type Region = "North America" | "Europe" | "Asia Pacific" | "Emerging" | "Global";
export const REGION_COLORS: Record<Region, string> = {
  "North America": "#f0b35b",
  Europe: "#8b9dff",
  "Asia Pacific": "#4fd8c4",
  Emerging: "#ff9b73",
  Global: "#7a8394",
};
export const COUNTRIES: Record<string, { name: string; region: Region; ccy: string }> = {
  US: { name: "United States", region: "North America", ccy: "USD" },
  CA: { name: "Canada", region: "North America", ccy: "CAD" },
  GB: { name: "United Kingdom", region: "Europe", ccy: "GBP" },
  FR: { name: "France", region: "Europe", ccy: "EUR" },
  DE: { name: "Germany", region: "Europe", ccy: "EUR" },
  NL: { name: "Netherlands", region: "Europe", ccy: "EUR" },
  ES: { name: "Spain", region: "Europe", ccy: "EUR" },
  IT: { name: "Italy", region: "Europe", ccy: "EUR" },
  DK: { name: "Denmark", region: "Europe", ccy: "DKK" },
  CH: { name: "Switzerland", region: "Europe", ccy: "CHF" },
  SE: { name: "Sweden", region: "Europe", ccy: "SEK" },
  JP: { name: "Japan", region: "Asia Pacific", ccy: "JPY" },
  AU: { name: "Australia", region: "Asia Pacific", ccy: "AUD" },
  TW: { name: "Taiwan", region: "Emerging", ccy: "TWD" },
  CN: { name: "China", region: "Emerging", ccy: "CNY" },
  KR: { name: "South Korea", region: "Emerging", ccy: "KRW" },
  IN: { name: "India", region: "Emerging", ccy: "INR" },
  BR: { name: "Brazil", region: "Emerging", ccy: "BRL" },
  SA: { name: "Saudi Arabia", region: "Emerging", ccy: "SAR" },
  ZA: { name: "South Africa", region: "Emerging", ccy: "ZAR" },
  OT: { name: "Other markets", region: "Global", ccy: "Other" },
  GL: { name: "Global / stateless", region: "Global", ccy: "USD" },
};
export function countryName(code: string) {
  return COUNTRIES[code]?.name ?? code;
}
export function flagOf(code: string): string {
  if (!code || code === "GL" || code === "OT") return "🌐";
  if (code === "EU") return "🇪🇺";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** MSCI ACWI reference weights (approximate) used for exposure comparisons. */
export const ACWI_REF = {
  countries: {
    US: 0.64, JP: 0.048, GB: 0.032, CA: 0.029, CN: 0.028, FR: 0.024, CH: 0.022, DE: 0.022, TW: 0.02,
    IN: 0.019, AU: 0.016, KR: 0.011, NL: 0.011, SE: 0.008, ES: 0.007, DK: 0.006, IT: 0.006, BR: 0.005,
    SA: 0.004, ZA: 0.003, OT: 0.039,
  } as Record<string, number>,
  sectors: {
    Technology: 0.259, Financials: 0.172, Industrials: 0.108, "Consumer Disc.": 0.105, "Health Care": 0.095,
    Communication: 0.085, Staples: 0.058, Energy: 0.036, Materials: 0.035, Utilities: 0.026, "Real Estate": 0.021,
  } as Record<string, number>,
  style: { LG: 0.36, LB: 0.3, LV: 0.2, MG: 0.05, MB: 0.05, MV: 0.03, SG: 0.004, SB: 0.003, SV: 0.003 } as Record<string, number>,
  divYield: 1.8,
  pe: 20.5,
  beta: 1,
  top10: 0.2,
};

export const ACCOUNTS: Record<string, { label: string; short: string }> = {
  brokerage: { label: "Taxable Brokerage", short: "Brokerage" },
  ira: { label: "Roth IRA", short: "Roth IRA" },
  crypto: { label: "Crypto Wallet", short: "Crypto" },
};

/** Approximate 3M T-bill rate (annual %) — risk-free rate and cash-sweep yield driver. */
const RATE_STEPS: [string, number][] = [
  ["2022-03-17", 0.05], ["2022-05-05", 0.4], ["2022-06-16", 0.9], ["2022-07-28", 1.6], ["2022-09-22", 2.4],
  ["2022-11-03", 3.1], ["2022-12-15", 3.9], ["2023-02-02", 4.3], ["2023-03-23", 4.6], ["2023-05-04", 4.8],
  ["2023-07-27", 5.1], ["2024-09-19", 5.3], ["2024-11-08", 4.8], ["2024-12-19", 4.55], ["2025-09-18", 4.3],
  ["2025-10-30", 4.05], ["2025-12-11", 3.8], ["2026-03-19", 3.6], ["2026-09-17", 3.55],
];
export function rateOn(date: string): number {
  for (const [until, r] of RATE_STEPS) if (date < until) return r;
  return 3.35;
}
export const CASH_SPREAD = 0.35;

export const EVENT_META: Record<string, { label: string; color: string }> = {
  earnings: { label: "Earnings", color: "#8b9dff" },
  ex_div: { label: "Ex-dividend", color: "#f0b35b" },
  dividend: { label: "Dividend paid", color: "#3ee0a1" },
  macro: { label: "Macro", color: "#c08bff" },
  review: { label: "Thesis review", color: "#ff9b73" },
};
