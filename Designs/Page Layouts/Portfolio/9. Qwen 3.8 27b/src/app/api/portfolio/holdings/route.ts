import { NextResponse } from "next/server";
import { loadCtx } from "@/lib/market";
import type { HoldingsPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

const ISO_REGION: Record<string, string> = {
  US: "US",
  GB: "Europe",
  NL: "Europe",
  DE: "Europe",
  TW: "Asia",
  JP: "Asia",
  XX: "Global",
};

const REGION_LABELS: Record<string, string> = {
  US: "United States",
  Canada: "Canada",
  LatAm: "Latin America",
  Europe: "Europe",
  Africa: "Africa",
  Asia: "Asia",
  Oceania: "Oceania",
  Global: "Global funds",
};
const REGION_ORDER = ["US", "Canada", "LatAm", "Europe", "Africa", "Asia", "Oceania", "Global"];

export async function GET(req: Request) {
  const ctx = await loadCtx();
  const { rows, total, cash } = ctx;
  const url = new URL(req.url);

  if (url.searchParams.get("lite") === "1") {
    return NextResponse.json(
      rows.map((r) => ({ symbol: r.id, name: r.name, price: r.price, dayChange: r.dayChange, color: r.color }))
    );
  }

  const ribbon: HoldingsPayload["ribbon"] = rows.slice(0, 8).map((r) => ({
    key: r.id,
    label: r.id,
    pct: r.weight * 100,
    color: r.color,
  }));
  const rest = rows.slice(8).reduce((s, r) => s + r.weight, 0) + cash / total;
  if (rest > 0.005) ribbon.push({ key: "OTHER", label: "Cash + rest", pct: rest * 100, color: "#3A444E" });

  const regionTotals: Record<string, number> = {};
  for (const r of rows) {
    const def = ctx.defs.find((d) => d.id === r.id)!;
    const mix = (def.meta as Record<string, unknown>).regionMix as Record<string, number> | undefined;
    if (mix) {
      for (const [k, v] of Object.entries(mix)) regionTotals[k] = (regionTotals[k] ?? 0) + r.weight * v;
    } else {
      const reg = ISO_REGION[r.countryIso] ?? "Other";
      regionTotals[reg] = (regionTotals[reg] ?? 0) + r.weight;
    }
  }
  const regions = REGION_ORDER.map((k) => {
    const pct = (regionTotals[k] ?? 0) * 100;
    return { key: k, label: REGION_LABELS[k], pct, inPortfolio: pct > 0.05 };
  });

  const payload: HoldingsPayload = {
    rows,
    cash: { value: cash, pct: cash / total },
    ribbon,
    regions,
    total,
  };
  return NextResponse.json(payload);
}
