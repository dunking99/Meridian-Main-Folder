import { notFound } from "next/navigation";
import ModuleContent, { MODULES } from "@/components/modules/ModuleContent";

export default async function TopLevelModule({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!MODULES[slug]) notFound();
  return <ModuleContent slug={slug} />;
}
