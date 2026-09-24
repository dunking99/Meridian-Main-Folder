import {
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Meridian — data model
 * ---------------------------------------------------------------------------
 * instruments : reference data for every tradable thing in the book
 * prices      : daily close series (in the instrument's own currency)
 * benchmarks  : daily close series for reference indices
 * fxRates     : daily USD-per-unit rates, used by the base-currency switch
 * accounts    : the (single-user) accounts the book is spread across
 * holdings    : open positions (shares + average cost) per account
 * transactions: the full ledger (buys, sells, dividends, fees, cash flows)
 * cashBalances: current cash per account/currency
 * fundHoldings : look-through constituents of the funds held (overlap analysis)
 * news / events: the "market context" layer that can be cross-referenced
 */

export const instruments = pgTable("instruments", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // equity | etf | bond_etf | reit_etf | commodity_etf | cash
  exchange: text("exchange").notNull(),
  currency: text("currency").notNull(),
  country: text("country").notNull(), // ISO-3166 alpha-2
  region: text("region").notNull(),
  sector: text("sector").notNull(),
  industry: text("industry").notNull(),
  assetClass: text("asset_class").notNull(), // Equity | Fixed Income | Alternatives | Cash
  style: text("style").notNull(), // Growth | Blend | Value
  marketCap: doublePrecision("market_cap").notNull(), // USD billions
  pe: doublePrecision("pe").notNull(),
  pb: doublePrecision("pb").notNull(),
  divYield: doublePrecision("div_yield").notNull(), // percent
  expenseRatio: doublePrecision("expense_ratio").notNull(), // percent
  summary: text("summary").notNull(),
});

export const prices = pgTable(
  "prices",
  {
    symbol: text("symbol")
      .notNull()
      .references(() => instruments.symbol),
    date: date("date", { mode: "string" }).notNull(),
    close: doublePrecision("close").notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.date] })],
);

export const benchmarks = pgTable(
  "benchmarks",
  {
    symbol: text("symbol").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    close: doublePrecision("close").notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.date] })],
);

export const fxRates = pgTable(
  "fx_rates",
  {
    code: text("code").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    rate: doublePrecision("rate").notNull(), // USD per 1 unit
  },
  (t) => [primaryKey({ columns: [t.code, t.date] })],
);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // taxable | retirement | pension | cash
  broker: text("broker").notNull(),
  baseCurrency: text("base_currency").notNull(),
  openedOn: date("opened_on", { mode: "string" }).notNull(),
});

export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  symbol: text("symbol")
    .notNull()
    .references(() => instruments.symbol),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  shares: doublePrecision("shares").notNull(),
  avgCost: doublePrecision("avg_cost").notNull(),
  openedOn: date("opened_on", { mode: "string" }).notNull(),
  targetWeight: doublePrecision("target_weight").notNull(), // percent of total portfolio
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol"),
  accountId: text("account_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  side: text("side").notNull(), // buy | sell | dividend | fee | deposit | withdrawal
  shares: doublePrecision("shares").notNull(),
  price: doublePrecision("price").notNull(),
  amount: doublePrecision("amount").notNull(), // signed cash impact, in position currency
  fee: doublePrecision("fee").notNull(),
  note: text("note").notNull(),
});

export const cashBalances = pgTable("cash_balances", {
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  currency: text("currency").notNull(),
  amount: doublePrecision("amount").notNull(),
  updatedOn: date("updated_on", { mode: "string" }).notNull(),
});

export const fundHoldings = pgTable(
  "fund_holdings",
  {
    fundSymbol: text("fund_symbol")
      .notNull()
      .references(() => instruments.symbol),
    constituentSymbol: text("constituent_symbol").notNull(),
    weight: doublePrecision("weight").notNull(), // percent of the fund
  },
  (t) => [primaryKey({ columns: [t.fundSymbol, t.constituentSymbol] })],
);

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  category: text("category").notNull(), // company | macro | sector | markets
  sentiment: doublePrecision("sentiment").notNull(), // -1..1
  importance: integer("importance").notNull(), // 1..3
  symbols: jsonb("symbols").notNull().$type<string[]>(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  kind: text("kind").notNull(), // earnings | dividend | split | conference | index | regulatory
  date: date("date", { mode: "string" }).notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  estimate: text("estimate").notNull(),
});

export type Instrument = typeof instruments.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Benchmark = typeof benchmarks.$inferSelect;
export type FxRate = typeof fxRates.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type CashBalance = typeof cashBalances.$inferSelect;
export type FundHolding = typeof fundHoldings.$inferSelect;
export type News = typeof news.$inferSelect;
export type Event = typeof events.$inferSelect;
