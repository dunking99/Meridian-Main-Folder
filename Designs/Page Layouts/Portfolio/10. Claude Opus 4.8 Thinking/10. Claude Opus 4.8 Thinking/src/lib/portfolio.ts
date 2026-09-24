import { cache } from "react";
import { db } from "@/db";
import {
  holdings as holdingsTable,
  priceHistory,
  portfolioMeta,
  fxRates,
  events as eventsTable,
  news as newsTable,
  etfConstituents,
} from "@/db/schema";
import { asc } from "drizzle-orm";

// ---------------- raw load ----------------
export const loadRaw = cache(async () => {
  const [holdings, prices, metaRows, fx, events, news, etfs] = await Promise.all([
    db.select().from(holdingsTable),
    db.select().from(priceHistory).orderBy(asc(priceHistory.d)),
    db.select().from(portfolioMeta),
    db.select().from(fxRates),
    db.select().from(eventsTable).orderBy(asc(eventsTable.d)),
    db.select().from(newsTable),
    db.select().from(etfConstituents),
  ]);
  return { holdings, prices, meta: metaRows[0], fx, events, news, etfs };
});

// ---------------- stats helpers ----------------
function mean(a: number[]) {
  return a.reduce((s, x) => s + x, 0) / (a.length || 1);
}
function std(a: number[]) {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}
function pearson(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  const aa = a.slice(a.length - n);
  const bb = b.slice(b.length - n);
  const ma = mean(aa);
  const mb = mean(bb);
  let num = 0,
    da = 0,
    db2 = 0;
  for (let i = 0; i < n; i++) {
    num += (aa[i] - ma) * (bb[i] - mb);
    da += (aa[i] - ma) ** 2;
    db2 += (bb[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db2);
  return den === 0 ? 0 : num / den;
}
function returns(closes: number[]) {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) r.push(closes[i] / closes[i - 1] - 1);
  return r;
}

export type ColorMap = Record<string, string>;

export const ASSET_COLORS: ColorMap = {
  Equity: "#60a5fa",
  ETF: "#34d399",
  "Fixed Income": "#94a3b8",
  Commodity: "#e8c489",
  Crypto: "#fbbf24",
};
export const SECTOR_COLORS: ColorMap = {
  Technology: "#38bdf8",
  "Consumer Discretionary": "#fb923c",
  "Communication Services": "#f472b6",
  Financials: "#facc15",
  "Health Care": "#22d3ee",
  "Consumer Staples": "#a3e635",
  Diversified: "#818cf8",
  Bonds: "#94a3b8",
  "Precious Metals": "#e8c489",
  "Digital Assets": "#fbbf24",
};
export const REGION_COLORS: ColorMap = {
  "North America": "#60a5fa",
  Europe: "#c084fc",
  "Asia Pacific": "#fb7185",
  "Emerging Markets": "#34d399",
  Global: "#e8c489",
};

// ---------------- main compute ----------------
export const getPortfolio = cache(async () => {
  const { holdings, prices, meta, fx, events, news, etfs } = await loadRaw();
  const cash = meta?.cash ?? 0;

  // price maps
  const bySymbol = new Map<string, { d: string; close: number }[]>();
  for (const p of prices) {
    if (!bySymbol.has(p.symbol)) bySymbol.set(p.symbol, []);
    bySymbol.get(p.symbol)!.push({ d: p.d, close: p.close });
  }
  const dates = (bySymbol.get("ACWI") ?? bySymbol.get(holdings[0]?.symbol) ?? []).map((x) => x.d);

  // enriched holdings
  const enriched = holdings.map((h) => {
    const value = h.quantity * h.currentPrice;
    const cost = h.quantity * h.avgCost;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const dayAbs = (h.currentPrice - h.prevClose) * h.quantity;
    const dayPct = h.prevClose > 0 ? ((h.currentPrice - h.prevClose) / h.prevClose) * 100 : 0;
    const series = (bySymbol.get(h.symbol) ?? []).map((x) => x.close);
    return { ...h, value, cost, pnl, pnlPct, dayAbs, dayPct, series };
  });

  const investedValue = enriched.reduce((s, h) => s + h.value, 0);
  const totalValue = investedValue + cash;
  enriched.forEach((h) => ((h as { weight?: number }).weight = (h.value / totalValue) * 100));
  const withWeight = enriched as (typeof enriched[number] & { weight: number })[];

  // portfolio value series
  const closeAt = (symbol: string, i: number) => bySymbol.get(symbol)?.[i]?.close ?? 0;
  const series = dates.map((d, i) => {
    const invested = holdings.reduce((s, h) => s + h.quantity * closeAt(h.symbol, i), 0);
    return { date: d, invested, value: invested + cash, bench: closeAt("ACWI", i) };
  });
  const pv = series.map((s) => s.value);
  const pvReturns = returns(pv);
  const benchReturns = returns(series.map((s) => s.bench));

  // summary
  const dayAbs = withWeight.reduce((s, h) => s + h.dayAbs, 0);
  const prevTotal = totalValue - dayAbs;
  const dayPct = prevTotal > 0 ? (dayAbs / prevTotal) * 100 : 0;
  const totalCost = withWeight.reduce((s, h) => s + h.cost, 0);
  const totalPnl = withWeight.reduce((s, h) => s + h.pnl, 0);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // trailing returns
  const lastIdx = pv.length - 1;
  const valAgo = (days: number) => {
    const idx = Math.max(0, lastIdx - days);
    return pv[idx];
  };
  const yearStart = (() => {
    const y = new Date().getFullYear();
    const idx = dates.findIndex((d) => d >= `${y}-01-01`);
    return idx === -1 ? 0 : idx;
  })();
  const ret = (fromIdx: number) => (pv[fromIdx] > 0 ? (pv[lastIdx] / pv[fromIdx] - 1) * 100 : 0);
  const benchRet = (fromIdx: number) => {
    const b = series.map((s) => s.bench);
    return b[fromIdx] > 0 ? (b[lastIdx] / b[fromIdx] - 1) * 100 : 0;
  };
  const trailing = [
    { label: "1M", idx: Math.max(0, lastIdx - 30) },
    { label: "3M", idx: Math.max(0, lastIdx - 90) },
    { label: "6M", idx: Math.max(0, lastIdx - 180) },
    { label: "YTD", idx: yearStart },
    { label: "1Y", idx: Math.max(0, lastIdx - 365) },
    { label: "Max", idx: 0 },
  ].map((t) => ({ label: t.label, port: ret(t.idx), bench: benchRet(t.idx) }));

  // monthly returns matrix
  const monthKey = (d: string) => d.slice(0, 7);
  const monthLast = new Map<string, number>();
  series.forEach((s) => monthLast.set(monthKey(s.date), s.value));
  const monthsSorted = [...monthLast.keys()].sort();
  const monthly: { ym: string; year: number; month: number; ret: number }[] = [];
  for (let i = 0; i < monthsSorted.length; i++) {
    const ym = monthsSorted[i];
    const cur = monthLast.get(ym)!;
    const prev = i === 0 ? series[0].value : monthLast.get(monthsSorted[i - 1])!;
    const [y, m] = ym.split("-").map(Number);
    monthly.push({ ym, year: y, month: m, ret: prev > 0 ? (cur / prev - 1) * 100 : 0 });
  }

  // allocations
  const groupBy = (key: (h: typeof withWeight[number]) => string, colors: ColorMap) => {
    const map = new Map<string, number>();
    withWeight.forEach((h) => map.set(key(h), (map.get(key(h)) ?? 0) + h.value));
    map.set("Cash", (map.get("Cash") ?? 0) + cash);
    return [...map.entries()]
      .map(([label, value]) => ({ label, value, weight: (value / totalValue) * 100, color: colors[label] ?? "#64748b" }))
      .sort((a, b) => b.value - a.value);
  };
  const byAssetClass = groupBy((h) => h.assetClass, { ...ASSET_COLORS, Cash: "#475569" });
  const bySector = groupBy((h) => h.sector, { ...SECTOR_COLORS, Cash: "#475569" });
  const byRegion = groupBy((h) => h.region, { ...REGION_COLORS, Cash: "#475569" });
  const byCurrency = (() => {
    const map = new Map<string, number>();
    withWeight.forEach((h) => map.set(h.currency, (map.get(h.currency) ?? 0) + h.value));
    map.set("USD", (map.get("USD") ?? 0) + cash);
    const palette: ColorMap = { USD: "#60a5fa", EUR: "#c084fc", GBP: "#f472b6", CHF: "#f87171", JPY: "#34d399" };
    return [...map.entries()]
      .map(([label, value]) => ({ label, value, weight: (value / totalValue) * 100, color: palette[label] ?? "#64748b" }))
      .sort((a, b) => b.value - a.value);
  })();

  // risk metrics
  const volAnnual = std(pvReturns) * Math.sqrt(252) * 100;
  const annualizedReturn = (Math.pow(pv[lastIdx] / pv[0], 252 / Math.max(1, pvReturns.length)) - 1) * 100;
  const rf = 4.3;
  const sharpe = volAnnual > 0 ? (annualizedReturn - rf) / volAnnual : 0;
  const downside = pvReturns.filter((r) => r < 0);
  const sortino = downside.length ? (annualizedReturn - rf) / (std(downside) * Math.sqrt(252) * 100) : 0;
  // max drawdown
  let peak = pv[0];
  let maxDD = 0;
  for (const v of pv) {
    if (v > peak) peak = v;
    const dd = (v / peak - 1) * 100;
    if (dd < maxDD) maxDD = dd;
  }
  const betaToBench = (() => {
    const n = Math.min(pvReturns.length, benchReturns.length);
    const a = pvReturns.slice(-n);
    const b = benchReturns.slice(-n);
    const mb = mean(b);
    const ma = mean(a);
    let cov = 0,
      varb = 0;
    for (let i = 0; i < n; i++) {
      cov += (a[i] - ma) * (b[i] - mb);
      varb += (b[i] - mb) ** 2;
    }
    return varb === 0 ? 0 : cov / varb;
  })();
  const corrToBench = pearson(pvReturns, benchReturns);
  const weightedBeta = withWeight.reduce((s, h) => s + (h.value / investedValue) * h.beta, 0);

  // diversification (HHI on invested weights)
  const invWeights = withWeight.map((h) => h.value / investedValue);
  const hhi = invWeights.reduce((s, w) => s + w * w, 0);
  const effHoldings = 1 / hhi;
  const top5Concentration = withWeight
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .reduce((s, h) => s + h.weight, 0);

  // home bias
  const naWeight = withWeight.filter((h) => h.region === "North America").reduce((s, h) => s + h.value, 0) / investedValue * 100;
  const homeBias = naWeight - 63; // vs ~63% global neutral

  // scores
  const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
  // risk score: higher = more risk
  const riskScore = Math.round(
    clamp(volAnnual * 2.6 + Math.abs(maxDD) * 0.9 + top5Concentration * 0.35 + weightedBeta * 12)
  );
  const grades = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "E"];
  const gradeFromScore = (s: number, invert = false) => {
    const v = invert ? 100 - s : s;
    return grades[Math.min(grades.length - 1, Math.floor((100 - v) / 9.1))];
  };
  const dividendYield = withWeight.reduce((s, h) => s + (h.value / investedValue) * h.dividendYield, 0);
  // health score: diversification + risk-adjusted return + drawdown resilience + cash buffer
  const healthScore = Math.round(
    clamp(
      clamp(effHoldings * 4.5, 0, 32) +
        clamp((sharpe + 0.2) * 28, 0, 30) +
        clamp((1 - Math.abs(maxDD) / 45) * 22, 0, 22) +
        clamp(((cash / totalValue) * 100) * 1.6, 0, 8) +
        clamp((1 - Math.abs(homeBias) / 60) * 8, 0, 8)
    )
  );

  // leaders / laggards
  const byDay = [...withWeight].sort((a, b) => b.dayPct - a.dayPct);
  const leaders = byDay.slice(0, 5);
  const laggards = byDay.slice(-5).reverse();

  // top holdings
  const topHoldings = [...withWeight].sort((a, b) => b.value - a.value);

  // correlation matrix (top 12 by weight)
  const corrSet = topHoldings.slice(0, 12);
  const corrReturns = corrSet.map((h) => returns(h.series));
  const corrMatrix = corrSet.map((_, i) => corrSet.map((_, j) => pearson(corrReturns[i], corrReturns[j])));

  // risk vs return bubbles (per holding)
  const bubbles = withWeight.map((h) => {
    const r = returns(h.series);
    const vol = std(r) * Math.sqrt(252) * 100;
    const ann = (Math.pow(h.series[h.series.length - 1] / h.series[0], 252 / Math.max(1, r.length)) - 1) * 100;
    return { symbol: h.symbol, name: h.name, vol, ret: ann, weight: h.weight, accent: h.accent, assetClass: h.assetClass };
  });

  // fund overlap (look-through)
  const directBySymbol = new Map(withWeight.map((h) => [h.symbol, h]));
  const overlap: { ticker: string; name: string; direct: number; viaEtf: number; combined: number; etfSources: string[] }[] = [];
  const lookThrough = new Map<string, { name: string; direct: number; viaEtf: number; etfSources: string[] }>();
  withWeight.forEach((h) => {
    if (h.assetClass !== "ETF") {
      lookThrough.set(h.symbol, { name: h.name, direct: h.value, viaEtf: 0, etfSources: [] });
    }
  });
  const etfHoldings = withWeight.filter((h) => h.assetClass === "ETF");
  etfHoldings.forEach((etf) => {
    etfs
      .filter((c) => c.etfSymbol === etf.symbol)
      .forEach((c) => {
        const contrib = etf.value * (c.weight / 100);
        const cur = lookThrough.get(c.ticker) ?? { name: c.name, direct: 0, viaEtf: 0, etfSources: [] };
        cur.viaEtf += contrib;
        if (!cur.etfSources.includes(etf.symbol)) cur.etfSources.push(etf.symbol);
        lookThrough.set(c.ticker, cur);
      });
  });
  lookThrough.forEach((v, ticker) => {
    if (v.viaEtf > 0 && v.direct > 0) {
      overlap.push({
        ticker,
        name: v.name,
        direct: (v.direct / totalValue) * 100,
        viaEtf: (v.viaEtf / totalValue) * 100,
        combined: ((v.direct + v.viaEtf) / totalValue) * 100,
        etfSources: v.etfSources,
      });
    }
  });
  overlap.sort((a, b) => b.combined - a.combined);
  const overlapTotal = overlap.reduce((s, o) => s + o.viaEtf, 0);

  // events (upcoming first)
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.d >= todayIso)
    .sort((a, b) => a.d.localeCompare(b.d))
    .map((e) => {
      const h = directBySymbol.get(e.symbol);
      return { ...e, name: h?.name ?? e.symbol, accent: h?.accent ?? "#64748b" };
    });

  // news enriched with held tickers
  const heldSet = new Set(withWeight.map((h) => h.symbol));
  const newsEnriched = news
    .map((n) => ({ ...n, held: n.tickers.filter((t) => heldSet.has(t)) }))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  return {
    meta,
    fx,
    cash,
    holdings: withWeight,
    topHoldings,
    series,
    summary: {
      totalValue,
      investedValue,
      cash,
      dayAbs,
      dayPct,
      totalPnl,
      totalPnlPct,
      totalCost,
      holdingsCount: withWeight.length,
      dividendYield,
      annualIncome: withWeight.reduce((s, h) => s + h.value * (h.dividendYield / 100), 0),
    },
    trailing,
    monthly,
    alloc: { byAssetClass, bySector, byRegion, byCurrency },
    risk: {
      volAnnual,
      annualizedReturn,
      sharpe,
      sortino,
      maxDD,
      betaToBench,
      corrToBench,
      weightedBeta,
      effHoldings,
      hhi,
      top5Concentration,
      homeBias,
      naWeight,
      dividendYield,
      riskScore,
      riskGrade: gradeFromScore(riskScore, true),
      healthScore,
      healthGrade: gradeFromScore(healthScore),
    },
    leaders,
    laggards,
    correlation: { labels: corrSet.map((h) => h.symbol), matrix: corrMatrix },
    bubbles,
    overlap: { rows: overlap, total: overlapTotal },
    events: upcoming,
    news: newsEnriched,
  };
});

export type PortfolioData = Awaited<ReturnType<typeof getPortfolio>>;

export const getHolding = cache(async (symbol: string) => {
  const data = await getPortfolio();
  const holding = data.holdings.find((h) => h.symbol.toLowerCase() === symbol.toLowerCase());
  if (!holding) return null;
  const { news, events } = data;
  const relatedNews = news.filter((n) => n.tickers.includes(holding.symbol));
  const relatedEvents = (await loadRaw()).events
    .filter((e) => e.symbol === holding.symbol)
    .sort((a, b) => a.d.localeCompare(b.d));
  return { holding, relatedNews, relatedEvents, data };
});
