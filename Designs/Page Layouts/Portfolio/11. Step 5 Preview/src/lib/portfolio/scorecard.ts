/**
 * Meridian — scorecards, risk profile and rule-based insights
 * The "second opinion" layer: it reads the analytics and tells the single
 * user what is good, what is drifting and what to look at next.
 */
import type { Analytics } from "./analytics";
import type { PortfolioCore } from "./engine";
import type { RawData } from "@/lib/data/repository";
import { band, clamp, grade, mean } from "./metrics";

export interface Subscore {
  key: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface Scorecard {
  overall: number;
  grade: string;
  subscores: Subscore[];
}

export interface RiskProfile {
  score: number; // 0 = defensive, 100 = aggressive
  level: "Defensive" | "Conservative" | "Balanced" | "Growth" | "Aggressive";
  color: string;
  factors: { label: string; value: string; score: number; note: string }[];
}

export interface HealthDriver {
  label: string;
  value: string;
  status: "good" | "warn" | "bad";
  note: string;
}

export interface Health {
  score: number;
  grade: string;
  drivers: HealthDriver[];
}

export function buildScorecard(core: PortfolioCore, a: Analytics): Scorecard {
  const h = core.holdings;
  const effN = a.concentration.effN;
  const top5 = a.concentration.top5;
  const maxW = a.concentration.maxWeight;
  const vol = a.stats.vol;
  const sharpe = a.stats.sharpe;
  const dd = Math.abs(a.stats.maxDd);
  const y1 = a.horizons.find((x) => x.label === "1Y")?.portfolio ?? 0;
  const bench1y = a.horizons.find((x) => x.label === "1Y")?.acwi ?? 0;
  const y3 = a.horizons.find((x) => x.label === "3Y")?.portfolio ?? 0;
  const bench3y = a.horizons.find((x) => x.label === "3Y")?.acwi ?? 0;
  const ir = a.stats.ir;
  const cost = a.costDrag;
  const cashPct = core.cash[core.cash.length - 1] / (core.totalValue[core.totalValue.length - 1] || 1) * 100;
  const yieldPct = a.income.forwardYield;
  const sectors = a.ltSector.length;

  const diversification = clamp(
    band(effN, 4, 18) * 0.4 +
      band(28 - top5, 0, 18) * 0.3 +
      band(9 - maxW, 0, 7) * 0.15 +
      band(sectors, 4, 11) * 0.15,
    0,
    100,
  );

  const riskEfficiency = clamp(
    band(sharpe, -0.5, 1.6) * 0.45 +
      band(20 - vol, 0, 12) * 0.25 +
      band(35 - dd, 0, 30) * 0.2 +
      band(a.stats.sortino, -0.5, 2.2) * 0.1,
    0,
    100,
  );

  const performance = clamp(
    band(y1 - bench1y, -0.25, 0.2) * 100 * 0.45 +
      band(y3 - bench3y, -0.3, 0.35) * 100 * 0.3 +
      band(ir, -0.6, 1.2) * 0.25,
    0,
    100,
  );

  const costScore = clamp(band(0.55 - cost, 0, 0.5), 0, 100);
  const liquidity = clamp(
    band(6 - Math.abs(cashPct - 3.5), 0, 4) * 0.6 +
      band(h.filter((x) => x.kind === "etf" || x.kind === "bond_etf").reduce((s, x) => s + x.weight, 0), 20, 70) * 0.4,
    0,
    100,
  );
  const income = clamp(band(yieldPct, 0.5, 3.6) * 0.7 + band(a.income.total12m, 0, 12000) * 0.3, 0, 100);
  const concentrationScore = clamp(
    band(35 - top5, 0, 20) * 0.4 + band(12 - maxW, 0, 8) * 0.35 + band(18 - effN, 0, 10) * 0.25,
    0,
    100,
  );

  const subscores: Subscore[] = [
    {
      key: "diversification",
      label: "Diversification",
      score: diversification,
      weight: 16,
      detail: `${effN.toFixed(1)} effective positions across ${sectors} sectors`,
    },
    {
      key: "risk",
      label: "Risk efficiency",
      score: riskEfficiency,
      weight: 20,
      detail: `Sharpe ${sharpe.toFixed(2)} · vol ${vol.toFixed(1)}% · max DD ${dd.toFixed(1)}%`,
    },
    {
      key: "performance",
      label: "Performance",
      score: performance,
      weight: 18,
      detail: `${(y1 * 100).toFixed(1)}% vs ${(bench1y * 100).toFixed(1)}% benchmark over 1Y`,
    },
    {
      key: "concentration",
      label: "Concentration",
      score: concentrationScore,
      weight: 14,
      detail: `Top 5 = ${top5.toFixed(1)}% · largest ${maxW.toFixed(1)}%`,
    },
    {
      key: "liquidity",
      label: "Liquidity",
      score: liquidity,
      weight: 10,
      detail: `${cashPct.toFixed(1)}% cash, remainder in liquid lines`,
    },
    {
      key: "cost",
      label: "Cost efficiency",
      score: costScore,
      weight: 10,
      detail: `Weighted expense ratio ${cost.toFixed(3)}%`,
    },
    {
      key: "income",
      label: "Income",
      score: income,
      weight: 12,
      detail: `Forward yield ${yieldPct.toFixed(2)}% · ${a.income.total12m.toLocaleString(undefined, { maximumFractionDigits: 0 })} received (12m)`,
    },
  ];

  const overall = subscores.reduce((s, x) => s + x.score * x.weight, 0) / subscores.reduce((s, x) => s + x.weight, 0);

  return { overall, grade: grade(overall), subscores };
}

export function buildRisk(core: PortfolioCore, a: Analytics): RiskProfile {
  const h = core.holdings;
  const vol = a.stats.vol;
  const beta = a.stats.beta;
  const dd = Math.abs(a.stats.maxDd);
  const var95 = Math.abs(a.stats.var95);
  const aiWeight = a.ltSector
    .filter((s) => ["Semiconductors", "Technology", "Software"].includes(s.key))
    .reduce((s, x) => s + x.weight, 0);
  const nonUsd = 100 - (a.currencyExposure.find((c) => c.code === "USD")?.total ?? 0);
  const singleName = a.concentration.maxWeight;
  const bondWeight = a.allocation.assetClass.find((x) => x.key === "Fixed Income")?.weight ?? 0;

  const factors = [
    {
      label: "Volatility",
      value: `${vol.toFixed(1)}% ann.`,
      score: band(vol, 5, 32),
      note: "Realised standard deviation of daily returns",
    },
    {
      label: "Market beta",
      value: beta.toFixed(2),
      score: band(beta, 0.2, 1.6),
      note: "Sensitivity to the S&P 500",
    },
    {
      label: "Max drawdown",
      value: `${dd.toFixed(1)}%`,
      score: band(dd, 3, 45),
      note: `Trough ${a.stats.maxDdDate}`,
    },
    {
      label: "Daily VaR (95%)",
      value: `${var95.toFixed(2)}%`,
      score: band(var95, 0.4, 4),
      note: "Worst 5% of days, historical",
    },
    {
      label: "AI / tech cluster",
      value: `${aiWeight.toFixed(0)}% look-through`,
      score: band(aiWeight, 10, 60),
      note: "Semis + software after fund look-through",
    },
    {
      label: "Largest position",
      value: `${singleName.toFixed(1)}%`,
      score: band(singleName, 2, 20),
      note: h[0]?.name ?? "",
    },
    {
      label: "Currency risk",
      value: `${nonUsd.toFixed(0)}% non-USD`,
      score: band(nonUsd, 0, 45),
      note: "Unhedged foreign-currency exposure",
    },
    {
      label: "Defensive ballast",
      value: `${bondWeight.toFixed(0)}% fixed income`,
      score: 100 - band(bondWeight, 0, 40),
      note: "Bonds + cash that dampen equity shocks",
    },
  ];

  const score = mean(factors.map((f) => f.score));
  const level: RiskProfile["level"] =
    score < 22 ? "Defensive" : score < 40 ? "Conservative" : score < 58 ? "Balanced" : score < 74 ? "Growth" : "Aggressive";
  const color = score < 22 ? "mint" : score < 40 ? "teal" : score < 58 ? "gold" : score < 74 ? "amber" : "coral";

  return { score, level, color, factors };
}

export function buildHealth(core: PortfolioCore, a: Analytics): Health {
  const h = core.holdings;
  const totalPct = core.totalValue[core.totalValue.length - 1];
  const cashPct = (core.cash[core.cash.length - 1] / (totalPct || 1)) * 100;
  const drifts = a.rebalance.filter((r) => Math.abs(r.drift) > 1.5);
  const worstDrift = a.rebalance[0];
  const overlap = a.overlap.pairs[0];
  const avgCorr =
    a.correlation.matrix.reduce((s, row, i) => s + row.reduce((t, v, j) => (i === j ? t : t + v), 0), 0) /
    Math.max(1, a.correlation.matrix.length * (a.correlation.matrix.length - 1));

  const drivers: HealthDriver[] = [
    {
      label: "Cash buffer",
      value: `${cashPct.toFixed(1)}%`,
      status: cashPct < 0.8 ? "bad" : cashPct > 12 ? "warn" : "good",
      note:
        cashPct < 0.8
          ? "Almost nothing undeployed — no dry powder"
          : cashPct > 12
            ? "Heavy cash drag at current yields"
            : "Enough to act on dislocations without selling",
    },
    {
      label: "Policy drift",
      value: `${drifts.length} lines > 1.5pp`,
      status: drifts.length > 5 ? "bad" : drifts.length > 2 ? "warn" : "good",
      note: worstDrift
        ? `Largest: ${worstDrift.symbol} at ${worstDrift.current.toFixed(1)}% vs ${worstDrift.target.toFixed(1)}% target`
        : "All lines within tolerance",
    },
    {
      label: "Fund overlap",
      value: overlap ? `${overlap.a} ∩ ${overlap.b} = ${overlap.overlap.toFixed(0)}%` : "—",
      status: overlap && overlap.overlap > 45 ? "warn" : "good",
      note: overlap
        ? `${overlap.shared} shared constituents — you are paying two fees for one exposure`
        : "No meaningful duplication between funds",
    },
    {
      label: "Correlation",
      value: `${avgCorr.toFixed(2)} avg`,
      status: avgCorr > 0.62 ? "warn" : "good",
      note:
        avgCorr > 0.62
          ? "Positions are moving together — diversification is thinner than the line count suggests"
          : "Return streams are genuinely different",
    },
    {
      label: "Concentration",
      value: `Top 5 = ${a.concentration.top5.toFixed(0)}%`,
      status: a.concentration.top5 > 45 ? "bad" : a.concentration.top5 > 35 ? "warn" : "good",
      note: `${a.concentration.effN.toFixed(1)} effective positions from ${h.length} lines`,
    },
    {
      label: "Cost drag",
      value: `${a.costDrag.toFixed(3)}%`,
      status: a.costDrag > 0.15 ? "warn" : "good",
      note: `≈ ${((a.costDrag / 100) * totalPct).toFixed(0)} per year in fund fees`,
    },
  ];

  const statusScore = { good: 100, warn: 62, bad: 28 };
  const score = mean(drivers.map((d) => statusScore[d.status]));
  return { score, grade: grade(score), drivers };
}

export interface Insight {
  id: string;
  tone: "good" | "warn" | "bad" | "info";
  title: string;
  detail: string;
  metric: string;
  href: string;
}

export function buildInsights(core: PortfolioCore, a: Analytics, raw: RawData): Insight[] {
  const out: Insight[] = [];
  const total = core.totalValue[core.totalValue.length - 1];
  const holdings = core.holdings;

  const sorted1y = [...holdings].sort((x, y) => y.ret.y1 - x.ret.y1);
  const best = sorted1y[0];
  const worst = sorted1y[sorted1y.length - 1];
  if (best)
    out.push({
      id: "best",
      tone: "good",
      title: `${best.symbol} is carrying the book`,
      detail: `${best.name} returned ${(best.ret.y1 * 100).toFixed(1)}% over 12 months and now accounts for ${best.weight.toFixed(1)}% of the portfolio — up from a ${best.targetWeight.toFixed(1)}% policy weight.`,
      metric: `+${(best.ret.y1 * 100).toFixed(0)}%`,
      href: `/portfolio/holdings/${encodeURIComponent(best.symbol)}`,
    });
  if (worst && worst.symbol !== best?.symbol)
    out.push({
      id: "worst",
      tone: worst.ret.y1 < -0.08 ? "bad" : "info",
      title: `${worst.symbol} is the biggest detractor`,
      detail: `${worst.name} is down ${(worst.ret.y1 * 100).toFixed(1)}% over 12 months. It contributes ${worst.contribution1y.toFixed(2)}pp to portfolio return.`,
      metric: `${(worst.ret.y1 * 100).toFixed(0)}%`,
      href: `/portfolio/holdings/${encodeURIComponent(worst.symbol)}`,
    });

  if (a.concentration.top5 > 35)
    out.push({
      id: "concentration",
      tone: a.concentration.top5 > 45 ? "bad" : "warn",
      title: "Five lines are a third of the book",
      detail: `The top five positions are ${a.concentration.top5.toFixed(1)}% of value across ${a.concentration.effN.toFixed(1)} effective positions. Single-name risk is doing more work than the line count implies.`,
      metric: `${a.concentration.top5.toFixed(0)}%`,
      href: "/portfolio/analysis",
    });

  const overlap = a.overlap.pairs[0];
  if (overlap && overlap.overlap > 30)
    out.push({
      id: "overlap",
      tone: "warn",
      title: `${overlap.a} and ${overlap.b} are the same trade`,
      detail: `They share ${overlap.shared} constituents with ${overlap.overlap.toFixed(0)}% weight overlap. Consolidating would cut fees without changing exposure.`,
      metric: `${overlap.overlap.toFixed(0)}% overlap`,
      href: "/portfolio/analysis",
    });

  if (Math.abs(a.homeBias.gap) > 5)
    out.push({
      id: "homebias",
      tone: "info",
      title: `Home bias is ${a.homeBias.gap > 0 ? "above" : "below"} policy`,
      detail: `Domestic equity is ${a.homeBias.domestic.toFixed(0)}% of equity exposure against a ${a.homeBias.target}% target — a ${Math.abs(a.homeBias.gap).toFixed(1)}pp gap driven by US large-cap drift.`,
      metric: `${a.homeBias.gap > 0 ? "+" : ""}${a.homeBias.gap.toFixed(0)}pp`,
      href: "/portfolio/analysis",
    });

  const semis = a.ltSector.find((s) => s.key === "Semiconductors");
  if (semis)
    out.push({
      id: "semis",
      tone: semis.weight > 22 ? "warn" : "info",
      title: "AI hardware is the dominant factor",
      detail: `Semiconductors are ${semis.weight.toFixed(1)}% of the book after look-through, versus ${(a.allocation.sector.find((s) => s.key === "Semiconductors")?.weight ?? 0).toFixed(1)}% held directly. The funds are hiding it.`,
      metric: `${semis.weight.toFixed(0)}%`,
      href: "/portfolio/analysis",
    });

  const cashPct = (core.cash[core.cash.length - 1] / (total || 1)) * 100;
  if (cashPct < 1.2)
    out.push({
      id: "cash",
      tone: "warn",
      title: "Dry powder is nearly exhausted",
      detail: `Cash is ${cashPct.toFixed(2)}% of the book. The next contribution lands in ${core.dates.length ? "the coming weeks" : "—"} — until then there is nothing to deploy into a drawdown.`,
      metric: `${cashPct.toFixed(1)}% cash`,
      href: "/portfolio/cash",
    });

  const upcoming = raw.events
    .filter((e) => e.kind === "earnings" && e.date > core.dates[core.dates.length - 1])
    .slice(0, 4);
  if (upcoming.length)
    out.push({
      id: "events",
      tone: "info",
      title: `${upcoming.length} earnings calls inside a month`,
      detail: `${upcoming.map((e) => e.symbol).join(", ")} report soon. Positions affected carry ${upcoming
        .reduce((s, e) => s + (holdings.find((h) => h.symbol === e.symbol)?.weight ?? 0), 0)
        .toFixed(1)}% of the book.`,
      metric: `${upcoming.length} events`,
      href: "/portfolio",
    });

  const negativeNews = raw.news.filter((x) => x.sentiment < -0.3 && x.symbols.some((s) => holdings.some((h) => h.symbol === s)));
  if (negativeNews.length)
    out.push({
      id: "news",
      tone: "warn",
      title: "Negative flow against held names",
      detail: `${negativeNews.length} stories in the last week carry a negative tone on positions you hold — the most exposed line is ${
        holdings.find((h) => h.symbol === negativeNews[0].symbols[0])?.name ?? negativeNews[0].symbols[0]
      }.`,
      metric: `${negativeNews.length} stories`,
      href: "/portfolio",
    });

  const dd = a.stats.maxDd;
  if (dd > -25)
    out.push({
      id: "drawdown",
      tone: "good",
      title: "Drawdowns have been shallow",
      detail: `The worst peak-to-trough decline since inception is ${dd.toFixed(1)}%, versus ${(a.stats.vol * 2.2).toFixed(1)}% for a portfolio of this volatility. Fixed income and gold are earning their keep.`,
      metric: `${dd.toFixed(1)}%`,
      href: "/portfolio/performance",
    });

  return out;
}

export interface PulseItem {
  key: string;
  label: string;
  value: number;
  display: string;
  delta?: number;
  tone: "pos" | "neg" | "neutral";
  spark?: number[];
  href: string;
}

export function buildPulse(core: PortfolioCore, a: Analytics): PulseItem[] {
  const nav = core.nav;
  const sparkFrom = (days: number) => nav.slice(-days);
  const items: PulseItem[] = [
    {
      key: "1d",
      label: "1 day",
      value: core.dailyReturns[core.dailyReturns.length - 1] * 100,
      display: pct(core.dailyReturns[core.dailyReturns.length - 1] * 100),
      tone: tone(core.dailyReturns[core.dailyReturns.length - 1]),
      spark: sparkFrom(40),
      href: "/portfolio/performance",
    },
    {
      key: "1m",
      label: "1 month",
      value: a.horizons.find((h) => h.label === "1M")!.portfolio * 100,
      display: pct(a.horizons.find((h) => h.label === "1M")!.portfolio * 100),
      tone: tone(a.horizons.find((h) => h.label === "1M")!.portfolio),
      spark: sparkFrom(120),
      href: "/portfolio/performance",
    },
    {
      key: "ytd",
      label: "YTD",
      value: a.horizons.find((h) => h.label === "YTD")!.portfolio * 100,
      display: pct(a.horizons.find((h) => h.label === "YTD")!.portfolio * 100),
      tone: tone(a.horizons.find((h) => h.label === "YTD")!.portfolio),
      spark: sparkFrom(252),
      href: "/portfolio/performance",
    },
    {
      key: "1y",
      label: "1 year",
      value: a.horizons.find((h) => h.label === "1Y")!.portfolio * 100,
      display: pct(a.horizons.find((h) => h.label === "1Y")!.portfolio * 100),
      tone: tone(a.horizons.find((h) => h.label === "1Y")!.portfolio),
      spark: sparkFrom(252),
      href: "/portfolio/performance",
    },
    {
      key: "vol",
      label: "Volatility",
      value: a.stats.vol,
      display: `${a.stats.vol.toFixed(1)}%`,
      tone: "neutral",
      href: "/portfolio/analysis",
    },
    {
      key: "sharpe",
      label: "Sharpe",
      value: a.stats.sharpe,
      display: a.stats.sharpe.toFixed(2),
      tone: a.stats.sharpe > 0.8 ? "pos" : a.stats.sharpe < 0.2 ? "neg" : "neutral",
      href: "/portfolio/analysis",
    },
    {
      key: "dd",
      label: "Max drawdown",
      value: a.stats.maxDd,
      display: `${a.stats.maxDd.toFixed(1)}%`,
      tone: a.stats.maxDd > -15 ? "pos" : "neg",
      href: "/portfolio/performance",
    },
    {
      key: "beta",
      label: "Beta",
      value: a.stats.beta,
      display: a.stats.beta.toFixed(2),
      tone: "neutral",
      href: "/portfolio/analysis",
    },
  ];
  return items;
}

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const tone = (v: number): PulseItem["tone"] => (v > 0.0001 ? "pos" : v < -0.0001 ? "neg" : "neutral");
