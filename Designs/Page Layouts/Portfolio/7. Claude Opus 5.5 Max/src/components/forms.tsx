"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { addTransaction, deleteTransaction, saveNote, type ActionState } from "@/lib/actions";
import { fmtDate, fmtMoney, fmtPct, fmtPrice, fmtQty } from "@/lib/format";
import { ACCOUNTS, type Ccy } from "@/lib/reference";
import { Seg } from "./client";

const input = "mt-1.5 w-full rounded-lg bg-white/[0.04] px-3 py-2 text-[12.5px] text-mist-100 outline-none ring-1 ring-inset ring-white/[0.08] placeholder:text-mist-500 focus:ring-gold-400/40";
const goldBtn = "rounded-lg bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2 text-[12px] font-medium text-ink-950 shadow-[0_6px_20px_-8px_rgba(245,189,98,.9)] transition hover:brightness-110 disabled:opacity-60";

export function NoteEditor({ symbol, price, priceCcy, initial }: {
  symbol: string; price: number; priceCcy: string;
  initial: { thesis: string; conviction: number; targetPrice: number | null; reviewDate: string | null; updatedAt: string | null } | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveNote.bind(null, symbol), null);
  const [conv, setConv] = useState(initial?.conviction ?? 3);
  const [target, setTarget] = useState(initial?.targetPrice ? String(initial.targetPrice) : "");
  const upside = Number(target) > 0 ? Number(target) / price - 1 : null;
  return (
    <form action={action} className="space-y-4">
      <textarea name="thesis" defaultValue={initial?.thesis ?? ""} rows={5} placeholder="Why do you own this? What has to be true? What would make you sell?" className={`${input} resize-none leading-relaxed`} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <div className="label">Conviction</div>
          <input type="hidden" name="conviction" value={conv} />
          <div className="mt-2.5 flex gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" onClick={() => setConv(i)} aria-label={`Conviction ${i}`} className={`h-5 w-5 rotate-45 rounded-[3px] transition-all ${i <= conv ? "bg-gold-400 shadow-[0_0_10px_rgba(245,189,98,.6)]" : "bg-white/[0.07] hover:bg-white/15"}`} />
            ))}
          </div>
        </div>
        <label className="block">
          <span className="label">Target ({priceCcy})</span>
          <input name="targetPrice" type="number" step="any" min="0" value={target} onChange={(e) => setTarget(e.target.value)} className={input} placeholder="—" />
          {upside !== null && <span className={`num mt-1 block text-[11px] ${upside >= 0 ? "text-up" : "text-down"}`}>{fmtPct(upside, 1)} vs {fmtPrice(price, priceCcy)}</span>}
        </label>
        <label className="block">
          <span className="label">Review on</span>
          <input name="reviewDate" type="date" defaultValue={initial?.reviewDate ?? ""} className={input} />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[11px] ${state?.ok ? "text-up" : state ? "text-down" : "text-mist-500"}`}>
          {state?.message ?? (initial?.updatedAt ? `Last edited ${fmtDate(initial.updatedAt.slice(0, 10), "medium")}` : "No thesis yet — write one.")}
        </span>
        <button disabled={pending} className={goldBtn}>{pending ? "Saving…" : "Save thesis"}</button>
      </div>
    </form>
  );
}

const TX_TYPES = ["BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND"] as const;
export function TransactionForm({ instruments, lastDate, prices }: { instruments: { symbol: string; name: string; currency: string; account: string }[]; lastDate: string; prices: Record<string, number> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addTransaction, null);
  const [ti, setTi] = useState(0);
  const [sym, setSym] = useState(instruments[0]?.symbol ?? "");
  const [price, setPrice] = useState(String(prices[instruments[0]?.symbol ?? ""] ?? ""));
  const [qty, setQty] = useState("");
  const type = TX_TYPES[ti];
  const inst = instruments.find((i) => i.symbol === sym);
  const trade = type === "BUY" || type === "SELL";
  const gross = Number(qty) * Number(price);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={type} />
      <Seg options={TX_TYPES.map((t) => t.charAt(0) + t.slice(1).toLowerCase())} value={ti} onChange={setTi} className="flex w-full [&>button]:flex-1" />
      {(trade || type === "DIVIDEND") && (
        <label className="block">
          <span className="label">Security</span>
          <select
            name="symbol"
            value={sym}
            onChange={(e) => { setSym(e.target.value); setPrice(String(prices[e.target.value] ?? "")); }}
            className={input}
          >
            {instruments.map((i) => <option key={i.symbol} value={i.symbol} className="bg-ink-900">{i.symbol} — {i.name}</option>)}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="label">Date</span><input name="date" type="date" defaultValue={lastDate} max={lastDate} min="2021-01-04" className={input} /></label>
        <label className="block">
          <span className="label">Account</span>
          <select name="account" defaultValue={inst?.account ?? "brokerage"} key={sym + type} className={input}>
            {Object.entries(ACCOUNTS).map(([k, v]) => <option key={k} value={k} className="bg-ink-900">{v.label}</option>)}
          </select>
        </label>
      </div>
      {trade ? (
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="label">Quantity</span><input name="quantity" type="number" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={input} placeholder="0" /></label>
          <label className="block"><span className="label">Price ({inst?.currency})</span><input name="price" type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={input} /></label>
          <label className="block"><span className="label">Fee (USD)</span><input name="fee" type="number" step="any" min="0" defaultValue="0" className={input} /></label>
        </div>
      ) : (
        <label className="block"><span className="label">Amount (USD)</span><input name="amount" type="number" step="any" min="0" className={input} placeholder="0.00" /></label>
      )}
      <label className="block"><span className="label">Note</span><input name="note" className={input} placeholder="Optional" maxLength={200} /></label>
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <span className="text-[11px] text-mist-500">
          {trade && gross > 0 ? <>Gross <span className="num text-mist-200">{fmtPrice(gross, inst?.currency ?? "USD")}</span> · FX at that day&apos;s close</> : "Cash moves are recorded in USD"}
        </span>
        <button disabled={pending} className={goldBtn}>{pending ? "Recording…" : "Record"}</button>
      </div>
      {state && <div className={`rounded-lg px-3 py-2 text-[12px] ring-1 ring-inset ${state.ok ? "bg-up/10 text-up ring-up/20" : "bg-down/10 text-down ring-down/20"}`}>{state.message}</div>}
    </form>
  );
}

export type LedgerRow = { id: number; date: string; type: string; symbol: string | null; account: string; quantity: number; price: number; amountDisp: number; fee: number; note: string | null; source: string; currency: string };
const TYPE_TONE: Record<string, string> = { BUY: "text-sky bg-sky/10", SELL: "text-violet bg-violet/10", DIVIDEND: "text-up bg-up/10", INTEREST: "text-up bg-up/10", DEPOSIT: "text-gold-300 bg-gold-400/10", WITHDRAWAL: "text-down bg-down/10", FEE: "text-down bg-down/10" };

export function Ledger({ rows, ccy }: { rows: LedgerRow[]; ccy: Ccy }) {
  const [ti, setTi] = useState(0);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [pending, start] = useTransition();
  const types = ["All", "Trades", "Income", "Cash", "Manual"];
  const filtered = useMemo(() => rows.filter((r) => {
    const t = types[ti];
    if (t === "Trades" && r.type !== "BUY" && r.type !== "SELL") return false;
    if (t === "Income" && r.type !== "DIVIDEND" && r.type !== "INTEREST") return false;
    if (t === "Cash" && r.type !== "DEPOSIT" && r.type !== "WITHDRAWAL") return false;
    if (t === "Manual" && r.source !== "manual") return false;
    if (q && !`${r.symbol ?? ""} ${r.note ?? ""} ${r.type} ${r.date}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, ti, q]);
  const per = 25;
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const shown = filtered.slice(page * per, page * per + per);
  return (
    <div className={pending ? "opacity-70" : ""}>
      <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
        <Seg options={types} value={ti} onChange={(i) => { setTi(i); setPage(0); }} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Filter by symbol, note, date…" className="ml-auto w-56 rounded-lg bg-white/[0.04] px-3 py-1.5 text-[12px] text-mist-100 outline-none ring-1 ring-inset ring-white/[0.08] placeholder:text-mist-500 focus:ring-gold-400/40" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12.5px]">
          <thead>
            <tr className="label text-left">
              <th className="px-5 pb-2 font-normal">Date</th>
              <th className="pb-2 font-normal">Type</th>
              <th className="pb-2 font-normal">Security</th>
              <th className="pb-2 font-normal">Detail</th>
              <th className="pb-2 font-normal">Account</th>
              <th className="pb-2 text-right font-normal">Cash impact</th>
              <th className="px-5 pb-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="num px-5 py-2 text-mist-300">{fmtDate(r.date, "medium")}</td>
                <td className="py-2"><span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${TYPE_TONE[r.type] ?? "text-mist-300 bg-white/5"}`}>{r.type}</span>{r.source === "manual" && <span className="ml-1.5 text-[10px] text-gold-400">● manual</span>}</td>
                <td className="py-2">{r.symbol ? <Link href={`/portfolio/holdings/${encodeURIComponent(r.symbol)}`} className="num text-mist-100 hover:text-gold-300">{r.symbol}</Link> : <span className="text-mist-500">—</span>}</td>
                <td className="py-2 text-[11.5px] text-mist-400">
                  {r.type === "BUY" || r.type === "SELL" ? <><span className="num text-mist-200">{fmtQty(r.quantity)}</span> @ <span className="num">{fmtPrice(r.price, r.currency)}</span>{r.fee > 0 && <span className="text-mist-500"> · fee ${r.fee.toFixed(2)}</span>}</> : r.type === "DIVIDEND" ? <><span className="num">{fmtQty(r.quantity)}</span> sh × <span className="num">{fmtPrice(r.price, r.currency)}</span></> : null}
                  {r.note && <span className="ml-1 text-mist-500">{r.type === "BUY" || r.type === "SELL" || r.type === "DIVIDEND" ? "· " : ""}{r.note}</span>}
                </td>
                <td className="py-2 text-[11.5px] text-mist-400">{ACCOUNTS[r.account]?.short ?? r.account}</td>
                <td className={`money num py-2 text-right ${r.amountDisp >= 0 ? "text-up" : "text-mist-200"}`}>{fmtMoney(r.amountDisp, ccy, { sign: true })}</td>
                <td className="px-5 py-2 text-right">
                  {r.source === "manual" && (
                    <button type="button" onClick={() => start(async () => { await deleteTransaction(r.id); })} className="rounded-md px-1.5 text-[11px] text-mist-500 hover:bg-down/10 hover:text-down" title="Delete manual entry">✕</button>
                  )}
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-mist-500">No transactions match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-5 pt-3 text-[11px] text-mist-500">
        <span>{filtered.length} transactions</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-md px-2 py-1 ring-1 ring-inset ring-white/10 disabled:opacity-30">←</button>
          <span className="num">{page + 1} / {pages}</span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded-md px-2 py-1 ring-1 ring-inset ring-white/10 disabled:opacity-30">→</button>
        </div>
      </div>
    </div>
  );
}
