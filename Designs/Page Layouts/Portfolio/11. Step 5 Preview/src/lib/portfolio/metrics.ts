/**
 * Meridian — quantitative primitives
 * Pure functions, no I/O. Everything the portfolio pages report is computed
 * here so the numbers are reproducible and testable.
 */

export interface Series {
  d: string;
  v: number;
}

export const ann = (x: number) => x * Math.sqrt(252);
export const TRADING_DAYS = 252;
export const RISK_FREE = 0.045; // annualised, used for Sharpe / Sortino

export function mean(a: number[]) {
  if (!a.length) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

export function stdev(a: number[]) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export function cov(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(-n));
  const mb = mean(b.slice(-n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[a.length - n + i] - ma) * (b[b.length - n + i] - mb);
  return s / (n - 1);
}

export function corr(a: number[], b: number[]) {
  const sa = stdev(a);
  const sb = stdev(b);
  if (sa === 0 || sb === 0) return 0;
  return cov(a, b) / (sa * sb);
}

export function beta(a: number[], b: number[]) {
  const vb = stdev(b) ** 2;
  if (vb === 0) return 0;
  return cov(a, b) / vb;
}

export function alpha(a: number[], b: number[], rf = RISK_FREE) {
  const n = Math.min(a.length, b.length);
  if (n < 20) return 0;
  const ra = mean(a.slice(-n)) * 252;
  const rb = mean(b.slice(-n)) * 252;
  return ra - (rf + beta(a, b) * (rb - rf));
}

export function sharpe(rets: number[], rf = RISK_FREE) {
  const s = stdev(rets);
  if (s === 0) return 0;
  return (mean(rets) * 252 - rf) / (s * Math.sqrt(252));
}

export function sortino(rets: number[], rf = RISK_FREE) {
  const downside = rets.filter((r) => r < 0);
  const dd = stdev(downside);
  if (!dd) return 0;
  return (mean(rets) * 252 - rf) / (dd * Math.sqrt(252));
}

export interface DrawdownInfo {
  max: number;
  peak: number;
  trough: number;
}

export function drawdownInfo(values: number[]): DrawdownInfo {
  let peak = values[0] ?? 0;
  let peakIdx = 0;
  let max = 0;
  let trough = 0;
  let maxPeakIdx = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > peak) {
      peak = values[i];
      peakIdx = i;
    }
    const dd = peak > 0 ? values[i] / peak - 1 : 0;
    if (dd < max) {
      max = dd;
      trough = i;
      maxPeakIdx = peakIdx;
    }
  }
  return { max, peak: maxPeakIdx, trough };
}

export function maxDrawdown(values: number[]) {
  return drawdownInfo(values).max;
}

export function underwaterSeries(values: number[]): number[] {
  const out: number[] = [];
  let peak = values[0] ?? 0;
  for (const v of values) {
    if (v > peak) peak = v;
    out.push(peak > 0 ? v / peak - 1 : 0);
  }
  return out;
}

export function ulcerIndex(values: number[]) {
  if (values.length < 2) return 0;
  let peak = values[0];
  let s = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (v / peak - 1) * 100 : 0;
    s += dd * dd;
  }
  return Math.sqrt(s / values.length);
}

