import { db } from "@/db";
import { instruments, prices, transactions, fxRates, events, news, targets } from "@/db/schema";
import { sql } from "drizzle-orm";
import { UNIVERSE, FX, TARGETS, NEWS_SEED, EVENTS_SEED } from "./seed-data";

const N_DAYS = 783; // ~3 years of business days

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function normal(rng: () => number) {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function demean(a: number[]) {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return a.map((x) => x - m);
}
export function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function businessDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(iso(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

function simulatePrices(dates: string[]) {
  const n = dates.length;
  const mrng = mulberry32(20240611);
  const mDaily = 0.15 / Math.sqrt(252);
  const market: number[] = [];
  const mNoise = demean(Array.from({ length: n }, () => normal(mrng) * mDaily));
  for (let t = 0; t < n; t++) {
    let r = mNoise[t];
    if (t >= 270 && t < 330) r += -0.0027; // correction
    if (t >= 330 && t < 430) r += 0.0014; // recovery
    if (t >= 600 && t < 614) r += -0.0065; // sharp shock
    if (t >= 614 && t < 680) r += 0.0016;
    market.push(r);
  }
  const sectors = new Map<string, number[]>();
  const sectorOf = (s: string) => {
    if (!sectors.has(s)) {
      const rng = mulberry32(hash("sector:" + s));
      sectors.set(s, demean(Array.from({ length: n }, () => normal(rng) * 0.006)));
    }
    return sectors.get(s)!;
  };

  const out = new Map<string, number[]>();
  for (const ins of UNIVERSE) {
    const rng = mulberry32(hash(ins.symbol));
    const sec = ins.kind === "Equity" ? sectorOf(ins.sector) : null;
    const secLoad = sec ? 0.8 : 0;
    const d = ins.vol / Math.sqrt(252);
    const sys = ins.beta * ins.beta * mDaily * mDaily + secLoad * secLoad * 0.006 * 0.006;
    const idio = Math.sqrt(Math.max(d * d - sys, 0.0000025));
    const drift = ins.mu / 252;
    const logp: number[] = [0];
    const noise = demean(Array.from({ length: n }, () => normal(rng) * idio));
    for (let t = 1; t < n; t++) {
      const r = drift - 0.5 * d * d + ins.beta * market[t] + (sec ? secLoad * sec[t] : 0) + noise[t];
      logp.push(logp[t - 1] + r);
    }
    const last = logp[n - 1];
    out.set(
      ins.symbol,
      logp.map((lp) => +(ins.price * Math.exp(lp - last)).toFixed(ins.price > 1000 ? 2 : 4))
    );
  }
  return out;
}

type Tx = {
  day: number;
  order: number;
  kind: string;
  symbol: string | null;
  quantity: number;
  price: number;
  amount: number;
  currency: string;
  note: string | null;
};

function buildLedger(dates: string[], px: Map<string, number[]>) {
  const bySym = new Map(UNIVERSE.map((u) => [u.symbol, u]));
  const planned: Tx[] = [];
  const buyUsd = (day: number, symbol: string, usd: number, note: string | null = null) => {
    const ins = bySym.get(symbol)!;
    const p = px.get(symbol)![day];
    const local = usd / FX[ins.currency];
    let q = local / p;
    q = ins.kind === "Crypto" ? +q.toFixed(4) : Math.max(1, Math.floor(q));
    planned.push({ day, order: 3, kind: "BUY", symbol, quantity: q, price: p, amount: -q * p, currency: ins.currency, note });
  };
  const sellFrac = (day: number, symbol: string, frac: number, note: string) => {
    planned.push({ day, order: 1, kind: "SELL", symbol, quantity: frac, price: px.get(symbol)![day], amount: 0, currency: bySym.get(symbol)!.currency, note });
  };

  const held = UNIVERSE.filter((u) => !u.isBenchmark);
  held.forEach((u, i) => {
    if (u.startDay === undefined) {
      buyUsd(0, u.symbol, u.targetUsd * 0.75, "Initial position");
      buyUsd(90 + ((i * 37) % 320), u.symbol, u.targetUsd * 0.25, "Add to position");
    } else {
      buyUsd(u.startDay, u.symbol, u.targetUsd, "New position");
    }
  });
  buyUsd(60, "VOO", 20000, "Scheduled top-up");
  buyUsd(380, "BND", 15000, "Rebalance into bonds");
  sellFrac(400, "META", 0.3, "Trim after rally");
  buyUsd(470, "LLY", 6000, "Add on weakness");
  buyUsd(500, "QQQ", 15000, "Growth tilt");
  sellFrac(540, "MC", 0.4, "Reduce luxury exposure");
  buyUsd(608, "VOO", 25000, "Buy the dip");
  buyUsd(650, "GOOGL", 5000, null);
  buyUsd(652, "TSM", 5000, null);
  buyUsd(700, "BND", 10000, "Rebalance into bonds");
  sellFrac(722, "NVDA", 0.2, "Trim concentration");
  buyUsd(745, "SCHD", 8000, "Income sleeve");

  // monthly contributions
  let lastMonth = "";
  dates.forEach((d, i) => {
    const m = d.slice(0, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      if (i > 0) planned.push({ day: i, order: 0, kind: "DEPOSIT", symbol: null, quantity: 0, price: 0, amount: 2500, currency: "USD", note: "Monthly contribution" });
    }
  });

  planned.sort((a, b) => a.day - b.day || a.order - b.order);

  // replay with dividends, interest, fees, and auto-funding
  const qty = new Map<string, number>();
  const cash: Record<string, number> = { USD: 0, EUR: 0, GBP: 0, JPY: 0, CHF: 0 };
  const final: Tx[] = [];
  let pi = 0;
  lastMonth = dates[0].slice(0, 7);
  for (let day = 0; day < dates.length; day++) {
    const month = dates[day].slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      if (cash.USD > 0) {
        const intr = +((cash.USD * 0.038) / 12).toFixed(2);
        final.push({ day, order: 0, kind: "INTEREST", symbol: null, quantity: 0, price: 0, amount: intr, currency: "USD", note: "Cash sweep interest" });
        cash.USD += intr;
      }
      if (month.endsWith("-01") && day > 0) {
        final.push({ day, order: 0, kind: "FEE", symbol: null, quantity: 0, price: 0, amount: -120, currency: "USD", note: "Annual platform fee" });
        cash.USD -= 120;
      }
    }
    // dividends
    for (const u of UNIVERSE) {
      const q = qty.get(u.symbol) ?? 0;
      if (!q || u.divYield <= 0) continue;
      const monthly = u.symbol === "BND";
      const period = monthly ? 21 : 63;
      if ((day + (hash(u.symbol) % period)) % period !== 0) continue;
      const p = px.get(u.symbol)![day];
      const amt = +((q * p * u.divYield) / (monthly ? 12 : 4)).toFixed(2);
      final.push({ day, order: 2, kind: "DIVIDEND", symbol: u.symbol, quantity: q, price: +(amt / q).toFixed(4), amount: amt, currency: u.currency, note: monthly ? "Monthly distribution" : "Quarterly dividend" });
      cash[u.currency] += amt;
    }
    while (pi < planned.length && planned[pi].day === day) {
      const tx = { ...planned[pi++] };
      if (tx.kind === "SELL") {
        const cur = qty.get(tx.symbol!) ?? 0;
        const q = bySym.get(tx.symbol!)!.kind === "Crypto" ? +(cur * tx.quantity).toFixed(4) : Math.floor(cur * tx.quantity);
        tx.quantity = q;
        tx.amount = +(q * tx.price).toFixed(2);
        qty.set(tx.symbol!, cur - q);
      } else if (tx.kind === "BUY") {
        const need = -tx.amount;
        if (cash[tx.currency] < need) {
          const unit = tx.currency === "JPY" ? 100000 : 1000;
          const buffer = tx.currency === "USD" ? (day === 0 ? 40000 : 500) : tx.currency === "JPY" ? 150000 : 1500;
          const dep = Math.ceil((need - cash[tx.currency] + buffer) / unit) * unit;
          final.push({ day, order: 0, kind: "DEPOSIT", symbol: null, quantity: 0, price: 0, amount: dep, currency: tx.currency, note: "Transfer from bank" });
          cash[tx.currency] += dep;
        }
        qty.set(tx.symbol!, (qty.get(tx.symbol!) ?? 0) + tx.quantity);
        tx.amount = +tx.amount.toFixed(2);
      }
      cash[tx.currency] += tx.amount;
      final.push(tx);
    }
  }
  return final;
}

let seeding: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seeding) {
    seeding = doSeed().catch((e) => {
      seeding = null;
      throw e;
    });
  }
  return seeding;
}

