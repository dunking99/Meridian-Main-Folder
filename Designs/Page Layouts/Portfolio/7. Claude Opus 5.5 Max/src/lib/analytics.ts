import {
  ACWI_REF, COUNTRIES, DEFAULT_TARGETS, EQUITY_SECTORS, SLEEVES, rateOn, CASH_SPREAD, type Region, type Sleeve,
} from "./reference";
import {
  annualize, benchReturn, bsearchLE, daysBetween, periodIndex, pxDisp, shiftDate, symbolPnl, twr,
  type BenchKey, type Core, type EventItem, type Horizon, type NewsItem, type Note,
} from "./engine";

// ————————————————————————————————— stats
export const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
export function std(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
export function cov(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
  return s / (n - 1);
}
export function corr(a: number[], b: number[]) {
  const d = std(a) * std(b);
  return d ? cov(a, b) / d : 0;
}
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function grade(score: number) {
  if (score >= 93) return "A";
  if (score >= 85) return "A−";
  if (score >= 78) return "B+";
  if (score >= 70) return "B";
  if (score >= 62) return "B−";
  if (score >= 55) return "C+";
  if (score >= 48) return "C";
  if (score >= 40) return "C−";
  if (score >= 30) return "D";
  return "F";
}

// ————————————————————————————————— returns & performance metrics
export function monthlyReturns(ret: number[], dates: string[]) {
  const out: { m: string; r: number }[] = [];
  let cur = "", acc = 1;
  for (let k = 0; k < ret.length; k++) {
    const m = dates[k].slice(0, 7);
    if (m !== cur) {
      if (cur) out.push({ m: cur, r: acc - 1 });
      cur = m; acc = 1;
    }
    acc *= 1 + ret[k];
  }
  if (cur) out.push({ m: cur, r: acc - 1 });
  return out;
}

export type Metrics = {
  cum: number; ann: number; vol: number; sharpe: number; sortino: number; maxDD: number; calmar: number; ulcer: number;
  var95: number; cvar95: number; bestDay: number; worstDay: number; bestMonth: number; worstMonth: number; posMonths: number;
  skew: number; kurt: number; beta: number; alpha: number; corr: number; r2: number; te: number; ir: number;
  upCapture: number; downCapture: number; winRate: number;
};
function seriesMetrics(r: number[], rf: number[], dates: string[], b: number[] | null): Metrics {
  const days = Math.max(1, daysBetween(dates[0], dates[dates.length - 1]));
  let idx = 1;
  for (const v of r) idx *= 1 + v;
  const cum = idx - 1;
  const ann = annualize(cum, days);
  const vol = std(r) * Math.sqrt(252);
  const rfAnn = mean(rf) * 252;
  const downside = Math.sqrt(mean(r.map((v, i) => Math.min(0, v - rf[i]) ** 2))) * Math.sqrt(252);
  let peak = 1, cur = 1, maxDD = 0, u = 0;
  for (const v of r) {
    cur *= 1 + v;
    peak = Math.max(peak, cur);
    const dd = cur / peak - 1;
    maxDD = Math.min(maxDD, dd);
    u += dd * dd;
  }
  const sorted = [...r].sort((a, c) => a - c);
  const tail = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.05)));
  const m = mean(r), s = std(r);
  const skew = s ? mean(r.map((v) => ((v - m) / s) ** 3)) : 0;
  const kurt = s ? mean(r.map((v) => ((v - m) / s) ** 4)) - 3 : 0;
  const mr = monthlyReturns(r, dates).map((x) => x.r);
  const out: Metrics = {
    cum, ann, vol, sharpe: vol ? (ann - rfAnn) / vol : 0, sortino: downside ? (ann - rfAnn) / downside : 0, maxDD,
    calmar: maxDD ? ann / -maxDD : 0, ulcer: Math.sqrt(u / Math.max(1, r.length)), var95: -quantile(sorted, 0.05), cvar95: -mean(tail),
    bestDay: sorted[sorted.length - 1] ?? 0, worstDay: sorted[0] ?? 0, bestMonth: Math.max(...mr), worstMonth: Math.min(...mr),
    posMonths: mr.filter((x) => x > 0).length / Math.max(1, mr.length), skew, kurt,
    beta: 1, alpha: 0, corr: 1, r2: 1, te: 0, ir: 0, upCapture: 1, downCapture: 1, winRate: 0.5,
  };
  if (b) {
    const vb = std(b) ** 2;
    out.beta = vb ? cov(r, b) / vb : 0;
    let bi = 1;
    for (const v of b) bi *= 1 + v;
    const annB = annualize(bi - 1, days);
    out.alpha = ann - rfAnn - out.beta * (annB - rfAnn);
    out.corr = corr(r, b);
    out.r2 = out.corr ** 2;
    out.te = std(r.map((v, i) => v - b[i])) * Math.sqrt(252);
    out.ir = out.te ? (ann - annB) / out.te : 0;
    const mb = monthlyReturns(b, dates).map((x) => x.r);
    const up = mb.map((v, i) => [mr[i], v]).filter(([, v]) => v > 0);
    const dn = mb.map((v, i) => [mr[i], v]).filter(([, v]) => v < 0);
    out.upCapture = up.length ? mean(up.map((x) => x[0])) / mean(up.map((x) => x[1])) : 1;
    out.downCapture = dn.length ? mean(dn.map((x) => x[0])) / mean(dn.map((x) => x[1])) : 1;
    out.winRate = mr.filter((v, i) => v > mb[i]).length / Math.max(1, mr.length);
  }
  return out;
}
export function performanceMetrics(core: Core, bench: BenchKey, h: Horizon = "ITD") {
  const k0 = periodIndex(core, h);
  const r = core.ret.slice(k0 + 1);
  const b = core.bench[bench].ret.slice(k0 + 1);
  const rf = core.rf.slice(k0 + 1);
  const dates = core.dates.slice(k0 + 1);
  return { p: seriesMetrics(r, rf, dates, b), b: seriesMetrics(b, rf, dates, null) };
}

export function monthlyGrid(core: Core, bench: BenchKey) {
  const p = monthlyReturns(core.ret, core.dates);
  const bm = new Map(monthlyReturns(core.bench[bench].ret, core.dates).map((x) => [x.m, x.r]));
  const years = [...new Set(p.map((x) => x.m.slice(0, 4)))].sort().reverse();
  const rows = years.map((y) => {
    const months: (number | null)[] = Array(12).fill(null);
    const bms: (number | null)[] = Array(12).fill(null);
    let acc = 1, accB = 1;
    for (const x of p) if (x.m.startsWith(y)) {
      const mi = Number(x.m.slice(5, 7)) - 1;
      months[mi] = x.r; acc *= 1 + x.r;
      const bv = bm.get(x.m) ?? 0;
      bms[mi] = bv; accB *= 1 + bv;
    }
    return { year: y, months, bench: bms, total: acc - 1, benchTotal: accB - 1 };
  });
  const all = p.map((x) => x.r);
  const seasonality = Array.from({ length: 12 }, (_, i) => {
    const xs = p.filter((x) => Number(x.m.slice(5, 7)) - 1 === i).map((x) => x.r);
    return { avg: mean(xs), hit: xs.filter((v) => v > 0).length / Math.max(1, xs.length) };
  });
  return { rows, monthly: p, all, seasonality };
}

