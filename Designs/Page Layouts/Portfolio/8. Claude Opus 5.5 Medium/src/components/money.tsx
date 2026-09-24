"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, DISPLAY_CCYS, tone } from "@/lib/format";

type Ctx = { ccy: string; rate: number };
const MoneyCtx = createContext<Ctx>({ ccy: "USD", rate: 1 });

export function CurrencyProvider({ ccy, rate, children }: Ctx & { children: React.ReactNode }) {
  return <MoneyCtx.Provider value={{ ccy, rate }}>{children}</MoneyCtx.Provider>;
}

export function useMoney() {
  const { ccy, rate } = useContext(MoneyCtx);
  return {
    ccy,
    rate,
    fmt: (usd: number, opts: { compact?: boolean; sign?: boolean; digits?: number } = {}) => fmtMoney(usd * rate, ccy, opts),
  };
}

export function Money({ usd, compact, sign, digits, colored, className = "" }: { usd: number; compact?: boolean; sign?: boolean; digits?: number; colored?: boolean; className?: string }) {
  const { fmt } = useMoney();
  return <span className={`num ${colored ? tone(usd) : ""} ${className}`}>{fmt(usd, { compact, sign, digits })}</span>;
}

export function CurrencySwitch() {
  const { ccy } = useContext(MoneyCtx);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={`flex items-center rounded-full border border-line bg-panel p-0.5 text-[11px] ${pending ? "opacity-60" : ""}`}>
      {DISPLAY_CCYS.map((c) => (
        <button
          key={c}
          onClick={() => {
            document.cookie = `ccy=${c};path=/;max-age=31536000`;
            start(() => router.refresh());
          }}
          className={`num rounded-full px-2.5 py-1 transition ${c === ccy ? "bg-accent text-ink font-semibold" : "text-muted hover:text-fg"}`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
