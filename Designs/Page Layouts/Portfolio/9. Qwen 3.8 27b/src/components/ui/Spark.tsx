export default function Spark({
  data,
  w = 92,
  h = 26,
  color,
  fill = true,
  className = "",
}: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
  className?: string;
}) {
  if (!data || data.length < 2) return null;
  const mn = Math.min(...data);
  const mx = Math.max(...data);
  const rng = mx - mn || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (w - 2) + 1,
    h - 2 - ((v - mn) / rng) * (h - 4),
  ]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const area = `${line}L${w - 1},${h - 1}L1,${h - 1}Z`;
  const c = color || (data[data.length - 1] >= data[0] ? "#3FD68F" : "#F0655F");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`shrink-0 ${className}`} aria-hidden>
      {fill && <path d={area} fill={c} opacity="0.1" />}
      <path d={line} fill="none" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
