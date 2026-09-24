"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMoney } from "./money";
import { Pill } from "./ui";
import { fmtLocal, longDate, tone } from "@/lib/format";
import { TimeChart } from "./charts/advanced";

type T = { id: number; date: string; kind: string; symbol: string | null; quantity: number; price: number; amount: number; currency: string; usd: number; note: string | null };
export const KIND_COL: Record<string, string> = { BUY: "#2fe39b", SELL: "#ff5a78", DIVIDEND: "#3fd0ff", DEPOSIT: "#d4ff3a", WITHDRAWAL: "#ffb547", FEE: "#ff7ad9", INTEREST: "#8f7cff" };

export function Ledger({ txns }: { txns: T[] }) {
  const { fmt } = useMoney();
  const [kind, setKind] = useState("ALL");
  const [q, setQ] = useState("");
  const [n, setN] = useState(40);
  const kinds = ["ALL", ...Object.keys(KIND_COL)];
  const counts = useMemo(() => Object.fromEntries(kinds.map((k) => [k, k === "ALL" ? txns.length : txns.filter((t) => t.kind === k).length])), [txns]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = txns.filter((t) => (kind === "ALL" || t.kind === kind) && (!q || (t.symbol ?? "").toLowerCase().includes(q.toLowerCase()) || (t.note ?? "").toLowerCase().includes(q.toLowerCase())));
  let lastMonth = "";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <button key={k} onClick={() => { setKind(k); setN(40); }} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition ${kind === k ? "bg-panel2 text-fg ring-1 ring-line2" : "text-muted hover:text-fg"}`}>
            {k !== "ALL" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND_COL[k] }} />}
            {k === "ALL" ? "All" : k[0] + k.slice(1).toLowerCase()} <span className="num text-dim">{counts[k]}</span>
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol or note…" className="ml-auto h-8 w-44 rounded-lg border border-line bg-ink/50 px-3 text-xs outline-none placeholder:text-dim focus:border-line2" />
      </div>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wider text-dim">
              <th className="px-5 pb-2 font-medium">Date</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Instrument</th><th className="pb-2 font-medium">Detail</th>
              <th className="pb-2 text-right font-medium">Amount (local)</th><th className="px-5 pb-2 text-right font-medium">Amount (display)</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, n).map((t) => {
              const m = t.date.slice(0, 7);
              const header = m !== lastMonth;
              lastMonth = m;
              return (
                <FragmentRow key={t.id} header={header ? new Date(t.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : null}>
                  <tr className="border-t border-line/50 transition hover:bg-panel2/50">
                    <td className="num px-5 py-2 text-xs text-muted">{longDate(t.date)}</td>
                    <td><Pill color={KIND_COL[t.kind]}>{t.kind}</Pill></td>
                    <td>{t.symbol ? <Link href={`/portfolio/holdings/${t.symbol}`} className="font-medium hover:text-accent">{t.symbol}</Link> : <span className="text-dim">Cash · {t.currency}</span>}</td>
                    <td className="text-xs text-muted">
                      {t.kind === "BUY" || t.kind === "SELL" ? <span className="num">{t.quantity} @ {fmtLocal(t.price, t.currency)}</span> : t.note}
                    </td>
                    <td className={`num text-right ${tone(t.amount)}`}>{fmtLocal(t.amount, t.currency)}</td>
                    <td className={`num px-5 text-right ${tone(t.usd)}`}>{fmt(t.usd, { sign: true })}</td>
                  </tr>
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > n && (
        <div className="mt-4 flex justify-center">
          <button onClick={() => setN((x) => x + 60)} className="rounded-full border border-line px-4 py-1.5 text-xs text-muted hover:border-accent hover:text-accent">Show more · {rows.length - n} remaining</button>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ header, children }: { header: string | null; children: React.ReactNode }) {
  return (
    <>
      {header && (
        <tr><td colSpan={6} className="px-5 pb-1 pt-4 text-[10.5px] uppercase tracking-[0.14em] text-accent/80">{header}</td></tr>
      )}
      {children}
    </>
  );
}

export function CashChart({ dates, cash, invested }: { dates: string[]; cash: number[]; invested: number[] }) {
  return <TimeChart dates={dates} defaultRange="ALL" height={220} series={[{ key: "c", label: "Cash balance", values: cash, color: "#3fd0ff", kind: "area" }]} extraControls={<span className="text-[11px] text-dim">Net deposits to date: <span className="num text-muted">{Math.round(invested[invested.length - 1]).toLocaleString()} USD</span></span>} />;
}
