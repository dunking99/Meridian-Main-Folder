export default function Delta({
  v,
  digits = 1,
  className = "",
  arrow = true,
  suffix = "%",
}: {
  v: number;
  digits?: number;
  className?: string;
  arrow?: boolean;
  suffix?: string;
}) {
  const up = v >= 0;
  return (
    <span className={`num inline-flex items-center gap-1 text-[12px] font-medium ${up ? "text-up" : "text-down"} ${className}`}>
      {arrow && (
        <svg width="7" height="7" viewBox="0 0 8 8" className={up ? "" : "rotate-180"} aria-hidden>
          <path d="M4 1L7.5 6.5H0.5L4 1z" fill="currentColor" />
        </svg>
      )}
      {(up ? "+" : "") + (v * 100).toFixed(digits) + suffix}
    </span>
  );
}
