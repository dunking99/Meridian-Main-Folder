import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  holdings,
  priceHistory,
  portfolioMeta,
  transactions,
  events,
  news,
  fxRates,
  etfConstituents,
} from "./schema";

// ---------- deterministic RNG ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const N = 540; // days of history
const DAY = 86400000;
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  return new Date(TODAY.getTime() - n * DAY);
}

type Spec = {
  symbol: string;
  name: string;
  assetClass: string;
  sector: string;
  region: string;
  country: string;
  currency: string;
  quantity: number;
  price: number; // current price target (USD)
  costFactor: number; // avgCost = price * costFactor
  startFactor: number; // start of walk = price * startFactor
  vol: number; // daily vol
  beta: number;
  dividendYield: number;
  marketCap: number; // billions
  pe: number | null;
  accent: string;
};

const SPECS: Spec[] = [
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "Equity", sector: "Technology", region: "North America", country: "United States", currency: "USD", quantity: 640, price: 232, costFactor: 0.72, startFactor: 0.78, vol: 0.014, beta: 1.12, dividendYield: 0.44, marketCap: 3520, pe: 34, accent: "#7dd3fc" },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "Equity", sector: "Technology", region: "North America", country: "United States", currency: "USD", quantity: 250, price: 438, costFactor: 0.81, startFactor: 0.83, vol: 0.013, beta: 0.98, dividendYield: 0.72, marketCap: 3260, pe: 36, accent: "#93c5fd" },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "Equity", sector: "Technology", region: "North America", country: "United States", currency: "USD", quantity: 900, price: 138, costFactor: 0.35, startFactor: 0.42, vol: 0.026, beta: 1.68, dividendYield: 0.03, marketCap: 3390, pe: 55, accent: "#86efac" },
  { symbol: "AMZN", name: "Amazon.com Inc.", assetClass: "Equity", sector: "Consumer Discretionary", region: "North America", country: "United States", currency: "USD", quantity: 380, price: 214, costFactor: 0.79, startFactor: 0.8, vol: 0.017, beta: 1.22, dividendYield: 0, marketCap: 2230, pe: 42, accent: "#fdba74" },
  { symbol: "GOOGL", name: "Alphabet Inc.", assetClass: "Equity", sector: "Communication Services", region: "North America", country: "United States", currency: "USD", quantity: 420, price: 178, costFactor: 0.88, startFactor: 0.86, vol: 0.016, beta: 1.05, dividendYield: 0.46, marketCap: 2180, pe: 24, accent: "#f9a8d4" },
  { symbol: "META", name: "Meta Platforms Inc.", assetClass: "Equity", sector: "Communication Services", region: "North America", country: "United States", currency: "USD", quantity: 120, price: 585, costFactor: 0.55, startFactor: 0.62, vol: 0.02, beta: 1.28, dividendYield: 0.35, marketCap: 1480, pe: 28, accent: "#c4b5fd" },
  { symbol: "TSLA", name: "Tesla Inc.", assetClass: "Equity", sector: "Consumer Discretionary", region: "North America", country: "United States", currency: "USD", quantity: 150, price: 340, costFactor: 1.18, startFactor: 0.72, vol: 0.03, beta: 1.9, dividendYield: 0, marketCap: 1080, pe: 92, accent: "#fca5a5" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", assetClass: "Equity", sector: "Financials", region: "North America", country: "United States", currency: "USD", quantity: 260, price: 245, costFactor: 0.7, startFactor: 0.74, vol: 0.014, beta: 1.06, dividendYield: 2.1, marketCap: 690, pe: 13, accent: "#fcd34d" },
  { symbol: "V", name: "Visa Inc.", assetClass: "Equity", sector: "Financials", region: "North America", country: "United States", currency: "USD", quantity: 150, price: 305, costFactor: 0.83, startFactor: 0.85, vol: 0.012, beta: 0.94, dividendYield: 0.74, marketCap: 600, pe: 30, accent: "#a5b4fc" },
  { symbol: "UNH", name: "UnitedHealth Group", assetClass: "Equity", sector: "Health Care", region: "North America", country: "United States", currency: "USD", quantity: 70, price: 560, costFactor: 1.12, startFactor: 0.98, vol: 0.016, beta: 0.72, dividendYield: 1.5, marketCap: 515, pe: 27, accent: "#67e8f9" },
  { symbol: "ASML", name: "ASML Holding N.V.", assetClass: "Equity", sector: "Technology", region: "Europe", country: "Netherlands", currency: "EUR", quantity: 55, price: 720, costFactor: 0.94, startFactor: 0.96, vol: 0.02, beta: 1.31, dividendYield: 0.9, marketCap: 285, pe: 33, accent: "#5eead4" },
  { symbol: "MC", name: "LVMH", assetClass: "Equity", sector: "Consumer Discretionary", region: "Europe", country: "France", currency: "EUR", quantity: 45, price: 680, costFactor: 1.22, startFactor: 1.05, vol: 0.015, beta: 0.99, dividendYield: 1.9, marketCap: 340, pe: 22, accent: "#f0abfc" },
  { symbol: "NESN", name: "Nestlé S.A.", assetClass: "Equity", sector: "Consumer Staples", region: "Europe", country: "Switzerland", currency: "CHF", quantity: 300, price: 92, costFactor: 1.08, startFactor: 1.02, vol: 0.009, beta: 0.55, dividendYield: 3.2, marketCap: 240, pe: 19, accent: "#bef264" },
  { symbol: "TSM", name: "Taiwan Semiconductor", assetClass: "Equity", sector: "Technology", region: "Asia Pacific", country: "Taiwan", currency: "USD", quantity: 300, price: 205, costFactor: 0.62, startFactor: 0.68, vol: 0.021, beta: 1.24, dividendYield: 1.1, marketCap: 1010, pe: 29, accent: "#fca5a5" },
  { symbol: "TM", name: "Toyota Motor Corp.", assetClass: "Equity", sector: "Consumer Discretionary", region: "Asia Pacific", country: "Japan", currency: "JPY", quantity: 120, price: 205, costFactor: 0.9, startFactor: 0.92, vol: 0.013, beta: 0.68, dividendYield: 2.6, marketCap: 280, pe: 9, accent: "#fda4af" },
  { symbol: "VTI", name: "Vanguard Total US Market", assetClass: "ETF", sector: "Diversified", region: "North America", country: "United States", currency: "USD", quantity: 200, price: 292, costFactor: 0.74, startFactor: 0.79, vol: 0.011, beta: 1.0, dividendYield: 1.3, marketCap: 0, pe: null, accent: "#60a5fa" },
  { symbol: "VWO", name: "Vanguard Emerging Markets", assetClass: "ETF", sector: "Diversified", region: "Emerging Markets", country: "Global", currency: "USD", quantity: 1200, price: 46, costFactor: 0.97, startFactor: 0.99, vol: 0.013, beta: 0.85, dividendYield: 3.0, marketCap: 0, pe: null, accent: "#34d399" },
  { symbol: "AGG", name: "iShares Core US Aggregate Bond", assetClass: "Fixed Income", sector: "Bonds", region: "North America", country: "United States", currency: "USD", quantity: 700, price: 98, costFactor: 1.02, startFactor: 1.03, vol: 0.004, beta: 0.15, dividendYield: 3.6, marketCap: 0, pe: null, accent: "#94a3b8" },
  { symbol: "GLD", name: "SPDR Gold Shares", assetClass: "Commodity", sector: "Precious Metals", region: "Global", country: "Global", currency: "USD", quantity: 150, price: 245, costFactor: 0.7, startFactor: 0.76, vol: 0.008, beta: 0.09, dividendYield: 0, marketCap: 0, pe: null, accent: "#e8c489" },
  { symbol: "BTC", name: "Bitcoin", assetClass: "Crypto", sector: "Digital Assets", region: "Global", country: "Global", currency: "USD", quantity: 0.75, price: 96000, costFactor: 0.48, startFactor: 0.55, vol: 0.032, beta: 1.55, dividendYield: 0, marketCap: 1900, pe: null, accent: "#fbbf24" },
];

