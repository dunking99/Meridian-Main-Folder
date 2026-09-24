import { getPortfolio } from "@/lib/engine";
import { Card } from "@/components/ui";
import { NewsList } from "@/components/overview";
import { Money } from "@/components/money";
import { pct } from "@/lib/format";

export default async function NewsPage() {
  const p = await getPortfolio();
  const held = p.news.filter((n) => n.exposure > 0);
  const byCat = Array.from(new Set(p.news.map((n) => n.category)));
  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-6">
        <div className="eyebrow mb-2 flex items-center gap-2"><span className="h-px w-6 bg-accent" />News · preview</div>
        <h1 className="font-serif text-5xl">What moves <em className="text-accent">your</em> money</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Every story is checked against your portfolio — including holdings hidden inside your funds — and ranked by exposure.</p>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 xl:col-span-8" eyebrow={`${p.news.length} stories · newest first`} title="Feed">
          <NewsList items={p.news} totalValue={p.totals.value} />
        </Card>
        <div className="col-span-12 space-y-4 xl:col-span-4">
          <Card eyebrow="Exposure-weighted" title="Portfolio relevance">
            <div className="space-y-2">
              {[...held].sort((a, b) => b.exposure - a.exposure).slice(0, 8).map((n) => (
                <div key={n.id} className="text-xs">
                  <div className="mb-1 flex justify-between gap-3"><span className="truncate text-muted">{n.headline}</span><Money usd={n.exposure * p.totals.value} compact className="shrink-0" /></div>
                  <div className="h-1.5 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(n.exposure / held[0].exposure) * 40}%`, background: n.sentiment >= 0 ? "#2fe39b" : "#ff5a78" }} /></div>
                </div>
              ))}
            </div>
          </Card>
          <Card eyebrow="Topics" title="Categories">
            <div className="flex flex-wrap gap-2">
              {byCat.map((c) => <span key={c} className="rounded-full border border-line px-3 py-1 text-xs text-muted">{c} <span className="num text-dim">{p.news.filter((n) => n.category === c).length}</span></span>)}
            </div>
            <div className="mt-4 text-xs text-muted">Aggregate mood: <span className="num text-fg">{p.pulse.newsSentiment.toFixed(2)}</span> · {pct(held.length / p.news.length, 0)} of stories touch your book</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
