import { heatColor, monthShort, MONTHS } from "@/lib/format";

export default function HeatCalendar({
  years,
}: {
  years: { year: number; months: (number | null)[]; total: number; vol: number }[];
}) {
  return (
    <div className="space-y-2">
      <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: "44px repeat(12, 1fr) 88px" }}>
        <span />
        {MONTHS.map((m) => (
          <span key={m} className="text-center text-[9.5px] uppercase tracking-wider text-tx-3 font-semibold">
            {m}
          </span>
        ))}
        <span className="text-right text-[9.5px] uppercase tracking-wider text-tx-3 font-semibold">Total</span>
      </div>
      {years.map((y) => (
        <div key={y.year} className="grid items-center gap-1.5" style={{ gridTemplateColumns: "44px repeat(12, 1fr) 88px" }}>
          <span className="num text-[11px] text-tx-3">{y.year}</span>
          {y.months.map((m, i) => (
            <div
              key={i}
              title={m === null ? undefined : `${monthShort(i)} ${y.year} · ${(m * 100).toFixed(1)}%`}
              className="h-9 rounded-[5px] transition-transform duration-150 hover:scale-105 hover:z-10 relative"
              style={{
                background: m === null ? "transparent" : heatColor(m),
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.035)",
              }}
            />
          ))}
          <div className="flex items-center justify-end gap-2">
            <span className={`num text-[12px] font-medium ${y.total >= 0 ? "text-up" : "text-down"}`}>
              {(y.total >= 0 ? "+" : "") + (y.total * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 pt-1 text-[10px] text-tx-3">
        <span>worst → best</span>
        <span className="h-2.5 w-24 rounded-full" style={{ background: "linear-gradient(90deg, #E0564E, #151B21, #2FBF87)" }} />
      </div>
    </div>
  );
}
