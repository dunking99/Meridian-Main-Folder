import type { ReactNode } from "react";
import { CurrencyProvider } from "@/components/portfolio/CurrencyContext";
import SubNav from "@/components/portfolio/SubNav";
import TickerTape from "@/components/portfolio/TickerTape";
import { CurrencySwitch } from "@/components/portfolio/CurrencyContext";

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <CurrencyProvider>
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-24 lg:pt-0">
        <SubNav />
        <div className="mt-3 flex justify-end">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.16em] text-tx-3 hidden sm:inline">Display</span>
            <CurrencySwitch />
          </div>
        </div>
        <TickerTape />
        <div className="mt-6">{children}</div>
      </div>
    </CurrencyProvider>
  );
}
