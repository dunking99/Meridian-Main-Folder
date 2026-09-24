import Link from "next/link";
import { notFound } from "next/navigation";

const SECTIONS: Record<string, { title: string; blurb: string; items: string[] }> = {
  today: { title: "Today", blurb: "A morning briefing: overnight moves, what changed in your book, and the day's catalysts.", items: ["Overnight P&L attribution", "Pre-market movers you own", "Today's earnings & macro prints", "Briefing generated from Portfolio + News"] },
  markets: { title: "Markets", blurb: "Indices, rates, FX, commodities and crypto — each tile annotated with your exposure.", items: ["Global index heatmap", "Yield curve & rate expectations", "FX board with your currency exposure", "Sector rotation tracker"] },
  watchlist: { title: "Watchlist", blurb: "Names you're tracking, with overlap checks against what you already own through funds.", items: ["Price alerts", "'Already own via VOO' badges", "What-if: add to portfolio", "Valuation bands"] },
  research: { title: "Research", blurb: "Company deep-dives, screeners and notes linked to your holdings.", items: ["Screener", "Financials & estimates", "Your investment theses", "Filing summaries"] },
  planner: { title: "Planner", blurb: "Goals, contributions and Monte Carlo projections powered by your real portfolio stats.", items: ["Goal tracking", "Contribution schedule", "Monte Carlo from realised vol", "Withdrawal & tax scenarios"] },
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = SECTIONS[section];
  if (!s) notFound();
  return (
    <div className="mx-auto max-w-4xl py-10">
      <div className="eyebrow mb-3 flex items-center gap-2"><span className="h-px w-6 bg-accent" />Coming soon</div>
      <h1 className="font-serif text-6xl">{s.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{s.blurb}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {s.items.map((i, k) => (
          <div key={i} className="card p-5" style={{ opacity: 1 - k * 0.12 }}>
            <div className="num mb-2 text-xs text-accent">0{k + 1}</div>
            <div className="text-sm">{i}</div>
          </div>
        ))}
      </div>
      <Link href="/portfolio" className="mt-8 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-ink">Back to Portfolio →</Link>
    </div>
  );
}