export function drawdowns(core: Core) {
  const { index, dates } = core;
  const dd: number[] = [];
  type Ep = { start: string; trough: string; end: string | null; depth: number; troughI: number; startI: number };
  const eps: Ep[] = [];
  let peak = index[0], peakI = 0;
  let cur: Ep | null = null;
  for (let k = 0; k < index.length; k++) {
    if (index[k] >= peak) {
      if (cur) { cur.end = dates[k]; eps.push(cur); cur = null; }
      peak = index[k]; peakI = k; dd.push(0);
    } else {
      const d = index[k] / peak - 1;
      dd.push(d);
      if (!cur) cur = { start: dates[peakI], startI: peakI, trough: dates[k], troughI: k, end: null, depth: d };
      if (d < cur.depth) { cur.depth = d; cur.trough = dates[k]; cur.troughI = k; }
    }
  }
  if (cur) eps.push(cur);
  const top = [...eps].sort((a, b) => a.depth - b.depth).slice(0, 5).map((e) => ({
    ...e, fallDays: daysBetween(e.start, e.trough), recoveryDays: e.end ? daysBetween(e.trough, e.end) : null,
  }));
  const bIdx = core.bench.ACWI.index;
  let bp = bIdx[0];
  const bdd = bIdx.map((v) => { bp = Math.max(bp, v); return v / bp - 1; });
  const r5 = (a: number[]) => a.map((v) => Math.round(v * 1e5) / 1e5);
  return { dd: r5(dd), bdd: r5(bdd), episodes: top, current: dd[dd.length - 1], daysSincePeak: daysBetween(dates[peakI], dates[dates.length - 1]) };
}

export function rolling(core: Core, bench: BenchKey, win = 252) {
  const out = { dates: [] as string[], ret: [] as number[], vol: [] as number[], sharpe: [] as number[], bret: [] as number[], bvol: [] as number[] };
  const b = core.bench[bench];
  for (let k = win; k < core.index.length; k += 3) {
    const w = core.ret.slice(k - win + 1, k + 1);
    const wb = b.ret.slice(k - win + 1, k + 1);
    const r = core.index[k] / core.index[k - win] - 1;
    const v = std(w) * Math.sqrt(252);
    const rfA = mean(core.rf.slice(k - win + 1, k + 1)) * 252;
    out.dates.push(core.dates[k]);
    const q = (x: number) => Math.round(x * 1000) / 1000;
    out.ret.push(q(r * 100));
    out.vol.push(q(v * 100));
    out.sharpe.push(q(v ? (r - rfA) / v : 0));
    out.bret.push(q((b.index[k] / b.index[k - win] - 1) * 100));
    out.bvol.push(q(std(wb) * Math.sqrt(252) * 100));
  }
  return out;
}

export function histogram(values: number[], step: number) {
  if (!values.length) return [];
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  const bins: { x0: number; x1: number; n: number }[] = [];
  for (let x = lo; x < hi - 1e-12; x += step) bins.push({ x0: x, x1: x + step, n: 0 });
  for (const v of values) {
    const i = Math.min(bins.length - 1, Math.max(0, Math.floor((v - lo) / step)));
    bins[i].n++;
  }
  return bins;
}

// ————————————————————————————————— attribution
export function contributions(core: Core, h: Horizon) {
  const n = core.dates.length;
  const k0 = h === "1D" ? n - 2 : periodIndex(core, h);
  const k1 = n - 1;
  const base = h === "ITD" ? Math.max(1, core.invested[k1]) : core.value[k0];
  const rows = Object.keys(core.qtyHist)
    .map((sym) => {
      const pnl = h === "ITD" ? itdPnl(core, sym) : symbolPnl(core, sym, k0, k1);
      const inst = core.market.bySym[sym];
      return { symbol: sym, name: inst?.name ?? sym, color: inst?.meta.color ?? "#999", sector: inst?.sector ?? "", pnl, contrib: pnl / base, held: core.positions.some((p) => p.symbol === sym) };
    })
    .filter((r) => Math.abs(r.pnl) > 0.5)
    .sort((a, b) => b.pnl - a.pnl);
  let flows = 0;
  for (let k = k0 + 1; k <= k1; k++) flows += core.flows[k];
  const total = h === "ITD" ? core.totals.totalGain : core.value[k1] - core.value[k0] - flows;
  const residual = total - rows.reduce((s, r) => s + r.pnl, 0);
  return { rows, total, residual, base };
}
function itdPnl(core: Core, sym: string) {
  const p = core.positions.find((x) => x.symbol === sym);
  if (p) return p.totalReturn;
  const c = core.closed.find((x) => x.symbol === sym);
  return c ? c.realized + c.dividends : 0;
}

export function valueBridge(core: Core, h: Horizon) {
  const n = core.dates.length;
  const k0 = h === "ITD" ? -1 : periodIndex(core, h);
  const start = k0 < 0 ? 0 : core.value[k0];
  const end = core.value[n - 1];
  let dep = 0, wd = 0, div = 0, int = 0, fees = 0;
  for (const t of core.txns) {
    if (t.k <= k0) continue;
    if (t.type === "DEPOSIT") dep += t.amountDisp;
    else if (t.type === "WITHDRAWAL") wd += t.amountDisp;
    else if (t.type === "DIVIDEND") div += t.amountDisp;
    else if (t.type === "INTEREST") int += t.amountDisp;
    if (t.fee) fees += t.fee / core.fxD[core.start + t.k];
  }
  const market = end - start - dep - wd - div - int + fees;
  return { start, end, steps: [
    { label: "Start", value: start, kind: "total" as const },
    { label: "Deposits", value: dep, kind: "delta" as const },
    { label: "Withdrawals", value: wd, kind: "delta" as const },
    { label: "Market", value: market, kind: "delta" as const },
    { label: "Dividends", value: div, kind: "delta" as const },
    { label: "Interest", value: int, kind: "delta" as const },
    { label: "Fees", value: -fees, kind: "delta" as const },
    { label: "End", value: end, kind: "total" as const },
  ] };
}

