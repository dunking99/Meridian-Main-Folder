/** Pure numeric helpers used by the portfolio API routes. */

export function returnsFromSeries(v: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < v.length; i++) r.push(v[i] / v[i - 1] - 1);
  return r;
}

export function mean(a: number[]): number {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

export function stdev(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}

export function annVol(daily: number[]): number {
  return stdev(daily) * Math.sqrt(252);
}

export function annReturn(first: number, last: number, nDays: number): number {
  if (first <= 0) return 0;
  const years = Math.max(nDays / 252, 1 / 252);
  return Math.pow(last / first, 1 / years) - 1;
}

export function maxDrawdown(v: number[]): { dd: number; peakIdx: number; troughIdx: number } {
  let peak = v[0], best = 0, pi = 0, ti = 0, bp = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] > peak) { peak = v[i]; bp = i; }
    const d = v[i] / peak - 1;
    if (d < best) { best = d; pi = bp; ti = i; }
  }
  return { dd: best, peakIdx: pi, troughIdx: ti };
}

export function drawdownSeries(v: number[]): number[] {
  let peak = v[0];
  return v.map((x) => {
    if (x > peak) peak = x;
    return x / peak - 1;
  });
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const A = a.slice(-n), B = b.slice(-n);
  const ma = mean(A), mb = mean(B);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (A[i] - ma) * (B[i] - mb);
    da += (A[i] - ma) ** 2;
    db += (B[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export function sharpe(daily: number[], rfAnnual = 0.043): number {
  const v = annVol(daily);
  if (!v) return 0;
  const ar = mean(daily) * 252;
  return (ar - rfAnnual) / v;
}

export function sortino(daily: number[], rfAnnual = 0.043): number {
  const neg = daily.filter((x) => x < 0);
  if (!neg.length) return 3;
  const dd = Math.sqrt(mean(neg.map((x) => x * x))) * Math.sqrt(252);
  if (!dd) return 3;
  return (mean(daily) * 252 - rfAnnual) / dd;
}

export function betaTo(p: number[], b: number[]): number {
  const n = Math.min(p.length, b.length);
  const P = p.slice(-n), B = b.slice(-n);
  const mb = mean(B);
  let cov = 0, varb = 0;
  for (let i = 0; i < n; i++) {
    cov += (B[i] - mb) * P[i];
    varb += (B[i] - mb) ** 2;
  }
  return varb ? cov / varb : 0;
}

/** trailing return over `d` trading days (negative = look back) */
export function trailing(v: number[], d: number): number {
  const last = v[v.length - 1];
  const first = v[Math.max(0, v.length - 1 - d)];
  return last / first - 1;
}

export function rolling12m(v: number[]): (number | null)[] {
  return v.map((x, i) => (i >= 252 ? x / v[i - 252] - 1 : null));
}

export type MonthCell = { year: number; month: number; ret: number | null };

export function monthlyCells(values: { t: string; v: number }[]): MonthCell[] {
  // group by year-month
  const byYM = new Map<string, number>();
  for (const { t, v } of values) byYM.set(t.slice(0, 7), v);
  const keys = [...byYM.keys()].sort();
  return keys.map((k, i) => {
    const [y, m] = k.split("-").map(Number);
    const prev = i > 0 ? byYM.get(keys[i - 1]) : undefined;
    return { year: y, month: m - 1, ret: prev ? v(byYM, k) / prev - 1 : null };
  });
  function v(map: Map<string, number>, key: string) {
    return map.get(key)!;
  }
}

export function grade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 72) return "B+";
  if (score >= 64) return "B";
  if (score >= 55) return "B−";
  if (score >= 45) return "C+";
  if (score >= 35) return "C";
  if (score >= 25) return "D+";
  return "D";
}
