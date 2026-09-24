import { NextResponse } from "next/server";
import { db } from "@/db";
import { newsItems } from "@/db/schema";
import { asc } from "drizzle-orm";
import { loadCtx } from "@/lib/market";
import {
  returnsFromSeries,
  annVol,
  betaTo,
  pearson,
  trailing,
} from "@/lib/stats";
import type { HoldingDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctxP: { params: Promise<{ id: string }> }) {
  const { id } = await ctxP.params;
  const ctx = await loadCtx();
  const row = ctx.rows.find((r) => r.id === id);
  const def = ctx.defs.find((d) => d.id === id);
  if (!row || !def) {
    return NextResponse.json({ error: "Holding not found" }, { status: 404 });
  }

  const p = ctx.prices[id];
  const spx = ctx.prices["SPX"] ?? [];
  const series = ctx.dates.map((t, i) => ({ t, close: p[i], bench: spx[i] }));

  const last252 = p.slice(-252);
  const r252 = returnsFromSeries(last252);
  const s252 = returnsFromSeries(spx.slice(-252));
  const port252 = returnsFromSeries(ctx.snaps.map((s) => s.v).slice(-252));
  const hi52 = Math.max(...last252);
  const lo52 = Math.min(...last252);

  const totalPl = ctx.rows.reduce((s, r) => s + r.pl, 0);

  const fundsHolding = ctx.rows
    .filter((r) => r.assetClass === "etf")
    .map((r) => {
      const d = ctx.defs.find((x) => x.id === r.id)!;
      return { r, top: (d.topHoldings ?? []) as string[] };
    })
    .filter(({ top }) => top.includes(id))
    .map(({ r }) => ({ id: r.id, name: r.name, sharedWeight: r.weight }));

  const ns = (await db.select().from(newsItems).orderBy(asc(newsItems.publishedAt)))
    .filter((n) => (n.symbols ?? []).includes(id))
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 4);
  const now = Date.now();

  const payload: HoldingDetail = {
    holding: {
      ...row,
      description: def.description,
      pe: (def.meta as Record<string, unknown>).pe as number | undefined,
      divYield: (def.meta as Record<string, unknown>).divYield as number | undefined,
      mcapB: (def.meta as Record<string, unknown>).mcapB as number | undefined,
    },
    series,
    stats: {
      ret1M: trailing(p, 21),
      ret3M: trailing(p, 63),
      ret6M: trailing(p, 126),
      ret1Y: trailing(p, 252),
      vol52w: annVol(r252),
      beta: betaTo(r252, s252),
      corrToBook: pearson(r252, port252),
      hi52,
      lo52,
      posIn52: (row.price - lo52) / (hi52 - lo52 || 1),
    },
    position: {
      quantity: row.quantity,
      avgCost: row.avgCost,
      value: row.value,
      weight: row.weight,
      pl: row.pl,
      plPct: row.plPct,
      cost: row.quantity * row.avgCost,
      contributionPct: totalPl ? (row.pl / totalPl) * 100 : 0,
    },
    fundsHolding,
    news: ns.map((n) => ({
      id: n.id,
      title: n.title,
      source: n.source,
      hoursAgo: (now - n.publishedAt.getTime()) / 3600e3,
      summary: n.summary,
      symbols: n.symbols ?? [],
      sentiment: n.sentiment,
      impact: n.impact,
    })),
    weightVsBook: { holding: row.weight, rest: 1 - row.weight },
  };
  return NextResponse.json(payload);
}
