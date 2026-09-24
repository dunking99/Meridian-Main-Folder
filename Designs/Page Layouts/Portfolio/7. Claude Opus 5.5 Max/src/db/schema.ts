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

/** Static + reference attributes for every security (holdings and benchmarks). */
export type InstrumentMeta = {
  color: string;
  description: string;
  account: "brokerage" | "ira" | "crypto";
  divYield: number; // annual %, e.g. 0.5
  divFreq: number; // payments per year
  divMonths: number[]; // ex-dividend months (1-12)
  exDay: number;
  earnMonths: number[];
  earnDay: number;
  pe: number | null;
  beta: number;
  mcap: number | null; // USD bn
  ter: number; // expense ratio %
  style: Record<string, number>; // style-box cells e.g. { LG: 1 }
  sectors?: Record<string, number>; // look-through sector weights (sum 1)
  countries?: Record<string, number>; // look-through country weights (sum 1)
  top?: [string, string, number][]; // [issuerKey, name, weight %]
};

export const instruments = pgTable("instruments", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // stock | etf | crypto | benchmark
  assetClass: text("asset_class").notNull(),
  sector: text("sector").notNull(),
  industry: text("industry").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  exchange: text("exchange").notNull(),
  meta: jsonb("meta").$type<InstrumentMeta>().notNull(),
});

export const prices = pgTable(
  "prices",
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
    currency: text("currency").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    usdPerUnit: doublePrecision("usd_per_unit").notNull(),
  },
  (t) => [primaryKey({ columns: [t.currency, t.date] })],
);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  type: text("type").notNull(), // BUY SELL DIVIDEND DEPOSIT WITHDRAWAL INTEREST FEE
  symbol: text("symbol"),
  account: text("account").notNull(),
  quantity: doublePrecision("quantity").notNull().default(0),
  price: doublePrecision("price").notNull().default(0), // local currency
  amount: doublePrecision("amount").notNull(), // signed USD cash impact
  fee: doublePrecision("fee").notNull().default(0), // USD
  fxRate: doublePrecision("fx_rate").notNull().default(1), // USD per unit of local ccy
  note: text("note"),
  source: text("source").notNull().default("auto"), // auto | manual
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  symbol: text("symbol"),
  type: text("type").notNull(), // earnings | ex_div | dividend | macro
  title: text("title").notNull(),
  detail: text("detail"),
  importance: integer("importance").notNull().default(2),
});

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  publishedAt: timestamp("published_at", { mode: "string" }).notNull(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  source: text("source").notNull(),
  symbols: jsonb("symbols").$type<string[]>().notNull(),
  topics: jsonb("topics").$type<string[]>().notNull(),
  sentiment: doublePrecision("sentiment").notNull(),
  impact: text("impact").notNull(), // high | medium | low
});

export const holdingNotes = pgTable("holding_notes", {
  symbol: text("symbol").primaryKey(),
  thesis: text("thesis").notNull().default(""),
  conviction: integer("conviction").notNull().default(3),
  targetPrice: doublePrecision("target_price"),
  reviewDate: date("review_date", { mode: "string" }),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
