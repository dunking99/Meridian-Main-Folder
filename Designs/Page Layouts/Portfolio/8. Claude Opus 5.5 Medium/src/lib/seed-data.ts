import type { LookThrough } from "@/db/schema";

export type SeedInstrument = {
  symbol: string;
  name: string;
  kind: string;
  assetClass: string;
  sector: string;
  industry: string;
  country: string;
  region: string;
  currency: string;
  exchange: string;
  beta: number;
  divYield: number;
  pe: number | null;
  marketCapB: number | null;
  expenseRatio: number | null;
  style: string;
  size: string;
  description: string;
  lookThrough?: LookThrough;
  isBenchmark?: boolean;
  // simulation params
  price: number; // current price in local ccy
  mu: number; // annual drift
  vol: number; // annual vol
  targetUsd: number; // initial allocation
  startDay?: number; // day index of first buy
};

export const FX: Record<string, number> = {
  USD: 1,
  EUR: 1.084,
  GBP: 1.271,
  JPY: 0.00664,
  CHF: 1.128,
};

const eq = (
  symbol: string,
  name: string,
  sector: string,
  industry: string,
  country: string,
  region: string,
  currency: string,
  exchange: string,
  beta: number,
  divYield: number,
  pe: number,
  marketCapB: number,
  style: string,
  price: number,
  mu: number,
  vol: number,
  targetUsd: number,
  description: string,
  startDay?: number
): SeedInstrument => ({
  symbol,
  name,
  kind: "Equity",
  assetClass: "Equities",
  sector,
  industry,
  country,
  region,
  currency,
  exchange,
  beta,
  divYield,
  pe,
  marketCapB,
  expenseRatio: null,
  style,
  size: "Large",
  description,
  price,
  mu,
  vol,
  targetUsd,
  startDay,
});

