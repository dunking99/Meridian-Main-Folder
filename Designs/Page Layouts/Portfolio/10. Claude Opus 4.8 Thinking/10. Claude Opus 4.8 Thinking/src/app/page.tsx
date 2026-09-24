import Link from "next/link";
import { getPortfolio } from "@/lib/portfolio";
import { Sparkline } from "@/components/charts";
import { fmtCompact, fmtSignedPct } from "@/lib/format";

export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default async function Home() {
  const d = await getPortfolio();
  const { summary, risk } = d;
  const spark = d.series.slice(-140).map((s) => s.value);

  const areas = [
    { href: "/portfolio", label: "Portfolio", desc: "Holdings, performance & deep analysis", live: true, accent: "#34e0c4" },
    { href: "/markets", label: "Markets", desc: "Indices, sectors, rates & commodities", live: false, accent: "#7c9bff" },
    { href: "/news", label: "News", desc: "Stories matched to your holdings", live: false, accent: "#f472b6" },
    { href: "/screener", label: "Screener", desc: "Find ideas, test the impact", live: false, accent: "#e8c489" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10 lg:px-14 lg:py-16">
      <div className="grid-dots pointer-events-none absolute inset-0 -z-10 opacity-30" />
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Personal markets workspace
        </div>
        <h1 className="font-serif text-5xl leading-none text-ink lg:text-6xl">Meridian</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-dim">
          Your investing command center. Every area — portfolio, markets, news — reads from the same source of truth and enriches the others.
        </p>

        {/* snapshot */}
        <Link href="/portfolio" className="group mt-9 block">
          <div className="card card-hover overflow-hidden p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-faint">Meridian Core · Net worth</div>
                <div className="tabnum mt-1.5 text-4xl font-semibold text-ink">{usd(summary.totalValue)}</div>
                <div className="mt-2 flex items-center gap-3 text-sm">
                  <span className={`tabnum font-semibold ${summary.dayPct >= 0 ? "text-pos" : "text-neg"}`}>{fmtSignedPct(summary.dayPct)} today</span>
                  <span className="text-ink-faint">·</span>
                  <span className={`tabnum font-semibold ${summary.totalPnl >= 0 ? "text-pos" : "text-neg"}`}>{fmtSignedPct(summary.totalPnlPct)} all-time</span>
                </div>
              </div>
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-faint">Risk</div>
                  <div className="font-serif text-2xl text-ink">{risk.riskGrade}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-faint">Health</div>
                  <div className="font-serif text-2xl text-accent">{risk.healthGrade}</div>
                </div>
                <Sparkline data={spark} color="#34e0c4" width={200} height={56} />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-1 text-sm font-medium text-accent">
              Open portfolio <span className="transition group-hover:translate-x-1">→</span>
            </div>
          </div>
        </Link>

        {/* areas */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((a) => (
            <Link key={a.href} href={a.href} className="card card-hover group p-5">
              <div className="flex items-center justify-between">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.accent }} />
                {a.live ? (
                  <span className="rounded-full bg-[#0f2a22] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-pos">Live</span>
                ) : (
                  <span className="rounded-full bg-[#1b2432] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-faint">Soon</span>
                )}
              </div>
              <div className="mt-4 text-lg font-semibold text-ink">{a.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-ink-faint">{a.desc}</div>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-6 text-xs text-ink-faint">
          <span>{summary.holdingsCount} holdings</span>
          <span>·</span>
          <span>{fmtCompact(risk.effHoldings)} effective positions</span>
          <span>·</span>
          <span>Vol {risk.volAnnual.toFixed(1)}%</span>
          <span>·</span>
          <span>Sharpe {risk.sharpe.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
