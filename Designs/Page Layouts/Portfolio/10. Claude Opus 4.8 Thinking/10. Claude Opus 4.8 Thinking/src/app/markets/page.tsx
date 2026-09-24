import { ComingSoon } from "@/components/coming-soon";

export const dynamic = "force-dynamic";

export default function MarketsPage() {
  return (
    <ComingSoon
      title="Markets"
      desc="Live indices, sectors, rates and commodities — with a lens that highlights what actually moves your book."
      icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>}
    />
  );
}
