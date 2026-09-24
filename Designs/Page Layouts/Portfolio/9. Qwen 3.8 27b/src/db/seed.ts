/* Seeds the Meridian portfolio DB. Deterministic (seeded PRNG) so charts are stable.
   Run with: npx tsx src/db/seed.ts */
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { holdings, pricesDaily, snapshots, newsItems, events } from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

/* ---------- deterministic RNG ---------- */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* ---------- calendar: 5y of business days ---------- */
const YEARS = 5;
const today = new Date();
today.setUTCHours(20, 0, 0, 0);
const start = new Date(today);
start.setUTCFullYear(start.getUTCFullYear() - YEARS);

const dates: string[] = [];
for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) continue;
  dates.push(d.toISOString().slice(0, 10));
}
const N = dates.length;

/* ---------- market factor (single common driver, so assets correlate) ---------- */
const MKT_MU = 0.105;
const MKT_VOL = 0.15;
const factorPrice: number[] = [];
{
  const r = mulberry32(777);
  let p = 1;
  for (let i = 0; i < N; i++) {
    p = p * Math.exp((MKT_MU - 0.5 * MKT_VOL * MKT_VOL) / 252 + (MKT_VOL / Math.sqrt(252)) * gaussWith(r));
    factorPrice.push(p);
  }
}
const factorRet: number[] = factorPrice.map((x, i) => (i === 0 ? 0 : Math.log(x / factorPrice[i - 1])));

