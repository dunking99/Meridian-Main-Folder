import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { appSettings, events, fxRates, holdingNotes, instruments, news, prices, transactions } from "./schema";
import { AGG_WP, FX_DEFS, NOTE_SEEDS, SPX_WP, UNIVERSE, type Def } from "./universe";
import { CASH_SPREAD, rateOn } from "@/lib/reference";

// ————————————————————————————————— calendar
const DAY = 86_400_000;
const toDate = (s: string) => new Date(s + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
const dow = (s: string) => toDate(s).getUTCDay();
export function nextBD(s: string) {
  let d = s;
  while (dow(d) === 0 || dow(d) === 6) d = addDays(d, 1);
  return d;
}
export function prevBD(s: string) {
  let d = s;
  while (dow(d) === 0 || dow(d) === 6) d = addDays(d, -1);
  return d;
}
function ymd(y: number, m: number, d: number) {
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, dim)).padStart(2, "0")}`;
}
function bdays(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = dow(d);
    if (w !== 0 && w !== 6) out.push(d);
  }
  return out;
}
const CAL = bdays("2020-12-31", "2027-12-31");
const N = CAL.length;
function idxOn(d: string) {
  if (d <= CAL[0]) return 0;
  if (d >= CAL[N - 1]) return N - 1;
  let lo = 0;
  let hi = N - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (CAL[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function currentAsOf() {
  return prevBD(iso(new Date()));
}

// ————————————————————————————————— deterministic randomness
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r: () => number) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const SQ = Math.sqrt(252);

// ————————————————————————————————— price paths (factor model bridged through waypoints)
// Near-"today" anchors so the recent path lands on a representative level.
const NOW_DATE = "2026-09-21";
const NOW: Record<string, number> = {
  SPX: 7290, ACWI: 150, AGG: 101.3, AAPL: 274, MSFT: 518, NVDA: 207, AMZN: 246, GOOGL: 326, JPM: 332, V: 366, UNH: 346, LLY: 1070,
  COST: 962, XOM: 118, NEE: 88, META: 712, INTC: 38.5, ASML: 952, "NOVO-B": 318, MC: 628, "7203": 3120, TSM: 311, NESN: 83.5,
  SHEL: 28.2, QQQ: 662, VXUS: 77.6, BND: 75.3, GLD: 422, VNQ: 95, BTC: 101000,
};
function parseWp(s: string, now?: number): [number, number][] {
  const out: [number, number][] = [];
  const toks = s.trim().split(/\s+/);
  if (now) toks.push(`${NOW_DATE}:${now}`);
  toks.sort();
  for (const tok of toks) {
    const [d, p] = tok.split(":");
    const i = idxOn(d);
    const v = Math.log(parseFloat(p));
    if (out.length && out[out.length - 1][0] === i) out[out.length - 1][1] = v;
    else out.push([i, v]);
  }
  return out;
}
function bridge(inc: Float64Array, wp: [number, number][]) {
  const d = Float64Array.from(inc);
  for (let j = 0; j < wp.length - 1; j++) {
    const [a, la] = wp[j];
    const [b, lb] = wp[j + 1];
    if (b <= a) continue;
    let s = 0;
    for (let t = a + 1; t <= b; t++) s += d[t];
    const adj = (lb - la - s) / (b - a);
    for (let t = a + 1; t <= b; t++) d[t] += adj;
  }
  const out = new Float64Array(N);
  out[wp[0][0]] = wp[0][1];
  for (let t = wp[0][0] + 1; t < N; t++) out[t] = out[t - 1] + d[t];
  for (let t = wp[0][0] - 1; t >= 0; t--) out[t] = out[t + 1] - d[t + 1];
  return out;
}
const diff = (lg: Float64Array) => {
  const o = new Float64Array(N);
  for (let t = 1; t < N; t++) o[t] = lg[t] - lg[t - 1];
  return o;
};

type Series = { px: Record<string, Float64Array>; fx: Record<string, Float64Array> };
let seriesMemo: Series | null = null;

function generateSeries(): Series {
  if (seriesMemo) return seriesMemo;
  const px: Record<string, Float64Array> = {};
  const fx: Record<string, Float64Array> = {};
  const regimeVol = (d: string) =>
    d < "2022-01-01" ? 0.13 : d < "2023-01-01" ? 0.24 : d < "2024-01-01" ? 0.15 : d < "2025-01-01" ? 0.13 : d < "2025-07-01" ? 0.22 : d < "2026-01-01" ? 0.12 : 0.14;
  const rm = mulberry32(hash("market"));
  const mInc = new Float64Array(N);
  for (let t = 1; t < N; t++) mInc[t] = (regimeVol(CAL[t]) / SQ) * gauss(rm);
  const spxLog = bridge(mInc, parseWp(SPX_WP, NOW.SPX));
  const m = diff(spxLog);

  const rb = mulberry32(hash("bonds"));
  const bInc = new Float64Array(N);
  for (let t = 1; t < N; t++) bInc[t] = (0.055 / SQ) * gauss(rb);
  const aggLog = bridge(bInc, parseWp(AGG_WP, NOW.AGG));
  const bond = diff(aggLog);

  const sectors: Record<string, Float64Array> = {};
  const sectorOf = (name: string) => {
    if (!sectors[name]) {
      const r = mulberry32(hash("sector:" + name));
      const a = new Float64Array(N);
      for (let t = 1; t < N; t++) a[t] = (0.1 / SQ) * gauss(r);
      sectors[name] = a;
    }
    return sectors[name];
  };

  const fxInc: Record<string, Float64Array> = {};
  for (const f of FX_DEFS) {
    const r = mulberry32(hash("fx:" + f.ccy));
    const inc = new Float64Array(N);
    for (let t = 1; t < N; t++) inc[t] = (f.vol / SQ) * gauss(r);
    const lg = bridge(inc, parseWp(f.wp));
    fx[f.ccy] = lg.map((v) => Math.exp(v));
    fxInc[f.ccy] = diff(lg);
  }
  fx.DKK = fx.EUR.map((v) => v / 7.4604);
  fx.USD = new Float64Array(N).fill(1);

  for (const def of UNIVERSE) {
    if (def.track) continue;
    let lg: Float64Array;
    if (def.symbol === "SPX") lg = spxLog;
    else if (def.symbol === "AGG") lg = aggLog;
    else {
      const r = mulberry32(hash("idio:" + def.symbol));
      const sec = def.sf ? sectorOf(def.sector === "Diversified" ? "Technology" : def.sector) : null;
      const inc = new Float64Array(N);
      for (let t = 1; t < N; t++) {
        let v = def.b * m[t] + (def.iv / SQ) * gauss(r);
        if (sec && def.sf) v += def.sf * sec[t];
        if (def.bf) v += def.bf * bond[t];
        if (def.fxl) for (const [c, l] of Object.entries(def.fxl)) v += l * (fxInc[c]?.[t] ?? 0);
        inc[t] = v;
      }
      lg = bridge(inc, parseWp(def.wp ?? "", NOW[def.symbol]));
    }
    const ty = (def.trYield ?? 0) / 100;
    const out = new Float64Array(N);
    for (let t = 0; t < N; t++) out[t] = Math.exp(lg[t] + (ty * t) / 252);
    px[def.symbol] = out;
  }
  for (const def of UNIVERSE) {
    if (!def.track) continue;
    const ratio = def.track[1];
    px[def.symbol] = spxLog.map((v) => Math.exp(v) * ratio);
  }
  seriesMemo = { px, fx };
  return seriesMemo;
}
const rp = (p: number) => (p >= 100 ? Math.round(p * 100) / 100 : Math.round(p * 10000) / 10000);
const r2 = (v: number) => Math.round(v * 100) / 100;

// ————————————————————————————————— dividends
function divSchedule(def: Def, fromYear = 2021, toYear = 2027) {
  const out: { ex: string; pay: string }[] = [];
  const m = def.meta;
  if (!m.divFreq || !m.divYield) return out;
  for (let y = fromYear; y <= toYear; y++)
    for (const mo of m.divMonths) {
      const ex = nextBD(ymd(y, mo, m.exDay));
      if (def.divSince && ex < def.divSince) continue;
      if (def.divUntil && ex > def.divUntil) continue;
      out.push({ ex, pay: nextBD(addDays(ex, m.divFreq === 12 ? 6 : 21)) });
    }
  return out;
}

// ————————————————————————————————— portfolio simulation
type TxRow = {
  date: string; type: string; symbol: string | null; account: string; quantity: number; price: number;
  amount: number; fee: number; fxRate: number; note: string | null; source: string;
};

function simulate(asOf: string, S: Series): TxRow[] {
  const defs: Record<string, Def> = Object.fromEntries(UNIVERSE.map((d) => [d.symbol, d]));
  const P = (sym: string, d: string) => S.px[sym][idxOn(d)];
  const FX = (ccy: string, d: string) => (S.fx[ccy] ? S.fx[ccy][idxOn(d)] : 1);
  const out: TxRow[] = [];
  const hold: Record<string, number> = {};
  let cash = 0;
  const push = (row: Omit<TxRow, "source">) => out.push({ ...row, source: "auto" });
  const tradeFee = (def: Def, gross: number) =>
    r2((def.currency !== "USD" ? 4.95 + gross * 0.001 : 0) + (def.kind === "crypto" ? gross * 0.005 : 0));

  function buy(d: string, sym: string, usd: number, note: string | null = null) {
    const def = defs[sym];
    const p = P(sym, d);
    const fx = FX(def.currency, d);
    const unit = p * fx;
    const budget = Math.min(usd, cash - 250);
    if (budget < 250) return;
    const foreign = def.currency !== "USD";
    const qty =
      def.kind === "crypto"
        ? Math.floor((budget / (unit * 1.005)) * 1e4) / 1e4
        : Math.floor((budget - (foreign ? 5 : 0)) / (unit * (foreign ? 1.001 : 1)));
    if (qty <= 0) return;
    const gross = qty * unit;
    const fee = tradeFee(def, gross);
    const amount = -r2(gross + fee);
    cash += amount;
    hold[sym] = (hold[sym] ?? 0) + qty;
    push({ date: d, type: "BUY", symbol: sym, account: def.meta.account, quantity: qty, price: rp(p), amount, fee, fxRate: fx, note });
  }
  function sell(d: string, sym: string, frac: number, note: string | null = null) {
    const def = defs[sym];
    const q0 = hold[sym] ?? 0;
    if (q0 <= 0) return;
    const qty = frac >= 1 ? q0 : def.kind === "crypto" ? Math.round(q0 * frac * 1e4) / 1e4 : Math.round(q0 * frac);
    if (qty <= 0) return;
    const p = P(sym, d);
    const fx = FX(def.currency, d);
    const gross = qty * p * fx;
    const fee = tradeFee(def, gross);
    const amount = r2(gross - fee);
    cash += amount;
    hold[sym] = Math.abs(q0 - qty) < 1e-9 ? 0 : q0 - qty;
    push({ date: d, type: "SELL", symbol: sym, account: def.meta.account, quantity: qty, price: rp(p), amount, fee, fxRate: fx, note });
  }
  function deposit(d: string, usd: number, account: string, note: string) {
    cash += usd;
    push({ date: d, type: "DEPOSIT", symbol: null, account, quantity: 0, price: 0, amount: usd, fee: 0, fxRate: 1, note });
  }
  function withdraw(d: string, usd: number, note: string) {
    if (cash - usd < 2000) {
      const unit = P("VOO", d);
      const need = Math.ceil((usd - cash + 5000) / unit);
      const q0 = hold.VOO ?? 0;
      if (q0 > 0) sell(d, "VOO", Math.min(1, need / q0), "Raise cash for withdrawal");
    }
    cash -= usd;
    push({ date: d, type: "WITHDRAWAL", symbol: null, account: "brokerage", quantity: 0, price: 0, amount: -usd, fee: 0, fxRate: 1, note });
  }
  function interest(d: string) {
    const r = Math.max(0, rateOn(d) - CASH_SPREAD);
    const amt = r2((cash * r) / 100 / 12);
    if (amt >= 0.01) {
      cash += amt;
      push({ date: d, type: "INTEREST", symbol: null, account: "brokerage", quantity: 0, price: 0, amount: amt, fee: 0, fxRate: 1, note: `Cash sweep @ ${r.toFixed(2)}%` });
    }
  }
  function sweep(d: string) {
    if (cash > 40000) {
      const x = cash - 25000;
      buy(d, "VOO", x * 0.65, "Quarterly cash sweep");
      buy(d, "VXUS", x * 0.35, "Quarterly cash sweep");
    }
  }

  type Act = { d: string; o: number; run: () => void };
  const acts: Act[] = [];
  const at = (date: string, o: number, run: (d: string) => void) => {
    const d = nextBD(date);
    acts.push({ d, o, run: () => run(d) });
  };
  const K = 1.35;
  const buys = (list: [string, number][], note: string, k = K) => (d: string) => list.forEach(([s, v]) => buy(d, s, v * k, note));

  at("2021-01-04", 0, (d) => {
    deposit(d, 232000, "brokerage", "Initial funding");
    deposit(d, 62000, "ira", "Roth IRA rollover");
  });
  at("2021-01-05", 2, buys([["VOO", 36000], ["AAPL", 12000], ["MSFT", 12000], ["AMZN", 8000], ["GOOGL", 7000], ["NVDA", 6000], ["JPM", 6000], ["V", 6000], ["UNH", 7000], ["COST", 5000], ["XOM", 4000], ["NEE", 5000], ["GLD", 7000], ["BND", 18000], ["VXUS", 11000], ["QQQ", 8000]], "Initial allocation"));
  at("2021-02-16", 2, buys([["INTC", 6000]], "Turnaround starter position"));
  at("2021-03-15", 2, buys([["ASML", 9000]], "Semicap monopoly"));
  at("2021-05-10", 2, buys([["BTC", 5000]], "Crypto satellite"));
  at("2021-06-14", 2, buys([["MC", 6000]], "Luxury exposure"));
  at("2021-09-08", 2, buys([["META", 7000]], "Social rebound bet"));
  at("2021-11-15", 2, buys([["7203", 5000]], "Japan value"));
  at("2022-03-14", 2, buys([["LLY", 7000]], "Obesity pipeline"));
  at("2022-05-16", 2, buys([["NOVO-B", 7000]], "GLP-1 pair trade with LLY"));
  at("2022-06-17", 2, buys([["VOO", 12000]], "Buying the drawdown"));
  at("2022-08-15", 2, buys([["TSM", 6000]], "Foundry leader"));
  at("2022-10-17", 1, (d) => sell(d, "META", 1, "Tax-loss harvest"));
  at("2022-10-18", 2, buys([["VNQ", 7000]], "Real-asset sleeve"));
  at("2022-11-14", 2, buys([["SHEL", 6000]], "Energy income"));
  at("2023-03-13", 2, buys([["NESN", 6000]], "Defensive staple"));
  at("2023-05-15", 2, buys([["BTC", 3500]], "Crypto top-up"));
  at("2023-10-16", 2, buys([["BND", 8000]], "Locking in 5% yields"));
  at("2024-03-11", 2, buys([["LLY", 4000]], "Adding to winner"));
  at("2024-06-20", 1, (d) => sell(d, "NVDA", 0.4, "Trim — position above 12% cap"));
  at("2024-06-21", 2, buys([["VXUS", 10000], ["BND", 7000]], "Redeploy NVDA trim"));
  at("2024-08-05", 1, (d) => sell(d, "INTC", 1, "Thesis broken — exit"));
  at("2024-08-06", 2, buys([["GOOGL", 6000]], "Adding on weakness"));
  at("2024-11-18", 2, buys([["TSM", 4000]], "Adding to foundry"));
  at("2025-01-13", 1, (d) => withdraw(d, 25000, "Home renovation"));
  at("2025-02-13", 1, (d) => sell(d, "COST", 0.3, "Valuation trim at 55× earnings"));
  at("2025-04-08", 2, buys([["VOO", 15000], ["ASML", 4000]], "Tariff-shock dip buy"));
  at("2025-05-20", 2, buys([["UNH", 4000]], "Averaging down after guidance reset"));
  at("2025-09-15", 2, buys([["NOVO-B", 4000]], "Averaging down"));
  at("2025-11-17", 1, (d) => sell(d, "BTC", 0.25, "Rebalance crypto sleeve"));
  at("2026-01-12", 2, buys([["VXUS", 8000]], "Reduce home bias"));
  at("2026-02-09", 2, buys([["JPM", 4000]], "Adding financials"));
  at("2026-05-11", 2, buys([["MSFT", 5000]], "Adding on AI-capex scare"));
  at("2026-07-13", 2, buys([["GLD", 4000]], "Hedge top-up"));
  at("2026-08-17", 1, (d) => sell(d, "NVDA", 0.15, "Trim into strength"));

  for (let y = 2021; y <= 2027; y++)
    for (let mo = 1; mo <= 12; mo++) {
      const first = ymd(y, mo, 1);
      if (!(y === 2021 && mo === 1)) {
        at(first, 0, (d) => deposit(d, 3000, "brokerage", "Monthly contribution"));
        at(first, 2, buys([["VOO", 1100], ["VXUS", 650], ["BND", 450]], "Auto-invest", 1));
      }
      if (mo === 8) at(first, 0, (d) => deposit(d, 15000, "brokerage", "Annual bonus"));
      if (y >= 2022 && [1, 4, 7, 10].includes(mo)) at(first, 3, (d) => sweep(d));
      const last = prevBD(ymd(y, mo, 31));
      acts.push({ d: last, o: 9, run: () => interest(last) });
    }
  const ira: [number, number][] = [[2022, 6000], [2023, 6500], [2024, 7000], [2025, 7000], [2026, 7000], [2027, 7000]];
  for (const [y, v] of ira) {
    at(`${y}-01-12`, 0, (d) => deposit(d, v, "ira", `${y} Roth IRA contribution`));
    at(`${y}-01-12`, 2, buys([["QQQ", v * 0.5], ["VXUS", v * 0.3], ["BND", v * 0.2]], "IRA allocation", 1));
  }
  for (const def of UNIVERSE) {
    if (def.kind === "benchmark") continue;
    for (const { ex, pay } of divSchedule(def)) {
      let ent = 0;
      let entQ = 0;
      let dps = 0;
      acts.push({
        d: ex, o: -1, run: () => {
          const q = hold[def.symbol] ?? 0;
          if (q > 0) {
            dps = (P(def.symbol, ex) * def.meta.divYield) / 100 / def.meta.divFreq;
            ent = q * dps;
            entQ = q;
          }
        },
      });
      acts.push({
        d: pay, o: 8, run: () => {
          if (ent <= 0) return;
          const fx = FX(def.currency, pay);
          const amt = r2(ent * fx);
          if (amt <= 0) return;
          cash += amt;
          push({ date: pay, type: "DIVIDEND", symbol: def.symbol, account: def.meta.account, quantity: entQ, price: Math.round(dps * 1e4) / 1e4, amount: amt, fee: 0, fxRate: fx, note: null });
        },
      });
    }
  }
  acts.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.o - b.o));
  for (const a of acts) if (a.d <= asOf) a.run();
  return out;
}

// ————————————————————————————————— events & news
type EventRow = { date: string; symbol: string | null; type: string; title: string; detail: string | null; importance: number };
const CCY_SYM: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF ", DKK: "DKK " };

function genEvents(asOf: string, S: Series): EventRow[] {
  const rows: EventRow[] = [];
  const iAs = idxOn(asOf);
  for (const def of UNIVERSE) {
    if (def.kind === "benchmark") continue;
    const m = def.meta;
    const cs = CCY_SYM[def.currency] ?? "";
    if (def.kind === "stock")
      for (let y = 2024; y <= 2027; y++)
        for (const mo of m.earnMonths) {
          const d = nextBD(ymd(y, mo, m.earnDay));
          const q = mo <= 2 ? `Q4 ${y - 1}` : mo <= 5 ? `Q1 ${y}` : mo <= 8 ? `Q2 ${y}` : `Q3 ${y}`;
          const p = S.px[def.symbol][Math.min(idxOn(d), iAs)];
          const eps = m.pe ? p / m.pe / 4 : null;
          rows.push({ date: d, symbol: def.symbol, type: "earnings", title: `${q} earnings`, detail: eps ? `Consensus EPS ${cs}${eps.toFixed(2)}` : "Results & outlook", importance: 3 });
        }
    for (const { ex, pay } of divSchedule(def, 2024, 2027)) {
      const p = S.px[def.symbol][Math.min(idxOn(ex), iAs)];
      const dps = (p * m.divYield) / 100 / m.divFreq;
      const txt = `${cs}${dps.toFixed(dps < 1 ? 3 : 2)} per share`;
      rows.push({ date: ex, symbol: def.symbol, type: "ex_div", title: "Ex-dividend", detail: txt, importance: 2 });
      rows.push({ date: pay, symbol: def.symbol, type: "dividend", title: "Dividend payment", detail: txt, importance: 2 });
    }
  }
  for (let y = 2025; y <= 2027; y++) {
    for (const [mo, day] of [[1, 28], [3, 18], [4, 29], [6, 17], [7, 29], [9, 16], [10, 28], [12, 9]])
      rows.push({ date: nextBD(ymd(y, mo, day)), symbol: null, type: "macro", title: "FOMC rate decision", detail: "Fed statement, dot plot & press conference", importance: 3 });
    for (let mo = 1; mo <= 12; mo++) {
      rows.push({ date: nextBD(ymd(y, mo, 12)), symbol: null, type: "macro", title: "US CPI", detail: "Consumer price inflation", importance: 2 });
      let d = ymd(y, mo, 1);
      while (dow(d) !== 5) d = addDays(d, 1);
      rows.push({ date: d, symbol: null, type: "macro", title: "US jobs report", detail: "Non-farm payrolls & unemployment", importance: 2 });
    }
    for (const [mo, day] of [[1, 30], [3, 6], [4, 17], [6, 5], [7, 24], [9, 11], [10, 29], [12, 17]])
      rows.push({ date: nextBD(ymd(y, mo, day)), symbol: null, type: "macro", title: "ECB rate decision", detail: "Eurozone policy — EUR sensitive", importance: 2 });
    for (const [mo, day] of [[1, 24], [3, 19], [5, 1], [6, 16], [7, 31], [9, 19], [10, 30], [12, 18]])
      rows.push({ date: nextBD(ymd(y, mo, day)), symbol: null, type: "macro", title: "BoJ policy meeting", detail: "Bank of Japan — yen sensitive", importance: 2 });
  }
  return rows;
}

type NewsDef = [number, string, string, string, string[], string[], number, "high" | "medium" | "low"];
const NEWS: NewsDef[] = [
  [2, "NVIDIA supplier checks point to a faster next-gen ramp", "Channel checks across packaging and memory suppliers suggest data-center shipments tracking ahead of plan into year-end.", "Bloomberg", ["NVDA", "TSM"], ["ai"], 0.6, "high"],
  [5, "iPhone 18 pre-orders run ahead of last year, analysts say", "Lead times for Pro models stretched to four weeks in the US and China; services attach rate also rising.", "CNBC", ["AAPL"], ["consumer"], 0.4, "medium"],
  [9, "Novo Nordisk cuts US list prices for Wegovy amid competition", "The move follows share losses to rival therapies; management keeps volume guidance but trims price assumptions.", "Financial Times", ["NOVO-B", "LLY"], ["healthcare"], -0.45, "high"],
  [14, "ASML jumps as chipmakers lift 2027 capex plans", "Two of the three leading-edge foundries signalled higher tool budgets, boosting EUV order visibility.", "Reuters", ["ASML", "TSM"], ["ai", "europe"], 0.5, "medium"],
  [20, "Oil slides 4% as OPEC+ signals further output increases", "Brent fell to a three-month low; integrated majors underperformed the broader market.", "Bloomberg", ["XOM", "SHEL"], ["oil"], -0.5, "medium"],
  [27, "Gold holds near record as central-bank buying continues", "Official-sector demand and a softer dollar keep bullion bid despite firmer real yields.", "WSJ", ["GLD"], ["gold", "usd"], 0.3, "medium"],
  [31, "Yen jumps after BoJ hints at October hike", "USD/JPY fell 1.4% on the day; exporters slipped in Tokyo trading.", "Nikkei Asia", ["7203"], ["jpy", "fx"], -0.2, "medium"],
  [38, "UnitedHealth reaffirms outlook as cost trend stabilises", "Medical-cost ratio came in slightly better than feared at an investor conference; shares rallied 5%.", "Reuters", ["UNH"], ["healthcare"], 0.4, "medium"],
  [46, "Microsoft extends multi-year AI capacity partnership", "The expanded agreement adds several gigawatts of Azure capacity through 2030.", "The Verge", ["MSFT"], ["ai"], 0.3, "medium"],
  [53, "LVMH flags softer China demand as luxury slowdown lingers", "Fashion & leather goods organic growth slowed; Sephora remained a bright spot.", "Financial Times", ["MC"], ["china", "consumer"], -0.4, "medium"],
  [60, "Bitcoin swings 8% in a day as ETF flows reverse", "Spot ETF outflows topped $900m over three sessions as leveraged longs were flushed.", "CoinDesk", ["BTC"], ["crypto"], -0.3, "medium"],
  [72, "Eurozone inflation eases to 2.0%; ECB seen on hold", "Core inflation also edged lower, cementing expectations for steady policy in October.", "Reuters", [], ["europe", "rates", "eur"], 0.1, "low"],
  [80, "JPMorgan sees record investment-banking fees this quarter", "M&A and debt underwriting rebounded strongly; trading revenue guided up mid-single digits.", "Bloomberg", ["JPM"], ["banks"], 0.5, "medium"],
  [96, "Amazon expands same-day grocery; AWS growth reaccelerates", "Management highlighted improving AI workloads and a faster fulfilment network.", "CNBC", ["AMZN"], ["ai", "consumer"], 0.4, "medium"],
  [108, "Alphabet wins partial relief in ad-tech remedies ruling", "The court declined a forced divestiture of core ad-exchange assets, a better-than-feared outcome.", "WSJ", ["GOOGL"], ["regulation"], 0.35, "high"],
  [120, "Costco monthly sales beat; membership income climbs", "Comparable sales ex-gas rose 7%; renewal rates held near record highs.", "Reuters", ["COST"], ["consumer"], 0.3, "low"],
  [130, "Treasury yields climb as long-end supply worries resurface", "The 10-year yield rose 12bp on the week, pressuring rate-sensitive sectors.", "Bloomberg", ["BND", "VNQ", "NEE"], ["rates"], -0.3, "medium"],
  [144, "TSMC monthly revenue up 38% year over year on AI demand", "Advanced-node utilisation remains near full; overseas fabs are ramping on schedule.", "Nikkei Asia", ["TSM"], ["ai"], 0.5, "medium"],
  [168, "Fed trims rates by 25bp, signals a slower path into 2027", "Policymakers cut to a 3.25–3.50% range; the dot plot implies one more move this year.", "Reuters", [], ["rates", "usd"], 0.2, "high"],
  [190, "Nestlé names new chair, pledges portfolio review", "The board promised a sharper capital-allocation framework after two years of underperformance.", "Financial Times", ["NESN"], ["consumer"], 0.1, "low"],
  [210, "Visa and Mastercard settle long-running merchant-fee litigation", "The settlement caps interchange rates for five years; analysts see limited earnings impact.", "Reuters", ["V"], ["regulation"], 0.2, "low"],
  [236, "Shell raises buyback despite weaker refining margins", "Strong LNG trading offset downstream softness; the dividend was held.", "Bloomberg", ["SHEL"], ["oil"], 0.2, "low"],
  [260, "Toyota lifts full-year forecast on hybrid demand", "Operating profit guidance rose 6%; the company assumes a stronger yen in the second half.", "Nikkei Asia", ["7203"], ["jpy"], 0.4, "medium"],
  [290, "Eli Lilly's oral GLP-1 filing accepted for priority review", "A decision is expected early next year; analysts see peak sales above $10bn.", "STAT", ["LLY"], ["healthcare"], 0.6, "high"],
  [312, "Dollar index falls to a 10-month low", "Rate-cut expectations and strong euro-area data weighed on the greenback.", "Reuters", [], ["usd", "fx"], -0.1, "medium"],
  [336, "NextEra signs 4GW of data-center power agreements", "Hyperscaler demand is extending the renewables backlog well into the next decade.", "Bloomberg", ["NEE"], ["ai"], 0.4, "low"],
  [360, "Chip tariffs: what a new Section 232 decision could mean", "A broad semiconductor levy would hit hardware margins; exemptions for US-investing firms are under discussion.", "Barron's", ["NVDA", "TSM", "ASML", "AAPL"], ["ai", "tariffs"], -0.3, "high"],
  [384, "Emerging-market equities notch best quarter since 2020", "Taiwan, Korea and India led gains as the dollar weakened.", "Financial Times", [], ["em", "china"], 0.3, "low"],
  [410, "S&P 500 closes at a record as breadth improves", "Equal-weight and small caps outperformed as rate-cut hopes broadened the rally.", "CNBC", ["VOO"], ["us-equity"], 0.3, "medium"],
];

function genNews() {
  const now = Date.now();
  return NEWS.map(([h, headline, summary, source, symbols, topics, sentiment, impact]) => ({
    publishedAt: new Date(now - h * 3_600_000).toISOString().slice(0, 19).replace("T", " "),
    headline, summary, source, symbols, topics, sentiment, impact,
  }));
}

// ————————————————————————————————— bootstrap
const DDL = `
CREATE TABLE IF NOT EXISTS "instruments" ("symbol" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "kind" text NOT NULL, "asset_class" text NOT NULL, "sector" text NOT NULL, "industry" text NOT NULL, "country" text NOT NULL, "currency" text NOT NULL, "exchange" text NOT NULL, "meta" jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS "prices" ("symbol" text NOT NULL, "date" date NOT NULL, "close" double precision NOT NULL, CONSTRAINT "prices_symbol_date_pk" PRIMARY KEY("symbol","date"));
CREATE TABLE IF NOT EXISTS "fx_rates" ("currency" text NOT NULL, "date" date NOT NULL, "usd_per_unit" double precision NOT NULL, CONSTRAINT "fx_rates_currency_date_pk" PRIMARY KEY("currency","date"));
CREATE TABLE IF NOT EXISTS "transactions" ("id" serial PRIMARY KEY NOT NULL, "date" date NOT NULL, "type" text NOT NULL, "symbol" text, "account" text NOT NULL, "quantity" double precision DEFAULT 0 NOT NULL, "price" double precision DEFAULT 0 NOT NULL, "amount" double precision NOT NULL, "fee" double precision DEFAULT 0 NOT NULL, "fx_rate" double precision DEFAULT 1 NOT NULL, "note" text, "source" text DEFAULT 'auto' NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "events" ("id" serial PRIMARY KEY NOT NULL, "date" date NOT NULL, "symbol" text, "type" text NOT NULL, "title" text NOT NULL, "detail" text, "importance" integer DEFAULT 2 NOT NULL);
CREATE TABLE IF NOT EXISTS "news" ("id" serial PRIMARY KEY NOT NULL, "published_at" timestamp NOT NULL, "headline" text NOT NULL, "summary" text NOT NULL, "source" text NOT NULL, "symbols" jsonb NOT NULL, "topics" jsonb NOT NULL, "sentiment" double precision NOT NULL, "impact" text NOT NULL);
CREATE TABLE IF NOT EXISTS "holding_notes" ("symbol" text PRIMARY KEY NOT NULL, "thesis" text DEFAULT '' NOT NULL, "conviction" integer DEFAULT 3 NOT NULL, "target_price" double precision, "review_date" date, "updated_at" timestamp DEFAULT now() NOT NULL);
CREATE TABLE IF NOT EXISTS "app_settings" ("key" text PRIMARY KEY NOT NULL, "value" jsonb NOT NULL);
`;

let state: { p: Promise<void>; at: number } | null = null;
/** Creates tables if needed and (re)generates market data so it always runs through the latest business day. */
export function ensureDatabase(): Promise<void> {
  const now = Date.now();
  if (state && now - state.at < 10 * 60_000) return state.p;
  const p = bootstrap().catch((e) => {
    state = null;
    throw e;
  });
  state = { p, at: now };
  return p;
}

async function bootstrap() {
  await db.execute(sql.raw(DDL));
  const asOf = currentAsOf();
  const cur = await db.select().from(appSettings).where(eq(appSettings.key, "data_through"));
  if (cur[0]?.value === asOf) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727274)`);
    const again = await tx.select().from(appSettings).where(eq(appSettings.key, "data_through"));
    if (again[0]?.value === asOf) return;
    const S = generateSeries();
    const iAs = idxOn(asOf);

    await tx.delete(instruments);
    await tx.insert(instruments).values(
      UNIVERSE.map((d) => ({ symbol: d.symbol, name: d.name, kind: d.kind, assetClass: d.assetClass, sector: d.sector, industry: d.industry, country: d.country, currency: d.currency, exchange: d.exchange, meta: d.meta })),
    );

    await tx.delete(prices);
    const pr: { symbol: string; date: string; close: number }[] = [];
    for (const def of UNIVERSE) {
      const a = S.px[def.symbol];
      for (let t = 0; t <= iAs; t++) pr.push({ symbol: def.symbol, date: CAL[t], close: rp(a[t]) });
    }
    for (let i = 0; i < pr.length; i += 5000) await tx.insert(prices).values(pr.slice(i, i + 5000));

    await tx.delete(fxRates);
    const fr: { currency: string; date: string; usdPerUnit: number }[] = [];
    for (const c of ["EUR", "GBP", "JPY", "CHF", "DKK"]) {
      const a = S.fx[c];
      for (let t = 0; t <= iAs; t++) fr.push({ currency: c, date: CAL[t], usdPerUnit: Math.round(a[t] * 1e7) / 1e7 });
    }
    for (let i = 0; i < fr.length; i += 5000) await tx.insert(fxRates).values(fr.slice(i, i + 5000));

    await tx.delete(transactions).where(eq(transactions.source, "auto"));
    const txs = simulate(asOf, S);
    for (let i = 0; i < txs.length; i += 1000) await tx.insert(transactions).values(txs.slice(i, i + 1000));

    await tx.delete(events);
    const ev = genEvents(asOf, S);
    for (let i = 0; i < ev.length; i += 1000) await tx.insert(events).values(ev.slice(i, i + 1000));

    await tx.delete(news);
    await tx.insert(news).values(genNews());

    await tx.insert(holdingNotes).values(NOTE_SEEDS).onConflictDoNothing();
    await tx
      .insert(appSettings)
      .values({ key: "data_through", value: asOf })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: asOf } });
  });
}
