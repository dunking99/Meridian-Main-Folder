import { timeAgo } from "@/lib/format";
import type { NewsOut } from "@/lib/types";

export default function NewsCard({ n, bookSet }: { n: NewsOut; bookSet: Set<string> }) {
  const mine = n.symbols.filter((s) => bookSet.has(s));
  return (
    <article className="group rounded-xl border border-line bg-ink-850/40 hover:bg-ink-850/80 hover:border-line2 transition-colors p-4">
      <div className="flex items-center gap-2 text-[10.5px] text-tx-3">
        <span className="font-semibold text-tx-2 tracking-wide">{n.source}</span>
        <span aria-hidden>·</span>
        <span>{timeAgo(n.hoursAgo)}</span>
        {n.sentiment > 0.15 && <span className="ml-auto font-mono uppercase tracking-wider text-up text-[9.5px]">bullish</span>}
        {n.sentiment < -0.15 && <span className="ml-auto font-mono uppercase tracking-wider text-down text-[9.5px]">bearish</span>}
      </div>
      <h4 className="mt-2 text-[13.5px] font-semibold leading-snug text-tx-1 group-hover:text-brass2 transition-colors">{n.title}</h4>
      <p className="mt-1.5 text-[12px] text-tx-2 leading-relaxed line-clamp-2">{n.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {n.symbols.map((s) => (
          <span key={s} className={`chip ${bookSet.has(s) ? "chip-hot" : ""}`}>
            {bookSet.has(s) && <span className="h-1 w-1 rounded-full bg-brass inline-block" aria-label="in your portfolio" />}
            {s}
          </span>
        ))}
        {mine.length > 0 && (
          <span className="text-[10px] text-tx-3 italic self-center">
            touches {mine.length} of your {mine.length === 1 ? "holding" : "holdings"}
          </span>
        )}
      </div>
    </article>
  );
}
