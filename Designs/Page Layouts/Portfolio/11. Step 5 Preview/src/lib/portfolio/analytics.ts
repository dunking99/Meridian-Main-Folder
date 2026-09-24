/**
 * Meridian — portfolio analytics
 * ---------------------------------------------------------------------------
 * Second pass over the core portfolio: benchmark-relative performance,
 * allocation, look-through exposure, correlation, overlap and stress tests.
 */
import type { RawData } from "@/lib/data/repository";
import type { PortfolioCore, Pt } from "./engine";
import {
  alpha,
  annualTable,
  beta as betaFn,
  corr,
  cvarHist,
  histogram,
  kurtosis,
  maxDrawdown,
  mean,
  monthlyTable,
  percentile,
  returnsFrom,
  sharpe as sharpeFn,
  sortino as sortinoFn,
  stdev,
  skewness,
  trailingReturn,
  ulcerIndex,
  varHist,
  ytdReturn,
} from "./metrics";
import { HOME_BIAS_TARGET } from "@/lib/data/universe";

export interface Horizon {
  label: string;
  days: number | null;
  portfolio: number;
  spx: number;
  acwi: number;
  g6040: number;
}

export interface Stats {
  vol: number;
  sharpe: number;
  sortino: number;
  maxDd: number;
  maxDdDate: string;
  maxDdPeak: string;
  beta: number;
  alpha: number;
  te: number;
  ir: number;
  var95: number;
  cvar95: number;
  skew: number;
  kurt: number;
  ulcer: number;
  hitRate: number;
  bestDay: { d: string; v: number };
  worstDay: { d: string; v: number };
  upCapture: number;
  downCapture: number;
  avgUp: number;
  avgDown: number;
  positiveMonths: number;
  totalMonths: number;
}

export interface AllocationBlock {
  key: string;
  weight: number;
  value: number;
  count: number;
}

export interface LookthroughRow {
  symbol: string;
  name: string;
  direct: number;
  viaFunds: number;
  total: number;
  sector: string;
  country: string;
  currency: string;
}

export interface OverlapPair {
  a: string;
  b: string;
  overlap: number;
  shared: number;
}

export interface Scenario {
  key: string;
  name: string;
  shock: string;
  impact: number; // percent of portfolio
  drivers: { symbol: string; contribution: number }[];
}

export interface Analytics {
  bench: { spx: Pt[]; acwi: Pt[]; g6040: Pt[] };
  benchRets: { spx: number[]; acwi: number[]; g6040: number[] };
  horizons: Horizon[];
  monthly: { year: number; months: (number | null)[]; total: number; benchTotal: number }[];
  annual: { year: number; value: number; bench: number }[];
  stats: Stats;
  rollingVol: Pt[];
  rollingSharpe: Pt[];
  drawdown: Pt[];
  distribution: { from: number; to: number; count: number }[];
  distStats: { mean: number; median: number; p5: number; p95: number };
  allocation: {
    assetClass: AllocationBlock[];
    sector: AllocationBlock[];
    country: AllocationBlock[];
    currency: AllocationBlock[];
    region: AllocationBlock[];
    account: AllocationBlock[];
    style: AllocationBlock[];
    mcap: AllocationBlock[];
    kind: AllocationBlock[];
  };
  lookthrough: LookthroughRow[];
  ltSector: AllocationBlock[];
  ltCountry: AllocationBlock[];
  ltCurrency: AllocationBlock[];
  correlation: { symbols: string[]; matrix: number[][]; portCol: number[] };
  overlap: { pairs: OverlapPair[]; max: number };
  homeBias: { domestic: number; international: number; target: number; gap: number; score: number };
  currencyExposure: { code: string; direct: number; lookthrough: number; total: number; hedged: number }[];
  riskContrib: { symbol: string; name: string; weight: number; riskPct: number; mctr: number }[];
  scenarios: Scenario[];
  shape: { level: number; weight: number }[];
  rebalance: {
    symbol: string;
    name: string;
    current: number;
    target: number;
    drift: number;
    trade: number;
    action: "buy" | "sell" | "hold";
  }[];
  income: {
    total12m: number;
    byMonth: Pt[];
    bySymbol: { symbol: string; name: string; amount: number }[];
    forwardYield: number;
    yieldOnCost: number;
    monthlyAvg: number;
  };
  cashFlow: Pt[];
  fees: number;
  costDrag: number;
  concentration: { top1: number; top5: number; top10: number; hhi: number; effN: number; maxWeight: number };
}