export function varHist(rets: number[], p = 0.95) {
  if (!rets.length) return 0;
  const sorted = [...rets].sort((a, b) => a - b);
  const idx = Math.floor((1 - p) * sorted.length);
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

export function cvarHist(rets: number[], p = 0.95) {
  if (!rets.length) return 0;
  const sorted = [...rets].sort((a, b) => a - b);
  const idx = Math.max(1, Math.floor((1 - p) * sorted.length));
  return mean(sorted.slice(0, idx));
}

export function skewness(a: number[]) {
  const n = a.length;
  if (n < 3) return 0;
  const m = mean(a);
  const s = stdev(a);
  if (!s) return 0;
  return (n / ((n - 1) * (n - 2))) * a.reduce((acc, x) => acc + ((x - m) / s) ** 3, 0);
}

export function kurtosis(a: number[]) {
  const n = a.length;
  if (n < 4) return 0;
  const m = mean(a);
  const s = stdev(a);
  if (!s) return 0;
  const k = a.reduce((acc, x) => acc + ((x - m) / s) ** 4, 0) / n;
  return k - 3;
}

export function percentile(a: number[], p: number) {
  if (!a.length) return 0;
  const sorted = [...a].sort((x, y) => x - y);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function trailingReturn(values: number[], days: number) {
  if (values.length < 2) return 0;
  const i = Math.max(0, values.length - 1 - days);
  const start = values[i];
  const end = values[values.length - 1];
  if (!start) return 0;
  return end / start - 1;
}

export function ytdReturn(dates: string[], values: number[]) {
  const year = dates[dates.length - 1]?.slice(0, 4);
  if (!year) return 0;
  let i = 0;
  while (i < dates.length && dates[i].slice(0, 4) < year) i++;
  const start = values[Math.max(0, i - 1)];
  const end = values[values.length - 1];
  if (!start) return 0;
  return end / start - 1;
}

export function siReturn(values: number[]) {
  if (values.length < 2 || !values[0]) return 0;
  return values[values.length - 1] / values[0] - 1;
}

export function returnsFrom(values: number[]) {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    out.push(prev ? values[i] / prev - 1 : 0);
  }
  return out;
}

export interface MonthCell {
  month: number;
  value: number | null;
}

export function monthlyTable(dates: string[], values: number[]) {
  const monthEnd = new Map<string, { v: number; prev: number }>();
  const yearFirst = new Map<number, { prev: number; last: number }>();
  for (let i = 0; i < dates.length; i++) {
    const key = dates[i].slice(0, 7);
    const prev = i === 0 ? values[0] : values[i - 1];
    monthEnd.set(key, { v: values[i], prev });
    const y = Number(dates[i].slice(0, 4));
    if (!yearFirst.has(y)) yearFirst.set(y, { prev, last: values[i] });
    yearFirst.get(y)!.last = values[i];
  }
  const rows: { year: number; months: MonthCell[]; total: number }[] = [];
  for (const [y, e] of yearFirst) {
    const months: MonthCell[] = [];
    for (let m = 0; m < 12; m++) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const c = monthEnd.get(key);
      months.push({ month: m, value: c ? c.v / c.prev - 1 : null });
    }
    rows.push({ year: y, months, total: e.last / e.prev - 1 });
  }
  return rows;
}

export function annualTable(dates: string[], values: number[]) {
  const out: { year: number; value: number; prev: number }[] = [];
  let curYear = "";
  for (let i = 0; i < dates.length; i++) {
    const y = dates[i].slice(0, 4);
    if (y !== curYear) {
      out.push({ year: Number(y), value: values[i], prev: i === 0 ? values[0] : values[i - 1] });
      curYear = y;
    } else {
      out[out.length - 1].value = values[i];
    }
  }
  return out.map((r) => ({ year: r.year, value: r.value / r.prev - 1 }));
}

export function rollingWindow(
  values: number[],
  window: number,
  fn: (slice: number[]) => number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window) {
      out.push(NaN);
      continue;
    }
    out.push(fn(values.slice(i - window, i)));
  }
  return out;
}

export function histogram(values: number[], bins = 24) {
  if (!values.length) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const w = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / w)));
    counts[idx]++;
  }
  return counts.map((c, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: c }));
}

export function hhi(weights: number[]) {
  return weights.reduce((s, w) => s + w * w, 0);
}

export function effectiveN(weights: number[]) {
  const h = hhi(weights);
  return h > 0 ? 1 / h : 0;
}

export function pctInRange(v: number, lo: number, hi: number) {
  if (hi === lo) return 0.5;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

export function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export function grade(score: number) {
  if (score >= 93) return "A+";
  if (score >= 87) return "A";
  if (score >= 80) return "A-";
  if (score >= 76) return "B+";
  if (score >= 70) return "B";
  if (score >= 64) return "B-";
  if (score >= 57) return "C+";
  if (score >= 50) return "C";
  if (score >= 42) return "C-";
  if (score >= 33) return "D";
  return "E";
}

export function band(v: number, lo: number, hi: number) {
  return clamp(((v - lo) / (hi - lo)) * 100, 0, 100);
}

export function downsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.min(arr.length - 1, Math.round(i * step))]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}
