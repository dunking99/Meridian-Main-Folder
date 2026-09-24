"use client";
import { useState } from "react";
import { corrColor } from "@/lib/format";

export default function CorrMatrix({ labels, matrix }: { labels: string[]; matrix: number[][] }) {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const cell = 34;
  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `56px repeat(${labels.length}, ${cell}px)` }}>
          <span />
          {labels.map((l) => (
            <div key={l} className="flex items-end justify-center pb-1">
              <span className="font-mono text-[9.5px] text-tx-3 leading-tight">{l === "PORTFOLIO" ? "PORT" : l}</span>
            </div>
          ))}
          {labels.map((rl, r) => (
            <Row key={rl} r={r} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-tx-3">
          <span>−1</span>
          <span className="h-2.5 w-28 rounded-full" style={{ background: "linear-gradient(90deg,#E0564E,#151B21,#2FBF87)" }} />
          <span>+1</span>
        </div>
      </div>
      {hover && (
        <div className="mt-2 h-5 text-[11px] text-tx-2">
          <span className="font-mono text-tx-1">{labels[hover[0]]}</span> × <span className="font-mono text-tx-1">{labels[hover[1]]}</span>
          <span className={`num ml-2 ${matrix[hover[0]][hover[1]] >= 0 ? "text-up" : "text-down"}`}>
            r = {matrix[hover[0]][hover[1]].toFixed(2)}
          </span>
          <span className="ml-2 text-tx-3">252-day daily returns</span>
        </div>
      )}
    </div>
  );

  function Row({ r }: { r: number }) {
    return (
      <>
        <div className="flex items-center justify-end pr-2">
          <span className="font-mono text-[10px] text-tx-3">{labels[r] === "PORTFOLIO" ? "PORT" : labels[r]}</span>
        </div>
        {matrix[r].map((c, ci) => {
          const dim = hover && hover[0] !== r && hover[1] !== ci;
          return (
            <div
              key={ci}
              onMouseEnter={() => setHover([r, ci])}
              onMouseLeave={() => setHover(null)}
              className="flex items-center justify-center rounded-[4px] transition-opacity duration-100"
              style={{
                width: cell,
                height: cell,
                background: corrColor(c),
                opacity: dim ? 0.3 : 1,
              }}
              title={`${labels[r]} × ${labels[ci]} = ${c.toFixed(2)}`}
            >
              <span className={`num text-[9.5px] ${r === ci ? "text-tx-3" : "text-white/70"}`}>{c.toFixed(2).replace("0.", ".")}</span>
            </div>
          );
        })}
      </>
    );
  }
}
