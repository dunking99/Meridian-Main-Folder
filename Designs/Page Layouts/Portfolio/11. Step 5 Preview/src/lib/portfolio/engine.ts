/**
 * Meridian — portfolio engine (core)
 * ---------------------------------------------------------------------------
 * Turns the raw store (prices, fx, ledger) into the derived objects the UI
 * renders. Everything is computed in USD internally and converted once, at
 * the end, into the requested display currency.
 */
import { cache } from "react";
import { loadRaw } from "@/lib/data/repository";
import {
  beta as betaFn,
  corr,
  cov,
  maxDrawdown,
  returnsFrom,
  sharpe as sharpeFn,
  siReturn,
  stdev,
  trailingReturn,
  ytdReturn,
} from "./metrics";
import { CURRENCIES } from "@/lib/data/universe";

export interface Pt {
  d: string;
  v: number;
}

export interface Slice {
  symbol: string;
  key: string;
  weight: number; // percent
  value: number;
  ret1d: number;
  ret1y: number;
}

export interface HoldingView {
  symbol: string;
  name: string;
  kind: string;
  exchange: string;
  currency: string;
  country: string;
  region: string;
  sector: string;
  industry: string;
  assetClass: string;
  style: string;
  accountId: string;
  accountName: string;
  shares: number;
  price: number; // local currency
  priceUsd: number;
  value: number; // display currency
  weight: number; // percent of total
  targetWeight: number;
  drift: number; // percentage points
  cost: number;
  avgCost: number;
  unrealized: number;
  unrealizedPct: number;
  realized: number;
  dayChange: number;
  dayChangePct: number;
  ret: { d1: number; w1: number; m1: number; m3: number; m6: number; ytd: number; y1: number; y3: number; si: number };
  localRet1y: number;
  fxRet1y: number;
  vol: number;
  beta: number;
  corr: number;
  sharpe: number;
  maxDd: number;
  hi52: number;
  lo52: number;
  pos52: number;
  divYield: number;
  income12m: number;
  expenseRatio: number;
  pe: number;
  pb: number;
  marketCap: number;
  contribution1y: number; // contribution to portfolio 1y return, in pp
  riskPct: number; // share of portfolio volatility, %
  spark: number[]; // last 90 USD closes
  usdSeries: number[]; // full USD price series (aligned to dates)
  openedOn: string;
  trades: number;
  firstBuy: string;
  lastTrade: string;
}

export interface PortfolioCore {
  dates: string[];
  totalValue: number[];
  invested: number[];
  cash: number[];
  contributions: number[];
  nav: number[];
  dailyReturns: number[];
  startIndex: number;
  fxRate: number;
  base: string;
  holdings: HoldingView[];
  instruments: Map<string, {
    symbol: string;
    name: string;
    kind: string;
    currency: string;
    country: string;
    sector: string;
    assetClass: string;
    region: string;
    style: string;
    exchange: string;
    industry: string;
    marketCap: number;
    pe: number;
    pb: number;
    divYield: number;
    expenseRatio: number;
  }>;
  cashByAccount: { id: string; name: string; amount: number }[];
  dividendsBySymbol: Record<string, number>;
  dividendsAllBySymbol: Record<string, number>;
  dividendsByMonth: Record<string, number>;
  transactionCount: number;
  fees: number;
}

const align = (dates: string[], rows: { date: string; v: number }[]) => {
  const m = new Map(rows.map((r) => [r.date, r.v]));
  const out: number[] = [];
  let last = 0;
  for (const d of dates) {
    const v = m.get(d);
    if (v !== undefined) last = v;
    out.push(last);
  }
  return out;
};

