import {
  pgTable,
  text,
  real,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  primaryKey,
  serial,
} from "drizzle-orm/pg-core";

/** Individual positions in the portfolio. `id` is the ticker symbol. */
export const holdings = pgTable("holdings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  assetClass: text("asset_class").notNull(), // stock | etf | bond-fund | commodity | cash
  sector: text("sector").notNull(),
  country: text("country").notNull(),
  countryIso: text("country_iso").notNull(),
  currency: text("currency").notNull(),
  quantity: doublePrecision("quantity").notNull(),
  avgCost: doublePrecision("avg_cost").notNull(),
  description: text("description").notNull().default(""),
  /** For funds/ETFs: the large names they are built from (used for overlap analysis). */
  topHoldings: text("top_holdings").array().default([]),
  /** Free-form numeric facts: pe, divYield, mcapB, beta, overlapSpx, regionMix, capMix, sectorMix, top10. */
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
});

/** Daily closing prices, one row per symbol per trading day (includes benchmark SPX). */
export const pricesDaily = pgTable(
  "prices_daily",
  {
    symbol: text("symbol").notNull(),
    date: date("date").notNull(),
    close: doublePrecision("close").notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.date] })]
);

/** One row per trading day: total portfolio value, cash, benchmark level. */
export const snapshots = pgTable("snapshots", {
  date: date("date").primaryKey(),
  value: doublePrecision("value").notNull(),
  cash: doublePrecision("cash").notNull(),
  benchmark: doublePrecision("benchmark").notNull(),
});

export const newsItems = pgTable("news_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  symbols: text("symbols").array().default([]),
  summary: text("summary").notNull().default(""),
  sentiment: doublePrecision("sentiment").notNull().default(0),
  impact: doublePrecision("impact").notNull().default(0),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  title: text("title").notNull(),
  eventType: text("event_type").notNull(), // earnings | macro | dividends | fund
  date: timestamp("date", { withTimezone: true }).notNull(),
  importance: integer("importance").notNull().default(2),
});

export type Holding = typeof holdings.$inferSelect;
export type NewsItem = typeof newsItems.$inferSelect;
export type EventRow = typeof events.$inferSelect;
