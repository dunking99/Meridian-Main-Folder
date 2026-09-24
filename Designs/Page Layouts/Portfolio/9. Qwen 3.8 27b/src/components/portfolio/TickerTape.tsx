"use client";
import Delta from "@/components/ui/Delta";
import { useApi } from "@/hooks/useApi";

type Lite = { symbol: string; name: string; price: number; dayChange: number };

function TapeItem({ it }: { it: Lite }) {
  return (
    <span className="flex items-center gap-2 px-4 py-1.5 text-[11.5px] whitespace-nowrap">
      <span className="font-mono font-semibold tracking-wide text-tx-1">{it.symbol}</span>
      <span className="num text-tx-3">${it.price.toFixed(2)}</span>
      <Delta v={it.dayChange} />
      <svg width="6" height="6" viewBox="0 0 6 6" className="ml-1 text-brass/50" aria-hidden>
        <rect x="0.8" y="0.8" width="4.4" height="4.4" transform="rotate(45 3 3)" fill="currentColor" />
      </svg>
    </span>
  );
}

export default function TickerTape() {
  const { data } = useApi<Lite[]>("/api/portfolio/holdings?lite=1");
  if (!data || data.length === 0) {
    return <div className="mt-4 border-y border-line/60 py-2" aria-hidden />;
  }
  const doubled = [...data, ...data];
  return (
    <div className="tape mt-4 overflow-hidden border-y border-line/70 bg-ink-900/40" aria-hidden>
      <div className="tape-track">
        {doubled.map((it, i) => (
          <TapeItem key={`${it.symbol}-${i}`} it={it} />
        ))}
      </div>
    </div>
  );
}
