import type { Metadata } from "next";
import { HubPage } from "@/components/hub/HubPage";
import { getHub } from "@/lib/cms";

const SLUG = "eat-drink" as const;

export function generateMetadata(): Metadata {
  const hub = getHub(SLUG);
  return { title: hub?.title, description: hub?.intro };
}

export default function Page() {
  return <HubPage slug={SLUG} />;
}
