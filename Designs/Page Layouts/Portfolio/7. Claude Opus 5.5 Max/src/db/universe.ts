import type { InstrumentMeta } from "./schema";

export type Def = {
  symbol: string;
  name: string;
  kind: "stock" | "etf" | "crypto" | "benchmark";
  assetClass: string;
  sector: string;
  industry: string;
  country: string;
  currency: string;
  exchange: string;
  wp?: string; // "YYYY-MM-DD:price ..." waypoints the simulated path is bridged through
  b: number; // loading on the market factor
  iv: number; // idiosyncratic annual vol
  sf?: number; // sector factor loading
  bf?: number; // rates (bond) factor loading
  fxl?: Record<string, number>; // FX factor loadings
  track?: [string, number]; // exact tracker of another series × ratio
  trYield?: number; // total-return drift for benchmarks (% p.a.)
  divSince?: string;
  divUntil?: string;
  meta: InstrumentMeta;
};

function meta(p: Partial<InstrumentMeta> & { color: string; description: string }): InstrumentMeta {
  return {
    account: "brokerage",
    divYield: 0,
    divFreq: 0,
    divMonths: [],
    exDay: 15,
    earnMonths: [],
    earnDay: 25,
    pe: null,
    beta: 1,
    mcap: null,
    ter: 0,
    style: {},
    ...p,
  };
}
const Q1 = [1, 4, 7, 10];
const Q2 = [2, 5, 8, 11];
const Q3 = [3, 6, 9, 12];

export const SPX_WP =
  "2020-12-31:3756 2021-03-04:3768 2021-09-02:4537 2021-10-04:4300 2021-12-31:4766 2022-01-27:4326 2022-03-29:4631 2022-06-16:3667 2022-08-16:4305 2022-10-12:3577 2022-12-30:3840 2023-02-02:4179 2023-03-13:3855 2023-07-31:4589 2023-10-27:4117 2023-12-29:4770 2024-03-28:5254 2024-04-19:4967 2024-07-16:5667 2024-08-05:5186 2024-12-31:5882 2025-02-19:6144 2025-04-08:4983 2025-06-30:6205 2025-10-31:6840 2025-12-31:6870 2026-03-31:6650 2026-06-30:7050 2026-12-31:7380 2027-12-31:7900";
export const AGG_WP =
  "2020-12-31:118.2 2021-12-31:114.1 2022-06-14:100.5 2022-10-21:93.2 2022-12-30:97 2023-04-05:100.5 2023-10-19:92 2023-12-29:99.2 2024-04-25:94.5 2024-09-16:101.5 2024-12-31:96.9 2025-01-13:95.2 2025-06-30:98.9 2025-12-31:100.2 2026-06-30:100.6 2026-12-31:101.5 2027-12-31:102.4";

export const FX_DEFS: { ccy: string; vol: number; wp: string }[] = [
  { ccy: "EUR", vol: 0.07, wp: "2020-12-31:1.2217 2021-06-01:1.2225 2021-12-31:1.137 2022-07-14:1.002 2022-09-27:0.9596 2022-12-30:1.0705 2023-07-14:1.1235 2023-10-03:1.0467 2023-12-29:1.1039 2024-04-16:1.0625 2024-09-30:1.1135 2024-12-31:1.0354 2025-02-03:1.0245 2025-04-21:1.151 2025-07-01:1.1805 2025-12-31:1.171 2026-03-31:1.155 2026-06-30:1.175 2026-12-31:1.182 2027-12-31:1.19" },
  { ccy: "GBP", vol: 0.08, wp: "2020-12-31:1.3673 2021-06-01:1.42 2021-12-31:1.3531 2022-09-26:1.0686 2022-12-30:1.2097 2023-07-14:1.3125 2023-10-03:1.2074 2023-12-29:1.2731 2024-09-30:1.3375 2024-12-31:1.2516 2025-01-13:1.215 2025-07-01:1.372 2025-12-31:1.345 2026-06-30:1.355 2026-12-31:1.36 2027-12-31:1.37" },
  { ccy: "JPY", vol: 0.1, wp: "2020-12-31:0.009685 2021-12-31:0.008688 2022-10-21:0.006623 2022-12-30:0.007626 2023-06-30:0.006925 2023-12-29:0.00709 2024-07-10:0.006184 2024-09-16:0.007117 2024-12-31:0.006361 2025-04-21:0.007087 2025-12-31:0.006452 2026-03-31:0.00665 2026-06-30:0.00672 2026-12-31:0.00685 2027-12-31:0.007" },
  { ccy: "CHF", vol: 0.07, wp: "2020-12-31:1.1302 2021-12-31:1.0965 2022-10-31:1.0 2022-12-30:1.0811 2023-12-29:1.1891 2024-12-31:1.1025 2025-04-21:1.227 2025-06-30:1.258 2025-12-31:1.256 2026-06-30:1.262 2026-12-31:1.268 2027-12-31:1.275" },
];