export const UNIVERSE: SeedInstrument[] = [
  eq("AAPL", "Apple Inc.", "Technology", "Consumer Electronics", "US", "North America", "USD", "NASDAQ", 1.18, 0.0044, 34.1, 3480, "Growth", 228.4, 0.2, 0.26, 62000, "Designs iPhone, Mac and wearables; services flywheel growing past $100B in annual revenue."),
  eq("MSFT", "Microsoft Corp.", "Technology", "Software", "US", "North America", "USD", "NASDAQ", 1.05, 0.0072, 35.6, 3190, "Growth", 429.9, 0.19, 0.24, 56000, "Cloud (Azure), productivity software and a leading stake in generative AI infrastructure."),
  eq("NVDA", "NVIDIA Corp.", "Technology", "Semiconductors", "US", "North America", "USD", "NASDAQ", 1.72, 0.0003, 52.3, 3310, "Growth", 135.2, 0.62, 0.52, 42000, "Dominant supplier of GPUs and networking for AI data centers.", 250),
  eq("AMZN", "Amazon.com Inc.", "Consumer Disc.", "Internet Retail", "US", "North America", "USD", "NASDAQ", 1.28, 0, 42.8, 2150, "Growth", 205.7, 0.22, 0.31, 36000, "E-commerce, AWS cloud and a fast-growing advertising business."),
  eq("GOOGL", "Alphabet Inc.", "Communication", "Interactive Media", "US", "North America", "USD", "NASDAQ", 1.1, 0.0046, 23.4, 2140, "Growth", 175.3, 0.18, 0.29, 30000, "Search, YouTube, Android and Google Cloud."),
  eq("META", "Meta Platforms", "Communication", "Interactive Media", "US", "North America", "USD", "NASDAQ", 1.34, 0.0034, 27.9, 1490, "Growth", 589.6, 0.42, 0.38, 24000, "Facebook, Instagram, WhatsApp and Reality Labs."),
  eq("JPM", "JPMorgan Chase", "Financials", "Banks", "US", "North America", "USD", "NYSE", 1.08, 0.021, 13.2, 680, "Value", 241.5, 0.17, 0.22, 20000, "Largest US bank by assets; consumer, commercial and investment banking."),
  eq("V", "Visa Inc.", "Financials", "Payments", "US", "North America", "USD", "NYSE", 0.94, 0.0075, 30.8, 610, "Growth", 314.8, 0.13, 0.19, 18000, "Global card network processing over 200B transactions a year."),
  eq("LLY", "Eli Lilly", "Health Care", "Pharmaceuticals", "US", "North America", "USD", "NYSE", 0.52, 0.0068, 82.1, 780, "Growth", 821.3, 0.34, 0.3, 22000, "Pharma leader in GLP-1 obesity and diabetes treatments."),
  eq("COST", "Costco Wholesale", "Consumer Staples", "Hypermarkets", "US", "North America", "USD", "NASDAQ", 0.78, 0.0052, 54.7, 404, "Growth", 912.4, 0.24, 0.2, 18000, "Membership warehouse club with 890+ locations worldwide."),
  eq("TSM", "Taiwan Semiconductor", "Technology", "Semiconductors", "TW", "Asia Pacific", "USD", "NYSE", 1.25, 0.013, 29.4, 1010, "Growth", 194.6, 0.36, 0.36, 20000, "World's largest contract chipmaker; fabs leading-edge nodes for Apple and NVIDIA."),
  eq("ASML", "ASML Holding", "Technology", "Semiconductor Equip.", "NL", "Europe", "EUR", "Euronext", 1.3, 0.009, 36.2, 270, "Growth", 681.2, 0.08, 0.36, 22000, "Sole maker of EUV lithography machines."),
  eq("SAP", "SAP SE", "Technology", "Software", "DE", "Europe", "EUR", "XETRA", 0.98, 0.0092, 44.5, 300, "Growth", 254.8, 0.33, 0.24, 15000, "Enterprise resource planning software, migrating customers to cloud."),
  eq("MC", "LVMH Moët Hennessy", "Consumer Disc.", "Luxury Goods", "FR", "Europe", "EUR", "Euronext", 1.12, 0.021, 22.6, 320, "Blend", 641.5, -0.06, 0.28, 16000, "Luxury conglomerate: Louis Vuitton, Dior, Moët, Tiffany."),
  eq("SHEL", "Shell plc", "Energy", "Integrated Oil & Gas", "GB", "Europe", "GBP", "LSE", 0.72, 0.041, 8.9, 205, "Value", 26.45, 0.06, 0.22, 14000, "Integrated energy major with a large LNG franchise."),
  eq("AZN", "AstraZeneca", "Health Care", "Pharmaceuticals", "GB", "Europe", "GBP", "LSE", 0.45, 0.021, 31.7, 210, "Growth", 108.2, 0.05, 0.21, 15000, "Oncology-led biopharma with a deep pipeline."),
  eq("7203", "Toyota Motor", "Consumer Disc.", "Automobiles", "JP", "Asia Pacific", "JPY", "TSE", 0.88, 0.028, 8.1, 230, "Value", 2750, 0.07, 0.27, 11000, "World's largest automaker by volume; hybrid leader."),
  eq("NESN", "Nestlé S.A.", "Consumer Staples", "Packaged Foods", "CH", "Europe", "CHF", "SIX", 0.42, 0.037, 17.9, 240, "Value", 82.3, -0.08, 0.16, 13000, "World's largest food company: Nescafé, KitKat, Purina."),
  {
    symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "ETF", assetClass: "Equities", sector: "Diversified", industry: "US Large Blend",
    country: "US", region: "North America", currency: "USD", exchange: "NYSE Arca", beta: 1, divYield: 0.0128, pe: 25.1, marketCapB: null,
    expenseRatio: 0.0003, style: "Blend", size: "Large", description: "Tracks the S&P 500 — 500 of the largest US companies.",
    price: 532.1, mu: 0.14, vol: 0.155, targetUsd: 150000,
    lookThrough: [
      { symbol: "AAPL", name: "Apple", weight: 0.071 }, { symbol: "NVDA", name: "NVIDIA", weight: 0.066 },
      { symbol: "MSFT", name: "Microsoft", weight: 0.063 }, { symbol: "AMZN", name: "Amazon", weight: 0.039 },
      { symbol: "GOOGL", name: "Alphabet", weight: 0.037 }, { symbol: "META", name: "Meta", weight: 0.025 },
      { symbol: "AVGO", name: "Broadcom", weight: 0.022 }, { symbol: "BRK.B", name: "Berkshire", weight: 0.017 },
      { symbol: "LLY", name: "Eli Lilly", weight: 0.014 }, { symbol: "JPM", name: "JPMorgan", weight: 0.014 },
      { symbol: "TSLA", name: "Tesla", weight: 0.014 }, { symbol: "V", name: "Visa", weight: 0.011 },
      { symbol: "XOM", name: "Exxon", weight: 0.01 }, { symbol: "COST", name: "Costco", weight: 0.009 },
    ],
  },
  {
    symbol: "QQQ", name: "Invesco QQQ Trust", kind: "ETF", assetClass: "Equities", sector: "Diversified", industry: "US Large Growth",
    country: "US", region: "North America", currency: "USD", exchange: "NASDAQ", beta: 1.18, divYield: 0.0058, pe: 32.4, marketCapB: null,
    expenseRatio: 0.002, style: "Growth", size: "Large", description: "Tracks the Nasdaq-100 — the largest non-financial Nasdaq names.",
    price: 501.8, mu: 0.18, vol: 0.2, targetUsd: 60000,
    lookThrough: [
      { symbol: "AAPL", name: "Apple", weight: 0.088 }, { symbol: "NVDA", name: "NVIDIA", weight: 0.084 },
      { symbol: "MSFT", name: "Microsoft", weight: 0.079 }, { symbol: "AMZN", name: "Amazon", weight: 0.055 },
      { symbol: "AVGO", name: "Broadcom", weight: 0.051 }, { symbol: "META", name: "Meta", weight: 0.049 },
      { symbol: "GOOGL", name: "Alphabet", weight: 0.05 }, { symbol: "TSLA", name: "Tesla", weight: 0.033 },
      { symbol: "COST", name: "Costco", weight: 0.026 }, { symbol: "NFLX", name: "Netflix", weight: 0.02 },
      { symbol: "ASML", name: "ASML", weight: 0.012 }, { symbol: "AMD", name: "AMD", weight: 0.014 },
    ],
  },
  {
    symbol: "VXUS", name: "Vanguard Total Intl Stock", kind: "ETF", assetClass: "Equities", sector: "Diversified", industry: "Foreign Large Blend",
    country: "INTL", region: "Global ex-US", currency: "USD", exchange: "NASDAQ", beta: 0.86, divYield: 0.031, pe: 14.2, marketCapB: null,
    expenseRatio: 0.0008, style: "Blend", size: "Large", description: "Broad exposure to 8,000+ stocks in developed and emerging markets outside the US.",
    price: 63.4, mu: 0.06, vol: 0.15, targetUsd: 55000,
    lookThrough: [
      { symbol: "TSM", name: "TSMC", weight: 0.025 }, { symbol: "NESN", name: "Nestlé", weight: 0.008 },
      { symbol: "ASML", name: "ASML", weight: 0.011 }, { symbol: "SAP", name: "SAP", weight: 0.009 },
      { symbol: "NOVO", name: "Novo Nordisk", weight: 0.01 }, { symbol: "TCEHY", name: "Tencent", weight: 0.011 },
      { symbol: "7203", name: "Toyota", weight: 0.007 }, { symbol: "AZN", name: "AstraZeneca", weight: 0.008 },
      { symbol: "SHEL", name: "Shell", weight: 0.007 }, { symbol: "MC", name: "LVMH", weight: 0.006 },
    ],
  },
  {
    symbol: "VWO", name: "Vanguard FTSE Emerging Mkts", kind: "ETF", assetClass: "Equities", sector: "Diversified", industry: "Diversified Emerging Mkts",
    country: "EM", region: "Emerging Markets", currency: "USD", exchange: "NYSE Arca", beta: 0.82, divYield: 0.034, pe: 12.8, marketCapB: null,
    expenseRatio: 0.0008, style: "Blend", size: "Large", description: "Emerging markets equity: China, India, Taiwan, Brazil and more.",
    price: 44.9, mu: 0.04, vol: 0.17, targetUsd: 25000,
    lookThrough: [
      { symbol: "TSM", name: "TSMC", weight: 0.089 }, { symbol: "TCEHY", name: "Tencent", weight: 0.041 },
      { symbol: "BABA", name: "Alibaba", weight: 0.022 }, { symbol: "RELIANCE", name: "Reliance Ind.", weight: 0.014 },
      { symbol: "HDB", name: "HDFC Bank", weight: 0.012 }, { symbol: "MEITUAN", name: "Meituan", weight: 0.01 },
    ],
  },
  {
    symbol: "SCHD", name: "Schwab US Dividend Equity", kind: "ETF", assetClass: "Equities", sector: "Diversified", industry: "US Large Value",
    country: "US", region: "North America", currency: "USD", exchange: "NYSE Arca", beta: 0.8, divYield: 0.036, pe: 16.4, marketCapB: null,
    expenseRatio: 0.0006, style: "Value", size: "Large", description: "High-quality US dividend payers screened for cash-flow and yield.",
    price: 28.1, mu: 0.08, vol: 0.14, targetUsd: 35000,
    lookThrough: [
      { symbol: "CSCO", name: "Cisco", weight: 0.043 }, { symbol: "HD", name: "Home Depot", weight: 0.041 },
      { symbol: "ABBV", name: "AbbVie", weight: 0.04 }, { symbol: "KO", name: "Coca-Cola", weight: 0.039 },
      { symbol: "PEP", name: "PepsiCo", weight: 0.038 }, { symbol: "VZ", name: "Verizon", weight: 0.041 },
      { symbol: "AMGN", name: "Amgen", weight: 0.04 }, { symbol: "XOM", name: "Exxon", weight: 0.018 },
    ],
  },
  {
    symbol: "BND", name: "Vanguard Total Bond Market", kind: "Bond ETF", assetClass: "Fixed Income", sector: "Bonds", industry: "Intermediate Core Bond",
    country: "US", region: "North America", currency: "USD", exchange: "NASDAQ", beta: 0.04, divYield: 0.037, pe: null, marketCapB: null,
    expenseRatio: 0.0003, style: "Blend", size: "Large", description: "Investment-grade US bonds: Treasuries, agency MBS and corporates. Duration ≈ 6.1y.",
    price: 72.6, mu: 0.012, vol: 0.062, targetUsd: 80000,
  },
  {
    symbol: "GLD", name: "SPDR Gold Shares", kind: "Commodity", assetClass: "Alternatives", sector: "Commodities", industry: "Gold",
    country: "US", region: "Global", currency: "USD", exchange: "NYSE Arca", beta: 0.08, divYield: 0, pe: null, marketCapB: null,
    expenseRatio: 0.004, style: "Blend", size: "Large", description: "Physically backed gold bullion trust.",
    price: 245.3, mu: 0.14, vol: 0.14, targetUsd: 30000,
  },
  {
    symbol: "BTC", name: "Bitcoin", kind: "Crypto", assetClass: "Alternatives", sector: "Digital Assets", industry: "Cryptocurrency",
    country: "GLOBAL", region: "Global", currency: "USD", exchange: "Coinbase", beta: 1.45, divYield: 0, pe: null, marketCapB: 1820,
    expenseRatio: null, style: "Growth", size: "Large", description: "Decentralised digital currency with a fixed 21M supply.",
    price: 92150, mu: 0.55, vol: 0.58, targetUsd: 22000, startDay: 300,
  },
  {
    symbol: "ACWI", name: "MSCI All Country World", kind: "ETF", assetClass: "Equities", sector: "Diversified", industry: "Global Large Blend",
    country: "GLOBAL", region: "Global", currency: "USD", exchange: "NASDAQ", beta: 1, divYield: 0.018, pe: 20.1, marketCapB: null,
    expenseRatio: 0.0032, style: "Blend", size: "Large", description: "Benchmark: global developed + emerging equities.",
    price: 118.4, mu: 0.105, vol: 0.14, targetUsd: 0, isBenchmark: true,
  },
];