export function leadersLaggards(core: Core) {
  const periods: Horizon[] = ["1D", "1M", "YTD", "1Y"];
  return periods.map((h) => {
    const c = contributions(core, h);
    const rows = c.rows;
    return { h, leaders: rows.filter((r) => r.pnl > 0).slice(0, 5), laggards: rows.filter((r) => r.pnl < 0).slice(-5).reverse(), total: c.total };
  });
}

// ————————————————————————————————— exposures (look-through)
export type Exposures = ReturnType<typeof exposures>;
export function exposures(core: Core) {
  const total = core.totals.value;
  const cashW = core.totals.cash / total;
  const sleeves = Object.fromEntries(SLEEVES.map((s) => [s, 0])) as Record<Sleeve, number>;
  sleeves.Cash = cashW;
  const sectorsEq: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const countriesEq: Record<string, number> = {};
  const ccyListing: Record<string, number> = { USD: cashW };
  const ccyEconomic: Record<string, number> = { USD: cashW };
  const style: Record<string, number> = {};
  const issuers: Record<string, { name: string; direct: number; via: Record<string, number> }> = {};
  const accounts: Record<string, number> = { brokerage: cashW };
  let eqW = 0, yieldW = 0, peW = 0, peBase = 0, betaW = 0, terW = 0, growthW = 0;
  for (const p of core.positions) {
    const w = p.weight;
    const m = p.inst.meta;
    sleeves[p.sleeve] += w;
    accounts[m.account] = (accounts[m.account] ?? 0) + w;
    yieldW += w * m.divYield;
    betaW += w * m.beta;
    terW += w * m.ter;
    const isEq = p.inst.assetClass === "Equity" || p.inst.assetClass === "Real Estate";
    const ctry = m.countries ?? { [p.inst.country]: 1 };
    for (const [c, x] of Object.entries(ctry)) countries[c] = (countries[c] ?? 0) + w * x;
    ccyListing[p.inst.currency] = (ccyListing[p.inst.currency] ?? 0) + w;
    if (isEq) {
      eqW += w;
      if (m.pe) { peW += w / m.pe; peBase += w; }
      const secs = m.sectors ?? (EQUITY_SECTORS.includes(p.inst.sector) ? { [p.inst.sector]: 1 } : {});
      for (const [s, x] of Object.entries(secs)) sectorsEq[s] = (sectorsEq[s] ?? 0) + w * x;
      for (const [c, x] of Object.entries(m.style)) {
        style[c] = (style[c] ?? 0) + w * x;
        if (c.endsWith("G")) growthW += w * x;
      }
      for (const [c, x] of Object.entries(ctry)) {
        countriesEq[c] = (countriesEq[c] ?? 0) + w * x;
        const cur = COUNTRIES[c]?.ccy ?? "Other";
        ccyEconomic[cur] = (ccyEconomic[cur] ?? 0) + w * x;
      }
    } else ccyEconomic.USD += w;
    if (m.top) for (const [key, name, pct] of m.top) {
      issuers[key] ??= { name, direct: 0, via: {} };
      issuers[key].via[p.symbol] = (issuers[key].via[p.symbol] ?? 0) + (w * pct) / 100;
    }
    if (p.inst.kind === "stock") {
      issuers[p.symbol] ??= { name: p.inst.name, direct: 0, via: {} };
      issuers[p.symbol].direct += w;
      issuers[p.symbol].name = p.inst.name;
    }
  }
  const norm = (o: Record<string, number>, d: number) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, d ? v / d : 0]));
  const sectorN = norm(sectorsEq, eqW);
  const countryEqN = norm(countriesEq, eqW);
  const styleN = norm(style, eqW);
  const regions: Record<Region, number> = { "North America": 0, Europe: 0, "Asia Pacific": 0, Emerging: 0, Global: 0 };
  for (const [c, v] of Object.entries(countryEqN)) regions[COUNTRIES[c]?.region ?? "Global"] += v;
  const acwiRegions: Record<Region, number> = { "North America": 0, Europe: 0, "Asia Pacific": 0, Emerging: 0, Global: 0 };
  for (const [c, v] of Object.entries(ACWI_REF.countries)) acwiRegions[COUNTRIES[c]?.region ?? "Global"] += v;
  const issuerList = Object.entries(issuers)
    .map(([key, v]) => ({ key, name: v.name, direct: v.direct, via: v.via, total: v.direct + Object.values(v.via).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  return {
    sleeves, sectorN, sectorsEq, countries, countryEqN, regions, acwiRegions, styleN, ccyListing, ccyEconomic, issuers: issuerList, accounts,
    equityW: eqW, yieldP: yieldW, pe: peW ? peBase / peW : 0, beta: betaW, ter: terW, growth: eqW ? growthW / eqW : 0,
    homeUS: countryEqN.US ?? 0, homeBias: (countryEqN.US ?? 0) - ACWI_REF.countries.US,
  };
}

export function issuerExposure(exp: Exposures, key: string) {
  const it = exp.issuers.find((i) => i.key === key);
  return it ? it.total : 0;
}

export function fundOverlap(core: Core) {
  const funds = core.positions.filter((p) => p.inst.kind === "etf" && p.inst.assetClass === "Equity" && p.inst.meta.top);
  const map = (sym: string) => new Map((core.market.bySym[sym].meta.top ?? []).map(([k, , w]) => [k, w]));
  const matrix = funds.map((a) => funds.map((b) => {
    if (a.symbol === b.symbol) return 100;
    const ma = map(a.symbol), mb = map(b.symbol);
    let s = 0;
    for (const [k, w] of ma) if (mb.has(k)) s += Math.min(w, mb.get(k)!);
    return s;
  }));
  const direct = core.positions.filter((p) => p.inst.kind === "stock").map((p) => ({
    symbol: p.symbol, name: p.inst.name, weight: p.weight,
    inFunds: funds.map((f) => ({ fund: f.symbol, pct: map(f.symbol).get(p.symbol) ?? 0 })).filter((x) => x.pct > 0),
  })).filter((x) => x.inFunds.length);
  return { funds: funds.map((f) => ({ symbol: f.symbol, name: f.inst.name, weight: f.weight })), matrix, direct };
}

// ————————————————————————————————— risk model
export type RiskModel = ReturnType<typeof riskModel>;
export function riskModel(core: Core, years = 1) {
  const md = core.market.dates;
  const iEnd = md.length - 1;
  const iStart = Math.max(1, bsearchLE(md, shiftDate(core.asOf, { years: -years })) + 1);
  const pos = core.positions;
  const R = pos.map((p) => {
    const a: number[] = [];
    for (let i = iStart; i <= iEnd; i++) a.push(pxDisp(core, p.symbol, i) / pxDisp(core, p.symbol, i - 1) - 1);
    return a;
  });
  const B: number[] = [];
  for (let i = iStart; i <= iEnd; i++) B.push(pxDisp(core, "SPX", i) / pxDisp(core, "SPX", i - 1) - 1);
  const w = pos.map((p) => p.weight);
  const C = R.map((a) => R.map((b) => cov(a, b)));
  const Cw = C.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
  const varP = w.reduce((s, wi, i) => s + wi * Cw[i], 0);
  const volP = Math.sqrt(varP * 252);
  const vols = C.map((row, i) => Math.sqrt(row[i] * 252));
  const vb = std(B) ** 2;
  const holdings = pos.map((p, i) => ({
    symbol: p.symbol, name: p.inst.name, sector: p.inst.sector, color: p.inst.meta.color, weight: w[i], vol: vols[i],
    ret: pxDisp(core, p.symbol, iEnd) / pxDisp(core, p.symbol, iStart - 1) - 1,
    beta: vb ? cov(R[i], B) / vb : 0, rc: varP > 0 ? (w[i] * Cw[i]) / varP : 0,
    corrP: varP > 0 && C[i][i] > 0 ? Cw[i] / Math.sqrt(C[i][i] * varP) : 0,
  }));
  const corrM = C.map((row, a) => row.map((v, b) => (C[a][a] > 0 && C[b][b] > 0 ? v / Math.sqrt(C[a][a] * C[b][b]) : 0)));
  let cs = 0, cw = 0;
  for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) { cs += w[a] * w[b] * corrM[a][b]; cw += w[a] * w[b]; }
  const pairs: { a: string; b: string; c: number }[] = [];
  for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) pairs.push({ a: pos[a].symbol, b: pos[b].symbol, c: corrM[a][b] });
  pairs.sort((x, y) => y.c - x.c);
  const bench = B;
  const n = core.ret.length;
  const pr = core.ret.slice(Math.max(1, n - (iEnd - iStart + 1)));
  const benchSlice = bench.slice(bench.length - pr.length);
  return {
    symbols: pos.map((p) => p.symbol), weights: w, vols, volP, varP, corr: corrM, holdings,
    divRatio: volP ? w.reduce((s, wi, i) => s + wi * vols[i], 0) / volP : 1, avgCorr: cw ? cs / cw : 0,
    top: pairs.slice(0, 3), bottom: pairs.slice(-3).reverse(),
    realizedVol: std(pr) * Math.sqrt(252), betaP: vb ? cov(pr, benchSlice) / vb : 1,
    var95: 1.645 * Math.sqrt(varP) * core.totals.value,
  };
}