const VOO_SECTORS = { Technology: 0.33, Financials: 0.13, "Health Care": 0.095, "Consumer Disc.": 0.105, Communication: 0.1, Industrials: 0.085, Staples: 0.055, Energy: 0.03, Utilities: 0.025, "Real Estate": 0.02, Materials: 0.025 };

export const UNIVERSE: Def[] = [
  // ——— US equities ———
  { symbol: "AAPL", name: "Apple", kind: "stock", assetClass: "Equity", sector: "Technology", industry: "Consumer Electronics", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.1, iv: 0.18, sf: 0.8,
    wp: "2020-12-31:132.7 2021-03-08:116.4 2021-07-14:149.2 2021-12-31:177.6 2022-06-16:130.1 2022-08-17:174.6 2022-12-30:129.9 2023-07-31:196.4 2023-10-26:166.9 2023-12-29:192.5 2024-04-19:165 2024-07-15:234.4 2024-12-31:250.4 2025-04-08:172.4 2025-06-30:205.2 2025-10-31:270.4 2025-12-31:262 2026-03-31:248 2026-06-30:268 2026-12-31:282 2027-12-31:300",
    meta: meta({ color: "#b8c0c8", description: "Devices, services and silicon — the largest consumer-tech ecosystem.", divYield: 0.42, divFreq: 4, divMonths: Q2, exDay: 9, earnMonths: Q1, earnDay: 30, pe: 33, beta: 1.2, mcap: 3900, style: { LG: 1 } }) },
  { symbol: "MSFT", name: "Microsoft", kind: "stock", assetClass: "Equity", sector: "Technology", industry: "Software & Cloud", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.05, iv: 0.16, sf: 0.8,
    wp: "2020-12-31:222.4 2021-12-31:336.3 2022-06-13:242.3 2022-11-03:214.3 2022-12-30:239.8 2023-07-18:359.5 2023-12-29:376 2024-07-05:467.6 2024-12-31:421.5 2025-04-08:354.6 2025-07-31:533.5 2025-10-28:542 2025-12-31:488 2026-03-31:455 2026-06-30:505 2026-12-31:530 2027-12-31:570",
    meta: meta({ color: "#3aa0f0", description: "Azure cloud, Office/M365 and a front-row seat in enterprise AI.", divYield: 0.7, divFreq: 4, divMonths: Q2, exDay: 18, earnMonths: Q1, earnDay: 28, pe: 34, beta: 1.05, mcap: 3950, style: { LG: 1 } }) },
  { symbol: "NVDA", name: "NVIDIA", kind: "stock", assetClass: "Equity", sector: "Technology", industry: "Semiconductors", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.7, iv: 0.4, sf: 1,
    wp: "2020-12-31:13.05 2021-05-12:13.9 2021-11-29:33.4 2022-06-16:15.6 2022-10-13:11.2 2022-12-30:14.6 2023-05-31:37.8 2023-12-29:49.5 2024-03-07:92.7 2024-04-19:76.2 2024-06-18:135.6 2024-08-07:98.9 2024-12-31:134.3 2025-04-04:94.3 2025-07-31:177.9 2025-10-29:207 2025-12-31:186.5 2026-03-31:172 2026-06-30:198 2026-12-31:214 2027-12-31:240",
    meta: meta({ color: "#76b900", description: "Accelerated computing: GPUs, networking and the CUDA software moat.", divYield: 0.03, divFreq: 4, divMonths: Q3, exDay: 6, earnMonths: Q2, earnDay: 26, pe: 42, beta: 1.8, mcap: 5000, style: { LG: 1 } }) },
  { symbol: "AMZN", name: "Amazon", kind: "stock", assetClass: "Equity", sector: "Consumer Disc.", industry: "E-commerce & Cloud", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.25, iv: 0.24, sf: 0.8,
    wp: "2020-12-31:162.8 2021-07-08:186.6 2021-12-31:166.7 2022-06-16:103.7 2022-08-16:144.8 2022-12-28:81.8 2023-04-25:102.6 2023-12-29:151.9 2024-07-08:199.3 2024-08-07:162.8 2024-12-31:219.4 2025-04-08:170.7 2025-07-31:234 2025-11-03:254 2025-12-31:231 2026-03-31:214 2026-06-30:236 2026-12-31:252 2027-12-31:272",
    meta: meta({ color: "#ff9900", description: "Retail marketplace, logistics network, advertising and AWS.", earnMonths: Q1, earnDay: 30, pe: 33, beta: 1.3, mcap: 2450, style: { LG: 1 } }) },
  { symbol: "GOOGL", name: "Alphabet", kind: "stock", assetClass: "Equity", sector: "Communication", industry: "Search & Advertising", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.1, iv: 0.22, sf: 0.8, divSince: "2024-06-01",
    wp: "2020-12-31:87.6 2021-11-18:149.2 2022-06-16:106.2 2022-11-03:83.4 2022-12-30:88.2 2023-07-18:124.1 2023-10-26:122.3 2023-12-29:139.7 2024-07-10:191.2 2024-09-06:150.9 2024-12-31:189.3 2025-04-08:144.7 2025-06-30:176.2 2025-11-24:318 2025-12-31:312 2026-03-31:295 2026-06-30:318 2026-12-31:330 2027-12-31:350",
    meta: meta({ color: "#4f8ef7", description: "Search, YouTube, Android, Google Cloud and Gemini models.", divYield: 0.3, divFreq: 4, divMonths: Q3, exDay: 10, earnMonths: Q1, earnDay: 28, pe: 25, beta: 1.1, mcap: 3450, style: { LG: 1 } }) },
  { symbol: "JPM", name: "JPMorgan Chase", kind: "stock", assetClass: "Equity", sector: "Financials", industry: "Diversified Banks", country: "US", currency: "USD", exchange: "NYSE", b: 1.05, iv: 0.16, sf: 1,
    wp: "2020-12-31:127.1 2021-10-25:171.8 2022-07-14:109.2 2022-10-12:103.2 2022-12-30:134.1 2023-05-04:133.5 2023-12-29:170.1 2024-07-31:212.8 2024-12-31:239.7 2025-04-08:214.4 2025-06-30:289.9 2025-12-31:318 2026-03-31:302 2026-06-30:325 2026-12-31:338 2027-12-31:355",
    meta: meta({ color: "#c4a26a", description: "The largest US bank: consumer, commercial and investment banking.", divYield: 2.0, divFreq: 4, divMonths: Q1, exDay: 6, earnMonths: Q1, earnDay: 14, pe: 15, beta: 1.1, mcap: 860, style: { LV: 1 } }) },
  { symbol: "V", name: "Visa", kind: "stock", assetClass: "Equity", sector: "Financials", industry: "Payment Networks", country: "US", currency: "USD", exchange: "NYSE", b: 0.9, iv: 0.14, sf: 0.8,
    wp: "2020-12-31:218.7 2021-06-30:233.8 2021-12-31:216.7 2022-09-30:177.7 2022-12-30:207.8 2023-12-29:260.4 2024-12-31:316 2025-04-08:318 2025-06-30:355 2025-12-31:352 2026-03-31:338 2026-06-30:360 2026-12-31:372 2027-12-31:392",
    meta: meta({ color: "#5b7cff", description: "Global card network — a toll road on consumer spending.", divYield: 0.7, divFreq: 4, divMonths: Q2, exDay: 10, earnMonths: Q1, earnDay: 27, pe: 30, beta: 0.95, mcap: 690, style: { LG: 1 } }) },
  { symbol: "UNH", name: "UnitedHealth", kind: "stock", assetClass: "Equity", sector: "Health Care", industry: "Managed Care", country: "US", currency: "USD", exchange: "NYSE", b: 0.55, iv: 0.22, sf: 0.9,
    wp: "2020-12-31:350.7 2021-12-31:502.1 2022-10-31:555.2 2022-12-30:530.2 2023-06-30:480.6 2023-12-29:526.5 2024-04-12:445.6 2024-11-11:610 2024-12-31:505.9 2025-04-16:585 2025-05-15:290 2025-08-01:245 2025-12-31:330 2026-03-31:312 2026-06-30:338 2026-12-31:352 2027-12-31:370",
    meta: meta({ color: "#4a86d9", description: "Largest US health insurer plus the Optum services platform.", divYield: 2.0, divFreq: 4, divMonths: Q3, exDay: 14, earnMonths: Q1, earnDay: 15, pe: 17, beta: 0.6, mcap: 300, style: { LV: 1 } }) },
  { symbol: "LLY", name: "Eli Lilly", kind: "stock", assetClass: "Equity", sector: "Health Care", industry: "Pharmaceuticals", country: "US", currency: "USD", exchange: "NYSE", b: 0.5, iv: 0.26, sf: 0.9,
    wp: "2020-12-31:168.8 2021-12-31:276.2 2022-12-30:365.8 2023-06-30:469 2023-12-29:582.9 2024-08-30:960 2024-12-31:772 2025-08-07:640 2025-11-21:1060 2025-12-31:1030 2026-03-31:985 2026-06-30:1050 2026-12-31:1095 2027-12-31:1150",
    meta: meta({ color: "#e0453a", description: "Obesity and diabetes franchise (tirzepatide) with a deep pipeline.", divYield: 0.6, divFreq: 4, divMonths: Q2, exDay: 14, earnMonths: Q2, earnDay: 6, pe: 48, beta: 0.5, mcap: 950, style: { LG: 1 } }) },
  { symbol: "COST", name: "Costco", kind: "stock", assetClass: "Equity", sector: "Staples", industry: "Warehouse Retail", country: "US", currency: "USD", exchange: "NASDAQ", b: 0.75, iv: 0.16, sf: 0.7,
    wp: "2020-12-31:376.8 2021-12-31:567.7 2022-04-06:590 2022-12-30:456.5 2023-12-29:660 2024-12-31:916.3 2025-02-13:1076 2025-04-08:940 2025-12-31:905 2026-03-31:930 2026-06-30:955 2026-12-31:975 2027-12-31:1020",
    meta: meta({ color: "#e8505b", description: "Membership warehouse retail with best-in-class renewal rates.", divYield: 0.5, divFreq: 4, divMonths: Q2, exDay: 21, earnMonths: Q3, earnDay: 25, pe: 50, beta: 0.8, mcap: 400, style: { LG: 1 } }) },
  { symbol: "XOM", name: "Exxon Mobil", kind: "stock", assetClass: "Equity", sector: "Energy", industry: "Integrated Oil & Gas", country: "US", currency: "USD", exchange: "NYSE", b: 0.75, iv: 0.2, sf: 1.2,
    wp: "2020-12-31:41.2 2021-12-31:61.2 2022-06-08:104.6 2022-07-14:83.5 2022-11-08:114.6 2022-12-30:110.3 2023-12-29:99.98 2024-04-26:122.3 2024-12-31:107.6 2025-04-10:99.2 2025-06-30:107.8 2025-12-31:117 2026-03-31:112 2026-06-30:116 2026-12-31:120 2027-12-31:124",
    meta: meta({ color: "#f0506e", description: "Integrated energy major: upstream, refining and chemicals.", divYield: 3.4, divFreq: 4, divMonths: Q2, exDay: 13, earnMonths: Q1, earnDay: 31, pe: 15, beta: 0.85, mcap: 500, style: { LV: 1 } }) },
  { symbol: "NEE", name: "NextEra Energy", kind: "stock", assetClass: "Equity", sector: "Utilities", industry: "Renewable Utilities", country: "US", currency: "USD", exchange: "NYSE", b: 0.5, iv: 0.16, sf: 0.9, bf: 1.2,
    wp: "2020-12-31:77.2 2021-12-31:93.4 2022-12-30:83.6 2023-06-30:74.2 2023-10-05:51.6 2023-12-29:60.7 2024-10-21:85.6 2024-12-31:71.7 2025-04-08:63.1 2025-06-30:69.4 2025-12-31:84 2026-03-31:82 2026-06-30:86.5 2026-12-31:89 2027-12-31:93",
    meta: meta({ color: "#2fa6de", description: "Regulated Florida utility plus the world's largest wind & solar developer.", divYield: 2.9, divFreq: 4, divMonths: [3, 6, 8, 11], exDay: 28, earnMonths: Q1, earnDay: 24, pe: 23, beta: 0.6, mcap: 170, style: { LB: 1 } }) },
  { symbol: "META", name: "Meta Platforms", kind: "stock", assetClass: "Equity", sector: "Communication", industry: "Social Media", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.3, iv: 0.34, sf: 0.8, divSince: "2024-02-15",
    wp: "2020-12-31:273.2 2021-09-07:382.2 2021-12-31:336.4 2022-06-16:160.9 2022-11-03:88.9 2022-12-30:120.3 2023-12-29:354 2024-12-31:585.5 2025-04-08:510 2025-08-12:790 2025-12-31:665 2026-06-30:700 2026-12-31:725 2027-12-31:760",
    meta: meta({ color: "#2f7bff", description: "Facebook, Instagram, WhatsApp and Reality Labs.", divYield: 0.3, divFreq: 4, divMonths: Q3, exDay: 15, earnMonths: Q1, earnDay: 30, pe: 26, beta: 1.25, mcap: 1750, style: { LG: 1 } }) },
  { symbol: "INTC", name: "Intel", kind: "stock", assetClass: "Equity", sector: "Technology", industry: "Semiconductors", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.2, iv: 0.3, sf: 0.8, divUntil: "2024-08-31",
    wp: "2020-12-31:49.8 2021-04-19:67.3 2021-12-31:51.5 2022-12-30:26.4 2023-12-29:50.3 2024-03-21:43.3 2024-08-02:21.5 2024-12-31:20 2025-04-08:18.1 2025-08-22:25 2025-12-31:37 2026-06-30:38 2026-12-31:39 2027-12-31:41",
    meta: meta({ color: "#2b8fe0", description: "x86 CPUs and an ambitious (and costly) foundry turnaround.", divYield: 1.8, divFreq: 4, divMonths: Q2, exDay: 5, earnMonths: Q1, earnDay: 25, pe: null, beta: 1.2, mcap: 160, style: { LV: 1 } }) },
  // ——— International equities ———
  { symbol: "ASML", name: "ASML Holding", kind: "stock", assetClass: "Equity", sector: "Technology", industry: "Semiconductor Equipment", country: "NL", currency: "EUR", exchange: "Euronext", b: 1.3, iv: 0.26, sf: 1,
    wp: "2020-12-31:398 2021-11-18:770 2022-06-16:420 2022-10-14:400 2022-12-30:505 2023-07-18:660 2023-10-26:535 2023-12-29:682 2024-07-10:1000 2024-12-31:675 2025-04-08:550 2025-07-16:595 2025-12-31:910 2026-03-31:860 2026-06-30:935 2026-12-31:970 2027-12-31:1030",
    meta: meta({ color: "#4d7fe8", description: "Sole supplier of EUV lithography — the chokepoint of advanced chips.", divYield: 0.9, divFreq: 4, divMonths: [2, 4, 7, 10], exDay: 28, earnMonths: Q1, earnDay: 15, pe: 33, beta: 1.4, mcap: 390, style: { LG: 1 } }) },
  { symbol: "NOVO-B", name: "Novo Nordisk", kind: "stock", assetClass: "Equity", sector: "Health Care", industry: "Pharmaceuticals", country: "DK", currency: "DKK", exchange: "Copenhagen", b: 0.6, iv: 0.26, sf: 0.9,
    wp: "2020-12-31:213 2021-12-31:367 2022-12-30:470 2023-12-29:697 2024-06-25:1020 2024-12-31:625 2025-03-31:475 2025-07-29:320 2025-12-31:330 2026-03-31:305 2026-06-30:325 2026-12-31:345 2027-12-31:365",
    meta: meta({ color: "#3b7bd4", description: "Diabetes and obesity care (Ozempic, Wegovy); GLP-1 pioneer.", divYield: 2.4, divFreq: 2, divMonths: [3, 8], exDay: 20, earnMonths: Q2, earnDay: 5, pe: 14, beta: 0.7, mcap: 220, style: { LB: 1 } }) },
  { symbol: "MC", name: "LVMH", kind: "stock", assetClass: "Equity", sector: "Consumer Disc.", industry: "Luxury Goods", country: "FR", currency: "EUR", exchange: "Euronext", b: 1.0, iv: 0.22, sf: 0.9,
    wp: "2020-12-31:511 2021-12-31:727 2022-06-30:582 2022-12-30:680 2023-04-24:902 2023-12-29:734 2024-12-31:635 2025-04-08:470 2025-06-30:445 2025-12-31:615 2026-03-31:590 2026-06-30:620 2026-12-31:640 2027-12-31:670",
    meta: meta({ color: "#c7a878", description: "Luxury conglomerate: Louis Vuitton, Dior, Moët Hennessy, Sephora.", divYield: 2.0, divFreq: 2, divMonths: [4, 12], exDay: 24, earnMonths: Q1, earnDay: 24, pe: 25, beta: 1.1, mcap: 320, style: { LB: 1 } }) },
  { symbol: "7203", name: "Toyota Motor", kind: "stock", assetClass: "Equity", sector: "Consumer Disc.", industry: "Automobiles", country: "JP", currency: "JPY", exchange: "Tokyo", b: 0.7, iv: 0.22, sf: 0.8,
    wp: "2020-12-31:1590 2021-12-31:2105 2022-12-30:1810 2023-12-29:2590 2024-03-26:3800 2024-08-05:2500 2024-12-31:2745 2025-04-08:2450 2025-06-30:2490 2025-12-31:3050 2026-03-31:2920 2026-06-30:3080 2026-12-31:3180 2027-12-31:3300",
    meta: meta({ color: "#eb3b48", description: "World's largest automaker by volume; hybrid leadership.", divYield: 2.8, divFreq: 2, divMonths: [3, 9], exDay: 28, earnMonths: Q2, earnDay: 6, pe: 9, beta: 0.9, mcap: 280, style: { LV: 1 } }) },
  { symbol: "TSM", name: "Taiwan Semiconductor", kind: "stock", assetClass: "Equity", sector: "Technology", industry: "Semiconductors", country: "TW", currency: "USD", exchange: "NYSE (ADR)", b: 1.35, iv: 0.26, sf: 1,
    wp: "2020-12-31:109 2021-12-31:120.3 2022-10-24:59.4 2022-12-30:74.5 2023-12-29:104 2024-07-11:192.8 2024-12-31:197.5 2025-04-08:140.6 2025-06-30:226.5 2025-10-29:305 2025-12-31:290 2026-03-31:272 2026-06-30:302 2026-12-31:318 2027-12-31:340",
    meta: meta({ color: "#e0474a", description: "The world's foundry: manufactures most leading-edge chips.", divYield: 1.2, divFreq: 4, divMonths: Q3, exDay: 12, earnMonths: Q1, earnDay: 16, pe: 25, beta: 1.35, mcap: 1450, style: { LG: 1 } }) },
  { symbol: "NESN", name: "Nestlé", kind: "stock", assetClass: "Equity", sector: "Staples", industry: "Packaged Foods", country: "CH", currency: "CHF", exchange: "SIX Swiss", b: 0.45, iv: 0.14, sf: 0.8,
    wp: "2020-12-31:104.3 2021-12-31:127.5 2022-12-30:107.1 2023-12-29:97.5 2024-12-31:74.9 2025-03-10:90.4 2025-06-30:78.9 2025-12-31:81.5 2026-03-31:79 2026-06-30:82.5 2026-12-31:84.5 2027-12-31:87",
    meta: meta({ color: "#8fb0d0", description: "Global food & beverage: Nescafé, Purina, KitKat, Nespresso.", divYield: 3.6, divFreq: 1, divMonths: [4], exDay: 12, earnMonths: [2, 4, 7, 10], earnDay: 20, pe: 18, beta: 0.5, mcap: 240, style: { LB: 1 } }) },
  { symbol: "SHEL", name: "Shell", kind: "stock", assetClass: "Equity", sector: "Energy", industry: "Integrated Oil & Gas", country: "GB", currency: "GBP", exchange: "London", b: 0.7, iv: 0.2, sf: 1.1,
    wp: "2020-12-31:12.9 2021-12-31:16.2 2022-12-30:23.4 2023-06-30:23.6 2023-12-29:25.7 2024-04-10:28.8 2024-12-31:24.8 2025-04-08:23.1 2025-06-30:25.7 2025-12-31:27.4 2026-03-31:26.8 2026-06-30:27.9 2026-12-31:28.6 2027-12-31:29.5",
    meta: meta({ color: "#f7c948", description: "Integrated energy: LNG leader, upstream, trading and chemicals.", divYield: 4.0, divFreq: 4, divMonths: Q2, exDay: 15, earnMonths: [2, 5, 7, 10], earnDay: 30, pe: 12, beta: 0.8, mcap: 215, style: { LV: 1 } }) },
  // ——— Funds & alternatives ———
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "etf", assetClass: "Equity", sector: "Diversified", industry: "US Large Blend", country: "US", currency: "USD", exchange: "NYSE Arca", b: 1, iv: 0, track: ["SPX", 1 / 10.95],
    meta: meta({ color: "#c8414f", description: "500 of the largest US companies at a 0.03% fee — the core of the book.", divYield: 1.3, divFreq: 4, divMonths: Q3, exDay: 24, pe: 26, beta: 1, ter: 0.03,
      style: { LG: 0.38, LB: 0.3, LV: 0.22, MG: 0.04, MB: 0.04, MV: 0.02 }, sectors: VOO_SECTORS, countries: { US: 1 },
      top: [["NVDA", "NVIDIA", 7.6], ["MSFT", "Microsoft", 6.9], ["AAPL", "Apple", 6.6], ["AMZN", "Amazon", 4.0], ["GOOGL", "Alphabet", 4.0], ["META", "Meta Platforms", 2.9], ["AVGO", "Broadcom", 2.5], ["TSLA", "Tesla", 2.0], ["BRK.B", "Berkshire Hathaway", 1.6], ["JPM", "JPMorgan Chase", 1.5], ["LLY", "Eli Lilly", 1.2], ["V", "Visa", 1.0], ["ORCL", "Oracle", 0.9], ["XOM", "Exxon Mobil", 0.9], ["COST", "Costco", 0.8], ["NFLX", "Netflix", 0.8], ["UNH", "UnitedHealth", 0.6], ["NEE", "NextEra Energy", 0.3]] }) },
  { symbol: "QQQ", name: "Invesco QQQ Trust", kind: "etf", assetClass: "Equity", sector: "Diversified", industry: "US Large Growth", country: "US", currency: "USD", exchange: "NASDAQ", b: 1.15, iv: 0.05, sf: 0.3,
    wp: "2020-12-31:313.7 2021-11-19:403.9 2021-12-31:397.9 2022-06-16:269.4 2022-08-16:334.2 2022-12-28:261 2023-07-18:386 2023-10-26:344.4 2023-12-29:409.5 2024-07-10:502.9 2024-08-05:436 2024-12-31:511.2 2025-04-08:423.7 2025-06-30:551.6 2025-10-29:635 2025-12-31:622 2026-03-31:596 2026-06-30:645 2026-12-31:668 2027-12-31:715",
    meta: meta({ color: "#7b6cf0", account: "ira", description: "Nasdaq-100: the largest non-financial growth companies.", divYield: 0.6, divFreq: 4, divMonths: Q3, exDay: 20, pe: 34, beta: 1.15, ter: 0.2,
      style: { LG: 0.7, LB: 0.2, LV: 0.04, MG: 0.04, MB: 0.02 },
      sectors: { Technology: 0.52, Communication: 0.16, "Consumer Disc.": 0.135, "Health Care": 0.055, Staples: 0.05, Industrials: 0.045, Utilities: 0.015, Materials: 0.012, Energy: 0.005, Financials: 0.003 },
      countries: { US: 0.965, NL: 0.012, GB: 0.01, CN: 0.008, CA: 0.005 },
      top: [["NVDA", "NVIDIA", 9.2], ["MSFT", "Microsoft", 8.4], ["AAPL", "Apple", 8.0], ["GOOGL", "Alphabet", 5.6], ["AMZN", "Amazon", 5.4], ["AVGO", "Broadcom", 5.0], ["META", "Meta Platforms", 3.7], ["TSLA", "Tesla", 3.1], ["COST", "Costco", 2.5], ["NFLX", "Netflix", 2.4], ["AMD", "AMD", 1.5], ["PLTR", "Palantir", 1.4], ["CSCO", "Cisco", 1.4], ["ASML", "ASML Holding", 1.2]] }) },
  { symbol: "VXUS", name: "Vanguard Total Intl Stock ETF", kind: "etf", assetClass: "Equity", sector: "Diversified", industry: "Foreign Large Blend", country: "GL", currency: "USD", exchange: "NASDAQ", b: 0.8, iv: 0.07, fxl: { EUR: 0.45, JPY: 0.18, GBP: 0.12 },
    wp: "2020-12-31:58.9 2021-06-30:64.4 2021-12-31:61.9 2022-09-30:46.3 2022-12-30:53.3 2023-07-31:58.3 2023-10-27:52.3 2023-12-29:58.5 2024-09-30:65.2 2024-12-31:58.9 2025-04-08:57.1 2025-06-30:69.4 2025-12-31:73.5 2026-03-31:71.8 2026-06-30:76 2026-12-31:78.5 2027-12-31:82",
    meta: meta({ color: "#c8414f", account: "ira", description: "8,000+ stocks across developed and emerging markets outside the US.", divYield: 3.0, divFreq: 4, divMonths: Q3, exDay: 20, pe: 15, beta: 0.85, ter: 0.05,
      style: { LV: 0.25, LB: 0.28, LG: 0.2, MV: 0.07, MB: 0.07, MG: 0.05, SV: 0.03, SB: 0.03, SG: 0.02 },
      sectors: { Financials: 0.22, Industrials: 0.15, Technology: 0.14, "Consumer Disc.": 0.11, "Health Care": 0.085, Staples: 0.065, Materials: 0.07, Communication: 0.055, Energy: 0.05, Utilities: 0.03, "Real Estate": 0.025 },
      countries: { JP: 0.155, GB: 0.09, CN: 0.08, CA: 0.075, IN: 0.06, FR: 0.058, CH: 0.055, DE: 0.055, TW: 0.055, AU: 0.045, KR: 0.035, NL: 0.025, SE: 0.02, DK: 0.018, ES: 0.018, IT: 0.016, BR: 0.015, SA: 0.012, ZA: 0.01, OT: 0.103 },
      top: [["TSM", "Taiwan Semiconductor", 2.9], ["TCEHY", "Tencent", 1.1], ["ASML", "ASML Holding", 0.9], ["SAP", "SAP", 0.9], ["SSNLF", "Samsung Electronics", 0.9], ["NESN", "Nestlé", 0.7], ["NOVO-B", "Novo Nordisk", 0.6], ["7203", "Toyota Motor", 0.6], ["SHEL", "Shell", 0.6], ["AZN", "AstraZeneca", 0.6], ["ROG", "Roche", 0.6], ["MC", "LVMH", 0.5], ["HSBC", "HSBC", 0.5]] }) },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", kind: "etf", assetClass: "Fixed Income", sector: "Fixed Income", industry: "Intermediate Core Bond", country: "US", currency: "USD", exchange: "NASDAQ", b: 0.02, iv: 0.012, bf: 1,
    wp: "2020-12-31:88.2 2021-12-31:84.7 2022-06-14:74.9 2022-10-21:68.9 2022-12-30:72.3 2023-04-05:74.8 2023-10-19:68.3 2023-12-29:73.5 2024-04-25:70.4 2024-09-16:75.6 2024-12-31:72.1 2025-01-13:70.9 2025-06-30:73.6 2025-12-31:74.6 2026-06-30:75 2026-12-31:75.6 2027-12-31:76.2",
    meta: meta({ color: "#c8414f", account: "ira", description: "Investment-grade US bonds: Treasuries, MBS and corporates (duration ~6y).", divYield: 3.6, divFreq: 12, divMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], exDay: 1, beta: 0.05, ter: 0.03, countries: { US: 1 } }) },
  { symbol: "VNQ", name: "Vanguard Real Estate ETF", kind: "etf", assetClass: "Real Estate", sector: "Real Estate", industry: "US REITs", country: "US", currency: "USD", exchange: "NYSE Arca", b: 0.9, iv: 0.12, sf: 0.5, bf: 1.6,
    wp: "2020-12-31:84.9 2021-12-31:116 2022-06-16:88 2022-10-12:77.2 2022-12-30:82.4 2023-10-27:71.6 2023-12-29:88.4 2024-09-16:100.2 2024-12-31:89.1 2025-04-08:80.2 2025-06-30:89.1 2025-12-31:91.5 2026-03-31:90 2026-06-30:94 2026-12-31:96 2027-12-31:99",
    meta: meta({ color: "#c8414f", account: "ira", description: "US REITs: data centers, towers, industrial, residential and retail property.", divYield: 3.9, divFreq: 4, divMonths: Q3, exDay: 26, pe: 34, beta: 0.95, ter: 0.13,
      style: { LB: 0.35, MB: 0.35, MV: 0.1, SB: 0.12, SV: 0.08 }, sectors: { "Real Estate": 1 }, countries: { US: 1 },
      top: [["PLD", "Prologis", 6.5], ["AMT", "American Tower", 5.2], ["EQIX", "Equinix", 4.9], ["WELL", "Welltower", 4.5], ["SPG", "Simon Property", 3.2], ["O", "Realty Income", 2.9], ["PSA", "Public Storage", 2.8]] }) },
  { symbol: "GLD", name: "SPDR Gold Shares", kind: "etf", assetClass: "Commodities", sector: "Commodities", industry: "Physical Gold", country: "GL", currency: "USD", exchange: "NYSE Arca", b: 0.08, iv: 0.15,
    wp: "2020-12-31:178.4 2021-03-08:157.8 2021-12-31:170.9 2022-03-08:192.7 2022-09-28:151.2 2022-12-30:169.6 2023-05-03:190.7 2023-10-05:169.7 2023-12-29:191.2 2024-04-12:219.4 2024-10-30:257 2024-12-31:242.1 2025-04-21:317.1 2025-06-30:304.8 2025-10-20:399 2025-12-31:396 2026-03-31:405 2026-06-30:418 2026-12-31:428 2027-12-31:440",
    meta: meta({ color: "#d9b44a", description: "Physically backed gold — the portfolio's crisis hedge.", beta: 0.1, ter: 0.4, countries: { GL: 1 } }) },
  { symbol: "BTC", name: "Bitcoin", kind: "crypto", assetClass: "Crypto", sector: "Crypto", industry: "Digital Asset", country: "GL", currency: "USD", exchange: "Coinbase", b: 1.6, iv: 0.58,
    wp: "2020-12-31:29000 2021-01-08:40700 2021-01-22:30800 2021-04-14:63500 2021-07-20:29800 2021-11-10:67500 2022-01-24:33000 2022-03-28:47300 2022-06-18:19000 2022-11-21:15800 2022-12-30:16550 2023-03-10:20100 2023-07-13:31400 2023-09-11:25100 2023-12-29:42100 2024-03-14:72500 2024-08-05:54000 2024-12-31:93500 2025-01-20:108000 2025-04-08:76300 2025-10-06:124700 2025-11-21:84500 2025-12-31:88000 2026-03-31:83000 2026-06-30:96000 2026-12-31:104000 2027-12-31:115000",
    meta: meta({ color: "#f7931a", account: "crypto", description: "Fixed-supply digital asset; a small, deliberately sized satellite.", beta: 1.6, countries: { GL: 1 } }) },
  // ——— Benchmarks (total return) ———
  { symbol: "SPX", name: "S&P 500 TR", kind: "benchmark", assetClass: "Benchmark", sector: "Benchmark", industry: "US Large Cap", country: "US", currency: "USD", exchange: "Index", b: 1, iv: 0, trYield: 1.35, wp: SPX_WP,
    meta: meta({ color: "#9aa3b2", description: "S&P 500 total return (dividends reinvested)." }) },
  { symbol: "ACWI", name: "MSCI ACWI TR", kind: "benchmark", assetClass: "Benchmark", sector: "Benchmark", industry: "Global Equity", country: "GL", currency: "USD", exchange: "Index", b: 0.95, iv: 0.05, trYield: 1.9, fxl: { EUR: 0.25, JPY: 0.08, GBP: 0.05 },
    wp: "2020-12-31:90.9 2021-12-31:106.5 2022-06-16:85 2022-10-12:78 2022-12-30:85.3 2023-07-31:101 2023-10-27:90.5 2023-12-29:104.3 2024-07-16:117 2024-08-05:108 2024-12-31:116.5 2025-02-19:122 2025-04-08:102 2025-06-30:128.5 2025-10-31:140 2025-12-31:141 2026-03-31:137 2026-06-30:145 2026-12-31:151 2027-12-31:160",
    meta: meta({ color: "#7cc4ff", description: "MSCI All Country World total return — the global equity opportunity set." }) },
  { symbol: "AGG", name: "US Aggregate Bond TR", kind: "benchmark", assetClass: "Benchmark", sector: "Benchmark", industry: "US Core Bonds", country: "US", currency: "USD", exchange: "Index", b: 0, iv: 0, trYield: 3.4, wp: AGG_WP,
    meta: meta({ color: "#6fcfe8", description: "Bloomberg US Aggregate total return." }) },
];

