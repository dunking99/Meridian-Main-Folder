/**
 * Meridian — persistence + reads
 * ---------------------------------------------------------------------------
 * The app is a single-user system, so the database is a local store for the
 * generated market data. `seedDatabase` writes a fresh bundle; `ensureSeeded`
 * is called by the data layer so a cold sandbox bootstraps itself.
 */
import { db } from "@/db";
import {
  accounts,
  benchmarks,
  cashBalances,
  events,
  fundHoldings,
  fxRates,
  holdings,
  instruments,
  news,
  prices,
  transactions,
} from "@/db/schema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  ACCOUNTS,
  FUND_CONSTITUENTS,
  HELD,
  INSTRUMENTS,
  TARGET_WEIGHTS,
} from "./universe";
import { buildSeedBundle } from "./generate";

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function isSeeded(): Promise<boolean> {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(instruments);
  return (rows[0]?.n ?? 0) > 0;
}

export async function seedDatabase(seed = 20260923) {
  const bundle = buildSeedBundle(seed);

  await db.delete(transactions);
  await db.delete(holdings);
  await db.delete(cashBalances);
  await db.delete(fundHoldings);
  await db.delete(prices);
  await db.delete(benchmarks);
  await db.delete(fxRates);
  await db.delete(news);
  await db.delete(events);
  await db.delete(accounts);
  await db.delete(instruments);

  await db.insert(instruments).values(
    INSTRUMENTS.map((i) => ({
      symbol: i.symbol,
      name: i.name,
      kind: i.kind,
      exchange: i.exchange,
      currency: i.currency,
      country: i.country,
      region: i.region,
      sector: i.sector,
      industry: i.industry,
      assetClass: i.assetClass,
      style: i.style,
      marketCap: i.marketCap,
      pe: i.pe,
      pb: i.pb,
      divYield: i.divYield,
      expenseRatio: i.expenseRatio,
      summary: i.summary,
    })),
  );

  await db.insert(accounts).values(
    ACCOUNTS.map((a) => ({ ...a, openedOn: a.openedOn })),
  );

  const priceRows: (typeof prices.$inferInsert)[] = [];
  for (const [sym, values] of Object.entries(bundle.prices.bySymbol)) {
    bundle.prices.dates.forEach((date, i) => {
      priceRows.push({ symbol: sym, date, close: values[i] });
    });
  }
  for (const part of chunk(priceRows, 3000)) {
    await db.insert(prices).values(part);
  }

  const benchRows: (typeof benchmarks.$inferInsert)[] = [];
  for (const [sym, values] of Object.entries(bundle.benchmarks.bySymbol)) {
    bundle.benchmarks.dates.forEach((date, i) => {
      benchRows.push({ symbol: sym, date, close: values[i] });
    });
  }
  for (const part of chunk(benchRows, 3000)) {
    await db.insert(benchmarks).values(part);
  }

  const fxRows: (typeof fxRates.$inferInsert)[] = [];
  for (const [code, values] of Object.entries(bundle.fx.byCode)) {
    bundle.fx.dates.forEach((date, i) => {
      fxRows.push({ code, date, rate: values[i] });
    });
  }
  for (const part of chunk(fxRows, 3000)) {
    await db.insert(fxRates).values(part);
  }

  const fh: (typeof fundHoldings.$inferInsert)[] = [];
  for (const [fund, cons] of Object.entries(FUND_CONSTITUENTS)) {
    if (!HELD.includes(fund as (typeof HELD)[number])) continue;
    const merged = new Map<string, number>();
    for (const [c, w] of cons) merged.set(c, (merged.get(c) ?? 0) + w);
    for (const [c, w] of merged) fh.push({ fundSymbol: fund, constituentSymbol: c, weight: w });
  }
  await db.insert(fundHoldings).values(fh);

  await db.insert(holdings).values(
    bundle.sim.holdings.map((h) => ({
      symbol: h.symbol,
      accountId: h.accountId,
      shares: h.shares,
      avgCost: h.avgCost,
      openedOn: h.openedOn,
      targetWeight: TARGET_WEIGHTS[h.symbol] ?? 0,
    })),
  );

  await db.insert(cashBalances).values(bundle.sim.cash);

  await db.insert(transactions).values(
    bundle.sim.transactions.map((t) => ({
      symbol: t.symbol,
      accountId: t.accountId,
      date: t.date,
      side: t.side,
      shares: t.shares,
      price: t.price,
      amount: t.amount,
      fee: t.fee,
      note: t.note,
    })),
  );

  await db.insert(news).values(
    bundle.news.map((n) => ({
      headline: n.headline,
      summary: n.summary,
      source: n.source,
      url: n.url,
      publishedAt: n.publishedAt,
      category: n.category,
      sentiment: n.sentiment,
      importance: n.importance,
      symbols: n.symbols,
    })),
  );

  await db.insert(events).values(bundle.events);

  return {
    instruments: INSTRUMENTS.length,
    prices: priceRows.length,
    transactions: bundle.sim.transactions.length,
  };
}