// ————————————————————————————————— scenarios
type Shock = Record<string, number>;
const SCEN: { key: string; name: string; period: string; kind: "historical" | "hypothetical"; shocks?: Shock; intl?: number; special?: string }[] = [
  { key: "gfc", name: "Global Financial Crisis", period: "Oct 2007 – Mar 2009", kind: "historical", intl: 1.08, shocks: { Technology: -0.5, Financials: -0.78, "Consumer Disc.": -0.55, "Health Care": -0.36, Staples: -0.28, Energy: -0.5, Utilities: -0.42, Communication: -0.45, Industrials: -0.6, Materials: -0.55, "Real Estate": -0.7, "Fixed Income": 0.06, Commodities: 0.25, Crypto: -0.75 } },
  { key: "dotcom", name: "Dot-com bust", period: "Mar 2000 – Oct 2002", kind: "historical", intl: 1.0, shocks: { Technology: -0.78, Financials: -0.2, "Consumer Disc.": -0.35, "Health Care": -0.25, Staples: 0.05, Energy: -0.1, Utilities: -0.25, Communication: -0.7, Industrials: -0.3, Materials: -0.15, "Real Estate": 0.2, "Fixed Income": 0.25, Commodities: 0.12, Crypto: -0.8 } },
  { key: "covid", name: "COVID crash", period: "Feb – Mar 2020", kind: "historical", intl: 1.0, shocks: { Technology: -0.28, Financials: -0.4, "Consumer Disc.": -0.32, "Health Care": -0.25, Staples: -0.22, Energy: -0.55, Utilities: -0.3, Communication: -0.28, Industrials: -0.4, Materials: -0.35, "Real Estate": -0.4, "Fixed Income": 0.01, Commodities: -0.03, Crypto: -0.5 } },
  { key: "rates22", name: "2022 rate shock", period: "Jan – Oct 2022", kind: "historical", intl: 1.05, shocks: { Technology: -0.35, Financials: -0.2, "Consumer Disc.": -0.38, "Health Care": -0.1, Staples: -0.1, Energy: 0.45, Utilities: -0.08, Communication: -0.42, Industrials: -0.2, Materials: -0.2, "Real Estate": -0.32, "Fixed Income": -0.16, Commodities: -0.1, Crypto: -0.65 } },
  { key: "tariff25", name: "2025 tariff shock", period: "Feb – Apr 2025", kind: "historical", intl: 0.8, shocks: { Technology: -0.26, Financials: -0.15, "Consumer Disc.": -0.24, "Health Care": -0.08, Staples: -0.02, Energy: -0.18, Utilities: -0.05, Communication: -0.18, Industrials: -0.15, Materials: -0.14, "Real Estate": -0.1, "Fixed Income": 0.01, Commodities: 0.08, Crypto: -0.28 } },
  { key: "eq20", name: "Equities fall 20%", period: "Beta-scaled shock", kind: "hypothetical", special: "beta" },
  { key: "rates100", name: "Rates +100bp", period: "Parallel yield shift", kind: "hypothetical", shocks: { Technology: -0.04, Financials: 0.01, "Consumer Disc.": -0.03, "Health Care": -0.02, Staples: -0.02, Energy: 0, Utilities: -0.06, Communication: -0.03, Industrials: -0.02, Materials: -0.02, "Real Estate": -0.08, "Fixed Income": -0.06, Commodities: -0.03, Crypto: -0.08 } },
  { key: "usd10", name: "US dollar +10%", period: "Broad USD rally", kind: "hypothetical", special: "usd" },
  { key: "oil30", name: "Oil spikes 30%", period: "Supply shock", kind: "hypothetical", shocks: { Technology: -0.02, Financials: -0.01, "Consumer Disc.": -0.04, "Health Care": -0.01, Staples: -0.02, Energy: 0.15, Utilities: -0.01, Communication: -0.02, Industrials: -0.03, Materials: 0.02, "Real Estate": -0.02, "Fixed Income": -0.01, Commodities: 0.06, Crypto: -0.03 } },
  { key: "ai", name: "AI trade unwinds", period: "Crowded-theme reversal", kind: "hypothetical", special: "ai" },
];
const AI_SHOCK: Record<string, number> = { NVDA: -0.42, TSM: -0.32, ASML: -0.3, MSFT: -0.2, GOOGL: -0.22, AMZN: -0.18, META: -0.26, AAPL: -0.12, QQQ: -0.22, VOO: -0.11, VXUS: -0.05, NEE: -0.08 };

