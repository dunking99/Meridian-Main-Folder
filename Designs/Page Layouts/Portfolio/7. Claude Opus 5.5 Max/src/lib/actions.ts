"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { holdingNotes, transactions } from "@/db/schema";
import { isCcy } from "./reference";
import { CCY_COOKIE, bsearchLE, loadMarket } from "./engine";

export type ActionState = { ok: boolean; message: string } | null;

export async function setCurrency(ccy: string) {
  if (!isCcy(ccy)) return;
  (await cookies()).set(CCY_COOKIE, ccy, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function saveNote(symbol: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const thesis = String(fd.get("thesis") ?? "").slice(0, 2000);
  const conviction = Math.max(1, Math.min(5, Math.round(Number(fd.get("conviction") ?? 3)) || 3));
  const tpRaw = String(fd.get("targetPrice") ?? "").trim();
  const tp = tpRaw ? Number(tpRaw) : null;
  const targetPrice = tp !== null && Number.isFinite(tp) && tp > 0 ? tp : null;
  const rd = String(fd.get("reviewDate") ?? "");
  const reviewDate = /^\d{4}-\d{2}-\d{2}$/.test(rd) ? rd : null;
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  await db
    .insert(holdingNotes)
    .values({ symbol, thesis, conviction, targetPrice, reviewDate, updatedAt: now })
    .onConflictDoUpdate({ target: holdingNotes.symbol, set: { thesis, conviction, targetPrice, reviewDate, updatedAt: now } });
  revalidatePath("/portfolio", "layout");
  return { ok: true, message: "Thesis saved" };
}

const TYPES = ["BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND"] as const;

export async function addTransaction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const type = String(fd.get("type") ?? "");
  const date = String(fd.get("date") ?? "");
  const account = String(fd.get("account") ?? "brokerage") || "brokerage";
  const symbol = String(fd.get("symbol") ?? "").trim() || null;
  const quantity = Number(fd.get("quantity") ?? 0);
  const price = Number(fd.get("price") ?? 0);
  const amountIn = Number(fd.get("amount") ?? 0);
  const fee = Math.max(0, Number(fd.get("fee") ?? 0) || 0);
  const note = String(fd.get("note") ?? "").trim().slice(0, 200) || null;

  if (!(TYPES as readonly string[]).includes(type)) return { ok: false, message: "Choose a transaction type" };
  const market = await loadMarket();
  const last = market.dates[market.dates.length - 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2021-01-04" || date > last) return { ok: false, message: `Date must be between Jan 4, 2021 and ${last}` };

  let amount = 0;
  let fxRate = 1;
  let qty = 0;
  let px = 0;
  if (type === "BUY" || type === "SELL" || type === "DIVIDEND") {
    const inst = symbol ? market.bySym[symbol] : undefined;
    if (!inst || inst.kind === "benchmark") return { ok: false, message: "Pick a valid security" };
    const i = Math.max(0, bsearchLE(market.dates, date));
    fxRate = market.fx[inst.currency]?.[i] ?? 1;
    if (type === "DIVIDEND") {
      if (!(amountIn > 0)) return { ok: false, message: "Enter the dividend amount (USD)" };
      amount = amountIn;
    } else {
      if (!(quantity > 0) || !(price > 0)) return { ok: false, message: "Quantity and price must be positive" };
      qty = quantity;
      px = price;
      const gross = quantity * price * fxRate;
      if (type === "SELL") {
        const held = await db
          .select({ q: sql<number>`coalesce(sum(case when ${transactions.type} = 'BUY' then ${transactions.quantity} when ${transactions.type} = 'SELL' then -${transactions.quantity} else 0 end), 0)` })
          .from(transactions)
          .where(eq(transactions.symbol, inst.symbol));
        if (Number(held[0]?.q ?? 0) + 1e-9 < quantity) return { ok: false, message: `You only hold ${Number(held[0]?.q ?? 0)} ${inst.symbol}` };
        amount = gross - fee;
      } else amount = -(gross + fee);
    }
  } else {
    if (!(amountIn > 0)) return { ok: false, message: "Enter a positive amount (USD)" };
    amount = type === "DEPOSIT" ? amountIn : -amountIn;
  }

  await db.insert(transactions).values({
    date, type, symbol: type === "DEPOSIT" || type === "WITHDRAWAL" ? null : symbol, account, quantity: qty, price: px,
    amount: Math.round(amount * 100) / 100, fee: type === "BUY" || type === "SELL" ? fee : 0, fxRate, note, source: "manual",
  });
  revalidatePath("/portfolio", "layout");
  return { ok: true, message: `${type.charAt(0) + type.slice(1).toLowerCase()} recorded — portfolio recalculated` };
}

export async function deleteTransaction(id: number) {
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.source, "manual")));
  revalidatePath("/portfolio", "layout");
}
