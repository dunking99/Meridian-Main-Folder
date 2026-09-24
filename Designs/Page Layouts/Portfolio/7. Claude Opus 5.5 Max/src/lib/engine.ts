import { cache } from "react";
import { cookies } from "next/headers";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabase } from "@/db/seed";
import {
  events as eventsTable,
  fxRates,
  holdingNotes,
  instruments,
  news as newsTable,
  prices,
  transactions,
  type InstrumentMeta,
} from "@/db/schema";
import { COUNTRIES, isCcy, rateOn, type Ccy, type Region, type Sleeve } from "./reference";

export type Instrument = {
  symbol: string; name: string; kind: string; assetClass: string; sector: string; industry: string;
  country: string; currency: string; exchange: string; meta: InstrumentMeta;
};
export type Txn = typeof transactions.$inferSelect;
export type NewsItem = typeof newsTable.$inferSelect;
export type EventItem = typeof eventsTable.$inferSelect;
export type Note = typeof holdingNotes.$inferSelect;

export type Market = {
  instruments: Instrument[];
  bySym: Record<string, Instrument>;
  dates: string[];
  px: Record<string, Float64Array>;
  fx: Record<string, Float64Array>;
  at: number;
};

// ————————————————————————————————— market data (process cache)
let marketCache: Market | null = null;
export function invalidateMarket() {
  marketCache = null;
}

function ffill(a: Float64Array) {
  let first = NaN;
  for (let i = 0; i < a.length; i++) if (!Number.isNaN(a[i])) { first = a[i]; break; }
  let last = first;
  for (let i = 0; i < a.length; i++) {
    if (Number.isNaN(a[i])) a[i] = last;
    else last = a[i];
  }
}

export async function loadMarket(): Promise<Market> {
  await ensureDatabase();
  if (marketCache && Date.now() - marketCache.at < 5 * 60_000) return marketCache;
  const [ins, pr, fr] = await Promise.all([
    db.select().from(instruments),
    db.select().from(prices).orderBy(asc(prices.date)),
    db.select().from(fxRates).orderBy(asc(fxRates.date)),
  ]);
  const set = new Set<string>();
  for (const p of pr) set.add(p.date);
  const dates = [...set].sort();
  const di = new Map(dates.map((d, i) => [d, i]));
  const n = dates.length;
  const px: Record<string, Float64Array> = {};
  for (const p of pr) {
    const a = (px[p.symbol] ??= new Float64Array(n).fill(NaN));
    a[di.get(p.date)!] = p.close;
  }
  const fx: Record<string, Float64Array> = { USD: new Float64Array(n).fill(1) };
  for (const f of fr) {
    const a = (fx[f.currency] ??= new Float64Array(n).fill(NaN));
    const i = di.get(f.date);
    if (i !== undefined) a[i] = f.usdPerUnit;
  }
  Object.values(px).forEach(ffill);
  Object.values(fx).forEach(ffill);
  const list = ins as Instrument[];
  marketCache = { instruments: list, bySym: Object.fromEntries(list.map((i) => [i.symbol, i])), dates, px, fx, at: Date.now() };
  return marketCache;
}

