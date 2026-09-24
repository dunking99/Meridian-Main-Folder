import Link from "next/link";

export const MODULES: Record<string, { title: string; blurb: string; plan: string[]; glyph: string }> = {
  news: {
    title: "Intelligence",
    blurb: "A research-first newsroom that cross-references every story against your holdings.",
    plan: [
      "Story feed scored for portfolio impact",
      "One-tap “check against my book” overlay",
      "Earnings & macro calendar with read-throughs",
      "Saved digests and thesis notes",
    ],
    glyph: "I",
  },
  watchlist: {
    title: "Watchlist",
    blurb: "Track names you are circling before they become positions.",
    plan: ["Price, valuation and news pulse per name", "Gap alerts vs your cost basis", "One-click move into portfolio (design)"],
    glyph: "W",
  },
  markets: {
    title: "Markets",
    blurb: "Breadth, rates and the macro tape — the context behind every position.",
    plan: ["Index, rate and FX dashboard", "Sector heat and style rotation", "Event-risk gauge ahead of macro prints"],
    glyph: "M",
  },
  research: {
    title: "Research",
    blurb: "Your own vault of theses, checklists and post-mortems.",
    plan: ["Thesis notes attached to every position", "Decision journal with outcome tracking", "Rebalancing simulator"],
    glyph: "R",
  },
  settings: {
    title: "Settings",
    blurb: "Broker feeds, currency base, risk limits and data hygiene.",
    plan: ["Base currency and FX rates", "Import from CSV / broker", "Notification rules", "Data reset & re-seed"],
    glyph: "S",
  },
};

export default function ModuleContent({ slug }: { slug: string }) {
  const m = MODULES[slug] ?? MODULES.research;
  return (
    <div className="max-w-[1560px] mx-auto px-4 lg:px-10 py-10 pt-28 lg:pt-10">
      <div className="panel panel-hero px-8 py-12 relative overflow-hidden">
        <div
          className="absolute -right-6 -top-24 font-display text-[260px] leading-none text-brass opacity-[0.06] select-none pointer-events-none"
          aria-hidden
        >
          {m.glyph}
        </div>
        <div className="kicker">Module in design</div>
        <h1 className="font-display text-4xl mt-3 tracking-tight">{m.title}</h1>
        <p className="text-tx-2 mt-3 max-w-xl leading-relaxed">{m.blurb}</p>
        <div className="mt-8 grid sm:grid-cols-2 gap-2.5 max-w-2xl">
          {m.plan.map((p) => (
            <div key={p} className="flex items-start gap-2.5 text-[13px] text-tx-2 border border-line rounded-lg px-3.5 py-2.5 bg-ink-850/60">
              <svg width="12" height="12" viewBox="0 0 12 12" className="mt-0.5 shrink-0" aria-hidden>
                <circle cx="6" cy="6" r="5" fill="none" stroke="#D9A648" strokeOpacity="0.6" />
                <circle cx="6" cy="6" r="1.6" fill="#D9A648" />
              </svg>
              {p}
            </div>
          ))}
        </div>
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-2 mt-10 text-[13px] font-semibold text-brass2 border border-brass/40 rounded-lg px-4 py-2.5 hover:bg-brass/10 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M8.5 3L5 7l3.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Portfolio
        </Link>
      </div>
    </div>
  );
}
