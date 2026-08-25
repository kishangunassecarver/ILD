"use client";

import { usePathname } from "next/navigation";
import { TitlePartner } from "./TitlePartner";

/**
 * Picks the title-partner treatment per route: the full billboard on the home
 * page, the slim band everywhere else. Lives in the layout so the banner always
 * sits between the header and the quick-actions rail.
 */
export function SiteBanner() {
  const pathname = usePathname();
  return <TitlePartner slim={pathname !== "/"} />;
}