export async function buildPortfolioCore(base: string, raw: Awaited<ReturnType<typeof loadRaw>>): Promise<PortfolioCore> {
  const dates = Array.from(new Set(raw.prices.map((p) => p.date))).sort();
  const idx = new Map(dates.map((d, i) => [d, i]));

  const priceBySymbol = new Map<string, Map<string, number>>();
  for (const p of raw.prices) {
    let m = priceBySymbol.get(p.symbol);
    if (!m) priceBySymbol.set(p.symbol, (m = new Map()));
    m.set(p.date, p.close);
  }
  const fxByCode = new Map<string, Map<string, number>>();
  for (const f of raw.fx) {
    let m = fxByCode.get(f.code);
    if (!m) fxByCode.set(f.code, (m = new Map()));
    m.set(f.date, f.rate);
  }

  const rateFor = (code: string, i: number) => {
    if (code === "USD") return 1;
    const m = fxByCode.get(code);
    if (!m) return 1;
    const d = dates[i];
    const v = m.get(d);
    if (v !== undefined) return v;
    // walk back to the last known print
    for (let j = i; j >= 0; j--) {
      const x = m.get(dates[j]);
      if (x !== undefined) return x;
    }
    return 1;
  };

  const localSeries = (symbol: string, from: number) => {
    const m = priceBySymbol.get(symbol);
    if (!m) return new Array(dates.length - from).fill(0);
    let last = 0;
    const out: number[] = [];
    for (let i = from; i < dates.length; i++) {
      const v = m.get(dates[i]);
      if (v !== undefined) last = v;
      out.push(last);
    }
    return out;
  };

  const usdSeries = (symbol: string, currency: string) => {
    const m = priceBySymbol.get(symbol);
    if (!m) return dates.map(() => 0);
    let last = 0;
    return dates.map((d, i) => {
      const v = m.get(d);
      if (v !== undefined) last = v;
      return last * rateFor(currency, i);
    });
  };

  const instMap = new Map(raw.instruments.map((i) => [i.symbol, i]));

  // ── ledger → shares / cash timelines ──────────────────────────────────────
  const txByDate = new Map<string, typeof raw.transactions>();
  for (const t of raw.transactions) {
    const arr = txByDate.get(t.date) ?? [];
    arr.push(t);
    txByDate.set(t.date, arr);
  }

  const symbols = raw.holdings.map((h) => h.symbol);
  const shares: Record<string, number[]> = {};
  for (const s of symbols) shares[s] = new Array(dates.length).fill(0);
  const cashArr = new Array(dates.length).fill(0);
  const contribArr = new Array(dates.length).fill(0);
  const divBySymbol: Record<string, number> = {};
  const divAllBySymbol: Record<string, number> = {};
  const divByMonth: Record<string, number> = {};
  const cutoffDate = dates[dates.length - 367] ?? dates[0];
  const realizedBySymbol: Record<string, number> = {};
  let fees = 0;

  let sharesState: Record<string, number> = {};
  for (const s of symbols) sharesState[s] = 0;
  let cashState = 0;
  let contribState = 0;

  const sortedDates = [...txByDate.keys()].sort();
  let cursor = 0;
  for (let i = 0; i < dates.length; i++) {
    while (cursor < sortedDates.length && sortedDates[cursor] < dates[i]) {
      applyDay(sortedDates[cursor]);
      cursor++;
    }
    if (cursor < sortedDates.length && sortedDates[cursor] === dates[i]) {
      applyDay(dates[i]);
      cursor++;
    }
    for (const s of symbols) shares[s][i] = sharesState[s];
    cashArr[i] = cashState;
    contribArr[i] = contribState;
  }
  while (cursor < sortedDates.length) {
    applyDay(sortedDates[cursor]);
    cursor++;
  }

  function applyDay(date: string) {
    for (const t of txByDate.get(date) ?? []) {
      if (t.side === "buy" && t.symbol) {
        sharesState[t.symbol] = (sharesState[t.symbol] ?? 0) + t.shares;
        cashState += t.amount;
      } else if (t.side === "sell" && t.symbol) {
        sharesState[t.symbol] = (sharesState[t.symbol] ?? 0) - t.shares;
        cashState += t.amount;
      }
      else if (t.side === "deposit") {
        cashState += t.amount;
        contribState += t.amount;
      } else if (t.side === "withdrawal") {
        cashState += t.amount;
        contribState += t.amount;
      } else if (t.side === "dividend" && t.symbol) {
        cashState += t.amount;
        divAllBySymbol[t.symbol] = (divAllBySymbol[t.symbol] ?? 0) + t.amount;
        if (date >= cutoffDate) divBySymbol[t.symbol] = (divBySymbol[t.symbol] ?? 0) + t.amount;
        divByMonth[date.slice(0, 7)] = (divByMonth[date.slice(0, 7)] ?? 0) + t.amount;
      } else if (t.side === "fee") {
        cashState += t.amount;
        fees += t.fee;
      }
    }
  }

  // ── value series ──────────────────────────────────────────────────────────
  const totalValue: number[] = [];
  const invested: number[] = [];
  let firstIndex = dates.length - 1;
  for (let i = 0; i < dates.length; i++) {
    let v = cashArr[i];
    for (const s of symbols) {
      if (shares[s][i] <= 0) continue;
      v += shares[s][i] * (usdSeries(s, instMap.get(s)!.currency)[i] ?? 0);
    }
    totalValue.push(v);
    invested.push(v - cashArr[i]);
    if (v > 1000 && i < firstIndex) firstIndex = i;
  }

  const d = dates.slice(firstIndex);
  const valueSeries = totalValue.slice(firstIndex);
  const contribSeries = contribArr.slice(firstIndex);

  // time-weighted daily returns (external flows removed)
  const dailyReturns: number[] = [0];
  for (let i = 1; i < valueSeries.length; i++) {
    const prev = valueSeries[i - 1];
    const flow = contribSeries[i] - contribSeries[i - 1];
    dailyReturns.push(prev > 0 ? (valueSeries[i] - flow) / prev - 1 : 0);
  }

  const nav: number[] = [100];
  for (let i = 1; i < dailyReturns.length; i++) nav.push(nav[i - 1] * (1 + dailyReturns[i]));

  const last = d.length - 1;
  const baseRate = 1 / rateFor(base, dates.length - 1);
  const conv = (usd: number) => usd * baseRate;
  const convSeries = (arr: number[]) => arr.map((v, i) => v / rateFor(base, firstIndex + i));

  // ── holdings ──────────────────────────────────────────────────────────────
  const portRets = dailyReturns;
  const holdings: HoldingView[] = raw.holdings
    .map((h) => {
      const inst = instMap.get(h.symbol)!;
      const series = usdSeries(h.symbol, inst.currency).slice(firstIndex);
      const rets = returnsFrom(series);
      const i = last;
      const price = priceBySymbol.get(h.symbol)!.get(dates[dates.length - 1]) ?? 0;
      const priceUsd = price * rateFor(inst.currency, dates.length - 1);
      const value = shares[h.symbol][dates.length - 1] * priceUsd;
      const cost = h.shares * h.avgCost;
      const yr = series.slice(-252);
      const txs = raw.transactions.filter((t) => t.symbol === h.symbol);
      const last252 = series.slice(-252);
      const hi52 = Math.max(...last252);
      const lo52 = Math.min(...last252);
      const buys = txs.filter((t) => t.side === "buy");
      return {
        symbol: h.symbol,
        name: inst.name,
        kind: inst.kind,
        exchange: inst.exchange,
        currency: inst.currency,
        country: inst.country,
        region: inst.region,
        sector: inst.sector,
        industry: inst.industry,
        assetClass: inst.assetClass,
        style: inst.style,
        accountId: h.accountId,
        accountName: raw.accounts.find((a) => a.id === h.accountId)?.name ?? h.accountId,
        shares: h.shares,
        price,
        priceUsd,
        value: conv(value),
        weight: 0,
        targetWeight: h.targetWeight,
        drift: 0,
        cost: conv(cost),
        avgCost: conv(h.avgCost),
        unrealized: conv(value - cost),
        unrealizedPct: cost > 0 ? (value / cost - 1) * 100 : 0,
        realized: conv(realizedBySymbol[h.symbol] ?? 0),
        dayChange: conv(
          shares[h.symbol][dates.length - 1] *
            (priceUsd - (series.length > 1 ? series[series.length - 2] : priceUsd)),
        ),
        dayChangePct: series.length > 1 ? (series[series.length - 1] / series[series.length - 2] - 1) * 100 : 0,
        ret: {
          d1: series.length > 1 ? series[series.length - 1] / series[series.length - 2] - 1 : 0,
          w1: trailingReturn(series, 5),
          m1: trailingReturn(series, 21),
          m3: trailingReturn(series, 63),
          m6: trailingReturn(series, 126),
          ytd: ytdReturn(d, series),
          y1: trailingReturn(series, 252),
          y3: trailingReturn(series, 756),
          si: siReturn(series),
        },
        localRet1y: trailingReturn(localSeries(h.symbol, firstIndex), 252),
        fxRet1y: 0,
        vol: stdev(rets) * Math.sqrt(252) * 100,
        beta: betaFn(rets, portRets),
        corr: corr(rets, portRets),
        sharpe: sharpeFn(rets),
        maxDd: maxDrawdown(series) * 100,
        hi52,
        lo52,
        pos52: hi52 > lo52 ? (price - lo52) / (hi52 - lo52) : 0.5,
        divYield: inst.divYield,
        income12m: conv(divBySymbol[h.symbol] ?? 0),
        expenseRatio: inst.expenseRatio,
        pe: inst.pe,
        pb: inst.pb,
        marketCap: inst.marketCap,
        contribution1y: 0,
        riskPct: 0,
        spark: series.slice(-90),
        usdSeries: series,
        openedOn: h.openedOn,
        trades: txs.length,
        firstBuy: buys.length ? buys[0].date : h.openedOn,
        lastTrade: txs.length ? txs[txs.length - 1].date : h.openedOn,
      };
    })
    .sort((a, b) => b.value - a.value);

  const total = holdings.reduce((s, h) => s + h.value, 0);
  const cashTotal = conv(cashArr[dates.length - 1]);
  const grand = total + cashTotal;

  for (const h of holdings) {
    h.weight = grand > 0 ? (h.value / grand) * 100 : 0;
    h.drift = h.weight - h.targetWeight;
    h.fxRet1y = (1 + h.ret.y1) / (1 + h.localRet1y) - 1;
  }

  // contribution + risk share over the last year
  const startVal = valueSeries[Math.max(0, valueSeries.length - 252)];
  const port1y = valueSeries[valueSeries.length - 1] / startVal - 1;
  for (const h of holdings) {
    const s = h.usdSeries;
    const w = h.value / (grand || 1);
    h.contribution1y = w * (s[s.length - 1] / s[Math.max(0, s.length - 252)] - 1) * 100;
  }
  const portVol = stdev(portRets) * Math.sqrt(252);
  let riskSum = 0;
  const rc: Record<string, number> = {};
  for (const h of holdings) {
    const w = h.value / (grand || 1);
    const c = w * cov(returnsFrom(h.usdSeries), portRets) * 252;
    rc[h.symbol] = c;
    riskSum += c;
  }
  for (const h of holdings) h.riskPct = portVol > 0 ? (rc[h.symbol] / portVol) * 100 : 0;

  return {
    dates: d,
    totalValue: valueSeries.map(conv),
    invested: invested.slice(firstIndex).map(conv),
    cash: cashArr.slice(firstIndex).map(conv),
    contributions: contribSeries.map(conv),
    nav,
    dailyReturns,
    startIndex: firstIndex,
    fxRate: baseRate,
    base,
    holdings,
    instruments: instMap as PortfolioCore["instruments"],
    cashByAccount: raw.cash.map((c) => ({
      id: c.accountId,
      name: raw.accounts.find((a) => a.id === c.accountId)?.name ?? c.accountId,
      amount: conv(c.amount),
    })),
    dividendsBySymbol: Object.fromEntries(
      Object.entries(divBySymbol).map(([k, v]) => [k, conv(v)]),
    ),
    dividendsAllBySymbol: Object.fromEntries(
      Object.entries(divAllBySymbol).map(([k, v]) => [k, conv(v)]),
    ),
    dividendsByMonth: Object.fromEntries(
      Object.entries(divByMonth).map(([k, v]) => [k, conv(v)]),
    ),
    transactionCount: raw.transactions.length,
    fees: conv(fees),
  };
}

export const getPortfolioCore = cache(async (base = "USD"): Promise<PortfolioCore> => {
  return buildPortfolioCore(base, await loadRaw());
});

export const SUPPORTED_BASES = CURRENCIES;
export { align };
