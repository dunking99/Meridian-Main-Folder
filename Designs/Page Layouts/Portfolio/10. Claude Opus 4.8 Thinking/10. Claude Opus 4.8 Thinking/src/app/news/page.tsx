import { ComingSoon } from "@/components/coming-soon";

export const dynamic = "force-dynamic";

export default function NewsPage() {
  return (
    <ComingSoon
      title="News"
      desc="A market newsroom that cross-references every story against your holdings, so relevance is automatic."
      icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>}
    />
  );
}