export function stressTests(core: Core, exp: Exposures) {
  const total = core.totals.value;
  return SCEN.map((s) => {
    const parts = core.positions.map((p) => {
      const m = p.inst.meta;
      let shock = 0;
      if (s.special === "beta") shock = p.inst.assetClass === "Fixed Income" ? 0.02 : p.inst.assetClass === "Commodities" ? 0.03 : p.inst.assetClass === "Crypto" ? -0.35 : -0.2 * m.beta;
      else if (s.special === "ai") shock = AI_SHOCK[p.symbol] ?? (p.inst.assetClass === "Equity" ? -0.03 : 0);
      else if (s.special === "usd") {
        const usdShare = p.inst.assetClass === "Equity" || p.inst.assetClass === "Real Estate"
          ? Object.entries(m.countries ?? { [p.inst.country]: 1 }).reduce((a, [c, x]) => a + (COUNTRIES[c]?.ccy === "USD" ? x : 0), 0)
          : 1;
        shock = core.ccy === "USD" ? -(1 - 1 / 1.1) * (1 - usdShare) : 0.1 * usdShare;
      } else if (s.shocks) {
        const secs = m.sectors ?? (EQUITY_SECTORS.includes(p.inst.sector) ? { [p.inst.sector]: 1 } : { [p.inst.sector]: 1 });
        for (const [sec, x] of Object.entries(secs)) shock += x * (s.shocks[sec] ?? 0);
        const intlShare = p.inst.assetClass === "Equity" ? 1 - (m.countries?.US ?? (p.inst.country === "US" ? 1 : 0)) : 0;
        shock *= 1 + intlShare * ((s.intl ?? 1) - 1);
      }
      return { symbol: p.symbol, impact: p.weight * shock, money: p.value * shock };
    });
    if (s.special === "usd" && core.ccy !== "USD") parts.push({ symbol: "Cash", impact: 0.1 * exp.sleeves.Cash, money: 0.1 * core.totals.cash });
    const impact = parts.reduce((a, x) => a + x.impact, 0);
    return { ...s, impact, money: impact * total, worst: [...parts].sort((a, b) => a.money - b.money).slice(0, 3) };
  });
}

// ————————————————————————————————— projection (Monte Carlo)
export function projection(core: Core, exp: Exposures, risk: RiskModel) {
  const mu: Record<Sleeve, number> = { "US Equity": 0.065, "Intl Equity": 0.07, "Fixed Income": 0.042, "Real Estate": 0.06, Commodities: 0.03, Crypto: 0.08, Cash: 0.03 };
  const muP = SLEEVES.reduce((a, s) => a + exp.sleeves[s] * mu[s], 0);
  const sigma = Math.max(0.08, Math.min(0.22, risk.volP));
  const n = core.flows.length;
  let flow12 = 0;
  const k12 = Math.max(0, bsearchLE(core.dates, shiftDate(core.asOf, { years: -1 })));
  for (let k = k12 + 1; k < n; k++) flow12 += core.flows[k];
  const monthly = Math.max(0, flow12 / 12);
  const years = 20, paths = 700;
  const r = rng(20260923);
  const gauss = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const byYear: number[][] = Array.from({ length: years + 1 }, () => []);
  const v0 = core.totals.value;
  const drift = (muP - (sigma * sigma) / 2) / 12;
  const sm = sigma / Math.sqrt(12);
  for (let p = 0; p < paths; p++) {
    let v = v0;
    byYear[0].push(v);
    for (let m = 1; m <= years * 12; m++) {
      v = v * Math.exp(drift + sm * gauss()) + monthly;
      if (m % 12 === 0) byYear[m / 12].push(v);
    }
  }
  const bands = byYear.map((vals) => {
    const s = vals.sort((a, b) => a - b);
    return { p10: quantile(s, 0.1), p25: quantile(s, 0.25), p50: quantile(s, 0.5), p75: quantile(s, 0.75), p90: quantile(s, 0.9) };
  });
  const goals = [2_000_000, 3_000_000, 5_000_000].map((g) => ({ goal: g, prob: byYear[years].filter((v) => v >= g).length / paths }));
  let contributed = v0;
  for (let y = 1; y <= years; y++) contributed += monthly * 12;
  return { bands, muP, sigma, monthly, goals, contributed, startYear: Number(core.asOf.slice(0, 4)) };
}

// ————————————————————————————————— concentration, drift, costs
export function concentration(core: Core) {
  const ws = core.positions.map((p) => p.weight).sort((a, b) => b - a);
  const inv = ws.reduce((a, b) => a + b, 0);
  const norm = ws.map((w) => w / inv);
  const hhi = norm.reduce((a, w) => a + w * w, 0);
  let acc = 0;
  const lorenz = [{ x: 0, y: 0 }, ...norm.map((w, i) => { acc += w; return { x: (i + 1) / norm.length, y: acc }; })];
  return { hhi, effN: hhi ? 1 / hhi : 0, top5: norm.slice(0, 5).reduce((a, b) => a + b, 0), top10: norm.slice(0, 10).reduce((a, b) => a + b, 0), lorenz, count: ws.length };
}

export function drift(core: Core, exp: Exposures, targets: Record<Sleeve, number> = DEFAULT_TARGETS) {
  const vehicle: Record<Sleeve, string> = { "US Equity": "VOO", "Intl Equity": "VXUS", "Fixed Income": "BND", "Real Estate": "VNQ", Commodities: "GLD", Crypto: "BTC", Cash: "Cash" };
  const rows = SLEEVES.map((s) => {
    const actual = exp.sleeves[s];
    const target = targets[s];
    return { sleeve: s, actual, target, diff: actual - target, trade: (target - actual) * core.totals.value, vehicle: vehicle[s] };
  });
  const total = rows.reduce((a, r) => a + Math.abs(r.diff), 0) / 2;
  return { rows, total };
}

export function costs(core: Core, exp: Exposures) {
  const annualFundFees = core.positions.reduce((a, p) => a + (p.value * p.inst.meta.ter) / 100, 0);
  const since = shiftDate(core.asOf, { years: -1 });
  let tradingFees = 0;
  for (const t of core.txns) if (t.date > since && t.fee) tradingFees += t.fee / core.fxD[core.start + t.k];
  const g = 0.06, ter = exp.ter / 100, v = core.totals.value;
  const drag20 = v * (Math.pow(1 + g, 20) - Math.pow(1 + g - ter, 20));
  const byFund = core.positions.filter((p) => p.inst.meta.ter > 0).map((p) => ({ symbol: p.symbol, ter: p.inst.meta.ter, cost: (p.value * p.inst.meta.ter) / 100 })).sort((a, b) => b.cost - a.cost);
  return { annualFundFees, tradingFees, ter: exp.ter, drag20, byFund };
}