export const TARGETS: Record<string, number> = {
  "US Equity": 0.6,
  "Intl Equity": 0.2,
  "Fixed Income": 0.1,
  Alternatives: 0.07,
  Cash: 0.03,
};

// News: offsets in hours before now
export const NEWS_SEED: {
  h: number;
  source: string;
  headline: string;
  summary: string;
  symbols: string[];
  sentiment: number;
  category: string;
}[] = [
  { h: 1.2, source: "Reuters", headline: "NVIDIA unveils next-gen Rubin platform, guides data-center revenue above consensus", summary: "Management said hyperscaler demand remains 'well ahead of supply' into next year; gross margin guided to 75%.", symbols: ["NVDA", "TSM"], sentiment: 0.78, category: "Earnings" },
  { h: 2.5, source: "Bloomberg", headline: "Broadcom lands $10B custom AI accelerator order from a fourth hyperscaler", summary: "The order extends Broadcom's lead in custom silicon; shares rose 6% in pre-market trade.", symbols: ["AVGO"], sentiment: 0.64, category: "Deals" },
  { h: 3.8, source: "FT", headline: "ECB signals further cuts as eurozone inflation cools to 2.1%", summary: "A weaker euro could weigh on USD returns from European holdings while supporting exporters.", symbols: ["ASML", "SAP", "MC"], sentiment: -0.12, category: "Macro" },
  { h: 5.1, source: "WSJ", headline: "Apple's services revenue hits record as App Store fees face new EU scrutiny", summary: "Services now make up 26% of revenue; Brussels opened a new probe into anti-steering rules.", symbols: ["AAPL"], sentiment: 0.18, category: "Regulation" },
  { h: 7.4, source: "CNBC", headline: "Eli Lilly's oral GLP-1 hits primary endpoint in late-stage trial", summary: "Orforglipron delivered 12.4% average weight loss; filing expected by year end.", symbols: ["LLY", "NOVO"], sentiment: 0.71, category: "Health" },
  { h: 9.0, source: "Reuters", headline: "LVMH warns on Chinese luxury demand; fashion & leather sales slip 3%", summary: "Aspirational shoppers pulled back further; the group is cutting store openings in Asia.", symbols: ["MC"], sentiment: -0.66, category: "Earnings" },
  { h: 11.6, source: "Bloomberg", headline: "Treasury yields fall to three-month low after soft jobs data", summary: "10-year yield dropped 11bp to 4.02%, lifting core bond funds and rate-sensitive sectors.", symbols: ["BND"], sentiment: 0.42, category: "Macro" },
  { h: 14.2, source: "The Information", headline: "Microsoft expands Azure AI capacity with $80B capex plan", summary: "Analysts see capex intensity peaking next year as monetisation of Copilot broadens.", symbols: ["MSFT", "NVDA"], sentiment: 0.35, category: "Tech" },
  { h: 18.9, source: "Nikkei", headline: "Toyota lifts full-year outlook as hybrid demand offsets weaker yen tailwind", summary: "Operating profit guidance raised 4%; the company announced a ¥1T buyback.", symbols: ["7203"], sentiment: 0.55, category: "Earnings" },
  { h: 22.4, source: "CoinDesk", headline: "Bitcoin ETF inflows top $1.2B in a week as BTC tests $95K", summary: "Spot ETF demand continues to absorb new supply; volatility remains elevated.", symbols: ["BTC"], sentiment: 0.48, category: "Crypto" },
  { h: 26.0, source: "Reuters", headline: "Shell to cut buyback pace as refining margins compress", summary: "Buyback trimmed to $3B/quarter; dividend maintained.", symbols: ["SHEL", "XOM"], sentiment: -0.38, category: "Energy" },
  { h: 31.5, source: "Bloomberg", headline: "Tencent profit beats on gaming rebound, shares rally in Hong Kong", summary: "Domestic gaming revenue grew 14% while ad revenue rose 20%.", symbols: ["TCEHY"], sentiment: 0.58, category: "Earnings" },
  { h: 38.0, source: "FT", headline: "Nestlé names new chairman amid pressure to revive volume growth", summary: "Investors want faster portfolio pruning; organic growth guidance cut to ~2%.", symbols: ["NESN"], sentiment: -0.31, category: "Corporate" },
  { h: 44.3, source: "WSJ", headline: "JPMorgan raises net interest income guide; Dimon cautious on consumer credit", summary: "NII now seen at $94B; card charge-offs expected to tick up.", symbols: ["JPM"], sentiment: 0.22, category: "Earnings" },
  { h: 52.7, source: "Barron's", headline: "Tesla robotaxi rollout slips to next year, shares drop 7%", summary: "Regulatory approvals in key states remain outstanding.", symbols: ["TSLA"], sentiment: -0.52, category: "Tech" },
  { h: 60.2, source: "Reuters", headline: "Gold notches record high as central-bank buying accelerates", summary: "Official sector purchases hit 290 tonnes last quarter, led by China and Poland.", symbols: ["GLD"], sentiment: 0.6, category: "Commodities" },
];

