"use client";
import { useApi } from "@/hooks/useApi";
import { useCurrency } from "@/components/portfolio/CurrencyContext";
import Panel from "@/components/ui/Panel";
import Reveal from "@/components/ui/Reveal";
import Skel from "@/components/ui/Skel";
import Treemap from "@/components/charts/Treemap";
import WorldDots from "@/components/charts/WorldDots";
import WeightRibbon from "@/components/charts/WeightRibbon";
import HoldingsTable from "@/components/portfolio/HoldingsTable";
import type { HoldingsPayload } from "@/lib/types";

export default function HoldingsPage() {
  const { data, error } = useApi<HoldingsPayload>("/api/portfolio/holdings");
  const { money } = useCurrency();

  if (error) {
    return (
      <div className="panel px-6 py-10 text-center">
        <div className="font-display text-xl">Something drifted off course</div>
        <p className="text-tx-3 text-sm mt-2">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skel className="h-24 w-full" />
        <Skel className="h-12 w-full" />
        <div className="grid grid-cols-12 gap-4">
          <Skel className="col-span-12 xl:col-span-8 h-[460px]" />
          <Skel className="col-span-12 xl:col-span-4 h-[460px]" />
        </div>
        <Skel className="h-96 w-full" />
      </div>
    );
  }

  const maxRegion = Math.max(...data.regions.filter((r) => r.inPortfolio).map((r) => r.pct), 1);
  const top = data.rows[0];

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { l: "Positions", v: `${data.rows.length}`, s: "across 5 asset classes" },
            { l: "Invested", v: money(data.total - data.cash.value, true), s: `${((1 - data.cash.pct) * 100).toFixed(1)}% of book` },
            { l: "Cash", v: money(data.cash.value, true), s: `${(data.cash.pct * 100).toFixed(1)}% of book` },
            { l: "Largest position", v: top.id, s: `${(top.weight * 100).toFixed(1)}% · ${money(top.value, true)}` },
          ].map((t) => (
            <div key={t.l} className="panel px-4 py-3.5">
              <div className="text-[9.5px] uppercase tracking-[0.15em] text-tx-3 font-semibold">{t.l}</div>
              <div className="num text-[19px] font-medium mt-1">{t.v}</div>
              <div className="text-[10.5px] text-tx-3 mt-0.5">{t.s}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={60}>
        <Panel kicker="Composition" title="Weight ribbon — who owns your book">
          <WeightRibbon segments={data.ribbon} />
        </Panel>
      </Reveal>

      <div className="grid grid-cols-12 gap-4">
        <Reveal className="col-span-12 xl:col-span-8">
          <Panel kicker="Exposure" title="Position treemap" className="h-full">
            <Treemap items={data.rows.map((r) => ({ id: r.id, value: r.value, color: r.color, ret: r.ret1M }))} height={430} />
          </Panel>
        </Reveal>
        <Reveal className="col-span-12 xl:col-span-4" delay={80}>
          <Panel kicker="Geography" title="Where your money lives" className="h-full">
            <WorldDots weights={data.regions} />
            <div className="mt-4 space-y-2">
              {data.regions
                .filter((r) => r.inPortfolio)
                .sort((a, b) => b.pct - a.pct)
                .slice(0, 6)
                .map((r) => (
                  <div key={r.key} className="flex items-center gap-2.5">
                    <span className="w-28 text-[11.5px] text-tx-2 truncate">{r.label}</span>
                    <span className="h-2 flex-1 rounded-full bg-ink-800 overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(r.pct / maxRegion) * 100}%`, background: "rgba(217,166,72,0.75)" }}
                      />
                    </span>
                    <span className="num text-[11.5px] w-11 text-right">{r.pct.toFixed(1)}%</span>
                  </div>
                ))}
            </div>
            <p className="mt-3.5 text-[10.5px] text-tx-3 leading-relaxed">
              Fund-level underliers included · single names mapped by domicile
            </p>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel kicker="Positions" title="All holdings" bodyClassName="px-5 pb-4 pt-4">
          <HoldingsTable rows={data.rows} cash={data.cash} total={data.total} />
        </Panel>
      </Reveal>
    </div>
  );
}
