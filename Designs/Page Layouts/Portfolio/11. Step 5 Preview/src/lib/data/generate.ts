/**
 * Meridian — synthetic market data generator
 * ---------------------------------------------------------------------------
 * Everything the app shows is derived from data that is generated once, here:
 *
 *  1. a factor model produces 6 years of daily closes for every instrument
 *     (global market + sector factors + idiosyncratic noise, with regime
 *     shifts so the history contains real drawdowns and recoveries)
 *  2. an FX model produces USD-per-unit series for the currencies we need
 *  3. a ledger simulator replays 5 years of contributions, rebalancing,
 *     trims and reinvested dividends, which *defines* the holdings and cash
 *     balances (so positions, cost basis and value-over-time all reconcile)
 *  4. a news + corporate-events layer is generated on top of the price history
 *
 * Deterministic: same seed in, same database out.
 */
import { ACCOUNTS, FUND_CONSTITUENTS, HELD, INSTRUMENTS, type InstrumentSeed } from "./universe";

/* ── deterministic RNG ─────────────────────────────────────────────────────── */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, fed by the uniform RNG. */
function gauss(rnd: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ── calendar helpers ──────────────────────────────────────────────────────── */

const DAY = 86400000;

export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}

export function tradingDays(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from.getTime());
  while (cur.getTime() <= to.getTime()) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) out.push(iso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/* ── regime model ──────────────────────────────────────────────────────────── */

interface Regime {
  until: number; // fraction of the window
  marketDrift: number; // annualised %
  marketVol: number; // annualised %
  label: string;
}

const REGIMES: Regime[] = [
  { until: 0.12, marketDrift: -22, marketVol: 26, label: "Rate shock" },
  { until: 0.27, marketDrift: 32, marketVol: 19, label: "Policy pivot" },
  { until: 0.42, marketDrift: 12, marketVol: 14, label: "Grind higher" },
  { until: 0.58, marketDrift: 28, marketVol: 12, label: "AI melt-up" },
  { until: 0.68, marketDrift: -14, marketVol: 20, label: "Valuation reset" },
  { until: 0.84, marketDrift: 22, marketVol: 15, label: "Broadening" },
  { until: 1.01, marketDrift: 16, marketVol: 17, label: "Late cycle" },
];

function regimeAt(f: number) {
  for (const r of REGIMES) if (f < r.until) return r;
  return REGIMES[REGIMES.length - 1];
}

/* ── factor model ──────────────────────────────────────────────────────────── */

const FACTOR_VOL: Record<string, number> = {
  market: 17,
  semis: 34,
  tech: 24,
  healthcare: 18,
  consumer: 20,
  energy: 27,
  materials: 24,
  industrials: 20,
  financials: 21,
  china: 26,
  rates: 8,
  credit: 7,
  gold: 15,
  cash: 0.3,
  diversified: 17,
};

const FACTOR_BETA: Record<string, number> = {
  market: 1,
  semis: 1.55,
  tech: 1.15,
  healthcare: 0.72,
  consumer: 1.0,
  energy: 0.92,
  materials: 1.05,
  industrials: 0.95,
  financials: 1.05,
  china: 0.85,
  rates: -0.08,
  credit: 0.25,
  gold: -0.05,
  cash: 0,
  diversified: 1,
};

/** The rates factor has its own macro history (2022-style bond bear market). */
const RATES_DRIFT = [
  { until: 0.18, drift: -14 },
  { until: 0.32, drift: 4 },
  { until: 0.55, drift: 3 },
  { until: 0.68, drift: 6 },
  { until: 0.84, drift: -5 },
  { until: 1.01, drift: 3 },
];

function ratesDriftAt(f: number) {
  for (const r of RATES_DRIFT) if (f < r.until) return r.drift;
  return 3;
}

export interface Series {
  dates: string[];
  values: number[];
}

function buildFactorSeries(dates: string[], name: string, rnd: () => number): number[] {
  const n = dates.length;
  const beta = FACTOR_BETA[name] ?? 1;
  const vol = FACTOR_VOL[name] ?? 20;
  const out: number[] = [];
  let volState = 1;
  let shock = 0;

  for (let i = 0; i < n; i++) {
    const f = i / n;
    const reg = regimeAt(f);
    // GARCH-ish volatility clustering
    volState = 0.94 * volState + 0.06 + 0.05 * Math.abs(shock);
    shock = gauss(rnd);

    const marketRet =
      (reg.marketDrift / 100) * (1 / 252) + (reg.marketVol / 100 / Math.sqrt(252)) * gauss(rnd);

    let drift: number;
    if (name === "market") drift = 0;
    else if (name === "rates") drift = ratesDriftAt(f) / 100 / 252;
    else drift = (reg.marketDrift / 100 / 252) * (beta - 1) * 0.6;

    const dailyVol = (vol / 100 / Math.sqrt(252)) * volState;
    const idio = shock * dailyVol * (name === "market" ? 1 : 0.55);
    out.push(beta * marketRet + drift + idio);
  }
  return out;
}

/* ── price generation ──────────────────────────────────────────────────────── */

export interface GeneratedPrices {
  dates: string[];
  bySymbol: Record<string, number[]>;
}

export function generatePrices(seed = 20260923, years = 6): GeneratedPrices {
  const rnd = mulberry32(seed);
  const end = new Date();
  const start = addDays(end, -Math.round(365.25 * years));
  const dates = tradingDays(start, end);
  const n = dates.length;

  const factors: Record<string, number[]> = {};
  const factorNames = Array.from(new Set(INSTRUMENTS.map((i) => i.sectorFactor))).concat([
    "market",
  ]);
  for (const f of factorNames) factors[f] = buildFactorSeries(dates, f, rnd);

  const bySymbol: Record<string, number[]> = {};

  for (const inst of INSTRUMENTS) {
    const factor = factors[inst.sectorFactor] ?? factors.market;
    const beta = inst.beta;
    const idioVol = (inst.vol / 100 / Math.sqrt(252)) * 0.62;
    // the factor series already carries the market's drift, so only the
    // instrument's *excess* return over beta × long-run market drift is added
    const BASE_MARKET_DRIFT = 11;
    const drift = (inst.drift - inst.beta * BASE_MARKET_DRIFT) / 100 / 252;
    const rets: number[] = new Array(n);

    let momentum = 0;
    for (let i = 0; i < n; i++) {
      const f = i / n;
      const reg = regimeAt(f);
      // instruments with high beta get hit harder in drawdowns
      const regimeAdj = 1 + (reg.marketDrift < 0 ? (beta - 1) * 0.9 : 0);
      const z = gauss(rnd);
      momentum = 0.06 * momentum + 0.94 * z;
      let r = beta * factor[i] * regimeAdj + drift + idioVol * momentum;
      if (inst.kind === "cash") r = 0.0002 + 0.00002 * gauss(rnd); // ~5.1%/yr, flat NAV
      rets[i] = r;
    }

    // build the raw level then rescale so the final print equals `inst.last`
    const level: number[] = new Array(n);
    level[0] = 1;
    for (let i = 1; i < n; i++) level[i] = level[i - 1] * (1 + rets[i]);
    const k = inst.last / level[n - 1];
    bySymbol[inst.symbol] = level.map((v) => (inst.kind === "cash" ? 1 : v * k));
  }

  return { dates, bySymbol };
}

/* ── FX model ──────────────────────────────────────────────────────────────── */

export interface GeneratedFx {
  dates: string[];
  byCode: Record<string, number[]>; // USD per 1 unit
}

const FX_SPEC: Record<string, { vol: number; drift: number; beta: number; start: number }> = {
  EUR: { vol: 9, drift: 0.4, beta: -0.35, start: 1.09 },
  GBP: { vol: 10, drift: -0.2, beta: -0.3, start: 1.28 },
  JPY: { vol: 11, drift: -3.4, beta: -0.25, start: 0.0089 },
  DKK: { vol: 8, drift: 0.4, beta: -0.3, start: 0.146 },
  HKD: { vol: 1.2, drift: 0, beta: -0.02, start: 0.128 },
  AUD: { vol: 12, drift: -1.1, beta: -0.45, start: 0.68 },
  CHF: { vol: 9, drift: 0.6, beta: -0.3, start: 1.14 },
  KRW: { vol: 12, drift: -1.6, beta: -0.3, start: 0.00074 },
};

export function generateFx(dates: string[], seed = 777): GeneratedFx {
  const rnd = mulberry32(seed);
  const n = dates.length;
  const market: number[] = [];
  for (let i = 0; i < n; i++) {
    const reg = regimeAt(i / n);
    market.push(
      (reg.marketDrift / 100 / 252) * 0.9 +
        (reg.marketVol / 100 / Math.sqrt(252)) * gauss(rnd) * 0.8,
    );
  }

  const byCode: Record<string, number[]> = { USD: new Array(n).fill(1) };
  for (const [code, spec] of Object.entries(FX_SPEC)) {
    const level: number[] = new Array(n);
    level[0] = 1;
    for (let i = 1; i < n; i++) {
      const vol = spec.vol / 100 / Math.sqrt(252);
      const r =
        spec.drift / 100 / 252 +
        spec.beta * market[i] +
        vol * gauss(rnd) +
        (code === "DKK" ? 0.55 * (byCode.EUR[i] / byCode.EUR[i - 1] - 1) : 0);
      level[i] = level[i - 1] * (1 + r);
    }
    const k = level[n - 1];
    byCode[code] = level.map((v) => (v / k) * spec.start * 1.02);
  }
  return { dates, byCode };
}

/* ── benchmarks ────────────────────────────────────────────────────────────── */

export interface GeneratedBenchmarks {
  dates: string[];
  bySymbol: Record<string, number[]>;
}

export function generateBenchmarks(prices: GeneratedPrices): GeneratedBenchmarks {
  const { dates, bySymbol } = prices;
  const n = dates.length;
  const spx: number[] = [];
  const acwi: number[] = [];
  const gb: number[] = [];
  const agg: number[] = [];
  const spxRets: number[] = [];
  const vxusRets: number[] = [];
  const aggRets: number[] = [];

  for (let i = 0; i < n; i++) {
    spxRets.push(
      i === 0 ? 0 : bySymbol.VTI[i] / bySymbol.VTI[i - 1] - 1,
    );
    vxusRets.push(i === 0 ? 0 : bySymbol.VXUS[i] / bySymbol.VXUS[i - 1] - 1);
    aggRets.push(i === 0 ? 0 : bySymbol.AGG[i] / bySymbol.AGG[i - 1] - 1);
  }

  let s = 100;
  let a = 100;
  let b = 100;
  let g = 100;
  for (let i = 0; i < n; i++) {
    s *= 1 + spxRets[i];
    a *= 1 + (0.62 * spxRets[i] + 0.38 * vxusRets[i]);
    b *= 1 + (0.6 * spxRets[i] + 0.4 * aggRets[i]);
    g *= 1 + aggRets[i];
    spx.push(s);
    acwi.push(a);
    gb.push(b);
    agg.push(g);
  }
  return { dates, bySymbol: { SPX: spx, ACWI: acwi, GLOBAL60_40: gb, AGG: agg } };
}

/* ── ledger simulation ─────────────────────────────────────────────────────── */

export interface SimResult {
  transactions: {
    symbol: string | null;
    accountId: string;
    date: string;
    side: string;
    shares: number;
    price: number;
    amount: number;
    fee: number;
    note: string;
  }[];
  holdings: {
    symbol: string;
    accountId: string;
    shares: number;
    avgCost: number;
    openedOn: string;
    targetWeight: number;
  }[];
  cash: { accountId: string; currency: string; amount: number; updatedOn: string }[];
  realizedBySymbol: Record<string, number>;
  totalContributions: number;
}

const ACCOUNT_FOR: Record<string, string> = {
  // US growth / broad market core
  NVDA: "core",
  AAPL: "core",
  MSFT: "core",
  MELI: "core",
  UNH: "core",
  COST: "core",
  VTI: "core",
  QQQ: "core",
  XLK: "core",
  SCHD: "core",
  SMH: "core",
  // international satellite
  ASML: "global",
  SAP: "global",
  "NOVO-B": "global",
  "0700.HK": "global",
  TM: "global",
  SHEL: "global",
  BHP: "global",
  VXUS: "global",
  VWO: "global",
  // long-horizon retirement sleeve
  AGG: "retire",
  BNDX: "retire",
  TLT: "retire",
  LQD: "retire",
  VNQ: "retire",
  GLD: "retire",
  SPAXX: "retire",
};

interface Position {
  shares: number;
  cost: number;
  realized: number;
  openedOn: string;
}

export function simulateLedger(
  prices: GeneratedPrices,
  fx: GeneratedFx,
  seed = 4242,
): SimResult {
  const rnd = mulberry32(seed);
  const { dates, bySymbol } = prices;
  const n = dates.length;
  const startIndex = Math.floor(n * 0.13); // ~5.2y of history

  const priceAt = (sym: string, i: number) => bySymbol[sym][i];
  const usdAt = (code: string, i: number) => {
    if (code === "USD") return 1;
    const arr = fx.byCode[code];
    return arr ? arr[Math.min(i, arr.length - 1)] : 1;
  };

  const positions = new Map<string, Position>();
  const cashByAccount: Record<string, number> = { core: 0, global: 0, retire: 0 };
  const realizedAccum: Record<string, number> = {};
  const transactions: SimResult["transactions"] = [];

  const push = (t: SimResult["transactions"][number]) => transactions.push(t);

  // initial funding
  cashByAccount.core = 45000;
  cashByAccount.global = 18000;
  cashByAccount.retire = 22000;
  for (const [acct, amount] of [
    ["core", 45000],
    ["global", 18000],
    ["retire", 22000],
  ] as const) {
    push({
      symbol: null,
      accountId: acct,
      date: dates[startIndex],
      side: "deposit",
      shares: 0,
      price: 0,
      amount,
      fee: 0,
      note: "Account funding — transfer from bank",
    });
  }

  const valueAt = (i: number) => {
    let v = cashByAccount.core + cashByAccount.global + cashByAccount.retire;
    for (const [sym, p] of positions) {
      const inst = INSTRUMENTS.find((x) => x.symbol === sym)!;
      v += p.shares * priceAt(sym, i) * usdAt(inst.currency, i);
    }
    return v;
  };

  let lastRebalance = startIndex;

  for (let i = startIndex; i < n; i++) {
    const date = dates[i];
    const isMonthStart = i === startIndex || (i > 0 && date.slice(0, 7) !== dates[i - 1].slice(0, 7));

    // ── monthly contribution ──
    if (isMonthStart && i > startIndex) {
      const monthIdx = Math.floor((i - startIndex) / 21);
      const lumps: Record<number, number> = { 6: 15000, 18: 26000, 31: 20000, 44: 32000 };
      const plan: [string, number][] = [
        ["core", 1800 + Math.round(rnd() * 200)],
        ["global", monthIdx % 3 !== 2 ? 900 : 0],
        ["retire", monthIdx % 4 !== 3 ? 700 : 0],
      ];
      for (const [acct, base] of plan) {
        if (base <= 0) continue;
        let amount = base;
        if (lumps[monthIdx] && acct === "core") amount += lumps[monthIdx];
        cashByAccount[acct] += amount;
        push({
          symbol: null,
          accountId: acct,
          date,
          side: "deposit",
          shares: 0,
          price: 0,
          amount,
          fee: 0,
          note: amount > 5000 ? "Lump-sum contribution" : "Monthly contribution",
        });
      }
    }

    // ── dividends (reinvested) ──
    for (const sym of HELD) {
      const inst = INSTRUMENTS.find((x) => x.symbol === sym)!;
      if (inst.divYield <= 0) continue;
      const p = positions.get(sym);
      if (!p || p.shares <= 0) continue;
      const monthly = inst.kind === "cash" ? inst.divYield / 12 : inst.divYield / 4;
      const freq = inst.kind === "cash" ? 21 : 63;
      if ((i - startIndex) % freq !== 3) continue;
      const dps = priceAt(sym, i) * (monthly / 100);
      const gross = p.shares * dps * usdAt(inst.currency, i);
      const fee = gross * 0.0005;
      const acct = ACCOUNT_FOR[sym];
      cashByAccount[acct] += gross - fee;
      push({
        symbol: sym,
        accountId: acct,
        date,
        side: "dividend",
        shares: 0,
        price: dps,
        amount: gross - fee,
        fee,
        note: `Distribution reinvested — ${sym}`,
      });
    }

    // ── advisory fee (quarterly) ──
    if ((i - startIndex) % 63 === 40) {
      const fee = valueAt(i) * 0.0006;
      cashByAccount.core -= fee;
      push({
        symbol: null,
        accountId: "core",
        date,
        side: "fee",
        shares: 0,
        price: 0,
        amount: -fee,
        fee,
        note: "Advisory fee — quarterly",
      });
    }

    // ── rebalance / deploy cash every ~3 months ──
    if (i - lastRebalance >= 55) {
      lastRebalance = i;
      const total = valueAt(i);
      const isFullRebalance = (i - startIndex) % 252 < 55;

      for (const acct of ["core", "global", "retire"] as const) {
        const symbols = HELD.filter((s) => ACCOUNT_FOR[s] === acct);
        const cashA = cashByAccount[acct];
        if (cashA < 250) continue;
        const budget = cashA * (0.82 + rnd() * 0.13);

        // deficit of every symbol in this account vs its policy weight
        const list = symbols
          .map((sym) => {
            const inst = INSTRUMENTS.find((x) => x.symbol === sym)!;
            const p = positions.get(sym);
            const cur = p ? p.shares * priceAt(sym, i) * usdAt(inst.currency, i) : 0;
            const target = targetFor(sym) * total;
            return { sym, inst, p, cur, deficit: target - cur, target };
          })
          .sort((a, b) => b.deficit - a.deficit);

        // fund the deficits with a tilt + noise, so positions genuinely drift
        const sumDef = list.reduce((a, c) => a + Math.max(c.deficit, 0) ** 0.65 * (0.45 + rnd()), 0);
        if (sumDef > 0) {
          for (const c of list) {
            if (c.deficit <= 0) continue;
            if (cashByAccount[acct] < 200) break;
            const tilt = Math.max(c.deficit, 0) ** 0.65 * (0.45 + rnd());
            let spend = (budget * tilt) / sumDef;
            spend = Math.min(spend, cashByAccount[acct] * 0.75);
            if (spend < 250) continue;
            const pxUsd = priceAt(c.sym, i) * usdAt(c.inst.currency, i);
            const shares = spend / pxUsd;
            const fee = spend * 0.0004;
            cashByAccount[acct] -= spend + fee;
            const p = c.p ?? { shares: 0, cost: 0, realized: 0, openedOn: date };
            p.shares += shares;
            p.cost += spend;
            positions.set(c.sym, p);
            push({
              symbol: c.sym,
              accountId: acct,
              date,
              side: "buy",
              shares,
              price: pxUsd,
              amount: -(spend + fee),
              fee,
              note: "Buy — contribution & drift rebalance",
            });
          }
        }

        // ── trim winners back toward policy ──
        const winners = list
          .filter((c) => c.p && c.p.shares > 0 && c.cur - c.target > c.cur * (isFullRebalance ? 0.03 : 0.09))
          .sort((a, b) => b.cur - b.target - (a.cur - a.target));
        for (const c of winners.slice(0, isFullRebalance ? 4 : 1)) {
          const p = c.p!;
          const pxUsd = priceAt(c.sym, i) * usdAt(c.inst.currency, i);
          const excess = c.cur - c.target;
          const shares = Math.min(p.shares * 0.4, (excess * 0.7) / pxUsd);
          if (shares * pxUsd < 500) continue;
          const proceeds = shares * pxUsd;
          const fee = proceeds * 0.0004;
          const costBasis = (p.cost / p.shares) * shares;
          const realized = proceeds - costBasis;
          cashByAccount[acct] += proceeds - fee;
          p.shares -= shares;
          p.cost -= costBasis;
          p.realized += realized - fee;
          realizedAccum[c.sym] = (realizedAccum[c.sym] ?? 0) + realized - fee;
          push({
            symbol: c.sym,
            accountId: acct,
            date,
            side: "sell",
            shares,
            price: pxUsd,
            amount: proceeds - fee,
            fee,
            note: isFullRebalance ? "Sell — annual rebalance" : "Sell — trim winner, realise gains",
          });
        }
      }
    }
  }

  // final sweep: leave a deliberate cash buffer
  const lastI = n - 1;
  for (const acct of ["core", "global", "retire"]) {
    if (cashByAccount[acct] > 3000) {
      const spend = cashByAccount[acct] - (acct === "retire" ? 2500 : 1800);
      const sym = acct === "retire" ? "AGG" : "VTI";
      const inst = INSTRUMENTS.find((x) => x.symbol === sym)!;
      const pxUsd = priceAt(sym, lastI) * usdAt(inst.currency, lastI);
      const shares = spend / pxUsd;
      cashByAccount[acct] -= spend;
      const p = positions.get(sym) ?? { shares: 0, cost: 0, realized: 0, openedOn: dates[lastI] };
      p.shares += shares;
      p.cost += spend;
      positions.set(sym, p);
      push({
        symbol: sym,
        accountId: acct,
        date: dates[lastI],
        side: "buy",
        shares,
        price: pxUsd,
        amount: -spend,
        fee: 0,
        note: "Buy — deploy residual cash",
      });
    }
  }

  const holdings: SimResult["holdings"] = [];
  for (const [sym, p] of positions) {
    if (p.shares <= 0.0001) continue;
    holdings.push({
      symbol: sym,
      accountId: ACCOUNT_FOR[sym],
      shares: p.shares,
      avgCost: p.cost / p.shares,
      openedOn: p.openedOn,
      targetWeight: targetFor(sym),
    });
  }

  const realizedBySymbol = realizedAccum;

  return {
    transactions,
    holdings,
    cash: [
      { accountId: "core", currency: "USD", amount: cashByAccount.core, updatedOn: dates[lastI] },
      { accountId: "global", currency: "USD", amount: cashByAccount.global, updatedOn: dates[lastI] },
      { accountId: "retire", currency: "USD", amount: cashByAccount.retire, updatedOn: dates[lastI] },
    ],
    realizedBySymbol,
    totalContributions: transactions
      .filter((t) => t.side === "deposit")
      .reduce((a, b) => a + b.amount, 0),
  };
}

function targetFor(sym: string): number {
  const tw: Record<string, number> = {
    VTI: 18, QQQ: 10, VXUS: 9, SCHD: 6, XLK: 4, VWO: 4,
    NVDA: 6, AAPL: 5, MSFT: 5, ASML: 2.5, SAP: 1.5, "0700.HK": 1.5,
    "NOVO-B": 1.5, MELI: 1, TM: 1.5, UNH: 2, COST: 2, SHEL: 1.5, BHP: 1.5,
    SMH: 2, AGG: 8, BNDX: 2, TLT: 1.5, LQD: 1, VNQ: 1.5, GLD: 3, SPAXX: 2,
  };
  return tw[sym] ?? 0;
}

/* ── news + events ─────────────────────────────────────────────────────────── */

const NEWS_TEMPLATES: {
  headline: string;
  summary: string;
  source: string;
  category: string;
  sentiment: number;
  importance: number;
  symbols: string[];
  daysAgo: number;
}[] = [
  {
    headline: "Nvidia lifts full-year data-centre guidance as backlog stretches into next year",
    summary:
      "Management framed the next two quarters as supply-constrained rather than demand-constrained, and flagged a step-up in advanced packaging capacity.",
    source: "Reuters",
    category: "company",
    sentiment: 0.72,
    importance: 3,
    symbols: ["NVDA", "SMH", "QQQ"],
    daysAgo: 0,
  },
  {
    headline: "TSMC raises capex again — foundry pricing holds despite efficiency gains",
    summary:
      "The leading-edge roadmap is being funded ahead of revenue, which supports equipment orders across the supply chain.",
    source: "Bloomberg",
    category: "sector",
    sentiment: 0.45,
    importance: 2,
    symbols: ["TSM", "ASML", "SMH"],
    daysAgo: 0,
  },
  {
    headline: "Core PCE prints at 2.4% — the last mile on services inflation is slow",
    summary:
      "Shelter disinflation is stalling, keeping the terminal-rate debate alive. Duration reacted with a bear flattening.",
    source: "Meridian Research",
    category: "macro",
    sentiment: -0.28,
    importance: 3,
    symbols: ["TLT", "AGG", "LQD"],
    daysAgo: 1,
  },
  {
    headline: "Apple's services line beats again; installed base crosses 2.4bn devices",
    summary:
      "Gross margin on services remains the swing factor for the multiple, and attachment in emerging markets is doing the work.",
    source: "WSJ",
    category: "company",
    sentiment: 0.55,
    importance: 2,
    symbols: ["AAPL", "QQQ", "VTI"],
    daysAgo: 1,
  },
  {
    headline: "EM equities rally as the dollar rolls over for a third week",
    summary:
      "A softer dollar has historically been the single strongest tailwind for emerging-market relative performance.",
    source: "FT",
    category: "markets",
    sentiment: 0.62,
    importance: 2,
    symbols: ["VWO", "VXUS", "0700.HK"],
    daysAgo: 2,
  },
  {
    headline: "Novo Nordisk guidance trimmed as US compounding pharmacies persist",
    summary:
      "Volume growth is intact but the pricing environment in the US is worse than the base case assumed.",
    source: "Reuters",
    category: "company",
    sentiment: -0.48,
    importance: 2,
    symbols: ["NOVO-B"],
    daysAgo: 2,
  },
  {
    headline: "Microsoft Azure growth re-accelerates; AI contribution now disclosed separately",
    summary:
      "The disclosure is the story — investors can finally size the AI revenue line rather than infer it.",
    source: "Bloomberg",
    category: "company",
    sentiment: 0.6,
    importance: 2,
    symbols: ["MSFT", "QQQ"],
    daysAgo: 3,
  },
  {
    headline: "Gold breaks to a fresh record as central-bank buying continues",
    summary:
      "Reserve managers keep adding at a pace that absorbs mine supply several times over.",
    source: "FT",
    category: "markets",
    sentiment: 0.5,
    importance: 2,
    symbols: ["GLD"],
    daysAgo: 3,
  },
  {
    headline: "Shell announces $3.5bn buyback after a strong downstream quarter",
    summary:
      "Capital returns are being prioritised over volume growth, which is the right call at this point in the cycle.",
    source: "Reuters",
    category: "company",
    sentiment: 0.35,
    importance: 1,
    symbols: ["SHEL"],
    daysAgo: 4,
  },
  {
    headline: "Iron ore slides below $95 as Chinese property starts disappoint again",
    summary:
      "Steel-intensive demand is the swing factor for the bulk complex; supply discipline is not there to offset it.",
    source: "Meridian Research",
    category: "macro",
    sentiment: -0.55,
    importance: 2,
    symbols: ["BHP", "VWO"],
    daysAgo: 4,
  },
  {
    headline: "Tencent's domestic games approvals normalise, ad inventory monetises better",
    summary:
      "Two years of regulatory ambiguity is finally clearing from the earnings line.",
    source: "Bloomberg",
    category: "company",
    sentiment: 0.42,
    importance: 1,
    symbols: ["0700.HK"],
    daysAgo: 5,
  },
  {
    headline: "Investment-grade credit spreads compress to the tightest since 2021",
    summary:
      "Carry is thin, which means the asymmetry in credit has worsened even as the index looks calm.",
    source: "Meridian Research",
    category: "markets",
    sentiment: -0.18,
    importance: 2,
    symbols: ["LQD", "AGG"],
    daysAgo: 5,
  },
  {
    headline: "UnitedHealth wins a key state Medicaid rate appeal",
    summary:
      "A modest but genuine reduction in the medical-cost-ratio overhang.",
    source: "WSJ",
    category: "company",
    sentiment: 0.3,
    importance: 1,
    symbols: ["UNH"],
    daysAgo: 6,
  },
  {
    headline: "Costco renews US membership at a record rate and raises the fee",
    summary:
      "The renewal rate is the single most important operating metric in the model.",
    source: "Reuters",
    category: "company",
    sentiment: 0.4,
    importance: 1,
    symbols: ["COST"],
    daysAgo: 6,
  },
  {
    headline: "ASML books another two High-NA orders, lead times extend into 2027",
    summary:
      "Order visibility at the chokepoint of the supply chain keeps improving.",
    source: "Bloomberg",
    category: "sector",
    sentiment: 0.66,
    importance: 2,
    symbols: ["ASML", "SMH"],
    daysAgo: 7,
  },
  {
    headline: "REITs catch a bid as the front end reprices lower",
    summary:
      "Listed real estate is the most rate-sensitive equity sleeve in the book.",
    source: "Meridian Research",
    category: "markets",
    sentiment: 0.25,
    importance: 1,
    symbols: ["VNQ"],
    daysAgo: 7,
  },
  {
    headline: "SAP's cloud backlog conversion accelerates ahead of plan",
    summary:
      "European enterprise software is quietly compounding without the multiple to match.",
    source: "FT",
    category: "company",
    sentiment: 0.38,
    importance: 1,
    symbols: ["SAP", "VXUS"],
    daysAgo: 8,
  },
  {
    headline: "Toyota lifts its full-year operating-profit forecast on hybrid mix",
    summary:
      "Hybrids are proving far more durable than the consensus BEV ramp implied.",
    source: "Reuters",
    category: "company",
    sentiment: 0.32,
    importance: 1,
    symbols: ["TM"],
    daysAgo: 8,
  },
  {
    headline: "MercadoLibre's credit book grows faster than commerce — again",
    summary:
      "The fintech arm is now the reason to own the equity rather than a rounding error.",
    source: "Bloomberg",
    category: "company",
    sentiment: 0.58,
    importance: 2,
    symbols: ["MELI"],
    daysAgo: 9,
  },
  {
    headline: "Volatility spikes as index concentration hits a multi-decade high",
    summary:
      "The top ten names now carry an unusually large share of index risk, which cuts both ways.",
    source: "Meridian Research",
    category: "markets",
    sentiment: -0.32,
    importance: 3,
    symbols: ["VTI", "QQQ", "SPX"],
    daysAgo: 9,
  },
];

function generateNews(prices: GeneratedPrices): {
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: Date;
  category: string;
  sentiment: number;
  importance: number;
  symbols: string[];
}[] {
  const rnd = mulberry32(9090);
  const last = prices.dates[prices.dates.length - 1];
  const base = new Date(`${last}T14:30:00Z`);
  return NEWS_TEMPLATES.map((t) => ({
    headline: t.headline,
    summary: t.summary,
    source: t.source,
    url: "https://meridian.local/news/" + t.headline.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48),
    publishedAt: new Date(base.getTime() - t.daysAgo * DAY - Math.floor(rnd() * 6) * 3600000),
    category: t.category,
    sentiment: t.sentiment,
    importance: t.importance,
    symbols: t.symbols.filter((s) => INSTRUMENTS.some((i) => i.symbol === s)),
  }));
}

