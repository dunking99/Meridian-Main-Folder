export default function WeightRibbon({
  segments,
}: {
  segments: { key: string; label: string; pct: number; color: string }[];
}) {
  return (
    <div>
      <div className="flex h-10 w-full overflow-hidden rounded-lg border border-line" role="img" aria-label="Portfolio weight ribbon">
        {segments.map((s) => (
          <div
            key={s.key}
            title={`${s.label} · ${s.pct.toFixed(1)}%`}
            className="group relative h-full transition-[filter] duration-150 hover:brightness-150"
            style={{ width: `${s.pct}%`, background: s.color, opacity: 0.75, boxShadow: "inset -1px 0 0 rgba(10,13,17,0.9)" }}
          >
            {s.pct > 6 && (
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[10.5px] font-semibold text-ink-950/85 pointer-events-none">
                {s.label}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-tx-2">
            <span className="h-2 w-2 rounded-[3px]" style={{ background: s.color, opacity: 0.85 }} />
            {s.label}
            <span className="num text-tx-3">{s.pct.toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
