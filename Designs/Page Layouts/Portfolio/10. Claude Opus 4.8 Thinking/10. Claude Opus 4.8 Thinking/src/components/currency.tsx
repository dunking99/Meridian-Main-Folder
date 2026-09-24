"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fmtCompact } from "@/lib/format";

export type Rate = { currency: string; symbol: string; perUsd: number };

type Ctx = {
  currency: string;
  setCurrency: (c: string) => void;
  rates: Rate[];
  rate: Rate;
};

const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ rates, children }: { rates: Rate[]; children: ReactNode }) {
  const [currency, setCurrency] = useState("USD");
  useEffect(() => {
    const saved = localStorage.getItem("meridian.currency");
    if (saved && rates.some((r) => r.currency === saved)) setCurrency(saved);
  }, [rates]);
  const set = (c: string) => {
    setCurrency(c);
    localStorage.setItem("meridian.currency", c);
  };
  const rate = rates.find((r) => r.currency === currency) ?? rates[0] ?? { currency: "USD", symbol: "$", perUsd: 1 };
  return <CurrencyContext.Provider value={{ currency, setCurrency: set, rates, rate }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}

export function Money({
  value,
  compact,
  decimals = 0,
  sign,
  className,
}: {
  value: number;
  compact?: boolean;
  decimals?: number;
  sign?: boolean;
  className?: string;
}) {
  const { rate } = useCurrency();
  const v = value * rate.perUsd;
  const prefix = sign ? (v >= 0 ? "+" : "−") : v < 0 ? "−" : "";
  const abs = Math.abs(v);
  const body = compact
    ? fmtCompact(abs, abs >= 1e6 ? 2 : 1)
    : abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span className={className}>
      {prefix}
      {rate.symbol}
      {body}
    </span>
  );
}

export function CurrencySwitch() {
  const { currency, setCurrency, rates } = useCurrency();
  return (
    <div className="inline-flex items-center rounded-lg border border-line bg-panel p-0.5 text-xs">
      {rates.map((r) => (
        <button
          key={r.currency}
          onClick={() => setCurrency(r.currency)}
          className={`rounded-md px-2 py-1 font-medium transition ${
            currency === r.currency ? "bg-[#1b2432] text-ink" : "text-ink-faint hover:text-ink-dim"
          }`}
        >
          {r.currency}
        </button>
      ))}
    </div>
  );
}
