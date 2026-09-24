import {
  pgTable,
  text,
  doublePrecision,
  serial,
  boolean,
  jsonb,
  primaryKey,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export type LookThrough = { symbol: string; name: string; weight: number }[];

export const instruments = pgTable("instruments", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // Equity | ETF | Crypto | Bond ETF | Commodity
  assetClass: text("asset_class").notNull(), // Equities | Fixed Income | Alternatives
  sector: text("sector").notNull(),
  industry: text("industry").notNull(),
  country: text("country").notNull(), // ISO2
  region: text("region").notNull(),
  currency: text("currency").notNull(),
  exchange: text("exchange").notNull(),
  beta: doublePrecision("beta").notNull(),
  divYield: doublePrecision("div_yield").notNull(),
  pe: doublePrecision("pe"),
  marketCapB: doublePrecision("market_cap_b"),
  expenseRatio: doublePrecision("expense_ratio"),
  style: text("style").notNull(), // Value | Blend | Growth
  size: text("size").notNull(), // Large | Mid | Small
  description: text("description").notNull(),
  lookThrough: jsonb("look_through").$type<LookThrough>(),
  isBenchmark: boolean("is_benchmark").notNull().default(false),
});

export const prices = pgTable(
  "prices",
  {
    symbol: text("symbol").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    close: doublePrecision("close").notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.date] })]
);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  kind: text("kind").notNull(), // BUY | SELL | DIVIDEND | DEPOSIT | WITHDRAWAL | FEE | INTEREST
  symbol: text("symbol"),
  quantity: doublePrecision("quantity").notNull().default(0),
  price: doublePrecision("price").notNull().default(0),
  amount: doublePrecision("amount").notNull(), // signed cash effect in `currency`
  currency: text("currency").notNull(),
  note: text("note"),
});

export const fxRates = pgTable("fx_rates", {
  currency: text("currency").primaryKey(),
  usdPer: doublePrecision("usd_per").notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  symbol: text("symbol"),
  kind: text("kind").notNull(), // Earnings | Dividend | Macro | Meeting | Split
  title: text("title").notNull(),
  detail: text("detail"),
});

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  publishedAt: timestamp("published_at", { mode: "string" }).notNull(),
  source: text("source").notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  symbols: jsonb("symbols").$type<string[]>().notNull(),
  sentiment: doublePrecision("sentiment").notNull(),
  category: text("category").notNull(),
});

export const targets = pgTable("targets", {
  bucket: text("bucket").primaryKey(),
  weight: doublePrecision("weight").notNull(),
});
