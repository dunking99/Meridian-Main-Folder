import { NextResponse } from "next/server";
import { loadCtx } from "@/lib/market";
import {
  returnsFromSeries,
  annVol,
  pearson,
  trailing,
  grade,
} from "@/lib/stats";
import type { AnalysisPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

const BENCH_SECTORS: Record<string, number> = {
  Technology: 0.316,
  Healthcare: 0.129,
  Financials: 0.135,
  "Consumer Cyclical": 0.108,
  "Consumer Staples": 0.079,
  Industrials: 0.09,
  Communication: 0.079,
  Energy: 0.034,
  Materials: 0.041,
  Utilities: 0.027,
  "Real Estate": 0.029,
};

const REGION_CURRENCY: Record<string, Record<string, number>> = {
  US: { USD: 1 },
  Canada: { CAD: 0.8, USD: 0.2 },
  LatAm: { USD: 0.7, EUR: 0.05, Other: 0.25 },
  Europe: { EUR: 0.68, GBP: 0.22, Other: 0.1 },
  Africa: { USD: 0.8, Other: 0.2 },
  Asia: { JPY: 0.22, CNY: 0.28, TWD: 0.18, Other: 0.32 },
  Oceania: { AUD: 0.95, USD: 0.05 },
  Global: { USD: 1 },
};
const ISO_REGION: Record<string, string> = { US: "US", GB: "Europe", NL: "Europe", DE: "Europe", TW: "Asia", JP: "Asia", XX: "Global" };

export async function GET() {
  const ctx = await loadCtx();
  const { rows, snaps, prices, total } = ctx;
  const vals = snaps.map((s) => s.v);
  const portRets = returnsFromSeries(vals).slice(-252);
  const portVol = annVol(returnsFromSeries(vals).slice(-252));

  const regionTotals: Record<string, number> = {};
  for (const r of rows) {
    const def = ctx.defs.find((d) => d.id === r.id)!;
    const mix = (def.meta as Record<string, unknown>).regionMix as Record<string, number> | undefined;
    if (mix) for (const [k, v] of Object.entries(mix)) regionTotals[k] = (regionTotals[k] ?? 0) + r.weight * v;
    else {
      const reg = ISO_REGION[r.countryIso] ?? "Global";
      regionTotals[reg] = (regionTotals[reg] ?? 0) + r.weight;
    }
  }

  /* scorecard */
  const hhi = rows.reduce((s, r) => s + r.weight * r.weight, 0);
  const top5 = rows.slice(0, 5).reduce((s, r) => s + r.weight, 0);
  const techPct = rows.reduce((s, r) => {
    const def = ctx.defs.find((d) => d.id === r.id)!;
    const mix = (def.meta as Record<string, unknown>).sectorMix as Record<string, number> | undefined;
    return s + r.weight * (mix ? (mix["Technology"] ?? 0) : r.sector === "Technology" ? 1 : 0);
  }, 0);
  let unhedged = 0;
  for (const r of rows) {
    const def = ctx.defs.find((d) => d.id === r.id)!;
    const mix = (def.meta as Record<string, unknown>).regionMix as Record<string, number> | undefined;
    if (mix) unhedged += r.weight * (1 - (mix.US ?? 0) - (mix.Global ?? 0));
    else if (r.countryIso !== "US" && r.countryIso !== "XX") unhedged += r.weight;
  }
  const cashPct = ctx.cash / total;
  const mom = trailing(vals, 126);
  const sc = (key: string, label: string, score: number, note: string) => ({
    key,
    label,
    score: Math.round(clamp(score, 0, 100)),
    grade: grade(Math.round(clamp(score, 0, 100))),
    note,
  });
  const scorecard = [
    sc("div", "Diversification", 96 - Math.max(0, 1150 - hhi * 10000) / 30, `${rows.length} positions, HHI ${Math.round(hhi * 10000)}`),
    sc("conc", "Concentration", 100 - top5 * 100 * 0.55, `Top 5 positions hold ${(top5 * 100).toFixed(0)}% of the book`),
    sc("sector", "Sector balance", 100 - Math.max(0, techPct * 100 - 30) * 1.1 - (hhi < 0.09 ? 0 : 8), `Technology tilts at ${(techPct * 100).toFixed(0)}% vs 32% in the S&P`),
    sc("ccy", "Currency exposure", 95 - unhedged * 100 * 1.5, `${(unhedged * 100).toFixed(0)}% unhedged non-USD underliers`),
    sc("mom", "Momentum", 50 + mom * 100 * 1.5, `6-month return ${(mom * 100).toFixed(1)}%`),
    sc("cash", "Cash drag", 95 - cashPct * 100 * 2, `${(cashPct * 100).toFixed(1)}% idle — funding dry powder`),
  ];

  /* sectors vs benchmark */
  const portSectors: Record<string, number> = {};
  for (const r of rows) {
    const def = ctx.defs.find((d) => d.id === r.id)!;
    const mix = (def.meta as Record<string, unknown>).sectorMix as Record<string, number> | undefined;
    if (mix) for (const [k, v] of Object.entries(mix)) portSectors[k] = (portSectors[k] ?? 0) + r.weight * v;
    else portSectors[r.sector] = (portSectors[r.sector] ?? 0) + r.weight;
  }
  const sectorKeys = [...new Set([...Object.keys(portSectors), ...Object.keys(BENCH_SECTORS)])];
  const sectors = sectorKeys
    .map((k) => ({ sector: k, port: (portSectors[k] ?? 0) * 100, bench: BENCH_SECTORS[k] !== undefined ? BENCH_SECTORS[k] * 100 : null }))
    .filter((s) => s.port > 0.1 || (s.bench ?? 0) > 0.1)
    .sort((a, b) => b.port - a.port);

  /* fund overlap */
  const bookSet = new Set(rows.map((r) => r.id));
  const overlap = rows
    .filter((r) => r.assetClass === "etf")
    .map((r) => {
      const def = ctx.defs.find((d) => d.id === r.id)!;
      const top = (def.topHoldings ?? []) as string[];
      return {
        id: r.id,
        name: r.name,
        overlap: ((def.meta as Record<string, unknown>).overlapSpx as number | undefined) ?? 0,
        shared: top.filter((t) => bookSet.has(t)),
      };
    })
    .filter((o) => o.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  /* correlation matrix: top 8 + portfolio + SPX */
  const corrLabels = [...rows.slice(0, 8).map((r) => r.id), "PORTFOLIO", "S&P 500"];
  const corrSeries = corrLabels.map((l) =>
    l === "PORTFOLIO" ? portRets : l === "S&P 500" ? returnsFromSeries(prices["SPX"] ?? []).slice(-252) : returnsFromSeries(prices[l] ?? []).slice(-252)
  );
  const matrix = corrSeries.map((a) => corrSeries.map((b) => Math.round(pearson(a, b) * 100) / 100));

  /* home bias */
  const us = regionTotals.US ?? 0;
  const intl = (["Canada", "LatAm", "Europe", "Africa", "Asia", "Oceania"] as const).reduce((s, k) => s + (regionTotals[k] ?? 0), 0);

  /* currency */
  const ccyTotals: Record<string, number> = {};
  for (const [reg, amt] of Object.entries(regionTotals)) {
    const map = REGION_CURRENCY[reg] ?? { Other: 1 };
    for (const [c, f] of Object.entries(map)) ccyTotals[c] = (ccyTotals[c] ?? 0) + amt * f;
  }
  const currency = Object.entries(ccyTotals)
    .map(([ccy, f]) => ({ ccy, value: f * total, pct: f }))
    .sort((a, b) => b.pct - a.pct);

  /* risk vs return bubbles */
  const bubbles = [
    ...rows.map((r) => {
      const p = prices[r.id];
      return {
        id: r.id,
        label: r.id,
        vol: annVol(returnsFromSeries(p.slice(-252))),
        ret: trailing(p, 252),
        weight: r.weight,
        color: r.color,
        isPortfolio: false,
      };
    }),
    {
      id: "PORT",
      label: "Portfolio",
      vol: portVol,
      ret: trailing(vals, 252),
      weight: 1,
      color: "#D9A648",
      isPortfolio: true,
    },
  ];

  /* concentration */
  const hhiVal = Math.round(hhi * 10000);
  const concentration = {
    hhi: hhiVal,
    grade: hhiVal < 1200 ? "Low" : hhiVal < 2200 ? "Moderate" : "High",
    top3: rows.slice(0, 3).reduce((s, r) => s + r.weight, 0),
    top5,
    top10: rows.slice(0, 10).reduce((s, r) => s + r.weight, 0),
    maxSingle: rows[0].weight,
  };

  const factors = [
    { name: "Growth vs value", tilt: 0.8 },
    { name: "Value", tilt: -0.7 },
    { name: "Large cap", tilt: 0.6 },
    { name: "Small cap", tilt: -0.5 },
    { name: "High beta", tilt: 0.7 },
    { name: "Quality", tilt: 0.4 },
    { name: "Momentum", tilt: 0.6 },
    { name: "Low yield", tilt: -0.6 },
  ];

  /* volatility attribution */
  const attr = rows
    .map((r) => {
      const p = prices[r.id];
      const cr = pearson(returnsFromSeries(p.slice(-252)), portRets);
      const vol = annVol(returnsFromSeries(p.slice(-252)));
      return { id: r.id, label: r.id, contrib: (r.weight * cr * vol) / (portVol || 1), color: r.color };
    })
    .sort((a, b) => b.contrib - a.contrib);
  const attrSum = attr.reduce((s, a) => s + a.contrib, 0) || 1;
  const attribution = attr.map((a) => ({ ...a, contrib: a.contrib / attrSum }));

  const payload: AnalysisPayload = {
    scorecard,
    sectors,
    overlap,
    correlation: { labels: corrLabels, matrix },
    homeBias: { us: us * 100, intl: intl * 100, globalUs: 65, globalIntl: 35 },
    currency,
    bubbles,
    concentration,
    factors,
    attribution,
  };
  return NextResponse.json(payload);
}