// ————————————————————————————————— scores
export function riskProfile(core: Core, risk: RiskModel) {
  const vol = risk.realizedVol;
  const m3 = performanceMetrics(core, "SPX", "3Y").p;
  const srri = vol < 0.005 ? 1 : vol < 0.02 ? 2 : vol < 0.05 ? 3 : vol < 0.1 ? 4 : vol < 0.15 ? 5 : vol < 0.25 ? 6 : 7;
  const score = Math.round(clamp(50 * Math.min(1, vol / 0.25) + 30 * Math.min(1, -m3.maxDD / 0.4) + 20 * Math.min(1, risk.betaP / 1.5), 0, 100) * 1.25);
  const s = Math.min(100, score);
  const label = s < 20 ? "Conservative" : s < 40 ? "Cautious" : s < 55 ? "Balanced" : s < 70 ? "Growth" : s < 85 ? "Aggressive" : "Speculative";
  return { vol, srri, score: s, label, maxDD3y: m3.maxDD, beta: risk.betaP, var95: risk.var95 };
}

export function healthScore(core: Core, exp: Exposures, risk: RiskModel, dr: ReturnType<typeof drift>) {
  const maxIssuer = exp.issuers[0]?.total ?? 0;
  const maxStock = Math.max(0, ...core.positions.filter((p) => p.inst.kind !== "etf").map((p) => p.weight));
  const cash = exp.sleeves.Cash;
  const parts = [
    { key: "Diversification", score: Math.round(0.5 * clamp(100 - (maxIssuer - 0.04) * 1000) + 0.5 * clamp((1 - risk.avgCorr) * 130)), weight: 0.2, note: `Largest look-through name ${(maxIssuer * 100).toFixed(1)}% · avg ρ ${risk.avgCorr.toFixed(2)}` },
    { key: "Concentration", score: Math.round(clamp(100 - (maxStock - 0.05) * 1250)), weight: 0.15, note: `Largest single stock ${(maxStock * 100).toFixed(1)}%` },
    { key: "Allocation drift", score: Math.round(clamp(100 - dr.total * 400)), weight: 0.2, note: `${(dr.total * 100).toFixed(1)}% of book off target` },
    { key: "Risk fit", score: Math.round(clamp(100 - Math.abs(risk.realizedVol - 0.14) * 600)), weight: 0.2, note: `Vol ${(risk.realizedVol * 100).toFixed(1)}% vs 14% growth profile` },
    { key: "Cost", score: Math.round(clamp(100 - exp.ter * 250)), weight: 0.15, note: `Weighted fee ${exp.ter.toFixed(3)}%` },
    { key: "Cash level", score: Math.round(clamp(100 - Math.abs(cash - 0.04) * 1500)), weight: 0.1, note: `${(cash * 100).toFixed(1)}% cash vs 4% target` },
  ];
  const score = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0));
  const label = score >= 80 ? "Excellent" : score >= 65 ? "Healthy" : score >= 50 ? "Fair" : "Needs attention";
  return { score, label, parts };
}

export function scorecard(core: Core, exp: Exposures, risk: RiskModel, health: ReturnType<typeof healthScore>) {
  const m = performanceMetrics(core, "ACWI", "ITD");
  const excess = m.p.ann - m.b.ann;
  const h = (k: string) => health.parts.find((p) => p.key === k)?.score ?? 50;
  const items = [
    { key: "Returns", score: clamp(55 + excess * 900), detail: `${excess >= 0 ? "+" : ""}${(excess * 100).toFixed(1)}% p.a. vs ACWI` },
    { key: "Risk-adjusted", score: clamp(62 + (m.p.sharpe - m.b.sharpe) * 90), detail: `Sharpe ${m.p.sharpe.toFixed(2)} vs ${m.b.sharpe.toFixed(2)}` },
    { key: "Resilience", score: clamp(62 + (Math.abs(m.b.maxDD) - Math.abs(m.p.maxDD)) * 300), detail: `Max DD ${(m.p.maxDD * 100).toFixed(1)}% vs ${(m.b.maxDD * 100).toFixed(1)}%` },
    { key: "Diversification", score: h("Diversification"), detail: `${risk.divRatio.toFixed(2)}× diversification ratio` },
    { key: "Concentration", score: h("Concentration"), detail: health.parts[1].note },
    { key: "Costs", score: h("Cost"), detail: `${exp.ter.toFixed(3)}% weighted fee` },
    { key: "Income", score: clamp(50 + (exp.yieldP - ACWI_REF.divYield) * 30), detail: `${exp.yieldP.toFixed(2)}% yield vs ${ACWI_REF.divYield}%` },
    { key: "Global balance", score: clamp(100 - Math.abs(exp.homeBias) * 250), detail: `US ${(exp.homeUS * 100).toFixed(0)}% of equity vs ${(ACWI_REF.countries.US * 100).toFixed(0)}%` },
  ].map((x) => ({ ...x, score: Math.round(x.score), grade: grade(x.score) }));
  const overall = Math.round(mean(items.map((i) => i.score)));
  return { items, overall, grade: grade(overall), metrics: m };
}

export function shapeOfBook(core: Core, exp: Exposures, conc: ReturnType<typeof concentration>) {
  const tech = (exp.sectorN.Technology ?? 0) + (exp.sectorN.Communication ?? 0);
  const defensive = exp.sleeves["Fixed Income"] + exp.sleeves.Commodities + exp.sleeves.Cash + exp.equityW * ((exp.sectorN.Staples ?? 0) + (exp.sectorN["Health Care"] ?? 0) + (exp.sectorN.Utilities ?? 0));
  const axes = [
    { label: "Equity", p: exp.equityW, b: 1 },
    { label: "Global", p: 1 - exp.homeUS, b: 1 - ACWI_REF.countries.US },
    { label: "Tech & AI", p: tech, b: ACWI_REF.sectors.Technology + ACWI_REF.sectors.Communication },
    { label: "Growth", p: exp.growth, b: (ACWI_REF.style.LG + ACWI_REF.style.MG + ACWI_REF.style.SG) },
    { label: "Yield", p: exp.yieldP / 4, b: ACWI_REF.divYield / 4 },
    { label: "Beta", p: exp.beta / 1.5, b: 1 / 1.5 },
    { label: "Concentration", p: conc.top10, b: ACWI_REF.top10 },
    { label: "Defensive", p: defensive, b: ACWI_REF.sectors.Staples + ACWI_REF.sectors["Health Care"] + ACWI_REF.sectors.Utilities },
  ];
  return axes.map((a) => ({ ...a, p: Math.max(0.02, Math.min(1, a.p)), b: Math.max(0.02, Math.min(1, a.b)) }));
}