export const NOTE_SEEDS: { symbol: string; thesis: string; conviction: number; targetPrice: number; reviewDate: string }[] = [
  { symbol: "NVDA", conviction: 4, targetPrice: 240, reviewDate: "2026-11-20", thesis: "AI compute leader with a software moat (CUDA + networking). Hold the core, trim above ~10% weight. Watch hyperscaler capex guides and gross margin for the first crack." },
  { symbol: "NOVO-B", conviction: 2, targetPrice: 420, reviewDate: "2026-11-05", thesis: "GLP-1 duopoly with Lilly, but share is slipping and US pricing is under pressure. Re-underwrite after Q3 — exit if volume share keeps falling for another two quarters." },
  { symbol: "UNH", conviction: 3, targetPrice: 400, reviewDate: "2026-10-15", thesis: "Managed-care leader after a brutal 2025 reset. Thesis = medical-loss-ratio normalisation in 2026–27. Averaged down once; no further adds until margins inflect." },
  { symbol: "LLY", conviction: 5, targetPrice: 1200, reviewDate: "2027-01-15", thesis: "Best-in-class incretin franchise; oral GLP-1 is the next leg. Let it run, but no new money while weight is above 6%." },
  { symbol: "ASML", conviction: 4, targetPrice: 1100, reviewDate: "2026-10-15", thesis: "Monopoly in EUV lithography. Orders are cyclical, demand is secular. Add on semiconductor drawdowns deeper than 25%." },
];
