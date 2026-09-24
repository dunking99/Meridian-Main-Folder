export default function Panel({
  kicker,
  title,
  right,
  className = "",
  bodyClassName = "px-5 pb-5 pt-3.5",
  children,
}: {
  kicker?: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {(kicker || title || right) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {kicker && <div className="kicker">{kicker}</div>}
            {title && <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-tx-1 truncate">{title}</h3>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