// ————————————————————————————————— date helpers
export function bsearchLE(dates: string[], d: string) {
  let lo = 0;
  let hi = dates.length - 1;
  if (hi < 0 || d < dates[0]) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (dates[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
export function bsearchGE(dates: string[], d: string) {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function shiftDate(d: string, { days = 0, months = 0, years = 0 }: { days?: number; months?: number; years?: number }) {
  const dt = new Date(d + "T00:00:00Z");
  if (years || months) {
    const day = dt.getUTCDate();
    dt.setUTCDate(1);
    dt.setUTCMonth(dt.getUTCMonth() + months + years * 12);
    const dim = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(day, dim));
  }
  if (days) dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000);
}

export const HORIZONS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "ITD"] as const;
export type Horizon = (typeof HORIZONS)[number];
/** Base date (exclusive start) for a horizon, relative to asOf. */
export function horizonBaseDate(asOf: string, h: Horizon, prevDate: string): string | null {
  switch (h) {
    case "1D": return prevDate;
    case "1W": return shiftDate(asOf, { days: -7 });
    case "1M": return shiftDate(asOf, { months: -1 });
    case "3M": return shiftDate(asOf, { months: -3 });
    case "6M": return shiftDate(asOf, { months: -6 });
    case "YTD": return `${Number(asOf.slice(0, 4)) - 1}-12-31`;
    case "1Y": return shiftDate(asOf, { years: -1 });
    case "3Y": return shiftDate(asOf, { years: -3 });
    case "5Y": return shiftDate(asOf, { years: -5 });
    case "ITD": return null;
  }
}

// ————————————————————————————————— portfolio model
export type Lot = { date: string; qty: number; costPer: number; localPer: number };
export type RealizedLot = { symbol: string; buyDate: string; sellDate: string; qty: number; proceeds: number; cost: number; gain: number; longTerm: boolean };

export type Position = {
  symbol: string;
  inst: Instrument;
  qty: number;
  price: number;
  prevPrice: number;
  priceDisp: number;
  value: number;
  prevValue: number;
  dayChange: number;
  dayPct: number;
  weight: number;
  cost: number;
  avgCostLocal: number;
  unrealized: number;
  unrealizedPct: number;
  realized: number;
  dividends: number;
  fees: number;
  totalReturn: number;
  totalReturnPct: number;
  firstBuy: string;
  lots: Lot[];
  sleeve: Sleeve;
  region: Region;
  ret: Partial<Record<Horizon, number>>;
  spark: number[];
};
export type ClosedPosition = { symbol: string; inst: Instrument; realized: number; dividends: number; firstBuy: string; lastSell: string; proceeds: number; cost: number };
export type TxView = Txn & { k: number; amountDisp: number };

export type Core = {
  ccy: Ccy;
  asOf: string;
  prevDate: string;
  start: number;
  dates: string[];
  value: number[];
  invested: number[];
  cash: number[];
  flows: number[];
  ret: number[];
  index: number[];
  income: number[];
  feesDaily: number[];
  rf: number[];
  positions: Position[];
  closed: ClosedPosition[];
  realizedLots: RealizedLot[];
  qtyHist: Record<string, Float64Array>;
  txns: TxView[];
  txBySym: Record<string, TxView[]>;
  bench: Record<BenchKey, { label: string; index: number[]; ret: number[] }>;
  market: Market;
  fxD: Float64Array;
  totals: {
    value: number; cash: number; invested: number; deposits: number; withdrawals: number; unrealized: number; realized: number;
    dividends: number; interest: number; fees: number; dayChange: number; dayPct: number; totalGain: number; totalGainPct: number;
    positions: number; costBasis: number;
  };
};
export type BenchKey = "SPX" | "ACWI" | "AGG" | "6040";
export const BENCH_LABELS: Record<BenchKey, string> = { SPX: "S&P 500", ACWI: "MSCI ACWI", AGG: "US Agg Bond", "6040": "60/40 Global" };

export function sleeveOf(inst: Instrument): Sleeve {
  switch (inst.assetClass) {
    case "Fixed Income": return "Fixed Income";
    case "Real Estate": return "Real Estate";
    case "Commodities": return "Commodities";
    case "Crypto": return "Crypto";
    default: return inst.country === "US" ? "US Equity" : "Intl Equity";
  }
}
export function regionOf(inst: Instrument): Region {
  return COUNTRIES[inst.country]?.region ?? "Global";
}

/** Price of an instrument in display currency at market index i. */
export function pxDisp(core: Pick<Core, "market" | "fxD">, sym: string, i: number) {
  const inst = core.market.bySym[sym];
  const f = core.market.fx[inst?.currency ?? "USD"] ?? core.market.fx.USD;
  return (core.market.px[sym][i] * f[i]) / core.fxD[i];
}

export function computeCore(market: Market, txnsRaw: Txn[], ccy: Ccy): Core {
  const { dates, px, fx, bySym } = market;
  const fxD = fx[ccy] ?? fx.USD;
  const nAll = dates.length;
  const asOfIdx = nAll - 1;
  const firstDate = txnsRaw.length ? txnsRaw[0].date : dates[0];
  const start = Math.min(bsearchGE(dates, firstDate), asOfIdx);
  const n = asOfIdx - start + 1;

  const txns: TxView[] = [];
  const byK: TxView[][] = Array.from({ length: n }, () => []);
  for (const t of txnsRaw) {
    const i = bsearchGE(dates, t.date);
    if (i > asOfIdx) continue;
    const k = Math.max(0, i - start);
    const tv: TxView = { ...t, k, amountDisp: t.amount / fxD[start + k] };
    txns.push(tv);
    byK[k].push(tv);
  }
  const txBySym: Record<string, TxView[]> = {};
  for (const t of txns) if (t.symbol) (txBySym[t.symbol] ??= []).push(t);

  type St = { qty: number; lots: Lot[]; realized: number; dividends: number; fees: number; firstBuy: string; lastSell: string; proceeds: number; soldCost: number };
  const st: Record<string, St> = {};
  const qtyHist: Record<string, Float64Array> = {};
  const realizedLots: RealizedLot[] = [];
  const value = new Array<number>(n);
  const invested = new Array<number>(n);
  const cash = new Array<number>(n);
  const flows = new Array<number>(n);
  const ret = new Array<number>(n);
  const index = new Array<number>(n);
  const income = new Array<number>(n).fill(0);
  const feesDaily = new Array<number>(n).fill(0);
  const rf = new Array<number>(n);
  let cashUsd = 0;
  let cumInv = 0;
  let deposits = 0;
  let withdrawals = 0;
  let interest = 0;
  let feesTotal = 0;

  for (let k = 0; k < n; k++) {
    const i = start + k;
    const f = fxD[i];
    let flowUsd = 0;
    for (const t of byK[k]) {
      cashUsd += t.amount;
      const amt = t.amount / f;
      const s = t.symbol ? (st[t.symbol] ??= { qty: 0, lots: [], realized: 0, dividends: 0, fees: 0, firstBuy: t.date, lastSell: "", proceeds: 0, soldCost: 0 }) : null;
      if (t.fee) {
        feesDaily[k] += t.fee / f;
        feesTotal += t.fee / f;
        if (s) s.fees += t.fee / f;
      }
      switch (t.type) {
        case "DEPOSIT":
          flowUsd += t.amount;
          deposits += amt;
          break;
        case "WITHDRAWAL":
          flowUsd += t.amount;
          withdrawals += -amt;
          break;
        case "BUY":
          if (s && t.quantity > 0) {
            if (s.qty <= 1e-9) s.firstBuy = s.lots.length ? s.firstBuy : t.date;
            s.qty += t.quantity;
            s.lots.push({ date: t.date, qty: t.quantity, costPer: -amt / t.quantity, localPer: t.price });
          }
          break;
        case "SELL":
          if (s && t.quantity > 0) {
            let q = t.quantity;
            const proceedsPer = amt / t.quantity;
            let costRemoved = 0;
            while (q > 1e-9 && s.lots.length) {
              const lot = s.lots[0];
              const take = Math.min(q, lot.qty);
              costRemoved += take * lot.costPer;
              realizedLots.push({
                symbol: t.symbol!, buyDate: lot.date, sellDate: t.date, qty: take, proceeds: take * proceedsPer, cost: take * lot.costPer,
                gain: take * (proceedsPer - lot.costPer), longTerm: daysBetween(lot.date, t.date) > 365,
              });
              lot.qty -= take;
              q -= take;
              if (lot.qty <= 1e-9) s.lots.shift();
            }
            s.qty = Math.max(0, s.qty - t.quantity);
            if (s.qty < 1e-9) s.qty = 0;
            s.realized += amt - costRemoved;
            s.proceeds += amt;
            s.soldCost += costRemoved;
            s.lastSell = t.date;
          }
          break;
        case "DIVIDEND":
          if (s) s.dividends += amt;
          income[k] += amt;
          break;
        case "INTEREST":
          interest += amt;
          income[k] += amt;
          break;
        case "FEE":
          feesDaily[k] += -amt;
          feesTotal += -amt;
          break;
      }
    }
    let mvUsd = 0;
    for (const sym in st) {
      const s = st[sym];
      const h = (qtyHist[sym] ??= new Float64Array(n));
      h[k] = s.qty;
      if (s.qty > 0) mvUsd += s.qty * px[sym][i] * (fx[bySym[sym]?.currency ?? "USD"] ?? fx.USD)[i];
    }
    const flowD = flowUsd / f;
    value[k] = (mvUsd + cashUsd) / f;
    cash[k] = cashUsd / f;
    flows[k] = flowD;
    cumInv += flowD;
    invested[k] = cumInv;
    const base = k === 0 ? 0 : value[k - 1] + flowD;
    ret[k] = k === 0 || base <= 0 ? 0 : value[k] / base - 1;
    index[k] = k === 0 ? 1 : index[k - 1] * (1 + ret[k]);
    rf[k] = rateOn(dates[i]) / 100 / 252;
  }

  const pDates = dates.slice(start);
  const asOf = dates[asOfIdx];
  const prevDate = dates[Math.max(0, asOfIdx - 1)];
  const coreLike = { market, fxD };
  const totalValue = value[n - 1];

  const positions: Position[] = [];
  const closed: ClosedPosition[] = [];
  for (const sym in st) {
    const s = st[sym];
    const inst = bySym[sym];
    if (!inst) continue;
    if (s.qty <= 1e-9) {
      if (s.proceeds > 0) closed.push({ symbol: sym, inst, realized: s.realized, dividends: s.dividends, firstBuy: s.firstBuy, lastSell: s.lastSell, proceeds: s.proceeds, cost: s.soldCost });
      continue;
    }
    const iNow = asOfIdx;
    const price = px[sym][iNow];
    const prevPrice = px[sym][iNow - 1];
    const pD = pxDisp(coreLike, sym, iNow);
    const pPrev = pxDisp(coreLike, sym, iNow - 1);
    const val = s.qty * pD;
    const prevVal = s.qty * pPrev;
    const cost = s.lots.reduce((a, l) => a + l.qty * l.costPer, 0);
    const avgLocal = s.lots.reduce((a, l) => a + l.qty * l.localPer, 0) / s.qty;
    const ret: Partial<Record<Horizon, number>> = {};
    for (const h of HORIZONS) {
      if (h === "ITD") continue;
      const bd = horizonBaseDate(asOf, h, prevDate)!;
      const bi = bsearchLE(dates, bd);
      if (bi >= 0) ret[h] = pD / pxDisp(coreLike, sym, bi) - 1;
    }
    const spark: number[] = [];
    const s0 = Math.max(0, bsearchLE(dates, shiftDate(asOf, { years: -1 })));
    for (let i = s0; i <= iNow; i += 5) spark.push(pxDisp(coreLike, sym, i));
    if ((iNow - s0) % 5 !== 0) spark.push(pD);
    const unreal = val - cost;
    const totalRet = unreal + s.realized + s.dividends;
    positions.push({
      symbol: sym, inst, qty: s.qty, price, prevPrice, priceDisp: pD, value: val, prevValue: prevVal, dayChange: val - prevVal,
      dayPct: pD / pPrev - 1, weight: val / totalValue, cost, avgCostLocal: avgLocal, unrealized: unreal, unrealizedPct: cost > 0 ? unreal / cost : 0,
      realized: s.realized, dividends: s.dividends, fees: s.fees, totalReturn: totalRet, totalReturnPct: cost + s.soldCost > 0 ? totalRet / (cost + s.soldCost) : 0,
      firstBuy: s.firstBuy, lots: s.lots.map((l) => ({ ...l })), sleeve: sleeveOf(inst), region: regionOf(inst), ret, spark,
    });
  }
  positions.sort((a, b) => b.value - a.value);

  const benchSeries = (sym: string) => {
    const idx = new Array<number>(n);
    const r = new Array<number>(n);
    const b0 = pxDisp(coreLike, sym, start);
    for (let k = 0; k < n; k++) {
      idx[k] = pxDisp(coreLike, sym, start + k) / b0;
      r[k] = k === 0 ? 0 : idx[k] / idx[k - 1] - 1;
    }
    return { idx, r };
  };
  const spx = benchSeries("SPX");
  const acwi = benchSeries("ACWI");
  const agg = benchSeries("AGG");
  const r6040 = acwi.r.map((v, k) => 0.6 * v + 0.4 * agg.r[k]);
  const i6040: number[] = [];
  r6040.forEach((v, k) => i6040.push(k === 0 ? 1 : i6040[k - 1] * (1 + v)));

  const r2 = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
  const r6 = (a: number[]) => a.map((v) => Math.round(v * 1e6) / 1e6);
  const unrealized = positions.reduce((a, p) => a + p.unrealized, 0);
  const realized = Object.values(st).reduce((a, s) => a + s.realized, 0);
  const dividends = Object.values(st).reduce((a, s) => a + s.dividends, 0);
  const costBasis = positions.reduce((a, p) => a + p.cost, 0);
  const dayChange = n > 1 ? value[n - 1] - value[n - 2] - flows[n - 1] : 0;
  return {
    ccy, asOf, prevDate, start, dates: pDates, value: r2(value), invested: r2(invested), cash: r2(cash), flows, ret, index: r6(index), income, feesDaily, rf,
    positions, closed, realizedLots, qtyHist, txns, txBySym, market, fxD,
    bench: {
      SPX: { label: BENCH_LABELS.SPX, index: r6(spx.idx), ret: spx.r },
      ACWI: { label: BENCH_LABELS.ACWI, index: r6(acwi.idx), ret: acwi.r },
      AGG: { label: BENCH_LABELS.AGG, index: r6(agg.idx), ret: agg.r },
      "6040": { label: BENCH_LABELS["6040"], index: r6(i6040), ret: r6040 },
    },
    totals: {
      value: totalValue, cash: cash[n - 1], invested: invested[n - 1], deposits, withdrawals, unrealized, realized, dividends, interest,
      fees: feesTotal, dayChange, dayPct: ret[n - 1], totalGain: totalValue - invested[n - 1],
      totalGainPct: invested[n - 1] > 0 ? (totalValue - invested[n - 1]) / invested[n - 1] : 0, positions: positions.length, costBasis,
    },
  };
}

// ————————————————————————————————— per-request accessors
export const CCY_COOKIE = "meridian-ccy";
export const getCcy = cache(async (): Promise<Ccy> => {
  const v = (await cookies()).get(CCY_COOKIE)?.value;
  return isCcy(v) ? v : "USD";
});

export const getPortfolio = cache(async (): Promise<Core> => {
  const ccy = await getCcy();
  const market = await loadMarket();
  const txns = await db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.id));
  return computeCore(market, txns, ccy);
});

