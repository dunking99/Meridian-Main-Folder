import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { bsearchLE, daysBetween, getEvents, getNews, getNotes, getPortfolio, periodIndex, pxDisp, shiftDate, symbolPnl } from "@/lib/engine";
import { exposures, riskModel } from "@/lib/analytics";
import { fmtDate, fmtNum, fmtPct, fmtPrice, fmtQty, relTime } from "@/lib/format";
import { ACCOUNTS, EVENT_META, SECTOR_COLORS, countryName } from "@/lib/reference";
import { Card, Flag, HoldingLink, Money, Monogram, Pct, Pill } from "@/components/ui";
import { TimeChart, type TMarker } from "@/components/client";
import { NoteEditor } from "@/components/forms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return { title: decodeURIComponent(symbol) };
}

export default async function HoldingPage({ params }: { params: Promise<{ symbol: string }> }) {
  const sym = decodeURIComponent((await params).symbol);
  const [core, events, news, notes] = await Promise.all([getPortfolio(), getEvents(), getNews(), getNotes()]);
  const inst = core.market.bySym[sym];
  if (!inst || inst.kind === "benchmark") notFound();
  const ccy = core.ccy;
  const pos = core.positions.find((p) => p.symbol === sym);
  const closed = core.closed.find((c) => c.symbol === sym);
  const m = inst.meta;
  const md = core.market.dates;
  const iEnd = md.length - 1;
  const px = core.market.px[sym];
  const price = px[iEnd], prev = px[iEnd - 1];
  const note = notes.find((x) => x.symbol === sym) ?? null;

  // chart series over the portfolio's life
  const dates = core.dates;
  const priceLocal = dates.map((_, k) => Math.round(px[core.start + k] * 1e4) / 1e4);
  const priceDispIdx = dates.map((_, k) => Math.round(pxDisp(core, sym, core.start + k) * 1e4) / 1e4);
  const txs = core.txBySym[sym] ?? [];
  const markers: TMarker[] = txs.filter((t) => t.type === "BUY" || t.type === "SELL").map((t) => ({ date: t.date, kind: t.type === "BUY" ? "buy" : "sell", label: `${t.type} ${fmtQty(t.quantity)} @ ${fmtPrice(t.price, inst.currency)}${t.note ? " — " + t.note : ""}` }));

  // 52-week range
  const i52 = Math.max(0, bsearchLE(md, shiftDate(core.asOf, { years: -1 })));
  let lo = Infinity, hi = -Infinity;
  for (let i = i52; i <= iEnd; i++) { lo = Math.min(lo, px[i]); hi = Math.max(hi, px[i]); }
  const rangePos = (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));

  const risk = pos ? riskModel(core) : null;
  const rh = risk?.holdings.find((h) => h.symbol === sym);
  const k1y = periodIndex(core, "1Y");
  const contrib1y = core.qtyHist[sym] ? symbolPnl(core, sym, k1y, dates.length - 1) / core.value[k1y] : 0;
  const exp = exposures(core);
  const lookThrough = exp.issuers.find((i) => i.key === sym);
  const heldSyms = new Set(core.positions.map((p) => p.symbol));

  const evs = events.filter((e) => e.symbol === sym && e.date > core.asOf).slice(0, 6);
  const nws = news.filter((n) => n.symbols.includes(sym)).slice(0, 4);
  const now = new Date(core.asOf + "T21:00:00Z").getTime();

  return (
    <div className="space-y-4">
      <Link href="/portfolio/holdings" className="inline-flex items-center gap-2 text-[12px] text-mist-400 hover:text-gold-300">← All holdings</Link>

      <section className="card card-hero rise relative overflow-hidden px-6 py-5">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full blur-3xl" style={{ background: `${m.color}22` }} />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Monogram symbol={sym} color={m.color} size={56} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="serif text-[38px] leading-none text-white">{inst.name}</h2>
                {!pos && <Pill tone="mute">Closed position</Pill>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-mist-400">
                <span className="num text-mist-100">{sym}</span><span>·</span><span>{inst.exchange}</span><span>·</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: SECTOR_COLORS[inst.sector] ?? "#999" }} />{inst.sector}</span><span>·</span>
                <span>{inst.industry}</span><span>·</span><span className="flex items-center gap-1"><Flag code={inst.country} /> {countryName(inst.country)}</span><span>·</span>
                <span>{ACCOUNTS[m.account]?.label}</span>
              </div>
              <p className="mt-2 max-w-xl text-[12.5px] text-mist-400">{m.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <div className="label">Last · {inst.currency}</div>
              <div className="num mt-2 text-[30px] font-light leading-none text-white">{fmtPrice(price, inst.currency)}</div>
              <Pct v={price / prev - 1} dp={2} className="mt-1 block text-[12px]" />
            </div>
            {pos && (
              <>
                <div>
                  <div className="label">Position · {ccy}</div>
                  <Money v={pos.value} ccy={ccy} className="mt-2 block text-[30px] font-light leading-none text-white" />
                  <span className="mt-1 block text-[12px] text-mist-400"><span className="num text-mist-200">{fmtPct(pos.weight, 2, false)}</span> of book</span>
                </div>
                <div>
                  <div className="label">Unrealized</div>
                  <Money v={pos.unrealized} ccy={ccy} compact sign className={`mt-2 block text-[30px] font-light leading-none ${pos.unrealized >= 0 ? "text-up" : "text-down"}`} />
                  <Pct v={pos.unrealizedPct} className="mt-1 block text-[12px]" />
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-8" title="Price & your trades" index="01">
          <TimeChart
            dates={dates}
            ccy={ccy}
            priceCcy={inst.currency}
            defaultRange="1Y"
            ranges={["1M", "3M", "YTD", "1Y", "3Y", "ALL"]}
            series={[
              { key: "price", label: `${sym} (${inst.currency})`, values: priceLocal, color: m.color, style: "area" },
              { key: "pidx", label: sym, values: priceDispIdx, color: m.color, style: "area" },
              { key: "book", label: "Your book (TWR)", values: core.index, color: "#f5bd62", style: "line" },
              { key: "acwi", label: "MSCI ACWI", values: core.bench.ACWI.index, color: "#7cc4ff", style: "dash" },
            ]}
            views={[
              { key: "price", label: "Price", series: ["price"], format: "price" },
              { key: "vs", label: `vs Book (${ccy})`, series: ["pidx", "book", "acwi"], format: "pct", rebase: "pct" },
            ]}
            markers={markers}
            refLines={[
              ...(pos ? [{ value: pos.avgCostLocal, label: `Avg cost ${fmtPrice(pos.avgCostLocal, inst.currency)}`, color: "#b69cff", views: ["price"] }] : []),
              ...(note?.targetPrice ? [{ value: note.targetPrice, label: `Target ${fmtPrice(note.targetPrice, inst.currency)}`, color: "#3ee0a1", views: ["price"] }] : []),
            ]}
            height={320}
          />
          <div className="mt-2 flex gap-4 text-[10.5px] text-mist-500"><span className="flex items-center gap-1"><span className="text-up">▲</span> buy</span><span className="flex items-center gap-1"><span className="text-down">▼</span> sell</span></div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Position" index="02">
          {pos ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <KV k="Quantity" v={<span className="num">{fmtQty(pos.qty)}</span>} />
              <KV k="Avg cost" v={<span className="num">{fmtPrice(pos.avgCostLocal, inst.currency)}</span>} />
              <KV k="Cost basis" v={<Money v={pos.cost} ccy={ccy} dp={0} />} />
              <KV k="Market value" v={<Money v={pos.value} ccy={ccy} dp={0} />} />
              <KV k="Realized P&L" v={<Money v={pos.realized} ccy={ccy} compact sign className={pos.realized >= 0 ? "text-up" : "text-down"} />} />
              <KV k="Dividends received" v={<Money v={pos.dividends} ccy={ccy} compact className="text-up" />} />
              <KV k="Total return" v={<><Money v={pos.totalReturn} ccy={ccy} compact sign className={pos.totalReturn >= 0 ? "text-up" : "text-down"} /> <Pct v={pos.totalReturnPct} className="text-[11px]" /></>} />
              <KV k="Today" v={<Money v={pos.dayChange} ccy={ccy} compact sign className={pos.dayChange >= 0 ? "text-up" : "text-down"} />} />
              <KV k="First bought" v={<span className="num">{fmtDate(pos.firstBuy, "medium")}</span>} />
              <KV k="Held" v={<span className="num">{(daysBetween(pos.firstBuy, core.asOf) / 365).toFixed(1)} yrs</span>} />
              <KV k="Yield on cost" v={<span className="num">{fmtPct(pos.cost ? (pos.value * m.divYield) / 100 / pos.cost : 0, 2, false)}</span>} />
              <KV k="Fees paid" v={<Money v={pos.fees} ccy={ccy} dp={2} className="text-mist-300" />} />
            </div>
          ) : closed ? (
            <div className="grid grid-cols-2 gap-4">
              <KV k="Realized P&L" v={<Money v={closed.realized} ccy={ccy} compact sign className={closed.realized >= 0 ? "text-up" : "text-down"} />} />
              <KV k="Dividends" v={<Money v={closed.dividends} ccy={ccy} compact />} />
              <KV k="Opened" v={fmtDate(closed.firstBuy, "medium")} />
              <KV k="Closed" v={fmtDate(closed.lastSell, "medium")} />
              <KV k="Since exit" v={<Pct v={price / (txs.filter((t) => t.type === "SELL").at(-1)?.price ?? price) - 1} />} />
            </div>
          ) : (
            <p className="text-[12px] text-mist-500">Not held.</p>
          )}
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <div className="label mb-3 flex justify-between"><span>52-week range</span><span className="num normal-case tracking-normal text-mist-400">{fmtPrice(lo, inst.currency)} — {fmtPrice(hi, inst.currency)}</span></div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-down/40 via-white/10 to-up/40">
              <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded bg-white shadow-[0_0_10px_white]" style={{ left: `${rangePos(price) * 100}%` }} title="Last" />
              {pos && pos.avgCostLocal >= lo && pos.avgCostLocal <= hi && <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded bg-violet" style={{ left: `${rangePos(pos.avgCostLocal) * 100}%` }} title="Avg cost" />}
            </div>
            <div className="mt-2 flex gap-3 text-[10.5px] text-mist-500"><span className="flex items-center gap-1"><span className="h-2 w-1 rounded bg-white" /> last</span>{pos && <span className="flex items-center gap-1"><span className="h-2 w-1 rounded bg-violet" /> your avg cost {pos.avgCostLocal < lo ? "(below range)" : pos.avgCostLocal > hi ? "(above range)" : ""}</span>}</div>
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Role in your portfolio" index="03">
          {pos && rh ? (
            <div className="space-y-4">
              {[
                { k: "Capital weight", v: pos.weight, c: "#f5bd62" },
                { k: "Share of portfolio risk", v: rh.rc, c: "#ff8a5c" },
                { k: "1Y return contribution", v: contrib1y, c: contrib1y >= 0 ? "#3ee0a1" : "#ff6b6b" },
              ].map((r) => (
                <div key={r.k}>
                  <div className="flex justify-between text-[12px]"><span className="text-mist-300">{r.k}</span><span className="num text-mist-100">{fmtPct(r.v, 2, r.k.includes("contribution"))}</span></div>
                  <div className="mt-1.5 h-2 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(r.v) / Math.max(pos.weight, rh.rc, Math.abs(contrib1y)) * 100)}%`, background: r.c, boxShadow: `0 0 12px -2px ${r.c}` }} /></div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
                <KV k="Vol 1Y" v={fmtPct(rh.vol, 1, false)} />
                <KV k="Beta" v={fmtNum(rh.beta, 2)} />
                <KV k="ρ to book" v={fmtNum(rh.corrP, 2)} />
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3 text-[12px] text-mist-300 ring-1 ring-inset ring-white/[0.05]">
                A <span className="num text-down">−10%</span> move in {sym} moves your book by <span className="num text-down">{fmtPct(-pos.weight * 0.1, 2)}</span> (<Money v={-pos.value * 0.1} ccy={ccy} compact className="text-down" />).
                {lookThrough && lookThrough.total - lookThrough.direct > 0.0005 && <> Including ETF look-through you own <span className="num text-gold-300">{fmtPct(lookThrough.total, 2, false)}</span> of {sym} in total.</>}
              </div>
            </div>
          ) : <p className="text-[12px] text-mist-500">Position closed — no current risk contribution.</p>}
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title="Key stats" index="04">
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <KV k="P/E" v={m.pe ? fmtNum(m.pe, 1) + "×" : "—"} />
            <KV k="Dividend yield" v={m.divYield ? fmtPct(m.divYield / 100, 2, false) : "—"} />
            <KV k="Beta (reported)" v={fmtNum(m.beta, 2)} />
            <KV k="Market cap" v={m.mcap ? `$${m.mcap >= 1000 ? (m.mcap / 1000).toFixed(2) + "T" : m.mcap + "B"}` : "—"} />
            <KV k="Expense ratio" v={m.ter ? fmtPct(m.ter / 100, 2, false) : inst.kind === "stock" ? "n/a" : "—"} />
            <KV k="Pays" v={m.divFreq ? `${m.divFreq}× / year` : "No dividend"} />
            <KV k="1M" v={<Pct v={pos?.ret["1M"] ?? null} />} />
            <KV k="YTD" v={<Pct v={pos?.ret.YTD ?? null} />} />
            <KV k="1Y" v={<Pct v={pos?.ret["1Y"] ?? null} />} />
            <KV k="3Y" v={<Pct v={pos?.ret["3Y"] ?? null} />} />
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" title={m.top ? "Inside this fund" : "Upcoming & news"} index="05">
          {m.top ? (
            <div className="space-y-2">
              {m.top.slice(0, 10).map(([k, name, w]) => (
                <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-3 text-[12px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="num text-mist-100">{k}</span><span className="truncate text-[11px] text-mist-500">{name}</span>{heldSyms.has(k) && <Pill tone="gold">you hold</Pill>}</div>
                    <div className="mt-1 h-1 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${(w / m.top![0][2]) * 100}%`, background: heldSyms.has(k) ? "#f5bd62" : "#5d6575" }} /></div>
                  </div>
                  <span className="num text-mist-300">{w.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <EventsAndNews evs={evs} nws={nws} now={now} />
          )}
        </Card>

        <Card className="col-span-12 xl:col-span-7" title="Your thesis" index="06" subtitle="Private notes — review dates appear in your upcoming events">
          <NoteEditor symbol={sym} price={price} priceCcy={inst.currency} initial={note ? { thesis: note.thesis, conviction: note.conviction, targetPrice: note.targetPrice, reviewDate: note.reviewDate, updatedAt: note.updatedAt } : null} />
        </Card>

        {m.top ? (
          <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Upcoming & news" index="07"><EventsAndNews evs={evs} nws={nws} now={now} /></Card>
        ) : (
          <Card className="col-span-12 md:col-span-6 xl:col-span-5" title="Tax lots · FIFO" index="07" bodyClass="!px-0 !pb-2">
            <Lots pos={pos} ccy={ccy} asOf={core.asOf} currency={inst.currency} />
          </Card>
        )}

        {m.top && (
          <Card className="col-span-12 xl:col-span-6" title="Tax lots · FIFO" index="08" bodyClass="!px-0 !pb-2">
            <Lots pos={pos} ccy={ccy} asOf={core.asOf} currency={inst.currency} />
          </Card>
        )}

        <Card className={`col-span-12 ${m.top ? "xl:col-span-6" : ""}`} title="Transactions" index={m.top ? "09" : "08"} bodyClass="!px-0 !pb-2">
          <div className="max-h-[340px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <tbody>
                {[...txs].reverse().slice(0, 40).map((t) => (
                  <tr key={t.id} className="border-t border-white/[0.04] first:border-0">
                    <td className="num px-5 py-2 text-mist-400">{fmtDate(t.date, "medium")}</td>
                    <td className="py-2"><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${t.type === "BUY" ? "bg-sky/10 text-sky" : t.type === "SELL" ? "bg-violet/10 text-violet" : "bg-up/10 text-up"}`}>{t.type}</span></td>
                    <td className="py-2 text-mist-300"><span className="num">{fmtQty(t.quantity)}</span> {t.type === "DIVIDEND" ? "sh ×" : "@"} <span className="num">{fmtPrice(t.price, inst.currency)}</span> {t.note && <span className="text-mist-500">· {t.note}</span>}</td>
                    <td className="px-5 py-2 text-right"><Money v={t.amountDisp} ccy={ccy} sign className={t.amountDisp >= 0 ? "text-up" : "text-mist-200"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label !text-[9.5px]">{k}</div>
      <div className="mt-1.5 truncate text-[14px] text-mist-100">{v}</div>
    </div>
  );
}

function Lots({ pos, ccy, asOf, currency }: { pos: Awaited<ReturnType<typeof getPortfolio>>["positions"][number] | undefined; ccy: string; asOf: string; currency: string }) {
  if (!pos) return <p className="px-5 text-[12px] text-mist-500">No open lots.</p>;
  const unit = pos.priceDisp;
  return (
    <div className="max-h-[340px] overflow-y-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="label text-left">
            <th className="px-5 pb-2 font-normal">Lot</th>
            <th className="pb-2 text-right font-normal">Qty</th>
            <th className="pb-2 text-right font-normal">Cost/sh</th>
            <th className="pb-2 text-right font-normal">Gain</th>
            <th className="px-5 pb-2 text-right font-normal">Term</th>
          </tr>
        </thead>
        <tbody>
          {pos.lots.map((l, i) => {
            const gain = l.qty * (unit - l.costPer);
            const lt = daysBetween(l.date, asOf) > 365;
            return (
              <tr key={i} className="border-t border-white/[0.04]">
                <td className="num px-5 py-2 text-mist-300">{fmtDate(l.date, "medium")}</td>
                <td className="num py-2 text-right text-mist-200">{fmtQty(l.qty)}</td>
                <td className="num py-2 text-right text-mist-400">{fmtPrice(l.localPer, currency)}</td>
                <td className="py-2 text-right"><Money v={gain} ccy={ccy} compact sign className={gain >= 0 ? "text-up" : "text-down"} /><Pct v={unit / l.costPer - 1} className="block text-[10px]" /></td>
                <td className="px-5 py-2 text-right"><Pill tone={lt ? "up" : "gold"}>{lt ? "Long" : "Short"}</Pill></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EventsAndNews({ evs, nws, now }: { evs: { date: string; type: string; title: string; detail: string | null }[]; nws: { id: number; headline: string; source: string; publishedAt: string; sentiment: number }[]; now: number }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {evs.length === 0 && <div className="text-[12px] text-mist-500">No scheduled events.</div>}
        {evs.map((e, i) => (
          <div key={i} className="flex items-center gap-3 text-[12px]">
            <span className="num w-14 text-mist-100">{fmtDate(e.date, "short")}</span>
            <span className="h-4 w-1 rounded-full" style={{ background: EVENT_META[e.type]?.color }} />
            <span className="text-mist-200">{e.title}</span>
            <span className="ml-auto truncate text-[11px] text-mist-500">{e.detail}</span>
          </div>
        ))}
      </div>
      {nws.length > 0 && (
        <div className="space-y-2.5 border-t border-white/[0.06] pt-3">
          {nws.map((n) => (
            <div key={n.id} className="flex gap-2.5">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.sentiment >= 0 ? "bg-up" : "bg-down"}`} />
              <div className="min-w-0">
                <div className="text-[12.5px] leading-snug text-mist-100">{n.headline}</div>
                <div className="text-[10.5px] text-mist-500">{n.source} · {relTime(Math.max(0, (now - new Date(n.publishedAt.replace(" ", "T") + "Z").getTime()) / 36e5))}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
