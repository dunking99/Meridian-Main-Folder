import type { EventOut } from "@/lib/types";

export default function EventsList({ events }: { events: EventOut[] }) {
  return (
    <ul className="-mx-2">
      {events.map((e) => {
        const d = new Date(e.dateISO);
        const dow = d.toLocaleDateString("en-US", { weekday: "short" });
        const day = d.getUTCDate();
        return (
          <li key={`${e.title}-${e.symbol}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-850/70 transition-colors">
            <div className="w-11 shrink-0 text-center rounded-lg border border-line bg-ink-850 py-1.5">
              <div className="text-[8.5px] uppercase tracking-widest text-tx-3">{dow}</div>
              <div className="font-display text-[17px] leading-none mt-0.5">{day}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium truncate text-tx-1">{e.title}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="chip">{e.symbol}</span>
                <span className="text-[10.5px] text-tx-3">{e.inDays === 0 ? "today" : `in ${e.inDays}d`}</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0" title={`Importance ${e.importance}/3`}>
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= e.importance ? "bg-brass" : "bg-ink-800"}`} />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
