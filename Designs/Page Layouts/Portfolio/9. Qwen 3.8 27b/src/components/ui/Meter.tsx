export default function Meter({ score, className = "" }: { score: number; className?: string }) {
  const filled = Math.round((score / 100) * 5);
  const tone = score >= 70 ? "bg-up" : score >= 45 ? "bg-brass" : "bg-down";
  return (
    <div className={`flex gap-1 ${className}`} aria-label={`${score} out of 100`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${i < filled ? tone : "bg-ink-800"}`}
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}
        />
      ))}
    </div>
  );
}
