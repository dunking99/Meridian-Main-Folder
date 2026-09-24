import type { ReactNode } from "react";
import { getPortfolio } from "@/lib/engine";
import { PortfolioHeader, PortfolioTabs, TickerTape } from "@/components/portfolio-header";

export default async function PortfolioLayout({ children }: { children: ReactNode }) {
  const p = await getPortfolio();
  const ticks = p.holdings.map((h) => ({ symbol: h.symbol, price: h.price, dayPct: h.dayPct }));
  return (
    <div className="mx-auto max-w-[1480px]">
      <TickerTape ticks={ticks} />
      <PortfolioHeader totals={p.totals} spark={p.series.value.slice(-90)} health={p.health} risk={p.risk} />
      <PortfolioTabs counts={{ Holdings: String(p.holdings.length), Activity: String(p.txns.length) }} />
      {children}
    </div>
  );
}