const group = (rows: { key: string; weight: number; value: number }[]): AllocationBlock[] => {
  const m = new Map<string, AllocationBlock>();
  for (const r of rows) {
    const e = m.get(r.key) ?? { key: r.key, weight: 0, value: 0, count: 0 };
    e.weight += r.weight;
    e.value += r.value;
    e.count += 1;
    m.set(r.key, e);
  }
  return [...m.values()].sort((a, b) => b.weight - a.weight);
};

const DURATION: Record<string, number> = {
  TLT: 16.5,
  AGG: 6.2,
  BNDX: 5.6,
  LQD: 6.8,
  VNQ: 0,
  GLD: 0,
  SPAXX: 0.1,
};

const isFund = (kind: string) =>
  kind === "etf" || kind === "bond_etf" || kind === "reit_etf" || kind === "commodity_etf";

export function buildAnalytics(core: PortfolioCore, raw: RawData): Analytics {
  const dates = core.dates;
  const n = dates.length;
  const rets = core.dailyReturns;
  const nav = core.nav;
  const last = n - 1;
  const holdings = core.holdings;
  const grand = holdings.reduce((s, h) => s + h.value, 0) + core.cash[last];

  /* ── benchmarks ─────────────────────────────────────────────────────────── */
  const benchOf = (symbol: string) => {
    const rows = raw.benchmarks.filter((b) => b.symbol === symbol);
    const m = new Map(rows.map((r) => [r.date, r.close]));
    let prev = 0;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = m.get(dates[i]);
      if (v !== undefined) prev = v;
      out.push(prev);
    }
    const base = out[0] || 1;
    return out.map((v) => (v / base) * 100);
  };
  const spx = benchOf("SPX");
  const acwi = benchOf("ACWI");
  const g6040 = benchOf("GLOBAL60_40");
  const toPt = (arr: number[]): Pt[] => arr.map((v, i) => ({ d: dates[i], v }));
  const benchRets = (arr: number[]) => returnsFrom(arr);

  /* ── trailing returns ───────────────────────────────────────────────────── */
  const horizons: Horizon[] = (
    [
      ["1D", 1],
      ["1W", 5],
      ["1M", 21],
      ["3M", 63],
      ["6M", 126],
      ["YTD", null],
      ["1Y", 252],
      ["3Y", 756],
      ["5Y", 1260],
      ["Inception", null],
    ] as [string, number | null][]
  ).map(([label, days]) => ({
    label,
    days,
    portfolio: days ? trailingReturn(nav, days) : label === "YTD" ? ytdReturn(dates, nav) : nav[last] / nav[0] - 1,
    spx: days ? trailingReturn(spx, days) : label === "YTD" ? ytdReturn(dates, spx) : spx[last] / spx[0] - 1,
    acwi: days ? trailingReturn(acwi, days) : label === "YTD" ? ytdReturn(dates, acwi) : acwi[last] / acwi[0] - 1,
    g6040: days ? trailingReturn(g6040, days) : label === "YTD" ? ytdReturn(dates, g6040) : g6040[last] / g6040[0] - 1,
  }));

  /* ── calendar tables ────────────────────────────────────────────────────── */
  const monthlyRaw = monthlyTable(dates, nav);
  const monthlyBench = monthlyTable(dates, spx);
  const monthly = monthlyRaw.map((r, i) => ({
    year: r.year,
    months: r.months.map((c) => c.value),
    total: r.total,
    benchTotal: monthlyBench[i]?.total ?? 0,
  }));
  const annualRaw = annualTable(dates, nav);
  const annualBench = annualTable(dates, spx);
  const annual = annualRaw.map((r, i) => ({ year: r.year, value: r.value, bench: annualBench[i]?.value ?? 0 }));

  /* ── risk statistics ────────────────────────────────────────────────────── */
  const spxRets = benchRets(spx);
  const ddInfo = (() => {
    let peak = nav[0];
    let peakIdx = 0;
    let max = 0;
    let trough = 0;
    let maxPeak = 0;
    for (let i = 0; i < n; i++) {
      if (nav[i] > peak) {
        peak = nav[i];
        peakIdx = i;
      }
      const dd = nav[i] / peak - 1;
      if (dd < max) {
        max = dd;
        trough = i;
        maxPeak = peakIdx;
      }
    }
    return { max, peak: maxPeak, trough };
  })();

  const active = rets.map((r, i) => r - (spxRets[i] ?? 0));
  const upDays = rets.filter((r) => r > 0);
  const downDays = rets.filter((r) => r < 0);
  const benchUp = spxRets.filter((r) => r > 0);
  const benchDown = spxRets.filter((r) => r < 0);

  const stats: Stats = {
    vol: stdev(rets) * Math.sqrt(252) * 100,
    sharpe: sharpeFn(rets),
    sortino: sortinoFn(rets),
    maxDd: ddInfo.max * 100,
    maxDdDate: dates[ddInfo.trough],
    maxDdPeak: dates[ddInfo.peak],
    beta: betaFn(rets, spxRets),
    alpha: alpha(rets, spxRets) * 100,
    te: stdev(active) * Math.sqrt(252) * 100,
    ir: stdev(active) > 0 ? (mean(active) * 252) / (stdev(active) * Math.sqrt(252)) : 0,
    var95: varHist(rets) * 100,
    cvar95: cvarHist(rets) * 100,
    skew: skewness(rets),
    kurt: kurtosis(rets),
    ulcer: ulcerIndex(nav),
    hitRate: (upDays.length / rets.length) * 100,
    bestDay: dates
      .map((d, i) => ({ d, v: rets[i] }))
      .reduce((a, b) => (b.v > a.v ? b : a), { d: dates[0], v: rets[0] }),
    worstDay: dates
      .map((d, i) => ({ d, v: rets[i] }))
      .reduce((a, b) => (b.v < a.v ? b : a), { d: dates[0], v: rets[0] }),
    upCapture: mean(benchUp) > 0 ? (mean(upDays) / mean(benchUp)) * 100 : 0,
    downCapture: mean(benchDown) < 0 ? (mean(downDays) / mean(benchDown)) * 100 : 0,
    avgUp: mean(upDays) * 100,
    avgDown: mean(downDays) * 100,
    positiveMonths: monthly.filter((m) => m.total > 0).length,
    totalMonths: monthly.length,
  };

  /* ── rolling series ─────────────────────────────────────────────────────── */
  const rollVol: number[] = [];
  const rollSharpe: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i < 63) {
      rollVol.push(NaN);
      rollSharpe.push(NaN);
      continue;
    }
    const slice = rets.slice(i - 63, i);
    rollVol.push(stdev(slice) * Math.sqrt(252) * 100);
    rollSharpe.push(i < 126 ? NaN : sharpeFn(rets.slice(i - 126, i)));
  }
  const rollingVol: Pt[] = [];
  const rollingSharpe: Pt[] = [];
  let peak = nav[0];
  const drawdown: Pt[] = [];
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(rollVol[i])) rollingVol.push({ d: dates[i], v: rollVol[i] });
    if (!Number.isNaN(rollSharpe[i])) rollingSharpe.push({ d: dates[i], v: rollSharpe[i] });
    if (nav[i] > peak) peak = nav[i];
    drawdown.push({ d: dates[i], v: (nav[i] / peak - 1) * 100 });
  }

  const dist = histogram(rets.map((r) => r * 100), 26);

  /* ── allocation ─────────────────────────────────────────────────────────── */
  const rowsFor = (fn: (h: (typeof holdings)[number]) => string) =>
    holdings.map((h) => ({ key: fn(h), weight: h.weight, value: h.value }));

  const mcapBucket = (h: (typeof holdings)[number]) => {
    if (h.kind !== "equity") return h.kind === "cash" ? "Cash" : "Fund";
    if (h.marketCap >= 500) return "Mega (>$500bn)";
    if (h.marketCap >= 200) return "Large ($200–500bn)";
    if (h.marketCap >= 50) return "Mid ($50–200bn)";
    return "Small (<$50bn)";
  };

  const allocation = {
    assetClass: group(rowsFor((h) => h.assetClass)),
    sector: group(rowsFor((h) => h.sector)),
    country: group(rowsFor((h) => h.country)),
    currency: group(rowsFor((h) => h.currency)),
    region: group(rowsFor((h) => h.region)),
    account: group(rowsFor((h) => h.accountName)),
    style: group(rowsFor((h) => h.style)),
    mcap: group(rowsFor((h) => mcapBucket(h))),
    kind: group(rowsFor((h) => h.kind)),
  };

  /* ── look-through exposure ──────────────────────────────────────────────── */
  const instById = new Map(raw.instruments.map((i) => [i.symbol, i]));
  const fundWeights = new Map<string, number>();
  for (const h of holdings) fundWeights.set(h.symbol, h.weight);

  const lt = new Map<string, LookthroughRow>();
  const ensure = (symbol: string): LookthroughRow => {
    const inst = instById.get(symbol);
    const existing = lt.get(symbol);
    if (existing) return existing;
    const row: LookthroughRow = {
      symbol,
      name: inst?.name ?? symbol,
      direct: 0,
      viaFunds: 0,
      total: 0,
      sector: inst?.sector ?? "—",
      country: inst?.country ?? "—",
      currency: inst?.currency ?? "USD",
    };
    lt.set(symbol, row);
    return row;
  };

  for (const h of holdings) {
    const row = ensure(h.symbol);
    row.direct += h.weight;
    const cons = raw.fundHoldings.filter((f) => f.fundSymbol === h.symbol);
    if (cons.length) {
      for (const c of cons) {
        const r = ensure(c.constituentSymbol);
        r.viaFunds += (h.weight * c.weight) / 100;
      }
    } else if (isFund(h.kind)) {
      row.viaFunds += h.weight; // fund with no disclosed constituents
    }
  }
  const lookthrough = [...lt.values()]
    .map((r) => ({ ...r, total: r.direct + r.viaFunds }))
    .sort((a, b) => b.total - a.total);

  const ltGroup = (fn: (r: LookthroughRow) => string) =>
    group(lookthrough.map((r) => ({ key: fn(r), weight: r.total, value: 0 })));

  const ltSector = ltGroup((r) => r.sector);
  const ltCountry = ltGroup((r) => r.country);
  const ltCurrency = ltGroup((r) => r.currency);

  /* ── correlation ────────────────────────────────────────────────────────── */
  const corrSymbols = holdings.slice(0, 14).map((h) => h.symbol);
  const retSeries = new Map<string, number[]>();
  for (const h of holdings) retSeries.set(h.symbol, returnsFrom(h.usdSeries));
  const matrix: number[][] = corrSymbols.map((a) =>
    corrSymbols.map((b) => (a === b ? 1 : corr(retSeries.get(a) ?? [], retSeries.get(b) ?? []))),
  );
  const portCol = holdings.map((h) => corr(retSeries.get(h.symbol) ?? [], rets));

  /* ── fund overlap ───────────────────────────────────────────────────────── */
  const fundSyms = holdings.filter((h) => raw.fundHoldings.some((f) => f.fundSymbol === h.symbol));
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < fundSyms.length; i++) {
    for (let j = i + 1; j < fundSyms.length; j++) {
      const a = fundSyms[i].symbol;
      const b = fundSyms[j].symbol;
      const ca = new Map(raw.fundHoldings.filter((f) => f.fundSymbol === a).map((f) => [f.constituentSymbol, f.weight]));
      const cb = new Map(raw.fundHoldings.filter((f) => f.fundSymbol === b).map((f) => [f.constituentSymbol, f.weight]));
      let overlap = 0;
      let shared = 0;
      for (const [k, w] of ca) {
        const w2 = cb.get(k);
        if (w2 !== undefined) {
          overlap += Math.min(w, w2);
          shared += 1;
        }
      }
      pairs.push({ a, b, overlap, shared });
    }
  }
  pairs.sort((x, y) => y.overlap - x.overlap);

  /* ── home bias + currency ───────────────────────────────────────────────── */
  const equityLt = lookthrough.filter((r) => {
    const inst = instById.get(r.symbol);
    return inst && inst.assetClass === "Equity";
  });
  const equityTotal = equityLt.reduce((s, r) => s + r.total, 0) || 1;
  const domestic = equityLt.filter((r) => r.country === "US").reduce((s, r) => s + r.total, 0);
  const homeBias = {
    domestic: (domestic / equityTotal) * 100,
    international: 100 - (domestic / equityTotal) * 100,
    target: HOME_BIAS_TARGET,
    gap: (domestic / equityTotal) * 100 - HOME_BIAS_TARGET,
    score: 0,
  };
  homeBias.score = Math.max(0, 100 - Math.abs(homeBias.gap) * 2.2);

  const currencyExposure = ltCurrency.map((c) => ({
    code: c.key,
    direct: allocation.currency.find((a) => a.key === c.key)?.weight ?? 0,
    lookthrough: c.weight,
    total: c.weight,
    hedged: c.key === "USD" ? 100 : 0,
  }));

  /* ── risk contribution ──────────────────────────────────────────────────── */
  const portVol = stdev(rets) * Math.sqrt(252);
  const riskContrib = holdings
    .map((h) => {
      const w = h.value / (grand || 1);
      const c = w * corr(rets, retSeries.get(h.symbol) ?? []) * stdev(retSeries.get(h.symbol) ?? []) * Math.sqrt(252);
      return {
        symbol: h.symbol,
        name: h.name,
        weight: h.weight,
        riskPct: portVol > 0 ? (c / portVol) * 100 : 0,
        mctr: c,
      };
    })
    .sort((a, b) => b.riskPct - a.riskPct);

  /* ── stress tests ───────────────────────────────────────────────────────── */
  const factorOf = (symbol: string) => {
    const inst = instById.get(symbol);
    const kind = inst?.kind ?? "equity";
    const sector = inst?.sector ?? "";
    const region = inst?.region ?? "";
    const assetClass = inst?.assetClass ?? "Equity";
    const dur = DURATION[symbol] ?? 0;
    return {
      equity: assetClass === "Equity" ? (kind === "reit_etf" ? 0.85 : 1) : assetClass === "Fixed Income" ? 0.12 : 0,
      semis: sector === "Semiconductors" ? 1 : sector === "Technology" || sector === "Software" ? 0.4 : 0.06,
      rates: dur > 0 ? -dur / 100 : assetClass === "Equity" ? (kind === "equity" && (sector === "Technology" || sector === "Software") ? -0.35 : -0.15) : 0,
      em: region === "Emerging Markets" || region === "Latin America" || region === "Asia-Pacific" ? 1 : 0.12,
      gold: assetClass === "Alternatives" ? 1 : 0,
      credit: assetClass === "Fixed Income" && (inst?.industry ?? "").includes("Corporate") ? 1 : 0.1,
      usd: (inst?.currency ?? "USD") !== "USD" ? 1 : 0,
    };
  };

  const ltForFactors = new Map<string, number>();
  for (const r of lookthrough) ltForFactors.set(r.symbol, r.total);

  const runScenario = (
    key: string,
    name: string,
    shock: string,
    factors: Record<string, number>,
  ): Scenario => {
    const drivers: { symbol: string; contribution: number }[] = [];
    let impact = 0;
    for (const r of lookthrough) {
      const f = factorOf(r.symbol);
      let delta = 0;
      for (const [k, v] of Object.entries(factors)) delta += f[k as keyof typeof f] * v;
      const contribution = (r.total / 100) * delta * 100;
      impact += contribution;
      if (Math.abs(contribution) > 0.02)
        drivers.push({ symbol: r.symbol, contribution });
    }
    drivers.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    return { key, name, shock, impact, drivers: drivers.slice(0, 6) };
  };

  const scenarios: Scenario[] = [
    runScenario("equity", "Global equity drawdown", "Equities −20%", { equity: -0.2 }),
    runScenario("semis", "AI hardware unwind", "Semis −35%", { semis: -0.35, equity: -0.08 }),
    runScenario("rates", "Rate shock", "Yields +200bp", { rates: 0.02, equity: -0.04 }),
    runScenario("usd", "Dollar squeeze", "USD +10%", { usd: -0.1 }),
    runScenario("em", "Emerging-market stress", "EM −25%", { em: -0.25, equity: -0.05 }),
    runScenario("gold", "Gold bid", "Gold +15%", { gold: 0.15 }),
    runScenario("credit", "Credit widening", "Spreads +150bp", { credit: -0.08, rates: 0.005, equity: -0.03 }),
    runScenario("combined", "Combined recession", "Equity −30%, spreads +250bp", {
      equity: -0.3,
      credit: -0.12,
      rates: 0.01,
      em: -0.2,
      semis: -0.25,
    }),
  ];

  /* ── shape of the book (time-at-value profile) ──────────────────────────── */
  const window = core.totalValue.slice(-252);
  const lo = Math.min(...window);
  const hi = Math.max(...window);
  const bins = 26;
  const counts = new Array(bins).fill(0);
  for (const v of window) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo || 1)) * bins)));
    counts[idx]++;
  }
  const maxCount = Math.max(...counts);
  const shape = counts.map((c, i) => ({
    level: lo + ((i + 0.5) / bins) * (hi - lo),
    weight: maxCount ? c / maxCount : 0,
  }));

  /* ── rebalancing ────────────────────────────────────────────────────────── */
  const rebalance = holdings
    .map((h) => {
      const drift = h.weight - h.targetWeight;
      const trade = (drift / 100) * grand;
      return {
        symbol: h.symbol,
        name: h.name,
        current: h.weight,
        target: h.targetWeight,
        drift,
        trade: -trade,
        action: (Math.abs(drift) < 0.4 ? "hold" : drift > 0 ? "sell" : "buy") as "buy" | "sell" | "hold",
      };
    })
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

  /* ── income ─────────────────────────────────────────────────────────────── */
  const byMonth: Pt[] = Object.entries(core.dividendsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-24)
    .map(([k, v]) => ({ d: k, v }));
  const bySymbol = holdings
    .map((h) => ({ symbol: h.symbol, name: h.name, amount: core.dividendsBySymbol[h.symbol] ?? 0 }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total12m = bySymbol.reduce((s, r) => s + r.amount, 0);
  const investedValue = holdings.reduce((s, h) => s + h.value, 0);
  const forwardYield = holdings.reduce((s, h) => s + (h.divYield * h.value) / 100, 0);
  const costBasis = holdings.reduce((s, h) => s + h.cost, 0);

  /* ── cash flow ──────────────────────────────────────────────────────────── */
  const cashFlow: Pt[] = dates.map((d, i) => ({ d, v: core.contributions[i] }));

  /* ── concentration ──────────────────────────────────────────────────────── */
  const weights = holdings.map((h) => h.weight / 100);
  const sortedW = [...weights].sort((a, b) => b - a);
  const concentration = {
    top1: (sortedW[0] ?? 0) * 100,
    top5: sortedW.slice(0, 5).reduce((s, x) => s + x, 0) * 100,
    top10: sortedW.slice(0, 10).reduce((s, x) => s + x, 0) * 100,
    hhi: weights.reduce((s, w) => s + w * w, 0) * 10000,
    effN: weights.length ? 1 / weights.reduce((s, w) => s + w * w, 0) : 0,
    maxWeight: (sortedW[0] ?? 0) * 100,
  };

  const weightedCost = holdings.reduce((s, h) => s + (h.expenseRatio * h.value) / (investedValue || 1), 0);

  return {
    bench: { spx: toPt(spx), acwi: toPt(acwi), g6040: toPt(g6040) },
    benchRets: { spx: spxRets, acwi: benchRets(acwi), g6040: benchRets(g6040) },
    horizons,
    monthly,
    annual,
    stats,
    rollingVol,
    rollingSharpe,
    drawdown,
    distribution: dist,
    distStats: {
      mean: mean(rets) * 100,
      median: percentile(rets, 50) * 100,
      p5: percentile(rets, 5) * 100,
      p95: percentile(rets, 95) * 100,
    },
    allocation,
    lookthrough,
    ltSector,
    ltCountry,
    ltCurrency,
    correlation: { symbols: corrSymbols, matrix, portCol },
    overlap: { pairs, max: pairs[0]?.overlap ?? 0 },
    homeBias,
    currencyExposure,
    riskContrib,
    scenarios,
    shape,
    rebalance,
    income: {
      total12m,
      byMonth,
      bySymbol,
      forwardYield: (forwardYield / (investedValue || 1)) * 100,
      yieldOnCost: costBasis > 0 ? (total12m / costBasis) * 100 : 0,
      monthlyAvg: byMonth.length ? total12m / byMonth.length : 0,
    },
    cashFlow,
    fees: core.fees,
    costDrag: weightedCost,
    concentration,
  };
}

export { group };
