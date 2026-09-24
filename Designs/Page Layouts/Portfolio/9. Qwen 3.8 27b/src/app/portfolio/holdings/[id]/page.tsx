import HoldingDetail from "@/components/portfolio/HoldingDetail";

export const dynamic = "force-dynamic";

export default async function HoldingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HoldingDetail id={id} />;
}
