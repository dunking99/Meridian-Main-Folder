import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortfolio, COUNTRY_NAMES } from "@/lib/engine";
import { Card, Stat, SymbolBadge, Pill, Delta } from "@/components/ui";
import { HoldingChart } from "@/components/holding-detail";
import { NewsList, EventsTimeline } from "@/components/overview";
import { Money } from "@/components/money";
import { pct, fmtLocal, BUCKET_COLORS, longDate, tone } from "@/lib/format";

export default async function HoldingPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const p = await getPortfolio();
  const h = p.holdings.find((x) => x.symbol === decodeURIComponent(symbol));
  if (!h) notFound();
  const color = BUCKET_COLORS[h.bucket];
  const trades = p.txns.filter((t) => t.symbol === h.symbol);
  const markers = trades.filter((t) => t.kind === "BUY" || t.kind === "SELL").map((t) => ({ date: t.date, label: `${t.kind} ${t.quantity} @ ${t.price.toFixed(2)}`, color: t.kind === "BUY" ? "#2fe39b" : "#ff5a78" }));
  const exposure = p.lookThrough.find((l) => l.symbol === h.symbol);
  const news = p.news.filter((n) => n.symbols.includes(h.symbol) || (h.lookThrough ?? []).some((c) => n.symbols.includes(c.symbol)));
  const events = p.events.filter((e) => e.symbol === h.symbol);
  const direct = new Set(p.holdings.map((x) => x.symbol));
  const rank = p.holdings.indexOf(h) + 1;
  const totalGainAll = p.attribution.reduce((s, a) => s + a.value, 0);
  const idx = p.holdings.findIndex((x) => x.symbol === h.symbol);
  const others = p.corrMatrix.symbols.includes(h.symbol)
    ? p.corrMatrix.symbols.map((s, j) => ({ s, c: p.corrMatrix.matrix[p.corrMatrix.symbols.indexOf(h.symbol)][j] })).filter((x) => x.s !== h.symbol).sort((a, b) => b.c - a.c)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/portfolio/holdings" className="hover:text-accent">← Holdings</Link>
        <span className="text-dim">/</span>
        <span>{h.symbol}</span>
        <span className="ml-auto flex gap-2">
          {idx > 0 && <Link href={`/portfolio/holdings/${p.holdings[idx - 1].symbol}`} className="rounded-md border border-line px-2 py-0.5 hover:text-fg">‹ {p.holdings[idx - 1].symbol}</Link>}
          {idx < p.holdings.length - 1 && <Link href={`/portfolio/holdings/${p.holdings[idx + 1].symbol}`} className="rounded-md border border-line px-2 py-0.5 hover:text-fg">{p.holdings[idx + 1].symbol} ›</Link>}
        </span>
      </div>

      <section className="card card-glow rise p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="scale-150 p-2"><SymbolBadge symbol={h.symbol} color={color} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-4xl leading-none">{h.name}</h2>
              <Pill color={color}>{h.bucket}</Pill>
              <Pill>{h.kind}</Pill>
            </div>
            <div className="mt-2 text-sm text-muted">{h.symbol} · {h.exchange} · {h.currency} · {h.sector} / {h.industry} · {COUNTRY_NAMES[h.country] ?? h.region}</div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{h.description}</p>
          </div>
          <div className="text-right">
            <div className="num text-4xl">{fmtLocal(h.price, h.currency)}</div>
            <div className="mt-1 flex items-center justify-end gap-2 text-sm"><Delta value={h.dayPct} /> <span className="text-dim">today</span></div>
            <div className="mt-3 flex justify-end gap-1.5">
              {([["1W", h.r1w], ["1M", h.r1m], ["3M", h.r3m], ["YTD", h.rYtd], ["1Y", h.r1y]] as const).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-ink/50 px-2 py-1 text-center">
                  <div className="text-[9px] text-dim">{k}</div>
                  <div className={`num text-xs ${tone(v)}`}>{pct(v, 1, true)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-8" eyebrow="Green = buys · red = sells" title="Price history & trades">
          <HoldingChart dates={p.dates} price={p.priceSeries[h.symbol]} position={p.posValue[h.symbol]} idx={p.series.idx} markers={markers} symbol={h.symbol} />
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow={`#${rank} by size`} title="Your position">
          <div className="mb-4">
            <Money usd={h.value} className="font-serif text-4xl" />
            <div className="mt-1 text-xs text-muted">{h.qty < 10 ? h.qty.toFixed(4) : h.qty.toLocaleString()} units · {pct(h.weight, 2)} of portfolio</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Avg cost" value={fmtLocal(h.avgCost, h.currency)} sub={<Money usd={h.cost} compact />} />
            <Stat label="Unrealised" value={<Money usd={h.pnl} compact sign colored />} sub={<span className={tone(h.pnlPct)}>{pct(h.pnlPct, 1, true)}</span>} />
            <Stat label="Realised" value={<Money usd={h.realized} compact sign colored />} sub="from sales" />
            <Stat label="Income received" value={<Money usd={h.income} compact />} sub={`yield ${pct(h.divYield, 2)}`} />
            <Stat label="Total return" value={<Money usd={h.totalReturn} compact sign colored />} sub={`${pct(h.totalReturn / (totalGainAll || 1), 1)} of all gains`} />
            <Stat label="Held since" value={longDate(h.firstBuy)} sub={`${Math.round((new Date(p.asOf).getTime() - new Date(h.firstBuy).getTime()) / 86400000 / 30.4)} months`} />
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Fundamentals & risk" title="Key stats">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="P/E" value={h.pe ? h.pe.toFixed(1) : "—"} />
            <Stat label="Div yield" value={pct(h.divYield, 2)} />
            <Stat label="Beta" value={h.beta.toFixed(2)} />
            <Stat label="Mkt cap" value={h.marketCapB ? `$${h.marketCapB >= 1000 ? (h.marketCapB / 1000).toFixed(2) + "T" : h.marketCapB + "B"}` : "—"} />
            <Stat label="Expense" value={h.expenseRatio !== null ? pct(h.expenseRatio, 2) : "—"} />
            <Stat label="Vol 1Y" value={pct(h.vol1y, 0)} />
          </div>
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-[11px] text-muted"><span>52w low {fmtLocal(h.low52, h.currency)}</span><span>high {fmtLocal(h.high52, h.currency)}</span></div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-neg/50 via-line2 to-pos/50">
              <div className="absolute -top-1.5 h-5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_#d4ff3a]" style={{ left: `${((h.price - h.low52) / (h.high52 - h.low52 || 1)) * 100}%` }} />
            </div>
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="How it behaves in the book" title="Portfolio role">
          <div className="space-y-4">
            {[["Capital weight", h.weight, "#8f7cff"], ["Risk contribution", h.riskContribution, "#ff5a78"]].map(([l, v, c]) => (
              <div key={l as string}>
                <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{l as string}</span><span className="num">{pct(v as number, 1)}</span></div>
                <div className="h-2 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (v as number) * 500)}%`, background: c as string }} /></div>
              </div>
            ))}
            <div className="rounded-xl bg-ink/40 p-3 text-xs leading-relaxed text-muted">
              {h.riskContribution > h.weight * 1.2 ? <>Punches <span className="text-neg">above its weight</span> in risk — {(h.riskContribution / h.weight).toFixed(1)}× its capital share.</> : h.riskContribution < h.weight * 0.8 ? <>A <span className="text-pos">diversifier</span> — adds less risk ({(h.riskContribution / h.weight).toFixed(1)}×) than its capital share.</> : <>Risk roughly proportional to its weight.</>}
              {" "}Correlation to portfolio: <span className="num text-fg">{h.corrToPortfolio.toFixed(2)}</span>.
            </div>
            {others.length > 0 && (
              <div className="text-xs">
                <div className="eyebrow mb-1">Moves most with</div>
                <div className="flex flex-wrap gap-1.5">{others.slice(0, 4).map((o) => <Link key={o.s} href={`/portfolio/holdings/${o.s}`} className="rounded-md border border-line px-2 py-0.5 hover:text-accent">{o.s} <span className="num text-violet">{o.c.toFixed(2)}</span></Link>)}</div>
              </div>
            )}
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-4" eyebrow="Direct + hidden in funds" title={h.lookThrough ? "What's inside" : "True exposure"}>
          {h.lookThrough ? (
            <div className="space-y-1.5">
              {h.lookThrough.map((c) => (
                <div key={c.symbol} className="grid grid-cols-[64px_1fr_64px] items-center gap-2 text-xs">
                  {direct.has(c.symbol) ? <Link href={`/portfolio/holdings/${c.symbol}`} className="font-semibold text-accent">{c.symbol}</Link> : <span className="text-muted">{c.symbol}</span>}
                  <div className="h-1.5 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(c.weight / h.lookThrough![0].weight) * 100}%`, background: direct.has(c.symbol) ? "#d4ff3a" : "#565d6e" }} /></div>
                  <Money usd={c.weight * h.value} compact className="text-right text-muted" />
                </div>
              ))}
              <div className="pt-2 text-[11px] text-dim"><span className="text-accent">Highlighted</span> = you also own it directly (overlap).</div>
            </div>
          ) : exposure ? (
            <div>
              <div className="mb-3 flex items-baseline gap-2"><span className="num text-3xl">{pct(exposure.total, 2)}</span><span className="text-xs text-muted">of portfolio</span></div>
              <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                <div className="bg-accent" style={{ width: `${(exposure.direct / exposure.total) * 100}%` }} />
                {exposure.via.map((v, i) => <div key={v.fund} style={{ width: `${(v.weight / exposure.total) * 100}%`, background: ["#8f7cff", "#3fd0ff", "#ff7ad9"][i % 3] }} />)}
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted">Direct</span><span className="num">{pct(exposure.direct, 2)} · <Money usd={exposure.direct * p.totals.value} compact /></span></div>
                {exposure.via.map((v) => <div key={v.fund} className="flex justify-between"><span className="text-muted">via <Link href={`/portfolio/holdings/${v.fund}`} className="text-fg hover:text-accent">{v.fund}</Link></span><span className="num">{pct(v.weight, 2)} · <Money usd={v.weight * p.totals.value} compact /></span></div>)}
              </div>
            </div>
          ) : <div className="text-sm text-muted">No look-through data.</div>}
        </Card>

        <Card className="col-span-12 xl:col-span-8" eyebrow={`${trades.length} entries`} title="Lots, trades & dividends">
          <div className="-mx-5 max-h-[340px] overflow-auto scroll-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-dim">
                  <th className="px-5 pb-2 font-medium">Date</th><th className="pb-2 font-medium">Type</th><th className="pb-2 text-right font-medium">Qty</th><th className="pb-2 text-right font-medium">Price</th><th className="px-5 pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-line/60">
                    <td className="num px-5 py-2 text-muted">{longDate(t.date)}</td>
                    <td><Pill color={t.kind === "BUY" ? "#2fe39b" : t.kind === "SELL" ? "#ff5a78" : "#3fd0ff"}>{t.kind}</Pill></td>
                    <td className="num text-right">{t.kind === "DIVIDEND" ? "—" : t.quantity}</td>
                    <td className="num text-right">{fmtLocal(t.price, t.currency, t.kind === "DIVIDEND" ? 4 : 2)}</td>
                    <td className={`num px-5 text-right ${tone(t.amount)}`}>{fmtLocal(t.amount, t.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="col-span-12 xl:col-span-4" eyebrow="Catalysts" title="Upcoming events">
          {events.length ? <EventsTimeline events={events} asOf={p.asOf} /> : <div className="text-sm text-muted">No scheduled events in the next 5 weeks.</div>}
        </Card>
        {news.length > 0 && (
          <Card className="col-span-12" eyebrow={h.lookThrough ? "About this fund's constituents" : "Mentions"} title="Related news">
            <NewsList items={news} totalValue={p.totals.value} />
          </Card>
        )}
      </div>
    </div>
  );
}
