import ModuleContent, { MODULES } from "@/components/modules/ModuleContent";
import { notFound } from "next/navigation";

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!MODULES[slug]) notFound();
  return <ModuleContent slug={slug} />;
}