// Events: offsets in calendar days from today
export const EVENTS_SEED: { d: number; symbol: string | null; kind: string; title: string; detail: string }[] = [
  { d: 1, symbol: null, kind: "Macro", title: "US CPI (MoM)", detail: "Consensus 0.2% · Prior 0.3%" },
  { d: 2, symbol: "COST", kind: "Earnings", title: "Costco Q1 earnings", detail: "EPS est. $4.11 · After close" },
  { d: 3, symbol: "SCHD", kind: "Dividend", title: "SCHD ex-dividend", detail: "Est. $0.26/share" },
  { d: 5, symbol: "V", kind: "Dividend", title: "Visa dividend payment", detail: "$0.59/share" },
  { d: 7, symbol: null, kind: "Macro", title: "FOMC rate decision", detail: "Market-implied: 72% hold" },
  { d: 9, symbol: "MSFT", kind: "Dividend", title: "Microsoft ex-dividend", detail: "$0.83/share" },
  { d: 12, symbol: "NVDA", kind: "Meeting", title: "NVIDIA GTC keynote", detail: "Roadmap update" },
  { d: 14, symbol: "ASML", kind: "Earnings", title: "ASML Q4 earnings", detail: "Bookings in focus · Pre-market" },
  { d: 16, symbol: "BND", kind: "Dividend", title: "BND monthly distribution", detail: "Est. $0.22/share" },
  { d: 19, symbol: "JPM", kind: "Earnings", title: "JPMorgan Q4 earnings", detail: "EPS est. $4.03" },
  { d: 21, symbol: "SAP", kind: "Earnings", title: "SAP Q4 earnings", detail: "Cloud backlog guide" },
  { d: 24, symbol: "AAPL", kind: "Earnings", title: "Apple Q1 earnings", detail: "EPS est. $2.35 · After close" },
  { d: 25, symbol: "META", kind: "Earnings", title: "Meta Q4 earnings", detail: "Capex outlook in focus" },
  { d: 26, symbol: "MSFT", kind: "Earnings", title: "Microsoft Q2 earnings", detail: "Azure growth est. 31%" },
  { d: 28, symbol: "AMZN", kind: "Earnings", title: "Amazon Q4 earnings", detail: "AWS margin watch" },
  { d: 31, symbol: null, kind: "Macro", title: "US Non-farm payrolls", detail: "Consensus 165K" },
  { d: 34, symbol: "GOOGL", kind: "Earnings", title: "Alphabet Q4 earnings", detail: "Cloud & search share" },
  { d: 38, symbol: "LLY", kind: "Earnings", title: "Eli Lilly Q4 earnings", detail: "Mounjaro/Zepbound sales" },
];