// ————————————————————————————————— income
export function incomeModel(core: Core) {
  const asOf = core.asOf;
  const months: string[] = [];
  for (let i = 1; i <= 12; i++) months.push(shiftDate(`${asOf.slice(0, 7)}-01`, { months: i }).slice(0, 7));
  const projected: Record<string, { symbol: string; amount: number }[]> = Object.fromEntries(months.map((m) => [m, []]));
  const bySymbol = core.positions
    .filter((p) => p.inst.meta.divYield > 0 && p.inst.meta.divFreq > 0)
    .map((p) => {
      const m = p.inst.meta;
      const annual = (p.value * m.divYield) / 100;
      for (let y = Number(asOf.slice(0, 4)); y <= Number(asOf.slice(0, 4)) + 1; y++)
        for (const mo of m.divMonths) {
          const ex = `${y}-${String(mo).padStart(2, "0")}-${String(Math.min(m.exDay, 28)).padStart(2, "0")}`;
          const pay = shiftDate(ex, { days: m.divFreq === 12 ? 6 : 21 }).slice(0, 7);
          if (projected[pay] && ex > asOf) projected[pay].push({ symbol: p.symbol, amount: annual / m.divFreq });
        }
      return { symbol: p.symbol, name: p.inst.name, color: p.inst.meta.color, sector: p.inst.sector, annual, yield: m.divYield, yoc: p.cost > 0 ? annual / p.cost : 0, freq: m.divFreq, months: m.divMonths };
    })
    .sort((a, b) => b.annual - a.annual);
  const cashRate = Math.max(0, rateOn(asOf) - CASH_SPREAD) / 100;
  const interestAnnual = core.totals.cash * cashRate;
  const fwdDividends = bySymbol.reduce((a, b) => a + b.annual, 0);
  const history: Record<string, { div: number; int: number }> = {};
  for (const t of core.txns) {
    if (t.type !== "DIVIDEND" && t.type !== "INTEREST") continue;
    const m = t.date.slice(0, 7);
    history[m] ??= { div: 0, int: 0 };
    if (t.type === "DIVIDEND") history[m].div += t.amountDisp;
    else history[m].int += t.amountDisp;
  }
  const histMonths: string[] = [];
  for (let i = 23; i >= 0; i--) histMonths.push(shiftDate(`${asOf.slice(0, 7)}-01`, { months: -i }).slice(0, 7));
  const yearly: Record<string, number> = {};
  for (const [m, v] of Object.entries(history)) yearly[m.slice(0, 4)] = (yearly[m.slice(0, 4)] ?? 0) + v.div + v.int;
  const since = shiftDate(asOf, { years: -1 });
  let ttm = 0;
  const ttmBySym: Record<string, number> = {};
  for (const t of core.txns) if ((t.type === "DIVIDEND" || t.type === "INTEREST") && t.date > since) {
    ttm += t.amountDisp;
    const key = t.symbol ?? "Cash interest";
    ttmBySym[key] = (ttmBySym[key] ?? 0) + t.amountDisp;
  }
  return {
    months, projected, bySymbol, fwdDividends, interestAnnual, fwdTotal: fwdDividends + interestAnnual, cashRate,
    yield: (fwdDividends + interestAnnual) / core.totals.value, yoc: core.totals.costBasis ? fwdDividends / core.totals.costBasis : 0,
    history: histMonths.map((m) => ({ m, div: history[m]?.div ?? 0, int: history[m]?.int ?? 0 })), yearly, ttm, ttmBySym,
  };
}

// ————————————————————————————————— events, news, insights
export function upcomingEvents(core: Core, events: EventItem[], notes: Note[], days = 45) {
  const held = new Map(core.positions.map((p) => [p.symbol, p]));
  const until = shiftDate(core.asOf, { days });
  const list = events
    .filter((e) => e.date > core.asOf && e.date <= until && (!e.symbol || held.has(e.symbol)))
    .map((e) => {
      const p = e.symbol ? held.get(e.symbol) : undefined;
      const amount = p && (e.type === "dividend" || e.type === "ex_div") && p.inst.meta.divFreq ? (p.value * p.inst.meta.divYield) / 100 / p.inst.meta.divFreq : null;
      return { ...e, weight: p?.weight ?? null, amount, color: p?.inst.meta.color ?? null, days: daysBetween(core.asOf, e.date) };
    });
  for (const n of notes) if (n.reviewDate && n.reviewDate > core.asOf && n.reviewDate <= until && held.has(n.symbol)) {
    const p = held.get(n.symbol)!;
    list.push({ id: -1, date: n.reviewDate, symbol: n.symbol, type: "review", title: "Thesis review", detail: `Conviction ${n.conviction}/5 · target ${n.targetPrice ?? "—"}`, importance: 3, weight: p.weight, amount: null, color: p.inst.meta.color, days: daysBetween(core.asOf, n.reviewDate) });
  }
  return list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.importance - a.importance));
}

const TOPIC_LABEL: Record<string, string> = { rates: "Rates", usd: "US dollar", fx: "FX", jpy: "Yen", eur: "Euro", gold: "Gold", crypto: "Crypto", ai: "AI complex", china: "China", europe: "Europe", em: "Emerging mkts", healthcare: "Health care", consumer: "Consumer", banks: "Banks", oil: "Oil", "us-equity": "US equities", tariffs: "Tariffs", regulation: "Regulation" };
export function enrichNews(core: Core, news: NewsItem[], exp: Exposures) {
  const eqSector = (s: string) => exp.equityW * (exp.sectorN[s] ?? 0);
  const nonUsd = 1 - (exp.ccyEconomic.USD ?? 0);
  const ai = ["NVDA", "MSFT", "GOOGL", "AMZN", "META", "TSM", "ASML", "AVGO"].reduce((a, k) => a + issuerExposure(exp, k), 0);
  const topicW: Record<string, number> = {
    rates: exp.sleeves["Fixed Income"] + exp.sleeves["Real Estate"] + eqSector("Utilities"), usd: nonUsd, fx: nonUsd,
    jpy: exp.ccyEconomic.JPY ?? 0, eur: exp.ccyEconomic.EUR ?? 0, gold: exp.sleeves.Commodities, crypto: exp.sleeves.Crypto, ai,
    china: (exp.countries.CN ?? 0), europe: exp.equityW * exp.regions.Europe, em: exp.equityW * exp.regions.Emerging,
    healthcare: eqSector("Health Care"), consumer: eqSector("Consumer Disc.") + eqSector("Staples"), banks: eqSector("Financials"),
    oil: eqSector("Energy"), "us-equity": exp.equityW * exp.homeUS, tariffs: eqSector("Technology"), regulation: 0,
  };
  const now = new Date(core.asOf + "T21:00:00Z").getTime();
  return news.map((n) => {
    const syms = n.symbols.map((s) => {
      const it = exp.issuers.find((i) => i.key === s);
      const direct = it?.direct ?? core.positions.find((p) => p.symbol === s)?.weight ?? 0;
      const via = it ? Object.values(it.via).reduce((a, b) => a + b, 0) : 0;
      return { symbol: s, direct: s === "VOO" || s === "BND" || s === "VNQ" || s === "GLD" || s === "BTC" ? core.positions.find((p) => p.symbol === s)?.weight ?? 0 : direct, via };
    });
    const symTotal = syms.reduce((a, s) => a + s.direct + s.via, 0);
    const topics = n.topics.map((t) => ({ topic: t, label: TOPIC_LABEL[t] ?? t, weight: topicW[t] ?? 0 }));
    const exposure = Math.min(1, Math.max(symTotal, ...topics.map((t) => t.weight), 0));
    const hours = Math.max(0, (now - new Date(n.publishedAt.replace(" ", "T") + "Z").getTime()) / 3_600_000);
    const impactW = n.impact === "high" ? 1 : n.impact === "medium" ? 0.6 : 0.35;
    const relevance = Math.min(1, exposure * 4) * impactW * Math.exp(-hours / 120) * (0.6 + Math.abs(n.sentiment));
    return { ...n, syms, topics, exposure, relevance, hours };
  }).sort((a, b) => b.relevance - a.relevance);
}

