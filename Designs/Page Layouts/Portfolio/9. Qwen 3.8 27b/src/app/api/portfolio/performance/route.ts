import { NextResponse } from "next/server";
import { loadCtx } from "@/lib/market";
import {
  returnsFromSeries,
  annVol,
  annReturn,
  maxDrawdown,
  drawdownSeries,
  betaTo,
  sharpe,
  sortino,
  trailing,
  rolling12m,
  monthlyCells,
  mean,
  stdev,
} from "@/lib/stats";
import { monthShort } from "@/lib/format";
import type { PerformancePayload } from "@/lib/types";

export const dynamic = "force-dynamic";

const label = (y: number, m: number) => `${monthShort(m)} ’${String(y).slice(2)}`;

export async function GET() {
  const ctx = await loadCtx();
  const vals = ctx.snaps.map((s) => s.v);
  const bench = ctx.snaps.map((s) => s.b);
  const n = vals.length;
  const rets = returnsFromSeries(vals);
  const brets = returnsFromSeries(bench);

  /* monthly */
  const cells = monthlyCells(ctx.snaps.map((s, i) => ({ t: ctx.dates[i], v: vals[i] })));
  const years = [...new Set(cells.map((c) => c.year))].sort();
  const monthly = years.map((year) => {
    const yc = cells.filter((c) => c.year === year);
    const months: (number | null)[] = Array.from({ length: 12 }, (_, i) => {
      const c = yc.find((x) => x.month === i);
      return c ? c.ret : null;
    });
    const rs = months.filter((x): x is number => x !== null);
    return {
      year,
      months,
      total: rs.length ? rs.reduce((s, r) => s * (1 + r), 1) - 1 : 0,
      vol: rs.length > 1 ? stdev(rs) * Math.sqrt(12) : 0,
    };
  });
  const realCells = cells.filter((c) => c.ret !== null) as { year: number; month: number; ret: number }[];
  const upMonths = realCells.filter((c) => c.ret > 0).length;
  const best = [...realCells].sort((a, b) => b.ret - a.ret)[0];
  const worst = [...realCells].sort((a, b) => a.ret - b.ret)[0];

  /* capture ratios */
  const upPort = rets.filter((r, i) => (brets[i] ?? 0) > 0);
  const upBench = brets.filter((r) => r > 0);
  const dnPort = rets.filter((r, i) => (brets[i] ?? 0) < 0);
  const dnBench = brets.filter((r) => r < 0);
  const upCapture = upBench.length ? mean(upPort) / mean(upBench) : 1;
  const downCapture = dnBench.length ? mean(dnPort) / mean(dnBench) : 1;

  /* calendar years */
  const yearNames = [...new Set(ctx.dates.map((d) => d.slice(0, 4)))].sort();
  const yearly = yearNames.map((y) => {
    const idx = ctx.dates.map((d, i) => (d.slice(0, 4) === y ? i : -1)).filter((i) => i >= 0);
    const base = idx.length ? vals[idx[0] - 1] ?? vals[idx[0]] : 0;
    const yVals = [base, ...idx.map((i) => vals[i])];
    const yr = returnsFromSeries(yVals);
    return {
      year: Number(y),
      ret: vals[idx[idx.length - 1]] / base - 1,
      vol: annVol(yr),
      maxDd: maxDrawdown(yVals).dd,
      sharpe: sharpe(yr),
    };
  });

  /* histogram of daily returns */
  const min = Math.min(...rets), max = Math.max(...rets);
  const bins = 21;
  const width = (max - min) / bins || 1;
  const hist = Array.from({ length: bins }, (_, i) => ({
    label: `${(((min + (i + 0.5) * width) * 100).toFixed(1))}%`,
    count: 0,
  }));
  for (const r of rets) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((r - min) / width)));
    hist[i].count++;
  }

  const ytdIdx = ctx.snaps.findIndex((s) => s.t.slice(0, 4) === String(new Date().getUTCFullYear()));
  const windows: [string, number][] = [
    ["1W", 5],
    ["1M", 21],
    ["3M", 63],
    ["6M", 126],
    ["1Y", 252],
    ["3Y", 756],
    ["5Y", n - 1],
    ["YTD", Math.max(1, n - 1 - (ytdIdx > 0 ? ytdIdx : 0))],
    ["Inception", n - 1],
  ];

  const cagr = annReturn(vals[0], vals[n - 1], n - 1);
  const bCagr = annReturn(bench[0], bench[n - 1], n - 1);
  const track = rets.map((r, i) => r - (brets[i] ?? 0));

  const payload: PerformancePayload = {
    stats: {
      cagr,
      sharpe: sharpe(rets),
      sortino: sortino(rets),
      vol: annVol(rets),
      maxDd: maxDrawdown(vals).dd,
      beta: betaTo(rets, brets),
      alpha: cagr - bCagr,
      trackingErr: annVol(track),
      upMonthPct: upMonths / Math.max(1, realCells.length),
      winRateDaily: rets.filter((r) => r > 0).length / rets.length,
      bestMonth: { label: label(best.year, best.month), ret: best.ret },
      worstMonth: { label: label(worst.year, worst.month), ret: worst.ret },
      upCapture,
      downCapture,
    },
    cumulative: ctx.dates.map((t, i) => ({ t, port: vals[i] / vals[0] - 1, bench: bench[i] / bench[0] - 1 })),
    trailing: windows.map(([window, d]) => ({
      window,
      port: trailing(vals, d),
      bench: trailing(bench, d),
    })),
    monthly,
    drawdown: ctx.dates.map((t, i) => ({ t, dd: drawdownSeries(vals)[i] })),
    rolling: rolling12m(vals)
      .map((r, i) => (r !== null && i % 5 === 0 ? { t: ctx.dates[i], ret: r } : null))
      .filter((x): x is { t: string; ret: number } => x !== null),
    hist,
    yearly,
    monthly24: cells.slice(-24).map((c) => ({ t: label(c.year, c.month), ret: c.ret ?? 0 })),
  };
  return NextResponse.json(payload);
}
