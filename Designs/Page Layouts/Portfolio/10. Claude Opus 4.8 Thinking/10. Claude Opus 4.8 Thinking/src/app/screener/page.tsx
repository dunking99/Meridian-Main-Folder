import { ComingSoon } from "@/components/coming-soon";

export const dynamic = "force-dynamic";

export default function ScreenerPage() {
  return (
    <ComingSoon
      title="Screener"
      desc="Hunt for ideas with factor filters, then instantly see how each candidate would reshape your risk and allocation."
      icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>}
    />
  );
}
