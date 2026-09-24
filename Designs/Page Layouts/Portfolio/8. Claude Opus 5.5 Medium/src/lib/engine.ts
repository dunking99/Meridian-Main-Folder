import { cache } from "react";
import { db } from "@/db";
import { instruments, prices, transactions, fxRates, events, news, targets } from "@/db/schema";
import type { LookThrough } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ensureSeeded } from "./seed";

/* ------------------------------ static reference ------------------------------ */

export const SECTORS = [
  "Technology", "Financials", "Health Care", "Consumer Disc.", "Communication", "Industrials",
  "Consumer Staples", "Energy", "Materials", "Utilities", "Real Estate",
];
const ETF_SECTORS: Record<string, Record<string, number>> = {
  VOO: { Technology: 31, Financials: 13, "Health Care": 11, "Consumer Disc.": 10, Communication: 9, Industrials: 8, "Consumer Staples": 6, Energy: 3.5, Utilities: 2.5, "Real Estate": 2.3, Materials: 2.2 },
  QQQ: { Technology: 50, Communication: 16, "Consumer Disc.": 14, "Consumer Staples": 6, "Health Care": 6, Industrials: 5, Utilities: 1.5, Materials: 1.5 },
  VXUS: { Financials: 21, Industrials: 15, Technology: 13, "Consumer Disc.": 11, "Health Care": 9, "Consumer Staples": 7, Materials: 7, Communication: 5, Energy: 5, Utilities: 3, "Real Estate": 2 },
  VWO: { Technology: 22, Financials: 22, "Consumer Disc.": 13, Communication: 9, Materials: 7, Industrials: 7, Energy: 5, "Consumer Staples": 5, "Health Care": 4, Utilities: 3, "Real Estate": 3 },
  SCHD: { Financials: 18, "Health Care": 16, "Consumer Staples": 14, Industrials: 12, Energy: 11, Technology: 9, "Consumer Disc.": 9, Communication: 5, Materials: 4, Utilities: 2 },
};
export const BENCH_SECTORS: Record<string, number> = { Technology: 25, Financials: 16, "Health Care": 10.5, "Consumer Disc.": 11, Industrials: 10.5, Communication: 8, "Consumer Staples": 6, Energy: 4, Materials: 3.5, Utilities: 2.6, "Real Estate": 2.1 };
const ETF_COUNTRIES: Record<string, Record<string, number>> = {
  VOO: { US: 100 }, SCHD: { US: 100 }, BND: { US: 100 },
  QQQ: { US: 97, NL: 1.2, GB: 0.8, CN: 1 },
  VXUS: { JP: 15, GB: 9, CN: 8, CA: 7.5, FR: 6.5, CH: 6, IN: 6, DE: 5.5, TW: 5.5, AU: 4.5, KR: 3, NL: 3, SE: 2, DK: 2, IT: 1.5, ES: 1.5, BR: 1.5, HK: 2, SG: 1, ZA: 1, MX: 1, SA: 1, OTHER: 5.5 },
  VWO: { CN: 30, IN: 22, TW: 19, BR: 4.5, SA: 4, ZA: 3, MX: 2, TH: 2, ID: 1.8, MY: 1.6, AE: 1.5, OTHER: 8.6 },
};
export const BENCH_COUNTRIES: Record<string, number> = { US: 64, JP: 5, GB: 3.3, CN: 2.8, CA: 2.8, FR: 2.6, CH: 2.3, IN: 2, DE: 2.1, TW: 2, AU: 1.8, NL: 1.2, KR: 1.1, OTHER: 7 };
const COUNTRY_CCY: Record<string, string> = {
  US: "USD", NL: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", GB: "GBP", JP: "JPY", CH: "CHF", CN: "CNY", HK: "HKD",
  CA: "CAD", IN: "INR", TW: "TWD", AU: "AUD", KR: "KRW", SE: "SEK", DK: "DKK", BR: "BRL", SG: "SGD", ZA: "ZAR", MX: "MXN",
  SA: "SAR", TH: "THB", ID: "IDR", MY: "MYR", AE: "AED",
};
export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", NL: "Netherlands", FR: "France", DE: "Germany", IT: "Italy", ES: "Spain", GB: "United Kingdom", JP: "Japan",
  CH: "Switzerland", CN: "China", HK: "Hong Kong", CA: "Canada", IN: "India", TW: "Taiwan", AU: "Australia", KR: "South Korea",
  SE: "Sweden", DK: "Denmark", BR: "Brazil", SG: "Singapore", ZA: "South Africa", MX: "Mexico", SA: "Saudi Arabia", TH: "Thailand",
  ID: "Indonesia", MY: "Malaysia", AE: "UAE", OTHER: "Other", XX: "Global / Non-sovereign",
};
const HOME = "US";
const RF = 0.04;

/* ------------------------------ math helpers ------------------------------ */

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const cov = (a: number[], b: number[]) => {
  const ma = mean(a), mb = mean(b);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (a.length - 1);
};
const corr = (a: number[], b: number[]) => {
  const sa = std(a), sb = std(b);
  return sa && sb ? cov(a, b) / (sa * sb) : 0;
};
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const rets = (p: number[]) => p.slice(1).map((x, i) => x / p[i] - 1);
export const gradeOf = (s: number) => (s >= 85 ? "A" : s >= 70 ? "B" : s >= 55 ? "C" : s >= 40 ? "D" : "E");

