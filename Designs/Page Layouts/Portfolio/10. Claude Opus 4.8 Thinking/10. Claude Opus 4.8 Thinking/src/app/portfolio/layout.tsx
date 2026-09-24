import type { ReactNode } from "react";
import { getPortfolio } from "@/lib/portfolio";
import { CurrencyProvider, CurrencySwitch, Money } from "@/components/currency";
import { SubNav } from "@/components/nav";
import { DeltaPill } from "@/components/ui";
import { fmtDateFull } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortfolioLayout({ children }: { children: ReactNode }) {
  const data = await getPortfolio();
  const { summary, meta } = data;
  const rates = data.fx.map((f) => ({ currency: f.currency, symbol: f.symbol, perUsd: f.perUsd }));

  return (
    <CurrencyProvider rates={rates}>
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5 lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ink-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Portfolio
            </div>
            <h1 className="mt-1 font-serif text-3xl leading-none text-ink">{meta.name}</h1>
            <p className="mt-1.5 text-xs text-ink-dim">
              {summary.holdingsCount} holdings · since {fmtDateFull(meta.inceptionDate)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <CurrencySwitch />
            <div className="flex items-end gap-3">
              <Money value={summary.totalValue} decimals={2} className="tabnum text-3xl font-semibold text-ink" />
              <div className="pb-1">
                <DeltaPill pct={summary.dayPct} />
                <div className="tabnum mt-0.5 text-right text-[11px] text-ink-dim">
                  <Money value={summary.dayAbs} sign decimals={0} /> today
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 pb-1 pt-3 lg:px-6">
          <SubNav />
        </div>
      </header>
      <div className="px-5 py-6 lg:px-8">{children}</div>
    </CurrencyProvider>
  );
}