function gaussWith(r: () => number) {
  let u = 0,
    v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** asset path = beta * market factor + idiosyncratic noise, anchored so last close = target */
function genPath(target: number, beta: number, idio: number, seed: number) {
  const r = mulberry32(seed);
  let p = 1;
  const raw: number[] = [];
  for (let i = 0; i < N; i++) {
    const ret = beta * (factorRet[i] || factorRet[1]) + (idio / Math.sqrt(252)) * gaussWith(r);
    p = p * Math.exp(ret);
    raw.push(p);
  }
  const k = target / raw[N - 1];
  return raw.map((x) => x * k);
}

/* ---------- portfolio definition ---------- */
type Def = {
  id: string;
  name: string;
  cls: string;
  sector: string;
  country: string;
  iso: string;
  ccy: string;
  price: number;
  pl: number; // P&L since purchase, e.g. 0.42
  w: number; // target weight of invested capital
  beta: number;
  idio: number;
  desc: string;
  meta: Record<string, unknown>;
};

const TOTAL = 1_482_340;
const CASH = 88_420;
const INVESTED = TOTAL - CASH;

const DEFS: Def[] = [
  {
    id: "VOO", name: "Vanguard S&P 500 ETF", cls: "etf", sector: "Fixed Income", country: "USA", iso: "US", ccy: "USD",
    price: 585.42, pl: 0.42, w: 14, beta: 1.00, idio: 0.03,
    desc: "Core US large-cap exposure, tracking the S&P 500.",
    meta: { overlapSpx: 0.97, regionMix: { US: 1 }, capMix: { Large: 0.7, Mid: 0.26, Small: 0.04 },
      sectorMix: { Technology: 0.31, Healthcare: 0.12, Financials: 0.13, "Consumer Cyclical": 0.09, Industrials: 0.08, Communication: 0.08, Energy: 0.04, Materials: 0.04, Utilities: 0.03, "Real Estate": 0.03, "Consumer Staples": 0.05, Other: 0.03 },
      top10: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AVGO", "LLY", "UNH"] },
  },
  {
    id: "VT", name: "Vanguard Total World ETF", cls: "etf", sector: "Fixed Income", country: "Global", iso: "XX", ccy: "USD",
    price: 148.75, pl: 0.38, w: 11, beta: 0.85, idio: 0.06,
    desc: "9,000+ stocks across developed and emerging markets.",
    meta: { overlapSpx: 0.41, regionMix: { US: 0.22, Canada: 0.03, LatAm: 0.06, Europe: 0.17, Africa: 0.02, Asia: 0.43, Oceania: 0.01, Other: 0.06 },
      capMix: { Large: 0.55, Mid: 0.3, Small: 0.15 },
      sectorMix: { Technology: 0.28, Healthcare: 0.13, Financials: 0.14, "Consumer Cyclical": 0.09, Industrials: 0.09, Communication: 0.07, Energy: 0.06, Materials: 0.04, Utilities: 0.04, "Real Estate": 0.03, "Consumer Staples": 0.03, Other: 0.09 },
      top10: ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSM", "ASML", "LLY", "SAP", "UNH"] },
  },
  {
    id: "QQQ", name: "Invesco QQQ Trust", cls: "etf", sector: "Fixed Income", country: "USA", iso: "US", ccy: "USD",
    price: 560.24, pl: 0.55, w: 9.5, beta: 1.25, idio: 0.09,
    desc: "Nasdaq-100 growth tilt.",
    meta: { overlapSpx: 0.71, regionMix: { US: 0.95, Asia: 0.03, Europe: 0.02 },
      capMix: { Large: 0.93, Mid: 0.07 },
      sectorMix: { Technology: 0.42, Communication: 0.16, "Consumer Cyclical": 0.12, Healthcare: 0.08, Financials: 0.04, Industrials: 0.06, Materials: 0.02, Other: 0.1 },
      top10: ["NVDA", "MSFT", "AAPL", "AMZN", "GOOGL", "AVGO", "LLY", "TSM", "META", "TSLA"] },
  },
  {
    id: "AAPL", name: "Apple Inc.", cls: "stock", sector: "Technology", country: "USA", iso: "US", ccy: "USD",
    price: 243.82, pl: 0.28, w: 9, beta: 1.15, idio: 0.16,
    desc: "Consumer hardware, services and on-device AI.",
    meta: { pe: 34.2, divYield: 0.55, mcapB: 3780 },
  },
  {
    id: "NVDA", name: "NVIDIA Corp.", cls: "stock", sector: "Technology", country: "USA", iso: "US", ccy: "USD",
    price: 172.61, pl: 1.68, w: 8.5, beta: 1.6, idio: 0.30,
    desc: "Data-center AI silicon and networking.",
    meta: { pe: 48.9, divYield: 0.03, mcapB: 4210 },
  },
  {
    id: "MSFT", name: "Microsoft Corp.", cls: "stock", sector: "Technology", country: "USA", iso: "US", ccy: "USD",
    price: 512.38, pl: 0.31, w: 7.5, beta: 1.05, idio: 0.12,
    desc: "Cloud, productivity and enterprise AI.",
    meta: { pe: 38.1, divYield: 0.72, mcapB: 3560 },
  },
  {
    id: "LLY", name: "Eli Lilly & Co.", cls: "stock", sector: "Healthcare", country: "USA", iso: "US", ccy: "USD",
    price: 815.4, pl: 2.24, w: 5.5, beta: 0.95, idio: 0.22,
    desc: "GLP-1 franchise, obesity and diabetes.",
    meta: { pe: 58.4, divYield: 0.03, mcapB: 792 },
  },
  {
    id: "VGT", name: "Vanguard Info Tech ETF", cls: "etf", sector: "Fixed Income", country: "USA", iso: "US", ccy: "USD",
    price: 302.9, pl: 0.71, w: 5, beta: 1.3, idio: 0.08,
    desc: "US technology sector sleeve.",
    meta: { overlapSpx: 0.88, regionMix: { US: 0.97, Asia: 0.03 },
      capMix: { Large: 0.95, Mid: 0.05 },
      sectorMix: { Technology: 0.62, Communication: 0.18, "Consumer Cyclical": 0.08, Materials: 0.04, Industrials: 0.04, Other: 0.04 },
      top10: ["NVDA", "MSFT", "AAPL", "AVGO", "AMD", "TSM", "ORCL", "QCOM", "INTC", "CRM"] },
  },
  {
    id: "BND", name: "Vanguard Total Bond ETF", cls: "bond-fund", sector: "Fixed Income", country: "USA", iso: "US", ccy: "USD",
    price: 74.85, pl: 0.11, w: 8, beta: -0.05, idio: 0.06,
    desc: "Investment-grade US fixed income ballast.",
    meta: { overlapSpx: 0, regionMix: { US: 0.94, Europe: 0.03, Asia: 0.02, Other: 0.01 },
      capMix: {}, sectorMix: { "Fixed Income": 1 }, top10: [] },
  },
  {
    id: "GLD", name: "SPDR Gold Shares", cls: "commodity", sector: "Commodities", country: "Global", iso: "XX", ccy: "USD",
    price: 312.55, pl: 0.64, w: 4.5, beta: 0.05, idio: 0.16,
    desc: "Physical gold, crisis hedge and real-asset tilt.",
    meta: { overlapSpx: 0.02, regionMix: { Global: 1 }, capMix: {}, sectorMix: { Commodities: 1 }, top10: [] },
  },
  {
    id: "TSM", name: "TSMC (ADR)", cls: "stock", sector: "Technology", country: "Taiwan", iso: "TW", ccy: "USD",
    price: 218.44, pl: 0.96, w: 4, beta: 1.3, idio: 0.18,
    desc: "Foundry lead for advanced logic nodes.",
    meta: { pe: 24.6, divYield: 1.7, mcapB: 1210 },
  },
  {
    id: "ASML", name: "ASML Holding (ADR)", cls: "stock", sector: "Technology", country: "Netherlands", iso: "NL", ccy: "USD",
    price: 765.4, pl: 0.34, w: 3.5, beta: 1.25, idio: 0.16,
    desc: "EUV lithography monopoly for top-tier nodes.",
    meta: { pe: 27.8, divYield: 1.5, mcapB: 342 },
  },
  {
    id: "SAP", name: "SAP SE (ADR)", cls: "stock", sector: "Technology", country: "Germany", iso: "DE", ccy: "USD",
    price: 192.72, pl: -0.14, w: 3, beta: 0.9, idio: 0.18,
    desc: "Enterprise ERP; business-software AI rollout.",
    meta: { pe: 21.9, divYield: 3.3, mcapB: 214 },
  },
  {
    id: "AZN", name: "AstraZeneca PLC", cls: "stock", sector: "Healthcare", country: "United Kingdom", iso: "GB", ccy: "GBP",
    price: 8.42, pl: -0.38, w: 2.5, beta: 0.8, idio: 0.20,
    desc: "Oncology and respiratory; UK dividend staple.",
    meta: { pe: 9.8, divYield: 3.4, mcapB: 138 },
  },
  {
    id: "BRK-B", name: "Berkshire Hathaway (B)", cls: "stock", sector: "Financials", country: "USA", iso: "US", ccy: "USD",
    price: 688.9, pl: 0.47, w: 2.5, beta: 0.95, idio: 0.10,
    desc: "Conglomerate; insurance float and cash reserve.",
    meta: { pe: 11.9, divYield: 0, mcapB: 1065 },
  },
];

const sumW = DEFS.reduce((s, d) => s + d.w, 0);

/* ---------- run ---------- */
async function main() {
  console.log("clearing tables…");
  await db.execute(sql`DELETE FROM prices_daily`);
  await db.execute(sql`DELETE FROM snapshots`);
  await db.execute(sql`DELETE FROM holdings`);
  await db.execute(sql`DELETE FROM news_items`);
  await db.execute(sql`DELETE FROM events`);

  console.log("generating price paths…");
  const paths: Record<string, number[]> = {};
  const spx = factorPrice.map((x) => (x / factorPrice[N - 1]) * 6321.5);
  paths["SPX"] = spx;
  for (const [i, d] of DEFS.entries()) {
    paths[d.id] = genPath(d.price, d.beta, d.idio, 1000 + i * 131);
  }

  const priceRows: { symbol: string; date: string; close: number }[] = [];
  for (let i = 0; i < N; i++) {
    for (const sym of Object.keys(paths)) {
      priceRows.push({ symbol: sym, date: dates[i], close: paths[sym][i] });
    }
  }
  for (let i = 0; i < priceRows.length; i += 2500) {
    await db.insert(pricesDaily).values(priceRows.slice(i, i + 2500));
  }

  console.log("building snapshots…");
  const qty: Record<string, number> = {};
  for (const d of DEFS) qty[d.id] = Math.round(((INVESTED * d.w) / sumW / d.price) * 100) / 100;

  const snapRows: { date: string; value: number; cash: number; benchmark: number }[] = [];
  for (let i = 0; i < N; i++) {
    let v = CASH;
    for (const d of DEFS) v += qty[d.id] * paths[d.id][i];
    snapRows.push({ date: dates[i], value: Math.round(v * 100) / 100, cash: CASH, benchmark: spx[i] });
  }
  for (let i = 0; i < snapRows.length; i += 2500) {
    await db.insert(snapshots).values(snapRows.slice(i, i + 2500));
  }

  console.log("inserting holdings…");
  await db.insert(holdings).values(
    DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      assetClass: d.cls,
      sector: d.sector,
      country: d.country,
      countryIso: d.iso,
      currency: d.ccy,
      quantity: qty[d.id],
      avgCost: Math.round((d.price / (1 + d.pl)) * 100) / 100,
      description: d.desc,
      topHoldings: (d.meta.top10 as string[]) ?? [],
      meta: d.meta,
    }))
  );

  const now = Date.now();
  const h = 3600e3;
  const newsRows = [
    { title: "Fed holds rates, signals patience on further cuts", source: "Meridian Wire", hours: 5, symbols: ["SPX"], sentiment: 0.1, impact: 3, summary: "The committee kept the target range steady and left the dot plot broadly unchanged, pushing rate-cut expectations out a quarter." },
    { title: "Nvidia earnings lift the AI trade as data-center demand stretches into 2027", source: "Terminal", hours: 22, symbols: ["NVDA", "VGT", "QQQ"], sentiment: 0.8, impact: 3, summary: "Data-center revenue grew 62% y/y and guidance raised. Hyperscaler capex plans now extend past 2026." },
    { title: "Eli Lilly expands GLP-1 pipeline to oral franchise", source: "Biotech Brief", hours: 30, symbols: ["LLY", "VOO", "QQQ", "VT"], sentiment: 0.75, impact: 2, summary: "Phase 3 data for the once-daily oral formulation met primary endpoints; oral launch pushed up to 2027." },
    { title: "TSMC says advanced capacity is sold out through next year", source: "Semiconductor Daily", hours: 15, symbols: ["TSM"], sentiment: 0.7, impact: 2, summary: "Foundry utilization near 100%; 2nm ramp on schedule with AI accelerators as the primary demand driver." },
    { title: "Gold steadies near record as central-bank buying continues", source: "Commodities Desk", hours: 9, symbols: ["GLD"], sentiment: 0.5, impact: 2, summary: "CB purchases ran at 400t/yr pace; spot held within 2% of all-time highs despite firmer dollar." },
    { title: "Microsoft Copilot monetization beats Street expectations", source: "Terminal", hours: 55, symbols: ["MSFT"], sentiment: 0.65, impact: 2, summary: "M365 Copilot seats crossed 25M; Azure growth re-accelerated to 34% on AI workloads." },
    { title: "Apple teases on-device AI push at spring event", source: "Tech Current", hours: 49, symbols: ["AAPL"], sentiment: 0.4, impact: 2, summary: "Next-generation Siri with local inference; analyst notes a 2027 replacement-cycle catalyst." },
    { title: "ASML export controls bite; EU wafer demand holds firm", source: "Semiconductor Daily", hours: 70, symbols: ["ASML", "TSM"], sentiment: -0.2, impact: 2, summary: "China share of bookings fell to 21%; EUV orders from leading nodes offset the gap." },
    { title: "Sprint: tech concentration in your index funds is higher than you think", source: "Portfolio Letters", hours: 75, symbols: ["VOO", "QQQ", "VGT"], sentiment: 0.05, impact: 1, summary: "Overlap of a typical three-fund tech stack exceeds 40% of combined exposure — effective positions may be 2x nominal." },
    { title: "AstraZeneca trims guidance on US pricing pressure", source: "Pharma Watch", hours: 96, symbols: ["AZN"], sentiment: -0.7, impact: 2, summary: "IR&D lowered full-year revenue outlook 4%; oncology growth intact but US net pricing weaker." },
    { title: "Berkshire's cash pile hits a new all-time high", source: "Value Corner", hours: 120, symbols: ["BRK-B"], sentiment: 0.2, impact: 1, summary: "Treasury holdings above $350B; management still 'patient' on a large acquisition." },
    { title: "EUR/USD drifts lower; unhedged international adds to US books", source: "FX Desk", hours: 130, symbols: ["VT"], sentiment: 0.1, impact: 1, summary: "Carry dynamics keep dollar bid; unhedged int'l equity adds ~1.8% to USD returns this year." },
  ].map((n) => ({
    ...n,
    source: n.source,
    publishedAt: new Date(now - n.hours * h),
    symbols: n.symbols,
    summary: n.summary,
    sentiment: n.sentiment,
    impact: n.impact,
  }));
  await db.insert(newsItems).values(newsRows);

  const ev = (days: number, sym: string, title: string, type: string, imp: number) => ({
    symbol: sym,
    title,
    eventType: type,
    date: new Date(now + days * 24 * h),
    importance: imp,
  });
  await db.insert(events).values([
    ev(3, "MACRO", "US CPI (month-over-month)", "macro", 3),
    ev(5, "NVDA", "NVIDIA Q3 earnings", "earnings", 3),
    ev(6, "MACRO", "FOMC rate decision + presser", "macro", 3),
    ev(9, "AAPL", "Apple Q2 earnings", "earnings", 3),
    ev(11, "MSFT", "Microsoft FY-Q4 earnings", "earnings", 3),
    ev(14, "ASML", "ASML Q2 results", "earnings", 2),
    ev(16, "SAP", "SAP Q2 earnings", "earnings", 2),
    ev(18, "TSM", "TSMC Q2 earnings", "earnings", 2),
    ev(21, "LLY", "Eli Lilly Q1 earnings", "earnings", 2),
  ]);

  const last = snapRows[snapRows.length - 1];
  console.log(
    `SEED COMPLETE — ${N} trading days, ${priceRows.length} price rows, ${DEFS.length} holdings, portfolio value $${last.value.toLocaleString()}`
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