/* ------------------------------ types ------------------------------ */

export type Bucket = "US Equity" | "Intl Equity" | "Fixed Income" | "Alternatives" | "Cash";

export type Holding = {
  symbol: string; name: string; kind: string; assetClass: string; sector: string; industry: string; country: string;
  region: string; currency: string; exchange: string; style: string; size: string; beta: number; divYield: number;
  pe: number | null; marketCapB: number | null; expenseRatio: number | null; description: string; lookThrough: LookThrough | null;
  bucket: Bucket; qty: number; price: number; prevPrice: number; avgCost: number; fx: number;
  value: number; cost: number; pnl: number; pnlPct: number; dayChange: number; dayPct: number;
  realized: number; income: number; totalReturn: number; weight: number;
  r1w: number; r1m: number; r3m: number; rYtd: number; r1y: number; vol1y: number;
  spark: number[]; high52: number; low52: number; firstBuy: string; riskContribution: number; corrToPortfolio: number;
};

export type Txn = { id: number; date: string; kind: string; symbol: string | null; quantity: number; price: number; amount: number; currency: string; usd: number; note: string | null };

export type Portfolio = Awaited<ReturnType<typeof compute>>;

/* ------------------------------ engine ------------------------------ */

async function load() {
  await ensureSeeded();
  const [ins, px, tx, fx, ev, nw, tg] = await Promise.all([
    db.select().from(instruments),
    db.select().from(prices).orderBy(asc(prices.date)),
    db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.id)),
    db.select().from(fxRates),
    db.select().from(events).orderBy(asc(events.date)),
    db.select().from(news),
    db.select().from(targets),
  ]);
  return { ins, px, tx, fx, ev, nw, tg };
}

