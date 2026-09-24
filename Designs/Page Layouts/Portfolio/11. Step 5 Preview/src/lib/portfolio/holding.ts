/**
 * Meridian — single-holding detail
 * Everything the holding page needs, built from the same raw store.
 */
import { cache } from "react";
import { loadRaw, type RawData } from "@/lib/data/repository";
import { buildPortfolioCore, type Pt } from "./engine";
import { enrichEvents, enrichNews } from "./index";
import { returnsFrom, trailingReturn } from "./metrics";

export interface HoldingDetail {
  symbol: string;
  holding: NonNullable<ReturnType<typeof findHolding>>;
  series: Pt[];
  localSeries: number[];
  bench: Pt[];
  peers: {
    symbol: string;
    name: string;
    ret1y: number;
    pe: number;
    weight: number;
    held: boolean;
  }[];
  lots: { date: string; side: string; shares: number; price: number; amount: number }[];
  events: ReturnType<typeof enrichEvents>;
  news: ReturnType<typeof enrichNews>;
  dividends: { date: string; amount: number }[];
  stats: {
    vol: number;
    sharpe: number;
    maxDd: number;
    bestDay: number;
    worstDay: number;
    corrPort: number;
    corrBench: number;
    betaPort: number;
    drawdown: Pt[];
    monthly: { month: string; value: number }[];
  };
  monthlyContribution: { month: string; value: number }[];
  fundConstituents: { symbol: string; name: string; weight: number; held: boolean }[];
  heldBy: { fund: string; weight: number }[];
}

function findHolding(core: ReturnType<typeof buildPortfolioCore> extends Promise<infer T> ? T : never, symbol: string) {
  return core.holdings.find((h) => h.symbol === symbol);
}

function corrOf(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 10) return 0;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

export const getHoldingDetail = cache(
  async (symbol: string, base = "USD"): Promise<HoldingDetail | null> => {
    const raw = await loadRaw();
    const core = await buildPortfolioCore(base, raw);
    const holding = core.holdings.find((h) => h.symbol === symbol);
    if (!holding) return null;

    const inst = raw.instruments.find((i) => i.symbol === symbol)!;
    const priceRows = raw.prices.filter((p) => p.symbol === symbol).sort((a, b) => a.date.localeCompare(b.date));
    const localMap = new Map(priceRows.map((p) => [p.date, p.close]));
    const localSeries: number[] = [];
    let lastLocal = priceRows[priceRows.length - 1]?.close ?? 0;
    for (const d of core.dates) {
      const v = localMap.get(d);
      if (v !== undefined) lastLocal = v;
      localSeries.push(lastLocal);
    }

    const series: Pt[] = core.dates.map((d, i) => ({ d, v: holding.usdSeries[i] }));

    const benchMap = new Map(
      raw.benchmarks.filter((b) => b.symbol === "SPX").map((b) => [b.date, b.close]),
    );
    const benchFull: number[] = [];
    let lastBench = 0;
    for (const d of core.dates) {
      const v = benchMap.get(d);
      if (v !== undefined) lastBench = v;
      benchFull.push(lastBench);
    }
    const b0 = benchFull[0] || 1;
    const bench = benchFull.map((v, i) => ({ d: core.dates[i], v: (v / b0) * 100 }));

    const rets = returnsFrom(holding.usdSeries);
    const benchRets = returnsFrom(benchFull);

    const peers = raw.instruments
      .filter((i) => i.symbol !== symbol && i.sector === inst.sector && i.assetClass === "Equity")
      .slice(0, 6)
      .map((p) => {
        const vals = raw.prices
          .filter((x) => x.symbol === p.symbol)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((r) => r.close);
        const h = core.holdings.find((x) => x.symbol === p.symbol);
        return {
          symbol: p.symbol,
          name: p.name,
          ret1y: trailingReturn(vals, 252),
          pe: p.pe,
          weight: h?.weight ?? 0,
          held: !!h,
        };
      });

    const lots = raw.transactions
      .filter((t) => t.symbol === symbol && (t.side === "buy" || t.side === "sell"))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => ({ date: t.date, side: t.side, shares: t.shares, price: t.price, amount: t.amount }));

    const dividends = raw.transactions
      .filter((t) => t.symbol === symbol && t.side === "dividend")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => ({ date: t.date, amount: t.amount }));

    const dd: Pt[] = [];
    let peak = holding.usdSeries[0];
    for (let i = 0; i < holding.usdSeries.length; i++) {
      if (holding.usdSeries[i] > peak) peak = holding.usdSeries[i];
      dd.push({ d: core.dates[i], v: (holding.usdSeries[i] / peak - 1) * 100 });
    }

    const monthMap = new Map<string, { prev: number; last: number }>();
    for (let i = 0; i < series.length; i++) {
      const key = series[i].d.slice(0, 7);
      const prev = i === 0 ? series[i].v : series[i - 1].v;
      if (!monthMap.has(key)) monthMap.set(key, { prev, last: series[i].v });
      monthMap.get(key)!.last = series[i].v;
    }
    const monthly = [...monthMap.entries()].map(([month, v]) => ({ month, value: (v.last / v.prev - 1) * 100 }));

    const contribMap = new Map<string, number>();
    for (const t of raw.transactions) {
      if (t.symbol !== symbol) continue;
      const key = t.date.slice(0, 7);
      contribMap.set(key, (contribMap.get(key) ?? 0) + Math.abs(t.amount));
    }
    const monthlyContribution = [...contribMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ month, value }));

    // if this line is a fund, show its constituents; if it is a constituent,
    // show the funds that hold it (the cross-reference layer)
    const fundConstituents = raw.fundHoldings
      .filter((f) => f.fundSymbol === symbol)
      .map((f) => ({
        symbol: f.constituentSymbol,
        name: raw.instruments.find((i) => i.symbol === f.constituentSymbol)?.name ?? f.constituentSymbol,
        weight: f.weight,
        held: core.holdings.some((h) => h.symbol === f.constituentSymbol),
      }))
      .sort((a, b) => b.weight - a.weight);

    const heldBy = raw.fundHoldings
      .filter((f) => f.constituentSymbol === symbol)
      .map((f) => ({
        fund: f.fundSymbol,
        weight: (core.holdings.find((h) => h.symbol === f.fundSymbol)?.weight ?? 0) * (f.weight / 100),
      }))
      .filter((f) => f.weight > 0)
      .sort((a, b) => b.weight - a.weight);

    return {
      symbol,
      holding,
      series,
      localSeries,
      bench,
      peers,
      lots,
      events: enrichEvents(raw, core).filter((e) => e.symbol === symbol),
      news: enrichNews(raw, core).filter((n) => n.symbols.includes(symbol)),
      dividends,
      stats: {
        vol: holding.vol,
        sharpe: holding.sharpe,
        maxDd: holding.maxDd,
        bestDay: Math.max(...rets) * 100,
        worstDay: Math.min(...rets) * 100,
        corrPort: holding.corr,
        corrBench: corrOf(rets, benchRets),
        betaPort: holding.beta,
        drawdown: dd,
        monthly,
      },
      monthlyContribution,
      fundConstituents,
      heldBy,
    };
  },
);
