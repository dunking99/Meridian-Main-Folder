import { pgTable, serial, text, real, date, timestamp } from "drizzle-orm/pg-core";

// A single-user investing app: one portfolio, many holdings.
export const portfolioMeta = pgTable("portfolio_meta", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  baseCurrency: text("base_currency").notNull(),
  cash: real("cash").notNull(),
  inceptionDate: date("inception_date").notNull(),
});

export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  assetClass: text("asset_class").notNull(), // Equity | ETF | Fixed Income | Commodity | Crypto
  sector: text("sector").notNull(),
  region: text("region").notNull(), // North America | Europe | Asia Pacific | Emerging Markets | Global
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  quantity: real("quantity").notNull(),
  avgCost: real("avg_cost").notNull(),
  currentPrice: real("current_price").notNull(),
  prevClose: real("prev_close").notNull(),
  beta: real("beta").notNull(),
  dividendYield: real("dividend_yield").notNull(),
  marketCap: real("market_cap").notNull(), // in billions USD
  peRatio: real("pe_ratio"),
  accent: text("accent").notNull(),
});

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  d: date("d").notNull(),
  close: real("close").notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  d: date("d").notNull(),
  type: text("type").notNull(), // Buy | Sell | Dividend
  quantity: real("quantity").notNull(),
  price: real("price").notNull(),
  amount: real("amount").notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  d: date("d").notNull(),
  type: text("type").notNull(), // Earnings | Dividend | Split | Guidance
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  impact: text("impact").notNull(), // high | medium | low
});

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  source: text("source").notNull(),
  publishedAt: timestamp("published_at").notNull(),
  sentiment: real("sentiment").notNull(), // -1 .. 1
  category: text("category").notNull(),
  summary: text("summary").notNull(),
  tickers: text("tickers").array().notNull(),
});

export const fxRates = pgTable("fx_rates", {
  id: serial("id").primaryKey(),
  currency: text("currency").notNull(),
  symbol: text("symbol").notNull(),
  perUsd: real("per_usd").notNull(), // 1 USD = perUsd of this currency
});

export const etfConstituents = pgTable("etf_constituents", {
  id: serial("id").primaryKey(),
  etfSymbol: text("etf_symbol").notNull(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  weight: real("weight").notNull(),
  sector: text("sector").notNull(),
});