async function compute() {
  const { ins, px, tx, fx, ev, nw, tg } = await load();
  const fxMap: Record<string, number> = Object.fromEntries(fx.map((f) => [f.currency, f.usdPer]));
  const insMap = new Map(ins.map((i) => [i.symbol, i]));

  const dates = Array.from(new Set(px.filter((p) => p.symbol === "ACWI").map((p) => p.date)));
  const dIdx = new Map(dates.map((d, i) => [d, i]));
  const T = dates.length;
  const series = new Map<string, number[]>();
  for (const i of ins) series.set(i.symbol, new Array(T).fill(NaN));
  for (const p of px) {
    const k = dIdx.get(p.date);
    if (k !== undefined) series.get(p.symbol)![k] = p.close;
  }
  for (const s of series.values()) for (let t = 1; t < T; t++) if (isNaN(s[t])) s[t] = s[t - 1];

  /* replay ledger */
  const qty = new Map<string, number>();
  const costLocal = new Map<string, number>();
  const realized = new Map<string, number>();
  const income = new Map<string, number>();
  const firstBuy = new Map<string, string>();
  const cash: Record<string, number> = {};
  const value: number[] = [], cashUsd: number[] = [], invested: number[] = [], flows: number[] = [];
  const posValue = new Map<string, number[]>();
  const held = ins.filter((i) => !i.isBenchmark);
  for (const h of held) posValue.set(h.symbol, new Array(T).fill(0));
  let cumDep = 0, interest = 0, fees = 0;
  const txns: Txn[] = [];
  let ti = 0;
  for (let t = 0; t < T; t++) {
    let flow = 0;
    while (ti < tx.length && tx[ti].date <= dates[t]) {
      const x = tx[ti++];
      const r = fxMap[x.currency] ?? 1;
      cash[x.currency] = (cash[x.currency] ?? 0) + x.amount;
      txns.push({ ...x, usd: x.amount * r });
      if (x.kind === "DEPOSIT" || x.kind === "WITHDRAWAL") { flow += x.amount * r; cumDep += x.amount * r; }
      if (x.kind === "INTEREST") interest += x.amount * r;
      if (x.kind === "FEE") fees += x.amount * r;
      if (!x.symbol) continue;
      const s = x.symbol;
      if (x.kind === "BUY") {
        qty.set(s, (qty.get(s) ?? 0) + x.quantity);
        costLocal.set(s, (costLocal.get(s) ?? 0) - x.amount);
        if (!firstBuy.has(s)) firstBuy.set(s, x.date);
      } else if (x.kind === "SELL") {
        const q0 = qty.get(s) ?? 0;
        const avg = q0 ? (costLocal.get(s) ?? 0) / q0 : 0;
        realized.set(s, (realized.get(s) ?? 0) + (x.price - avg) * x.quantity * r);
        costLocal.set(s, (costLocal.get(s) ?? 0) - avg * x.quantity);
        qty.set(s, q0 - x.quantity);
      } else if (x.kind === "DIVIDEND") {
        income.set(s, (income.get(s) ?? 0) + x.amount * r);
      }
    }
    let v = 0;
    for (const h of held) {
      const q = qty.get(h.symbol) ?? 0;
      const pv = q * series.get(h.symbol)![t] * (fxMap[h.currency] ?? 1);
      posValue.get(h.symbol)![t] = pv;
      v += pv;
    }
    let c = 0;
    for (const [k, a] of Object.entries(cash)) c += a * (fxMap[k] ?? 1);
    value.push(v + c); cashUsd.push(c); invested.push(cumDep); flows.push(flow);
  }

  /* time-weighted returns */
  const r: number[] = [];
  const idx: number[] = [1];
  for (let t = 1; t < T; t++) {
    const rt = (value[t] - flows[t]) / value[t - 1] - 1;
    r.push(rt);
    idx.push(idx[t - 1] * (1 + rt));
  }
  const bpx = series.get("ACWI")!;
  const bidx = bpx.map((p) => p / bpx[0]);
  const b = rets(bpx);

  const last = T - 1;
  const totalValue = value[last];
  const cashTotal = cashUsd[last];
  const invTotal = value[last] - cashTotal;

  const atOrBefore = (d: string) => {
    let lo = 0, hi = T - 1, ans = 0;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (dates[m] <= d) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans;
  };
  const shift = (months: number, days = 0) => {
    const d = new Date(dates[last] + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - months);
    d.setUTCDate(d.getUTCDate() - days);
    return atOrBefore(d.toISOString().slice(0, 10));
  };
  const ytdStart = atOrBefore(`${Number(dates[last].slice(0, 4)) - 1}-12-31`);
  const i1w = shift(0, 7), i1m = shift(1), i3m = shift(3), i6m = shift(6), i1y = shift(12), i3y = 0;

  /* holdings */
  const sumV = held.reduce((s, h) => s + posValue.get(h.symbol)![last], 0);
  const holdings: Holding[] = [];
  for (const h of held) {
    const q = qty.get(h.symbol) ?? 0;
    if (q <= 1e-9) continue;
    const s = series.get(h.symbol)!;
    const f = fxMap[h.currency] ?? 1;
    const price = s[last], prev = s[last - 1];
    const val = q * price * f;
    const cst = (costLocal.get(h.symbol) ?? 0) * f;
    const y = s.slice(i1y);
    const bucket: Bucket =
      h.assetClass === "Fixed Income" ? "Fixed Income" : h.assetClass === "Alternatives" ? "Alternatives" : h.country === HOME ? "US Equity" : "Intl Equity";
    holdings.push({
      symbol: h.symbol, name: h.name, kind: h.kind, assetClass: h.assetClass, sector: h.sector, industry: h.industry, country: h.country,
      region: h.region, currency: h.currency, exchange: h.exchange, style: h.style, size: h.size, beta: h.beta, divYield: h.divYield,
      pe: h.pe, marketCapB: h.marketCapB, expenseRatio: h.expenseRatio, description: h.description, lookThrough: h.lookThrough,
      bucket, qty: q, price, prevPrice: prev, avgCost: (costLocal.get(h.symbol) ?? 0) / q, fx: f,
      value: val, cost: cst, pnl: val - cst, pnlPct: cst ? val / cst - 1 : 0, dayChange: q * (price - prev) * f, dayPct: price / prev - 1,
      realized: realized.get(h.symbol) ?? 0, income: income.get(h.symbol) ?? 0,
      totalReturn: val - cst + (realized.get(h.symbol) ?? 0) + (income.get(h.symbol) ?? 0),
      weight: val / totalValue,
      r1w: price / s[i1w] - 1, r1m: price / s[i1m] - 1, r3m: price / s[i3m] - 1, rYtd: price / s[ytdStart] - 1, r1y: price / s[i1y] - 1,
      vol1y: std(rets(y)) * Math.sqrt(252), spark: s.slice(-60), high52: Math.max(...y), low52: Math.min(...y),
      firstBuy: firstBuy.get(h.symbol) ?? dates[0], riskContribution: 0, corrToPortfolio: 0,
    });
  }
  // include fully-sold positions' realized p&l for attribution
  const closedPnl = held
    .filter((h) => !holdings.find((x) => x.symbol === h.symbol) && (realized.get(h.symbol) || income.get(h.symbol)))
    .map((h) => ({ symbol: h.symbol, value: (realized.get(h.symbol) ?? 0) + (income.get(h.symbol) ?? 0) }));
  holdings.sort((a, b) => b.value - a.value);

  /* covariance / risk contribution (1y) */
  const win = T - i1y;
  const hr = holdings.map((h) => rets(series.get(h.symbol)!.slice(i1y)));
  const pr1y = r.slice(-(win - 1));
  const wInv = holdings.map((h) => h.value / totalValue);
  const Sw = holdings.map((_, i) => holdings.reduce((s, __, j) => s + cov(hr[i], hr[j]) * wInv[j], 0));
  const pVar = wInv.reduce((s, w, i) => s + w * Sw[i], 0);
  holdings.forEach((h, i) => {
    h.riskContribution = pVar ? (wInv[i] * Sw[i]) / pVar : 0;
    h.corrToPortfolio = corr(hr[i], pr1y.slice(-hr[i].length));
  });

  /* performance stats */
  const annRet = (a: number[]) => Math.pow(a.reduce((p, x) => p * (1 + x), 1), 252 / Math.max(a.length, 1)) - 1;
  const ddSeries = (ix: number[]) => {
    let peak = -Infinity;
    return ix.map((v) => { peak = Math.max(peak, v); return v / peak - 1; });
  };
  const dd = ddSeries(idx), bdd = ddSeries(bidx);
  let maxDD = 0, maxDDi = 0;
  dd.forEach((x, i) => { if (x < maxDD) { maxDD = x; maxDDi = i; } });
  let peakI = 0;
  for (let i = maxDDi; i >= 0; i--) if (dd[i] === 0) { peakI = i; break; }
  let recI = -1;
  for (let i = maxDDi; i < T; i++) if (dd[i] === 0) { recI = i; break; }
  const cagr = Math.pow(idx[last], 252 / (T - 1)) - 1;
  const vol = std(r) * Math.sqrt(252);
  const downside = Math.sqrt(mean(r.map((x) => Math.min(0, x - RF / 252) ** 2))) * Math.sqrt(252);
  const beta = cov(r, b) / cov(b, b);
  const bcagr = Math.pow(bidx[last], 252 / (T - 1)) - 1;
  const alpha = cagr - (RF + beta * (bcagr - RF));
  const te = std(r.map((x, i) => x - b[i])) * Math.sqrt(252);
  const sorted = [...r].sort((a, c) => a - c);
  const var95 = -sorted[Math.floor(sorted.length * 0.05)];
  const cvar95 = -mean(sorted.slice(0, Math.floor(sorted.length * 0.05)));
  const m3 = mean(r.map((x) => (x - mean(r)) ** 3)), sd = std(r);
  const skew = m3 / sd ** 3;
  const kurt = mean(r.map((x) => (x - mean(r)) ** 4)) / sd ** 4 - 3;

  /* monthly */
  const monthEnds: number[] = [];
  for (let t = 0; t < T; t++) if (t === last || dates[t + 1].slice(0, 7) !== dates[t].slice(0, 7)) monthEnds.push(t);
  const monthly = monthEnds.map((t, k) => {
    const p = k === 0 ? 0 : monthEnds[k - 1];
    return { year: Number(dates[t].slice(0, 4)), month: Number(dates[t].slice(5, 7)), ret: idx[t] / idx[p] - 1, bench: bidx[t] / bidx[p] - 1 };
  });
  const years = Array.from(new Set(monthly.map((m) => m.year)));
  const yearly = years.map((y) => {
    const ms = monthly.filter((m) => m.year === y);
    return { year: y, ret: ms.reduce((p, m) => p * (1 + m.ret), 1) - 1, bench: ms.reduce((p, m) => p * (1 + m.bench), 1) - 1 };
  });
  const upM = monthly.filter((m) => m.bench > 0), dnM = monthly.filter((m) => m.bench < 0);
  const upCapture = mean(upM.map((m) => m.ret)) / mean(upM.map((m) => m.bench));
  const downCapture = mean(dnM.map((m) => m.ret)) / mean(dnM.map((m) => m.bench));

  const tr = (from: number, ann = false) => {
    const p = idx[last] / idx[from] - 1, q = bidx[last] / bidx[from] - 1;
    if (!ann) return { p, b: q };
    const yrs = (last - from) / 252;
    return { p: Math.pow(1 + p, 1 / yrs) - 1, b: Math.pow(1 + q, 1 / yrs) - 1 };
  };
  const trailing = [
    { label: "1W", ...tr(i1w) }, { label: "1M", ...tr(i1m) }, { label: "3M", ...tr(i3m) }, { label: "6M", ...tr(i6m) },
    { label: "YTD", ...tr(ytdStart) }, { label: "1Y", ...tr(i1y) }, { label: "3Y ann.", ...tr(i3y, true) },
  ];

  /* rolling */
  const rolling = dates.map((d, t) => {
    const w63 = t >= 63 ? r.slice(t - 63, t) : null;
    const w126 = t >= 126 ? r.slice(t - 126, t) : null;
    const b126 = t >= 126 ? b.slice(t - 126, t) : null;
    return {
      date: d,
      vol: w63 ? std(w63) * Math.sqrt(252) : null,
      bvol: t >= 63 ? std(b.slice(t - 63, t)) * Math.sqrt(252) : null,
      ret1y: t >= 252 ? idx[t] / idx[t - 252] - 1 : null,
      bret1y: t >= 252 ? bidx[t] / bidx[t - 252] - 1 : null,
      beta: w126 && b126 ? cov(w126, b126) / cov(b126, b126) : null,
      sharpe: t >= 252 ? (annRet(r.slice(t - 252, t)) - RF) / (std(r.slice(t - 252, t)) * Math.sqrt(252)) : null,
    };
  });

  /* histogram */
  const bins: { x: number; p: number; b: number }[] = [];
  for (let x = -0.04; x < 0.04 - 1e-9; x += 0.0025) bins.push({ x, p: 0, b: 0 });
  const bin = (v: number) => clamp(Math.floor((v + 0.04) / 0.0025), 0, bins.length - 1);
  r.forEach((x) => bins[bin(x)].p++);
  b.forEach((x) => bins[bin(x)].b++);

  /* allocation */
  const bucketW: Record<string, number> = { "US Equity": 0, "Intl Equity": 0, "Fixed Income": 0, Alternatives: 0, Cash: cashTotal / totalValue };
  holdings.forEach((h) => (bucketW[h.bucket] += h.weight));
  const targetW = Object.fromEntries(tg.map((t) => [t.bucket, t.weight]));
  const drift = Object.keys(bucketW).map((k) => ({
    bucket: k, weight: bucketW[k], target: targetW[k] ?? 0, diff: bucketW[k] - (targetW[k] ?? 0), trade: -(bucketW[k] - (targetW[k] ?? 0)) * totalValue,
  }));
  const totalDrift = drift.reduce((s, d) => s + Math.abs(d.diff), 0) / 2;

  const group = (key: (h: Holding) => string) => {
    const m = new Map<string, number>();
    holdings.forEach((h) => m.set(key(h), (m.get(key(h)) ?? 0) + h.weight));
    return Array.from(m, ([name, weight]) => ({ name, weight })).sort((a, c) => c.weight - a.weight);
  };
  const byKind = group((h) => h.kind);
  const byRegion = group((h) => h.region);

  /* look-through: sectors, countries, currencies, single names */
  const eqW = holdings.filter((h) => h.assetClass === "Equities").reduce((s, h) => s + h.weight, 0);
  const secLT: Record<string, number> = Object.fromEntries(SECTORS.map((s) => [s, 0]));
  const ctyLT: Record<string, number> = {};
  const ccyLT: Record<string, number> = {};
  const ccyListing: Record<string, number> = {};
  const addC = (c: string, w: number) => {
    ctyLT[c] = (ctyLT[c] ?? 0) + w;
    const cc = c === "OTHER" || c === "XX" ? "Other" : COUNTRY_CCY[c] ?? "Other";
    ccyLT[cc] = (ccyLT[cc] ?? 0) + w;
  };
  for (const h of holdings) {
    ccyListing[h.currency] = (ccyListing[h.currency] ?? 0) + h.weight;
    if (h.assetClass === "Equities") {
      const sm = ETF_SECTORS[h.symbol];
      if (sm) { const tot = Object.values(sm).reduce((a, c) => a + c, 0); for (const [k, v] of Object.entries(sm)) secLT[k] += (h.weight * v) / tot; }
      else if (secLT[h.sector] !== undefined) secLT[h.sector] += h.weight;
    }
    const cm = ETF_COUNTRIES[h.symbol];
    if (cm) { const tot = Object.values(cm).reduce((a, c) => a + c, 0); for (const [k, v] of Object.entries(cm)) addC(k, (h.weight * v) / tot); }
    else if (h.country === "GLOBAL" || h.kind === "Commodity") { ctyLT.XX = (ctyLT.XX ?? 0) + h.weight; ccyLT.USD = (ccyLT.USD ?? 0) + h.weight; }
    else addC(h.country, h.weight);
  }
  for (const [k, a] of Object.entries(cash)) {
    const w = (a * (fxMap[k] ?? 1)) / totalValue;
    ccyLT[k] = (ccyLT[k] ?? 0) + w;
    ccyListing[k] = (ccyListing[k] ?? 0) + w;
  }
  const sectorExposure = SECTORS.map((s) => ({ sector: s, weight: secLT[s] / (eqW || 1), bench: BENCH_SECTORS[s] / 100 })).sort((a, c) => c.weight - a.weight);
  const countries = Object.entries(ctyLT).map(([code, w]) => ({ code, weight: w, bench: (BENCH_COUNTRIES[code] ?? 0) / 100 })).sort((a, c) => c.weight - a.weight);
  const currencyEconomic = Object.entries(ccyLT).map(([ccy, weight]) => ({ ccy, weight })).sort((a, c) => c.weight - a.weight);
  const currencyListing = Object.entries(ccyListing).map(([ccy, weight]) => ({ ccy, weight })).sort((a, c) => c.weight - a.weight);

  const eqCountry: Record<string, number> = {};
  for (const h of holdings.filter((x) => x.assetClass === "Equities")) {
    const cm = ETF_COUNTRIES[h.symbol];
    if (cm) { const tot = Object.values(cm).reduce((a, c) => a + c, 0); for (const [k, v] of Object.entries(cm)) eqCountry[k] = (eqCountry[k] ?? 0) + (h.weight * v) / tot; }
    else eqCountry[h.country] = (eqCountry[h.country] ?? 0) + h.weight;
  }
  const homeShare = (eqCountry[HOME] ?? 0) / (eqW || 1);
  const homeBias = { home: HOME, share: homeShare, global: BENCH_COUNTRIES[HOME] / 100, tilt: homeShare - BENCH_COUNTRIES[HOME] / 100 };

  // single-name look-through
  const names = new Map<string, { symbol: string; name: string; direct: number; via: { fund: string; weight: number }[] }>();
  for (const h of holdings) {
    if (h.kind === "Equity") {
      const e = names.get(h.symbol) ?? { symbol: h.symbol, name: h.name, direct: 0, via: [] };
      e.direct += h.weight; names.set(h.symbol, e);
    }
  }
  for (const h of holdings) for (const c of h.lookThrough ?? []) {
    const e = names.get(c.symbol) ?? { symbol: c.symbol, name: c.name, direct: 0, via: [] };
    e.via.push({ fund: h.symbol, weight: h.weight * c.weight }); names.set(c.symbol, e);
  }
  const lookThrough = Array.from(names.values())
    .map((n) => ({ ...n, indirect: n.via.reduce((s, v) => s + v.weight, 0), total: n.direct + n.via.reduce((s, v) => s + v.weight, 0) }))
    .sort((a, c) => c.total - a.total);
  const exposureOf = (sym: string) => lookThrough.find((l) => l.symbol === sym);

  // fund overlap
  const funds = holdings.filter((h) => h.lookThrough && h.lookThrough.length);
  const overlap = funds.map((f1) => funds.map((f2) => {
    if (f1 === f2) return 1;
    const m2 = new Map(f2.lookThrough!.map((c) => [c.symbol, c.weight]));
    return f1.lookThrough!.reduce((s, c) => s + Math.min(c.weight, m2.get(c.symbol) ?? 0), 0);
  }));
  const fundOverlap = { funds: funds.map((f) => f.symbol), matrix: overlap };

  /* correlation matrix */
  const topCorr = holdings.slice(0, 14);
  const corrMatrix = {
    symbols: topCorr.map((h) => h.symbol),
    matrix: topCorr.map((h1) => topCorr.map((h2) => corr(hr[holdings.indexOf(h1)], hr[holdings.indexOf(h2)]))),
  };
  const avgCorr = mean(corrMatrix.matrix.flatMap((row, i) => row.filter((_, j) => j > i)));

  /* concentration */
  const ws = holdings.map((h) => h.weight / (1 - bucketW.Cash));
  const hhi = ws.reduce((s, w) => s + w * w, 0);
  const lorenz = [...ws].sort((a, c) => a - c).reduce<number[]>((acc, w) => [...acc, (acc[acc.length - 1] ?? 0) + w], [0]);
  const gini = 1 - lorenz.slice(1).reduce((s, y, i) => s + (y + lorenz[i]) / ws.length, 0);

  /* costs & income */
  const ter = holdings.reduce((s, h) => s + h.weight * (h.expenseRatio ?? 0), 0);
  const annualIncome = holdings.reduce((s, h) => s + h.value * h.divYield, 0) + Math.max(0, cash.USD ?? 0) * 0.038;
  const portYield = annualIncome / totalValue;
  const costTotal = holdings.reduce((s, h) => s + h.cost, 0);
  const divByMonth: { month: string; amount: number }[] = [];
  const twoYrAgo = dates[shift(24)].slice(0, 7);
  for (const t of txns) {
    if (t.kind !== "DIVIDEND" && t.kind !== "INTEREST") continue;
    const m = t.date.slice(0, 7);
    if (m < twoYrAgo) continue;
    const e = divByMonth.find((x) => x.month === m);
    if (e) e.amount += t.usd; else divByMonth.push({ month: m, amount: t.usd });
  }
  const ttmIncome = txns.filter((t) => (t.kind === "DIVIDEND" || t.kind === "INTEREST") && t.date > dates[i1y]).reduce((s, t) => s + t.usd, 0);

  /* risk score */
  const vol1y = std(pr1y) * Math.sqrt(252);
  const riskLevel = vol1y < 0.005 ? 1 : vol1y < 0.02 ? 2 : vol1y < 0.05 ? 3 : vol1y < 0.1 ? 4 : vol1y < 0.15 ? 5 : vol1y < 0.25 ? 6 : 7;
  const riskLabel = ["Very low", "Low", "Low-moderate", "Moderate", "Moderately high", "High", "Very high"][riskLevel - 1];
  const vol21 = std(r.slice(-21)) * Math.sqrt(252);

  /* scorecard */
  const maxName = lookThrough[0];
  const effN = 1 / hhi;
  const econUsd = currencyEconomic.find((c) => c.ccy === "USD")?.weight ?? 0;
  const scorecard = [
    { key: "Diversification", score: clamp(effN * 5.5), value: `${effN.toFixed(1)} effective positions`, hint: "Inverse Herfindahl of position weights" },
    { key: "Concentration", score: clamp(100 - Math.max(0, maxName.total - 0.04) * 900), value: `Largest look-through: ${maxName.symbol} ${(maxName.total * 100).toFixed(1)}%`, hint: "Single-name exposure incl. funds" },
    { key: "Cost efficiency", score: clamp(100 - ter * 10000 * 2.5), value: `${(ter * 100).toFixed(3)}% weighted TER`, hint: "Fund expense ratios, weighted" },
    { key: "Income", score: clamp((portYield / 0.03) * 100), value: `${(portYield * 100).toFixed(2)}% forward yield`, hint: "Dividends + cash interest" },
    { key: "Volatility", score: clamp(100 - (vol1y - 0.08) * 450), value: `${(vol1y * 100).toFixed(1)}% annualised (1Y)`, hint: "Lower is calmer" },
    { key: "Resilience", score: clamp(100 + maxDD * 250), value: `${(maxDD * 100).toFixed(1)}% max drawdown`, hint: "Depth of worst peak-to-trough" },
    { key: "Global balance", score: clamp(100 - Math.abs(homeBias.tilt) * 280), value: `${(homeShare * 100).toFixed(0)}% US vs ${(homeBias.global * 100).toFixed(0)}% global`, hint: "Home bias vs world market cap" },
    { key: "Currency balance", score: clamp(100 - Math.max(0, econUsd - 0.7) * 300), value: `${(econUsd * 100).toFixed(0)}% USD economic exposure`, hint: "Look-through currency mix" },
    { key: "Target discipline", score: clamp(100 - totalDrift * 500), value: `${(totalDrift * 100).toFixed(1)}% total drift`, hint: "Distance from target allocation" },
    { key: "Risk-adjusted return", score: clamp(((cagr - RF) / vol) * 70), value: `Sharpe ${((cagr - RF) / vol).toFixed(2)}`, hint: "Excess return per unit of risk" },
  ].map((s) => ({ ...s, score: Math.round(s.score), grade: gradeOf(s.score) }));
  const health = Math.round(mean(scorecard.map((s) => s.score)));

  /* factor fingerprint */
  const eqH = holdings.filter((h) => h.assetClass === "Equities");
  const eqSum = eqH.reduce((s, h) => s + h.weight, 0) || 1;
  const wAvg = (f: (h: Holding) => number) => eqH.reduce((s, h) => s + (h.weight / eqSum) * f(h), 0);
  const fingerprint = [
    { axis: "Growth", p: clamp(wAvg((h) => (h.style === "Growth" ? 100 : h.style === "Blend" ? 50 : 10))), b: 50 },
    { axis: "Value", p: clamp(wAvg((h) => (h.style === "Value" ? 100 : h.style === "Blend" ? 50 : 10))), b: 50 },
    { axis: "Momentum", p: clamp(50 + wAvg((h) => h.r1y) * 150), b: 55 },
    { axis: "Quality", p: clamp(wAvg((h) => (h.pe ? clamp(110 - Math.abs(h.pe - 22) * 1.5) : 60))), b: 60 },
    { axis: "Yield", p: clamp((portYield / 0.035) * 100), b: 51 },
    { axis: "Low vol", p: clamp(100 - wAvg((h) => h.vol1y) * 250), b: 62 },
    { axis: "Mega-cap", p: clamp(wAvg((h) => (h.marketCapB ? clamp(h.marketCapB / 25) : 55))), b: 48 },
  ].map((f) => ({ ...f, p: Math.round(f.p) }));

  /* stress tests */
  const techLike = (h: Holding) => ["Technology", "Communication"].includes(h.sector) || h.symbol === "QQQ";
  const scen = (name: string, desc: string, f: (h: Holding) => number) => {
    const items = holdings.map((h) => ({ symbol: h.symbol, impact: h.value * f(h) }));
    const total = items.reduce((s, x) => s + x.impact, 0);
    return { name, desc, total, pct: total / totalValue, worst: [...items].sort((a, c) => a.impact - c.impact).slice(0, 3) };
  };
  const stress = [
    scen("Global Financial Crisis", "2007–09 replay: equities −50% × beta, credit spreads blow out", (h) =>
      h.assetClass === "Equities" ? -0.5 * h.beta * (h.sector === "Financials" ? 1.3 : 1) : h.kind === "Crypto" ? -0.75 : h.kind === "Commodity" ? 0.05 : 0.04),
    scen("COVID crash", "Feb–Mar 2020: 5-week −34% equity shock", (h) =>
      h.assetClass === "Equities" ? -0.34 * h.beta * (h.sector === "Energy" ? 1.6 : 1) : h.kind === "Crypto" ? -0.5 : h.kind === "Commodity" ? -0.03 : 0.03),
    scen("2022 rate shock", "Rates +300bp, long-duration growth reprices", (h) =>
      h.kind === "Bond ETF" ? -0.13 : h.kind === "Crypto" ? -0.64 : h.kind === "Commodity" ? -0.01 : techLike(h) || h.style === "Growth" ? -0.3 : h.sector === "Energy" ? 0.4 : -0.1),
    scen("AI unwind", "Semis & mega-cap tech −30%, rotation into defensives", (h) =>
      ["Semiconductors", "Semiconductor Equip."].includes(h.industry) ? -0.38 : techLike(h) ? -0.26 : h.symbol === "VOO" ? -0.12 : h.sector === "Consumer Staples" || h.kind === "Bond ETF" ? 0.03 : -0.04),
    scen("Dollar +10%", "Broad USD rally translates foreign assets lower", (h) => {
      const cm = ETF_COUNTRIES[h.symbol];
      const foreign = cm ? 1 - (cm.US ?? 0) / Object.values(cm).reduce((a, c) => a + c, 0) : h.country !== "US" && h.country !== "GLOBAL" ? 1 : 0;
      return -0.1 * foreign + (h.kind === "Commodity" ? -0.05 : 0);
    }),
    scen("Soft landing rally", "Cuts + earnings beat: broad risk-on", (h) =>
      h.assetClass === "Equities" ? 0.12 * h.beta : h.kind === "Crypto" ? 0.35 : h.kind === "Bond ETF" ? 0.04 : -0.02),
  ];

  /* risk vs return bubble data */
  const bubbles = holdings.map((h) => ({ symbol: h.symbol, x: h.vol1y, y: h.r1y, w: h.weight, bucket: h.bucket }));

  /* events & news enrichment */
  const todayIso = dates[last];
  const hMap = new Map(holdings.map((h) => [h.symbol, h]));
  const upcoming = ev.map((e) => ({ ...e, position: e.symbol ? hMap.get(e.symbol)?.value ?? 0 : null, weight: e.symbol ? hMap.get(e.symbol)?.weight ?? 0 : null }));
  const enrichedNews = nw
    .map((n) => {
      const parts = n.symbols.map((s) => {
        const e = exposureOf(s);
        return { symbol: s, direct: e?.direct ?? 0, indirect: e?.indirect ?? 0, via: e?.via.map((v) => v.fund) ?? [] };
      });
      const exposure = parts.reduce((s, p) => s + p.direct + p.indirect, 0);
      return { ...n, parts, exposure, relevance: exposure * (0.5 + Math.abs(n.sentiment)) };
    })
    .sort((a, c) => (a.publishedAt < c.publishedAt ? 1 : -1));
  const newsPulse = enrichedNews.reduce((s, n) => s + n.sentiment * n.exposure, 0) / (enrichedNews.reduce((s, n) => s + n.exposure, 0) || 1);

  /* daily pulse */
  const dayChange = value[last] - value[last - 1] - flows[last];
  const up = holdings.filter((h) => h.dayPct > 0).length;
  const above50 = holdings.filter((h) => { const s = series.get(h.symbol)!; return s[last] > mean(s.slice(-50)); }).length;

  /* attribution */
  const attribution = [
    ...holdings.map((h) => ({ symbol: h.symbol, value: h.totalReturn })),
    ...closedPnl,
    { symbol: "Interest", value: interest },
    { symbol: "Fees", value: fees },
  ].sort((a, c) => c.value - a.value);
  const pnlBreakdown = {
    unrealized: holdings.reduce((s, h) => s + h.pnl, 0),
    realized: Array.from(realized.values()).reduce((s, x) => s + x, 0),
    dividends: Array.from(income.values()).reduce((s, x) => s + x, 0),
    interest, fees,
  };

  const cashBalances = Object.entries(cash).filter(([, a]) => Math.abs(a) > 0.01)
    .map(([ccy, amount]) => ({ ccy, amount, usd: amount * (fxMap[ccy] ?? 1) })).sort((a, c) => c.usd - a.usd);

  return {
    asOf: todayIso,
    fx: fxMap,
    dates,
    series: { value, cash: cashUsd, invested, idx, bidx, dd, bdd },
    posValue: Object.fromEntries(posValue),
    priceSeries: Object.fromEntries(series),
    totals: {
      value: totalValue, invested: invTotal, cash: cashTotal, cost: costTotal, netDeposits: invested[last],
      dayChange, dayPct: dayChange / value[last - 1], totalGain: totalValue - invested[last],
      totalGainPct: totalValue / invested[last] - 1, twr: idx[last] - 1, positions: holdings.length,
      annualIncome, portYield, ttmIncome, ter,
    },
    stats: {
      cagr, vol, vol1y, vol21, sharpe: (cagr - RF) / vol, sortino: (cagr - RF) / downside, maxDD, maxDDStart: dates[peakI], maxDDTrough: dates[maxDDi],
      maxDDRecovery: recI >= 0 ? dates[recI] : null, currentDD: dd[last], calmar: cagr / Math.abs(maxDD), beta, alpha, te,
      ir: (cagr - bcagr) / te, r2: corr(r, b) ** 2, upCapture, downCapture, bestDay: Math.max(...r), worstDay: Math.min(...r),
      posDays: r.filter((x) => x > 0).length / r.length, var95, cvar95, var95Usd: var95 * totalValue, skew, kurt, bcagr,
      bestMonth: Math.max(...monthly.map((m) => m.ret)), worstMonth: Math.min(...monthly.map((m) => m.ret)),
      posMonths: monthly.filter((m) => m.ret > 0).length / monthly.length, bvol: std(b) * Math.sqrt(252), bmaxDD: Math.min(...bdd),
    },
    risk: { level: riskLevel, label: riskLabel, avgCorr },
    health, scorecard, fingerprint, stress, bubbles,
    holdings, monthly, yearly, trailing, rolling, histogram: bins, attribution, pnlBreakdown,
    allocation: { buckets: bucketW, drift, totalDrift, byKind, byRegion, sectorExposure, countries, currencyEconomic, currencyListing, homeBias },
    lookThrough: lookThrough.slice(0, 40), fundOverlap, corrMatrix,
    concentration: { hhi, effN, gini, lorenz, top5: ws.slice(0, 5).reduce((s, w) => s + w, 0), top10: ws.slice(0, 10).reduce((s, w) => s + w, 0) },
    income: { byMonth: divByMonth.sort((a, c) => (a.month < c.month ? -1 : 1)), annual: annualIncome, yieldOnCost: annualIncome / costTotal },
    pulse: { up, down: holdings.length - up, above50, newsSentiment: newsPulse, recent: r.slice(-40) },
    events: upcoming, news: enrichedNews, cashBalances,
    txns: txns.reverse(),
  };
}

export const getPortfolio = cache(compute);
