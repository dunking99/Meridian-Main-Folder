import Link from "next/link";
import { notFound } from "next/navigation";

const MODULES: Record<string, { title: string; blurb: string; links: string[] }> = {
  markets: {
    title: "Markets",
    blurb: "Indices, rates, FX, commodities and sector heatmaps — the macro backdrop for everything you own.",
    links: ["Sector heatmap shaded by your look-through exposure", "FX moves translated into P&L on your foreign holdings", "Rates dashboard linked to your bond & REIT sleeve"],
  },
  news: {
    title: "News",
    blurb: "A newsroom that reads with your book in mind. Every story is scored for how much of your money it touches.",
    links: ["Exposure scoring via direct + ETF look-through weights", "Sentiment-weighted relevance ranking", "One click from a headline to the affected holdings"],
  },
  watchlist: {
    title: "Watchlist",
    blurb: "Ideas you don't own yet, sized against what you do.",
    links: ["“What if I bought 2%?” — impact on risk, overlap and sector mix", "Correlation of candidates to the current book", "Price alerts tied to your thesis targets"],
  },
  research: {
    title: "Research",
    blurb: "Screeners, fundamentals and peer comparisons.",
    links: ["Screen for names that diversify your book", "Peer tables that highlight what you already hold", "Thesis notes shared with Portfolio → Holdings"],
  },
  calendar: {
    title: "Calendar",
    blurb: "Earnings, dividends, macro prints and your own thesis-review dates in one timeline.",
    links: ["Expected dividend cash per event", "Earnings dates weighted by position size", "Personal review reminders from holding notes"],
  },
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const m = MODULES[module];
  if (!m) notFound();
  return (
    <main className="mx-auto grid min-h-[80vh] max-w-3xl place-items-center px-6 py-16">
      <section className="card card-hero rise w-full p-10">
        <div className="label flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Module in design
        </div>
        <h1 className="serif mt-4 text-[56px] italic leading-none text-mist-100">{m.title}</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mist-300">{m.blurb}</p>
        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <div className="label mb-4">How it will enrich your portfolio</div>
          <ul className="space-y-3">
            {m.links.map((l) => (
              <li key={l} className="flex items-start gap-3 text-[13.5px] text-mist-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold-400" />
                {l}
              </li>
            ))}
          </ul>
        </div>
        <Link href="/portfolio" className="mt-10 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-4 py-2.5 text-[13px] font-medium text-ink-950 shadow-[0_8px_28px_-10px_rgba(245,189,98,.9)]">
          Open Portfolio →
        </Link>
      </section>
    </main>
  );
}