function generateEvents(prices: GeneratedPrices, seed = 3131): {
  symbol: string;
  kind: string;
  date: string;
  title: string;
  detail: string;
  estimate: string;
}[] {
  const rnd = mulberry32(seed);
  const n = prices.dates.length;
  const today = new Date(`${prices.dates[n - 1]}T00:00:00Z`);
  const out: ReturnType<typeof generateEvents> = [];

  const quarterLabels = ["Q3 FY26", "Q4 FY26", "Q1 FY27", "Q2 FY27"];
  for (const sym of HELD) {
    const inst = INSTRUMENTS.find((i) => i.symbol === sym)!;
    if (inst.kind === "cash") continue;
    const offset = 3 + Math.floor(rnd() * 42);
    const d = addDays(today, offset);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    const q = quarterLabels[Math.floor(rnd() * quarterLabels.length)];
    out.push({
      symbol: sym,
      kind: "earnings",
      date: iso(d),
      title: `${sym} — ${q} results`,
      detail: inst.name,
      estimate: `Consensus EPS $${(2 + rnd() * 6).toFixed(2)}`,
    });

    if (inst.divYield > 0) {
      const dd = addDays(today, 5 + Math.floor(rnd() * 50));
      while (dd.getUTCDay() === 0 || dd.getUTCDay() === 6) dd.setUTCDate(dd.getUTCDate() + 1);
      const dps = (inst.last * inst.divYield) / 400;
      out.push({
        symbol: sym,
        kind: "dividend",
        date: iso(dd),
        title: `${sym} — ex-dividend`,
        detail: inst.name,
        estimate: `Indicative $${dps.toFixed(3)} / share`,
      });
    }
  }

  const macro: [string, number, string, string][] = [
    ["FOMC", 6, "Policy decision", "Rate path & balance-sheet guidance"],
    ["CPI", 9, "US CPI print", "Headline & core, month-on-month"],
    ["NFP", 14, "US nonfarm payrolls", "Labour-market temperature check"],
    ["PCE", 21, "Core PCE", "The Fed's preferred gauge"],
    ["OPEC", 27, "OPEC+ meeting", "Quota policy for the next quarter"],
    ["GDP", 33, "Advance GDP estimate", "US real activity"],
  ];
  for (const [name, offset, title, detail] of macro) {
    const d = addDays(today, offset);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    out.push({
      symbol: name,
      kind: "macro",
      date: iso(d),
      title,
      detail,
      estimate: "Consensus —",
    });
  }

  // a couple of structural events
  out.push({
    symbol: "NVDA",
    kind: "conference",
    date: iso(addDays(today, 17)),
    title: "NVIDIA — AI developer keynote",
    detail: "Roadmap and supply commentary expected",
    estimate: "Watch",
  });
  out.push({
    symbol: "SPX",
    kind: "index",
    date: iso(addDays(today, 24)),
    title: "S&P index rebalance — effective date",
    detail: "Quarterly review; passive flows land at the close",
    estimate: "Watch",
  });

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ── top-level seed ────────────────────────────────────────────────────────── */

export interface SeedBundle {
  prices: GeneratedPrices;
  fx: GeneratedFx;
  benchmarks: GeneratedBenchmarks;
  sim: SimResult;
  news: ReturnType<typeof generateNews>;
  events: ReturnType<typeof generateEvents>;
}

export function buildSeedBundle(seed = 20260923): SeedBundle {
  const prices = generatePrices(seed);
  const fx = generateFx(prices.dates, seed + 5);
  const benchmarks = generateBenchmarks(prices);
  const sim = simulateLedger(prices, fx, seed + 11);
  const news = generateNews(prices);
  const events = generateEvents(prices);
  return { prices, fx, benchmarks, sim, news, events };
}

export const ACCOUNT_SEEDS = ACCOUNTS;
export const INSTRUMENT_SEEDS: InstrumentSeed[] = INSTRUMENTS;
export const FUND_CONSTITUENT_SEEDS = FUND_CONSTITUENTS;
