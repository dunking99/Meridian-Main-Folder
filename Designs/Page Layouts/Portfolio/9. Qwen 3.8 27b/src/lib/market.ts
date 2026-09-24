import "server-only";
import { db } from "@/db";
import {
  holdings as holdingsT,
  pricesDaily,
  snapshots,
  newsItems,
  events,
  type Holding,
} from "@/db/schema";
import { asc } from "drizzle-orm";
import { CLASS_COLORS, holdingColor } from "./format";
import type { HoldingRow, EventOut, NewsOut } from "./types";

export type Ctx = {
  defs: Holding[];
  prices: Record<string, number[]>;
  dates: string[];
  snaps: { t: string; v: number; b: number; cash: number }[];
  rows: HoldingRow[]; // sorted by weight desc, colors assigned
  total: number;
  cash: number;
};

export async function loadCtx(): Promise<Ctx> {
  const [hs, ps, ss] = await Promise.all([
    db.select().from(holdingsT),
    db.select().from(pricesDaily).orderBy(asc(pricesDaily.symbol), asc(pricesDaily.date)),
    db.select().from(snapshots).orderBy(asc(snapshots.date)),
  ]);

  const prices: Record<string, number[]> = {};
  for (const r of ps) (prices[r.symbol] ??= []).push(r.close);

  const dates = ss.map((s) => s.date);
  const snaps = ss.map((s) => ({ t: s.date, v: s.value, b: s.benchmark, cash: s.cash }));
  const cash = snaps[ss.length - 1]?.cash ?? 0;

  const raw: HoldingRow[] = hs.map((h) => {
    const p = prices[h.id] ?? [1];
    const last = p[p.length - 1];
    const prev = p[p.length - 2] ?? last;
    const p22 = p[p.length - 22] ?? last;
    const value = h.quantity * last;
    const cost = h.quantity * h.avgCost;
    const sparkRaw = p.slice(-60);
    const mn = Math.min(...sparkRaw), mx = Math.max(...sparkRaw);
    return {
      id: h.id,
      name: h.name,
      assetClass: h.assetClass,
      sector: h.sector,
      country: h.country,
      countryIso: h.countryIso,
      currency: h.currency,
      quantity: h.quantity,
      avgCost: h.avgCost,
      price: last,
      dayChange: last / prev - 1,
      ret1M: last / p22 - 1,
      value,
      weight: 0,
      pl: value - cost,
      plPct: value / cost - 1,
      color: "",
      spark: sparkRaw.map((x) => (mx > mn ? ((x - mn) / (mx - mn)) * 100 : 50)),
      pe: (h.meta as Record<string, unknown>).pe as number | undefined,
      divYield: (h.meta as Record<string, unknown>).divYield as number | undefined,
      mcapB: (h.meta as Record<string, unknown>).mcapB as number | undefined,
    };
  });

  const invested = raw.reduce((s, r) => s + r.value, 0);
  const total = invested + cash;
  for (const r of raw) r.weight = r.value / total;
  raw.sort((a, b) => b.value - a.value);
  raw.forEach((r, i) => (r.color = holdingColor(i)));

  return { defs: hs, prices, dates, snaps, rows: raw, total, cash };
}

export function bookSymbolSet(ctx: Ctx): Set<string> {
  return new Set(ctx.rows.map((r) => r.id));
}

export async function newsOut(limit = 6): Promise<NewsOut[]> {
  const ns = await db.select().from(newsItems).orderBy(asc(newsItems.publishedAt));
  const now = Date.now();
  return ns
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit)
    .map((n) => ({
      id: n.id,
      title: n.title,
      source: n.source,
      hoursAgo: (now - n.publishedAt.getTime()) / 3600e3,
      summary: n.summary,
      symbols: n.symbols ?? [],
      sentiment: n.sentiment,
      impact: n.impact,
    }));
}

export async function eventsOut(limit = 8): Promise<EventOut[]> {
  const evs = await db.select().from(events).orderBy(asc(events.date));
  const now = Date.now();
  return evs
    .filter((e) => e.date.getTime() > now - 86400e3)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit)
    .map((e) => ({
      symbol: e.symbol,
      title: e.title,
      type: e.eventType,
      dateISO: e.date.toISOString(),
      inDays: Math.max(0, Math.round((e.date.getTime() - now) / 86400e3)),
      importance: e.importance,
    }));
}

export function classColor(cls: string): string {
  return CLASS_COLORS[cls] ?? "#7B8794";
}
