/**
 * Meridian — portfolio façade
 * One cached call gives a page everything it needs.
 */
import { cache } from "react";
import { loadRaw, type RawData } from "@/lib/data/repository";
import { buildPortfolioCore, type HoldingView, type PortfolioCore } from "./engine";
import { buildAnalytics, type Analytics, type Scenario } from "./analytics";
import {
  buildHealth,
  buildInsights,
  buildPulse,
  buildRisk,
  buildScorecard,
  type Health,
  type Insight,
  type PulseItem,
  type RiskProfile,
  type Scorecard,
} from "./scorecard";

export interface EnrichedEvent {
  id: number;
  symbol: string;
  name: string;
  kind: string;
  date: string;
  title: string;
  detail: string;
  estimate: string;
  daysUntil: number;
  weight: number;
  past: boolean;
}

export interface EnrichedNews {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  sentiment: number;
  importance: number;
  symbols: string[];
  exposure: number;
  heldSymbols: string[];
}

export interface ActivityRow {
  id: number;
  date: string;
  symbol: string | null;
  name: string;
  side: string;
  shares: number;
  price: number;
  amount: number;
  fee: number;
  note: string;
  accountId: string;
  realized: number | null;
}

export interface Activity {
  rows: ActivityRow[];
  summary: {
    deposits: number;
    withdrawals: number;
    bought: number;
    sold: number;
    dividends: number;
    fees: number;
    realized: number;
    trades: number;
    firstDate: string;
    lastDate: string;
  };
  byMonth: { month: string; buy: number; sell: number; dividend: number }[];
  bySide: { side: string; count: number; amount: number }[];
}

export interface Portfolio extends PortfolioCore, Analytics {
  scorecard: Scorecard;
  risk: RiskProfile;
  health: Health;
  insights: Insight[];
  pulse: PulseItem[];
  events: EnrichedEvent[];
  news: EnrichedNews[];
  activity: Activity;
  asOf: string;
  grand: number;
  dayChange: number;
  dayChangePct: number;
  totalPnl: number;
  totalPnlPct: number;
  scenario: Scenario;
  base: string;
  fxRate: number;
}

export function enrichEvents(raw: RawData, core: PortfolioCore): EnrichedEvent[] {
  const asOf = core.dates[core.dates.length - 1];
  const weightOf = (s: string) => core.holdings.find((h) => h.symbol === s)?.weight ?? 0;
  return raw.events
    .map((e) => {
      const inst = raw.instruments.find((i) => i.symbol === e.symbol);
      const days = Math.round(
        (new Date(`${e.date}T00:00:00Z`).getTime() - new Date(`${asOf}T00:00:00Z`).getTime()) / 86400000,
      );
      return {
        id: e.id,
        symbol: e.symbol,
        name: inst?.name ?? e.symbol,
        kind: e.kind,
        date: e.date,
        title: e.title,
        detail: e.detail,
        estimate: e.estimate,
        daysUntil: days,
        weight: weightOf(e.symbol),
        past: days < 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function enrichNews(raw: RawData, core: PortfolioCore): EnrichedNews[] {
  const held = new Map(core.holdings.map((h) => [h.symbol, h]));
  return raw.news
    .map((n) => {
      const heldSymbols = n.symbols.filter((s) => held.has(s));
      const exposure = heldSymbols.reduce((s, sym) => s + (held.get(sym)?.weight ?? 0), 0);
      return {
        id: n.id,
        headline: n.headline,
        summary: n.summary,
        source: n.source,
        url: n.url,
        publishedAt: n.publishedAt.toISOString(),
        category: n.category,
        sentiment: n.sentiment,
        importance: n.importance,
        symbols: n.symbols,
        exposure,
        heldSymbols,
      };
    })
    .sort((a, b) => b.exposure + b.importance * 4 - (a.exposure + a.importance * 4));
}

function buildActivity(raw: RawData, core: PortfolioCore): Activity {
  const nameOf = (s: string | null) =>
    (s ? raw.instruments.find((i) => i.symbol === s)?.name : null) ?? "Cash";
  const rows: ActivityRow[] = [...raw.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => {
      let realized: number | null = null;
      if (t.side === "sell" && t.symbol) {
        const avgCost = core.holdings.find((h) => h.symbol === t.symbol)?.avgCost ?? 0;
        realized = t.amount - t.fee - avgCost * t.shares;
      }
      return {
        id: t.id,
        date: t.date,
        symbol: t.symbol,
        name: nameOf(t.symbol),
        side: t.side,
        shares: t.shares,
        price: t.price,
        amount: t.amount,
        fee: t.fee,
        note: t.note,
        accountId: t.accountId,
        realized,
      };
    });

  const sum = (side: string) =>
    rows.filter((r) => r.side === side).reduce((s, r) => s + Math.abs(r.amount), 0);
  const byMonthMap = new Map<string, { buy: number; sell: number; dividend: number }>();
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const e = byMonthMap.get(key) ?? { buy: 0, sell: 0, dividend: 0 };
    if (r.side === "buy") e.buy += Math.abs(r.amount);
    if (r.side === "sell") e.sell += Math.abs(r.amount);
    if (r.side === "dividend") e.dividend += r.amount;
    byMonthMap.set(key, e);
  }

  return {
    rows,
    summary: {
      deposits: sum("deposit"),
      withdrawals: sum("withdrawal"),
      bought: sum("buy"),
      sold: sum("sell"),
      dividends: sum("dividend"),
      fees: sum("fee"),
      realized: rows.reduce((s, r) => s + (r.realized ?? 0), 0),
      trades: rows.filter((r) => r.side === "buy" || r.side === "sell").length,
      firstDate: rows.length ? rows[rows.length - 1].date : "",
      lastDate: rows.length ? rows[0].date : "",
    },
    byMonth: [...byMonthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v })),
    bySide: (["buy", "sell", "dividend", "deposit", "fee"] as const)
      .map((side) => ({ side, count: rows.filter((r) => r.side === side).length, amount: sum(side) }))
      .filter((x) => x.count > 0),
  };
}

export const getPortfolio = cache(async (base = "USD"): Promise<Portfolio> => {
  const raw = await loadRaw();
  const core = await buildPortfolioCore(base, raw);
  const a = buildAnalytics(core, raw);
  const scorecard = buildScorecard(core, a);
  const risk = buildRisk(core, a);
  const health = buildHealth(core, a);
  const insights = buildInsights(core, a, raw);
  const pulse = buildPulse(core, a);
  const events = enrichEvents(raw, core);
  const news = enrichNews(raw, core);
  const activity = buildActivity(raw, core);

  const last = core.totalValue.length - 1;
  const grand = core.holdings.reduce((s, h) => s + h.value, 0) + core.cash[last];
  const dayChange = core.totalValue[last] - core.totalValue[last - 1];
  const netContrib = core.contributions[last];

  return {
    ...core,
    ...a,
    scorecard,
    risk,
    health,
    insights,
    pulse,
    events,
    news,
    activity,
    asOf: core.dates[last],
    grand,
    dayChange,
    dayChangePct: core.totalValue[last - 1] ? (dayChange / core.totalValue[last - 1]) * 100 : 0,
    totalPnl: core.totalValue[last] - netContrib,
    totalPnlPct: netContrib ? (core.totalValue[last] / netContrib - 1) * 100 : 0,
    scenario: a.scenarios[0],
    base,
    fxRate: core.fxRate,
  };
});

export type { HoldingView, PortfolioCore };