export type Insight = { tone: "warn" | "good" | "info"; title: string; detail: string; href: string };
export function insights(core: Core, exp: Exposures, risk: RiskModel, dr: ReturnType<typeof drift>, overlap: ReturnType<typeof fundOverlap>): Insight[] {
  const out: Insight[] = [];
  const top = exp.issuers[0];
  if (top && top.total > 0.06) out.push({ tone: "warn", title: `${top.key} is ${(top.total * 100).toFixed(1)}% of your book`, detail: `${(top.direct * 100).toFixed(1)}% direct + ${((top.total - top.direct) * 100).toFixed(1)}% hidden inside your ETFs`, href: "/portfolio/analysis#overlap" });
  const big = [...dr.rows].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
  if (big && Math.abs(big.diff) > 0.03) out.push({ tone: "warn", title: `${big.sleeve} ${big.diff > 0 ? "over" : "under"}weight by ${(Math.abs(big.diff) * 100).toFixed(1)} pts`, detail: `${big.diff > 0 ? "Trim" : "Add"} ≈ ${Math.abs(big.trade / 1000).toFixed(0)}k via ${big.vehicle} to get back on target`, href: "/portfolio/analysis#rebalance" });
  const losers = core.positions.filter((p) => p.unrealizedPct < -0.2).sort((a, b) => a.unrealizedPct - b.unrealizedPct);
  if (losers[0]) out.push({ tone: "info", title: `${losers.map((l) => l.symbol).slice(0, 3).join(", ")} ${losers.length > 1 ? "are" : "is"} down >20% from cost`, detail: "Candidates for a thesis review or tax-loss harvesting", href: `/portfolio/holdings/${losers[0].symbol}` });
  const winners = core.positions.filter((p) => p.unrealizedPct > 2).sort((a, b) => b.unrealizedPct - a.unrealizedPct);
  if (winners[0]) out.push({ tone: "good", title: `${winners[0].symbol} is up ${(winners[0].unrealizedPct * 100).toFixed(0)}% on cost`, detail: `${winners.length} position${winners.length > 1 ? "s have" : " has"} more than tripled — consider rebalancing gains`, href: `/portfolio/holdings/${winners[0].symbol}` });
  const vooQqq = overlap.matrix.length > 1 ? Math.max(...overlap.matrix.flatMap((row, i) => row.filter((_, j) => j !== i))) : 0;
  if (vooQqq > 20) out.push({ tone: "info", title: `Your ETFs overlap by up to ${vooQqq.toFixed(0)}%`, detail: "Top holdings of your US funds are largely the same companies", href: "/portfolio/analysis#overlap" });
  if (exp.homeBias > 0.08) out.push({ tone: "info", title: `Home bias: ${(exp.homeUS * 100).toFixed(0)}% of equity in the US`, detail: `${((exp.homeBias) * 100).toFixed(0)} pts above the global market weight`, href: "/portfolio/analysis#exposure" });
  const topRc = [...risk.holdings].sort((a, b) => b.rc - b.weight - (a.rc - a.weight))[0];
  if (topRc) out.push({ tone: "warn", title: `${topRc.symbol} drives ${(topRc.rc * 100).toFixed(0)}% of portfolio risk`, detail: `on just ${(topRc.weight * 100).toFixed(1)}% of capital`, href: "/portfolio/analysis#risk" });
  const cash = exp.sleeves.Cash;
  out.push({ tone: cash < 0.02 ? "warn" : "good", title: `Cash at ${(cash * 100).toFixed(1)}% of the book`, detail: `Earning ${(Math.max(0, rateOn(core.asOf) - CASH_SPREAD)).toFixed(2)}% in the sweep`, href: "/portfolio/activity" });
  return out;
}

/** Money-weighted return (XIRR) of external cash flows over a horizon, annualised. */
export function moneyWeighted(core: Core, h: Horizon = "ITD") {
  const n = core.dates.length;
  const k0 = h === "ITD" ? -1 : periodIndex(core, h);
  const d0 = k0 < 0 ? core.dates[0] : core.dates[k0];
  const flows: { t: number; v: number }[] = [];
  if (k0 >= 0) flows.push({ t: 0, v: -core.value[k0] });
  for (let k = k0 + 1; k < n; k++) if (core.flows[k]) flows.push({ t: daysBetween(d0, core.dates[k]) / 365.25, v: -core.flows[k] });
  flows.push({ t: daysBetween(d0, core.asOf) / 365.25, v: core.value[n - 1] });
  let r = 0.08;
  for (let it = 0; it < 80; it++) {
    let f = 0, df = 0;
    for (const { t, v } of flows) {
      const d = Math.pow(1 + r, t);
      f += v / d;
      df += (-t * v) / (d * (1 + r));
    }
    if (Math.abs(df) < 1e-12) break;
    const nr = Math.max(-0.95, r - f / df);
    if (!Number.isFinite(nr)) break;
    if (Math.abs(nr - r) < 1e-10) { r = nr; break; }
    r = nr;
  }
  return r;
}

export function trailing(core: Core, bench: BenchKey) {
  const hs: Horizon[] = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "ITD"];
  return hs.map((h) => {
    const k0 = periodIndex(core, h);
    const days = daysBetween(core.dates[k0], core.asOf);
    const p = twr(core, h), b = benchReturn(core, bench, h);
    const ann = days > 366;
    return { h, p: ann ? annualize(p, days) : p, b: ann ? annualize(b, days) : b, ann };
  });
}
