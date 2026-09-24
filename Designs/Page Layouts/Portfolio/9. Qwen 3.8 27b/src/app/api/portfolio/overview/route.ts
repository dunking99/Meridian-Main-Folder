import { NextResponse } from "next/server";
import { loadCtx, newsOut, eventsOut } from "@/lib/market";
import {
  returnsFromSeries,
  annVol,
  betaTo,
  maxDrawdown,
  trailing,
  grade,
} from "@/lib/stats";
import type { OverviewPayload, Leader } from "@/lib/types";

export const dynamic = "force-dynamic";

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function leader(r: { id: string; name: string; ret1M: number; weight: number; spark: number[]; color: string; assetClass: string }): Leader {
  return { id: r.id, name: r.name, ret: r.ret1M, weight: r.weight, spark: r.spark, color: r.color, assetClass: r.assetClass };
}

export async function GET() {
  const ctx = await loadCtx();
  const { snaps, prices, rows, total, cash } = ctx;
  const vals = snaps.map((s) => s.v);
  const n = vals.length;
  const rets = returnsFromSeries(vals);
  const spxRets = returnsFromSeries(prices["SPX"] ?? []);

  const value = vals[n - 1];
  const prev = vals[n - 2] ?? value;
  const year = new Date().getUTCFullYear().toString();
  const ytdIdx = snaps.findIndex((s) => s.t.slice(0, 4) === year);
  const ytdBase = ytdIdx > 0 ? vals[ytdIdx - 1] : vals[0];

  const costTotal = rows.reduce((s, r) => s + r.quantity * r.avgCost, 0);
  const plTotal = rows.reduce((s, r) => s + r.pl, 0);

  /* allocation by asset class */
  const classOrder = ["stock", "etf", "bond-fund", "commodity"];
  const classLabels: Record<string, string> = {
    stock: "Single stocks",
    etf: "Index ETFs",
    "bond-fund": "Bonds",
    commodity: "Commodities",
    cash: "Cash",
  };
  const classColors: Record<string, string> = {
    stock: "#D9A648",
    etf: "#64B6E8",
    "bond-fund": "#8FBF9F",
    commodity: "#C77E54",
    cash: "#7B8794",
  };
  const allocation = classOrder
    .map((k) => {
      const v = rows.filter((r) => r.assetClass === k).reduce((s, r) => s + r.value, 0);
      return { key: k, label: classLabels[k], value: v, pct: v / total, color: classColors[k] };
    })
    .filter((a) => a.value > 0);
  allocation.push({ key: "cash", label: classLabels.cash, value: cash, pct: cash / total, color: classColors.cash });

  /* shape of the book: market-cap blend */
  const cap: Record<string, number> = { Large: 0, Mid: 0, Small: 0 };
  for (const r of rows) {
    const def = ctx.defs.find((d) => d.id === r.id)!;
    const mix = (def.meta as Record<string, unknown>).capMix as Record<string, number> | undefined;
    if (mix) for (const [k, v] of Object.entries(mix)) cap[k] = (cap[k] ?? 0) + r.weight * v;
    else if (r.assetClass === "stock") cap.Large += r.weight;
  }
  const capSum = Object.values(cap).reduce((s, x) => s + x, 0);
  const capShape = Object.entries(cap).map(([k, v]) => ({ key: k, label: k, pct: v / capSum })).sort((a, b) => b.pct - a.pct);

  /* risk */
  const vol = annVol(rets);
  const beta = betaTo(rets, spxRets);
  const maxDd = maxDrawdown(vals).dd;
  const equity = rows.filter((r) => r.assetClass === "stock" || r.assetClass === "etf").reduce((s, r) => s + r.value, 0) / total;
  const riskScore = Math.round(clamp(equity * 0.55 + vol * 1.1 * 100 + Math.min(beta, 1.6) * 8, 0, 100));
  const riskLabel = riskScore < 35 ? "Conservative" : riskScore < 55 ? "Balanced" : riskScore < 75 ? "Growth" : "Aggressive";

  /* health */
  const hhi = rows.reduce((s, r) => s + r.weight * r.weight, 0);
  const top5 = rows.slice(0, 5).reduce((s, r) => s + r.weight, 0);
  const techPct =
    rows.reduce((s, r) => {
      const def = ctx.defs.find((d) => d.id === r.id)!;
      const mix = (def.meta as Record<string, unknown>).sectorMix as Record<string, number> | undefined;
      return s + r.weight * (mix ? (mix["Technology"] ?? 0) : r.sector === "Technology" ? 1 : 0);
    }, 0) * 100;
  let unhedged = 0;
  for (const r of rows) {
    const def = ctx.defs.find((d) => d.id === r.id)!;
    const mix = (def.meta as Record<string, unknown>).regionMix as Record<string, number> | undefined;
    if (mix) unhedged += r.weight * (1 - (mix.US ?? 0) - (mix.Global ?? 0));
    else if (r.countryIso !== "US" && r.countryIso !== "XX") unhedged += r.weight;
  }
  const healthParts = [
    { key: "div", label: "Diversification", score: Math.round(clamp(96 - Math.max(0, 1150 - hhi * 10000) / 30, 30, 96)) },
    { key: "conc", label: "Concentration", score: Math.round(clamp(100 - top5 * 100 * 0.55, 0, 100)) },
    { key: "sector", label: "Sector balance", score: Math.round(clamp(100 - Math.max(0, techPct - 30) * 1.1 - (hhi < 0.09 ? 0 : 8), 25, 95)) },
    { key: "ccy", label: "Currency", score: Math.round(clamp(95 - unhedged * 100 * 1.5, 0, 95)) },
    { key: "mom", label: "Momentum", score: Math.round(clamp(50 + trailing(vals, 126) * 100 * 1.5, 15, 95)) },
  ];
  const healthScore = Math.round(healthParts.reduce((s, p) => s + p.score, 0) / healthParts.length);

  const byRet = [...rows].sort((a, b) => b.ret1M - a.ret1M);

  /* market session (ET) */
  const etHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date())
  );
  const dowStr = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
  const dowIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dowStr);
  const marketsOpen = dowIdx >= 1 && dowIdx <= 5 && etHour >= 9 && etHour < 16;

  const [news, events] = await Promise.all([newsOut(6), eventsOut(8)]);

  const payload: OverviewPayload = {
    asOf: new Date().toISOString(),
    marketsOpen,
    value,
    cash,
    invested: value - cash,
    dayChange: value - prev,
    dayChangePct: value / prev - 1,
    ret1M: trailing(vals, 21),
    retYTD: value / ytdBase - 1,
    retInception: value / vals[0] - 1,
    plTotal,
    plPct: plTotal / costTotal,
    holdingsCount: rows.length,
    symbols: rows.map((r) => r.id),
    series: snaps.map((s) => ({ t: s.t, value: s.v, bench: s.b })),
    allocation,
    capShape,
    risk: {
      score: riskScore,
      grade: grade(riskScore),
      label: riskLabel,
      beta,
      vol,
      maxDd,
      equity,
      note: `Tracks ${beta.toFixed(2)}x the S&P 500 with ${(vol * 100).toFixed(1)}% annualized volatility over 5 years.`,
    },
    health: { score: healthScore, grade: grade(healthScore), parts: healthParts },
    leaders: byRet.slice(0, 3).map(leader),
    laggards: byRet.slice(-3).reverse().map(leader),
    topHoldings: rows.slice(0, 6),
    events,
    news,
  };
  return NextResponse.json(payload);
}