async function doSeed() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(77123)`);
    const res = await tx.execute(sql`select count(*)::int as n from instruments`);
    const n = Number((res.rows[0] as { n: number }).n);
    if (n > 0) return;

    const dates = businessDays(N_DAYS);
    const px = simulatePrices(dates);

    await tx.insert(instruments).values(
      UNIVERSE.map((u) => ({
        symbol: u.symbol,
        name: u.name,
        kind: u.kind,
        assetClass: u.assetClass,
        sector: u.sector,
        industry: u.industry,
        country: u.country,
        region: u.region,
        currency: u.currency,
        exchange: u.exchange,
        beta: u.beta,
        divYield: u.divYield,
        pe: u.pe,
        marketCapB: u.marketCapB,
        expenseRatio: u.expenseRatio,
        style: u.style,
        size: u.size,
        description: u.description,
        lookThrough: u.lookThrough ?? null,
        isBenchmark: u.isBenchmark ?? false,
      }))
    );

    const rows: { symbol: string; date: string; close: number }[] = [];
    for (const [symbol, series] of px) series.forEach((close, i) => rows.push({ symbol, date: dates[i], close }));
    for (let i = 0; i < rows.length; i += 2500) await tx.insert(prices).values(rows.slice(i, i + 2500));

    const ledger = buildLedger(dates, px);
    for (let i = 0; i < ledger.length; i += 1000) {
      await tx.insert(transactions).values(
        ledger.slice(i, i + 1000).map((t) => ({
          date: dates[t.day],
          kind: t.kind,
          symbol: t.symbol,
          quantity: t.quantity,
          price: t.price,
          amount: t.amount,
          currency: t.currency,
          note: t.note,
        }))
      );
    }

    await tx.insert(fxRates).values(Object.entries(FX).map(([currency, usdPer]) => ({ currency, usdPer })));
    await tx.insert(targets).values(Object.entries(TARGETS).map(([bucket, weight]) => ({ bucket, weight })));

    const now = Date.now();
    await tx.insert(news).values(
      NEWS_SEED.map((x) => ({
        publishedAt: new Date(now - x.h * 3600_000).toISOString(),
        source: x.source,
        headline: x.headline,
        summary: x.summary,
        symbols: x.symbols,
        sentiment: x.sentiment,
        category: x.category,
      }))
    );
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await tx.insert(events).values(
      EVENTS_SEED.map((e) => ({
        date: iso(new Date(today.getTime() + e.d * 86400_000)),
        symbol: e.symbol,
        kind: e.kind,
        title: e.title,
        detail: e.detail,
      }))
    );
  });
}