function walk(spec: Spec) {
  const rng = mulberry32(hashStr(spec.symbol));
  const start = spec.price * spec.startFactor;
  const logStart = Math.log(start);
  const logEnd = Math.log(spec.price);
  const noise: number[] = [];
  let acc = 0;
  for (let i = 0; i < N; i++) {
    // fat-ish tailed shock
    const u = rng() + rng() + rng() - 1.5;
    acc += u * spec.vol;
    noise.push(acc);
  }
  const n0 = noise[0];
  const nN = noise[N - 1];
  const closes: number[] = [];
  for (let i = 0; i < N; i++) {
    const trend = logStart + (logEnd - logStart) * (i / (N - 1));
    const detr = noise[i] - n0 - (nN - n0) * (i / (N - 1));
    closes.push(Math.exp(trend + detr));
  }
  return closes;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Clearing tables...");
  await db.delete(priceHistory);
  await db.delete(holdings);
  await db.delete(portfolioMeta);
  await db.delete(transactions);
  await db.delete(events);
  await db.delete(news);
  await db.delete(fxRates);
  await db.delete(etfConstituents);

  // FX
  await db.insert(fxRates).values([
    { currency: "USD", symbol: "$", perUsd: 1 },
    { currency: "EUR", symbol: "€", perUsd: 0.92 },
    { currency: "GBP", symbol: "£", perUsd: 0.79 },
    { currency: "CHF", symbol: "Fr", perUsd: 0.88 },
    { currency: "JPY", symbol: "¥", perUsd: 151 },
  ]);

  // Holdings + price history
  const priceRows: { symbol: string; d: string; close: number }[] = [];
  const holdingRows = SPECS.map((s) => {
    const closes = walk(s);
    for (let i = 0; i < N; i++) {
      priceRows.push({ symbol: s.symbol, d: iso(daysAgo(N - 1 - i)), close: +closes[i].toFixed(4) });
    }
    const current = closes[N - 1];
    const prev = closes[N - 2];
    return {
      symbol: s.symbol,
      name: s.name,
      assetClass: s.assetClass,
      sector: s.sector,
      region: s.region,
      country: s.country,
      currency: s.currency,
      quantity: s.quantity,
      avgCost: +(s.price * s.costFactor).toFixed(4),
      currentPrice: +current.toFixed(4),
      prevClose: +prev.toFixed(4),
      beta: s.beta,
      dividendYield: s.dividendYield,
      marketCap: s.marketCap,
      peRatio: s.pe,
      accent: s.accent,
    };
  });
  await db.insert(holdings).values(holdingRows);

  // Benchmark (ACWI-like global index) + AGG-bench + 60/40 handled in app
  const benchRng = mulberry32(hashStr("ACWI"));
  let bacc = 0;
  const benchNoise: number[] = [];
  for (let i = 0; i < N; i++) {
    const u = benchRng() + benchRng() + benchRng() - 1.5;
    bacc += u * 0.008;
    benchNoise.push(bacc);
  }
  const bLogStart = Math.log(88);
  const bLogEnd = Math.log(106);
  for (let i = 0; i < N; i++) {
    const trend = bLogStart + (bLogEnd - bLogStart) * (i / (N - 1));
    const detr = benchNoise[i] - benchNoise[0] - (benchNoise[N - 1] - benchNoise[0]) * (i / (N - 1));
    priceRows.push({ symbol: "ACWI", d: iso(daysAgo(N - 1 - i)), close: +Math.exp(trend + detr).toFixed(4) });
  }

  // insert price rows in chunks
  for (let i = 0; i < priceRows.length; i += 1000) {
    await db.insert(priceHistory).values(priceRows.slice(i, i + 1000));
  }

  // Portfolio meta
  await db.insert(portfolioMeta).values({
    name: "Meridian Core",
    owner: "You",
    baseCurrency: "USD",
    cash: 92450,
    inceptionDate: iso(daysAgo(N - 1)),
  });

  // Events (upcoming + a few recent)
  await db.insert(events).values([
    { symbol: "NVDA", d: iso(daysAgo(-6)), type: "Earnings", title: "NVIDIA Q-Report", detail: "Consensus EPS $0.85 · Data-center demand in focus", impact: "high" },
    { symbol: "AAPL", d: iso(daysAgo(-12)), type: "Earnings", title: "Apple Earnings", detail: "Services growth & iPhone cycle watched", impact: "high" },
    { symbol: "MSFT", d: iso(daysAgo(-18)), type: "Earnings", title: "Microsoft Earnings", detail: "Azure & Copilot monetisation", impact: "high" },
    { symbol: "JPM", d: iso(daysAgo(-3)), type: "Dividend", title: "JPM ex-dividend", detail: "$1.25 / share quarterly payout", impact: "low" },
    { symbol: "V", d: iso(daysAgo(-9)), type: "Dividend", title: "Visa ex-dividend", detail: "$0.59 / share quarterly payout", impact: "low" },
    { symbol: "ASML", d: iso(daysAgo(-21)), type: "Earnings", title: "ASML Earnings", detail: "EUV bookings & China guidance", impact: "medium" },
    { symbol: "META", d: iso(daysAgo(-27)), type: "Earnings", title: "Meta Earnings", detail: "Ad pricing & Reality Labs burn", impact: "medium" },
    { symbol: "TSLA", d: iso(daysAgo(-2)), type: "Guidance", title: "Tesla delivery update", detail: "Quarterly delivery numbers due", impact: "high" },
    { symbol: "GLD", d: iso(daysAgo(-1)), type: "Guidance", title: "FOMC decision", detail: "Rate path re-pricing; gold sensitive", impact: "medium" },
    { symbol: "TM", d: iso(daysAgo(-33)), type: "Dividend", title: "Toyota dividend", detail: "Semi-annual payout confirmed", impact: "low" },
  ]);

  // News
  const now = TODAY.getTime();
  await db.insert(news).values([
    { headline: "Nvidia extends AI capex supercycle as hyperscalers raise 2026 budgets", source: "Bloomberg", publishedAt: new Date(now - 2 * 3600000), sentiment: 0.72, category: "Technology", summary: "Cloud providers signal another leg of accelerated compute spending, lifting the AI supply chain.", tickers: ["NVDA", "TSM", "MSFT"] },
    { headline: "Apple's services momentum offsets softer hardware demand", source: "Reuters", publishedAt: new Date(now - 5 * 3600000), sentiment: 0.34, category: "Technology", summary: "Recurring revenue mix continues to expand margins even as unit sales plateau.", tickers: ["AAPL"] },
    { headline: "Fed minutes hint at slower easing path, gold whipsaws", source: "FT", publishedAt: new Date(now - 9 * 3600000), sentiment: -0.18, category: "Macro", summary: "Rate-cut expectations trimmed; real yields tick higher, pressuring non-yielding assets.", tickers: ["GLD", "AGG"] },
    { headline: "LVMH warns of softer luxury demand in China", source: "WSJ", publishedAt: new Date(now - 26 * 3600000), sentiment: -0.55, category: "Consumer", summary: "Aspirational shoppers pull back; management strikes cautious tone on near-term growth.", tickers: ["MC"] },
    { headline: "ASML books record EUV orders despite export curbs", source: "Reuters", publishedAt: new Date(now - 30 * 3600000), sentiment: 0.61, category: "Technology", summary: "Backlog resilience underscores structural demand for leading-edge lithography.", tickers: ["ASML", "TSM"] },
    { headline: "JPMorgan flags resilient consumer, raises net interest income view", source: "Bloomberg", publishedAt: new Date(now - 40 * 3600000), sentiment: 0.44, category: "Financials", summary: "Credit costs contained; bank guides NII higher on stickier deposit rates.", tickers: ["JPM", "V"] },
    { headline: "Bitcoin consolidates near highs as ETF inflows persist", source: "CoinDesk", publishedAt: new Date(now - 14 * 3600000), sentiment: 0.4, category: "Crypto", summary: "Spot ETF demand provides a structural bid even amid choppy price action.", tickers: ["BTC"] },
    { headline: "Emerging markets rally on softer dollar and China stimulus hopes", source: "FT", publishedAt: new Date(now - 52 * 3600000), sentiment: 0.5, category: "Macro", summary: "A weaker greenback and policy support lift EM equities broadly.", tickers: ["VWO", "TSM", "TM"] },
    { headline: "Tesla margins under scrutiny ahead of delivery print", source: "Reuters", publishedAt: new Date(now - 18 * 3600000), sentiment: -0.3, category: "Autos", summary: "Price cuts and mix shift keep investors cautious on profitability.", tickers: ["TSLA"] },
    { headline: "Meta ramps AI infrastructure, guides higher capex", source: "CNBC", publishedAt: new Date(now - 60 * 3600000), sentiment: 0.22, category: "Technology", summary: "Heavy investment cycle continues; ad engine funds the buildout.", tickers: ["META", "NVDA"] },
  ]);

  // ETF constituents (for fund overlap analysis)
  await db.insert(etfConstituents).values([
    { etfSymbol: "VTI", name: "Apple Inc.", ticker: "AAPL", weight: 6.4, sector: "Technology" },
    { etfSymbol: "VTI", name: "Microsoft Corp.", ticker: "MSFT", weight: 6.1, sector: "Technology" },
    { etfSymbol: "VTI", name: "NVIDIA Corp.", ticker: "NVDA", weight: 5.8, sector: "Technology" },
    { etfSymbol: "VTI", name: "Amazon.com Inc.", ticker: "AMZN", weight: 3.5, sector: "Consumer Discretionary" },
    { etfSymbol: "VTI", name: "Alphabet Inc.", ticker: "GOOGL", weight: 3.1, sector: "Communication Services" },
    { etfSymbol: "VTI", name: "Meta Platforms Inc.", ticker: "META", weight: 2.4, sector: "Communication Services" },
    { etfSymbol: "VTI", name: "Tesla Inc.", ticker: "TSLA", weight: 1.6, sector: "Consumer Discretionary" },
    { etfSymbol: "VTI", name: "JPMorgan Chase & Co.", ticker: "JPM", weight: 1.4, sector: "Financials" },
    { etfSymbol: "VTI", name: "Visa Inc.", ticker: "V", weight: 1.0, sector: "Financials" },
    { etfSymbol: "VTI", name: "Broadcom Inc.", ticker: "AVGO", weight: 1.9, sector: "Technology" },
    { etfSymbol: "VWO", name: "Taiwan Semiconductor", ticker: "TSM", weight: 9.2, sector: "Technology" },
    { etfSymbol: "VWO", name: "Tencent Holdings", ticker: "TCEHY", weight: 4.6, sector: "Communication Services" },
    { etfSymbol: "VWO", name: "Alibaba Group", ticker: "BABA", weight: 2.7, sector: "Consumer Discretionary" },
    { etfSymbol: "VWO", name: "Reliance Industries", ticker: "RELI", weight: 1.4, sector: "Energy" },
    { etfSymbol: "VWO", name: "Toyota Motor Corp.", ticker: "TM", weight: 0.9, sector: "Consumer Discretionary" },
  ]);

  // Transactions (cost-basis buys + a few dividends & one trim)
  const txRows: { symbol: string; d: string; type: string; quantity: number; price: number; amount: number }[] = [];
  SPECS.forEach((s, idx) => {
    const buyPrice = +(s.price * s.costFactor).toFixed(2);
    txRows.push({ symbol: s.symbol, d: iso(daysAgo(N - 10 - idx * 3)), type: "Buy", quantity: s.quantity, price: buyPrice, amount: +(buyPrice * s.quantity).toFixed(2) });
  });
  txRows.push({ symbol: "NVDA", d: iso(daysAgo(120)), type: "Sell", quantity: 100, price: 118, amount: 11800 });
  txRows.push({ symbol: "AAPL", d: iso(daysAgo(30)), type: "Dividend", quantity: 0, price: 0, amount: 156.8 });
  txRows.push({ symbol: "JPM", d: iso(daysAgo(15)), type: "Dividend", quantity: 0, price: 0, amount: 325 });
  txRows.push({ symbol: "MSFT", d: iso(daysAgo(45)), type: "Dividend", quantity: 0, price: 0, amount: 187.5 });
  await db.insert(transactions).values(txRows);

  console.log(`Seeded ${holdingRows.length} holdings, ${priceRows.length} price points.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