let ensurePromise: Promise<boolean> | null = null;

/** Idempotent: only seeds when the store is empty. */
export async function ensureSeeded(): Promise<boolean> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const done = await isSeeded();
      if (done) return false;
      await seedDatabase();
      return true;
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

/* ── reads ─────────────────────────────────────────────────────────────────── */

export interface RawData {
  instruments: (typeof instruments.$inferSelect)[];
  prices: { symbol: string; date: string; close: number }[];
  benchmarks: { symbol: string; date: string; close: number }[];
  fx: { code: string; date: string; rate: number }[];
  accounts: (typeof accounts.$inferSelect)[];
  holdings: (typeof holdings.$inferSelect)[];
  transactions: (typeof transactions.$inferSelect)[];
  cash: (typeof cashBalances.$inferSelect)[];
  fundHoldings: (typeof fundHoldings.$inferSelect)[];
  news: (typeof news.$inferSelect)[];
  events: (typeof events.$inferSelect)[];
}

export async function loadRaw(): Promise<RawData> {
  await ensureSeeded();

  const [instr, priceRows, benchRows, fxRows, accts, hold, txs, cash, fh, newsRows, eventRows] =
    await Promise.all([
      db.select().from(instruments),
      db.select().from(prices),
      db.select().from(benchmarks),
      db.select().from(fxRates),
      db.select().from(accounts),
      db.select().from(holdings),
      db.select().from(transactions),
      db.select().from(cashBalances),
      db.select().from(fundHoldings),
      db.select().from(news).orderBy(sql`${news.publishedAt} desc`),
      db.select().from(events),
    ]);

  return {
    instruments: instr,
    prices: priceRows,
    benchmarks: benchRows,
    fx: fxRows,
    accounts: accts,
    holdings: hold,
    transactions: txs,
    cash,
    fundHoldings: fh,
    news: newsRows,
    events: eventRows,
  };
}

export async function loadInstrument(symbol: string) {
  await ensureSeeded();
  const [inst] = await db.select().from(instruments).where(eq(instruments.symbol, symbol));
  if (!inst) return null;
  const [px, txs, evts, nws, fh] = await Promise.all([
    db.select().from(prices).where(eq(prices.symbol, symbol)).orderBy(prices.date),
    db.select().from(transactions).where(eq(transactions.symbol, symbol)).orderBy(transactions.date),
    db.select().from(events).where(eq(events.symbol, symbol)),
    db.select().from(news).orderBy(sql`${news.publishedAt} desc`),
    db
      .select()
      .from(fundHoldings)
      .where(eq(fundHoldings.constituentSymbol, symbol)),
  ]);
  return { instrument: inst, prices: px, transactions: txs, events: evts, news: nws, fundOf: fh };
}

/** Windowed series used by the range-limited views. */
export async function loadSeriesSince(fromDate: string) {
  await ensureSeeded();
  const [px, fxRows, benchRows] = await Promise.all([
    db.select().from(prices).where(gte(prices.date, fromDate)),
    db.select().from(fxRates).where(gte(fxRates.date, fromDate)),
    db.select().from(benchmarks).where(gte(benchmarks.date, fromDate)),
  ]);
  return { prices: px, fx: fxRows, benchmarks: benchRows };
}

export async function symbolsInUniverse() {
  return INSTRUMENTS.map((i) => i.symbol);
}

export async function loadHoldingsForSymbols(symbols: string[]) {
  if (!symbols.length) return [];
  return db.select().from(holdings).where(inArray(holdings.symbol, symbols));
}

export async function transactionsBetween(from: string, to: string) {
  return db
    .select()
    .from(transactions)
    .where(and(gte(transactions.date, from), lte(transactions.date, to)));
}
