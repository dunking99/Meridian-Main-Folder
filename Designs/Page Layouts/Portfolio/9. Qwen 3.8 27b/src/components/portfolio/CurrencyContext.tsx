"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { CCYS, fmtMoney } from "@/lib/format";
import type { Ccy } from "@/lib/types";

type Ctx = {
  ccy: Ccy;
  set: (c: Ccy) => void;
  money: (usd: number, compact?: boolean) => string;
};

const CurrencyContext = createContext<Ctx>({
  ccy: "USD",
  set: () => {},
  money: (v, c) => fmtMoney(v, "USD", c),
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [ccy, setCcy] = useState<Ccy>("USD");
  useEffect(() => {
    const s = localStorage.getItem("meridian-ccy");
    if (s && CCYS.includes(s as Ccy)) setCcy(s as Ccy);
  }, []);
  const set = (c: Ccy) => {
    setCcy(c);
    localStorage.setItem("meridian-ccy", c);
  };
  const money = (usd: number, compact = false) => fmtMoney(usd, ccy, compact);
  return <CurrencyContext.Provider value={{ ccy, set, money }}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);

export function CurrencySwitch() {
  const { ccy, set } = useCurrency();
  const shown = CCYS.slice(0, 5);
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-ink-900/70 p-0.5">
      {shown.map((c) => (
        <button key={c} onClick={() => set(c)} className={`seg ${ccy === c ? "seg-on" : ""}`} aria-pressed={ccy === c}>
          {c}
        </button>
      ))}
    </div>
  );
}