export const getNews = cache(async (): Promise<NewsItem[]> => {
  await ensureDatabase();
  return db.select().from(newsTable).orderBy(desc(newsTable.publishedAt));
});
export const getEvents = cache(async (): Promise<EventItem[]> => {
  await ensureDatabase();
  return db.select().from(eventsTable).orderBy(asc(eventsTable.date));
});
export const getNotes = cache(async (): Promise<Note[]> => {
  await ensureDatabase();
  return db.select().from(holdingNotes);
});

// ————————————————————————————————— shared helpers for pages
export function periodIndex(core: Core, h: Horizon): number {
  if (h === "ITD") return 0;
  const bd = horizonBaseDate(core.asOf, h, core.prevDate)!;
  return Math.max(0, bsearchLE(core.dates, bd));
}
export function twr(core: Core, h: Horizon): number {
  const k0 = periodIndex(core, h);
  return core.index[core.index.length - 1] / core.index[k0] - 1;
}
export function benchReturn(core: Core, key: BenchKey, h: Horizon): number {
  const k0 = periodIndex(core, h);
  const idx = core.bench[key].index;
  return idx[idx.length - 1] / idx[k0] - 1;
}
/** Money P&L of one symbol between portfolio indices (k0, k1]: ΔMV − buys + sells + dividends. */
export function symbolPnl(core: Core, sym: string, k0: number, k1: number) {
  const q = core.qtyHist[sym];
  if (!q) return 0;
  const mv0 = q[k0] * pxDisp(core, sym, core.start + k0);
  const mv1 = q[k1] * pxDisp(core, sym, core.start + k1);
  let net = 0;
  for (const t of core.txBySym[sym] ?? []) {
    if (t.k <= k0 || t.k > k1) continue;
    if (t.type === "BUY" || t.type === "SELL" || t.type === "DIVIDEND") net += t.amountDisp;
  }
  return mv1 - mv0 + net;
}
export function annualize(r: number, days: number) {
  if (days <= 0) return 0;
  return Math.pow(1 + r, 365.25 / days) - 1;
}
