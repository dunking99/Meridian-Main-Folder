import Link from "next/link";
import type { ReactNode } from "react";

export function ComingSoon({ title, desc, icon }: { title: string; desc: string; icon: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="grid-dots absolute inset-0 -z-10 opacity-40" />
      <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-panel text-accent">{icon}</span>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> On the roadmap
      </div>
      <h1 className="font-serif text-4xl text-ink">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-dim">{desc}</p>
      <Link
        href="/portfolio"
        className="mt-8 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90"
      >
        Go to Portfolio →
      </Link>
    </div>
  );
}
