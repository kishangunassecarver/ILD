import {
  Award,
  BedDouble,
  Briefcase,
  Calendar,
  Compass,
  Heart,
  House,
  MapPin,
  Megaphone,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Ticket,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/lib/types";

/**
 * The only place icon names from the CMS are resolved to components, so an
 * editor typing an unknown name degrades to a map pin instead of crashing
 * the build.
 */
const ICONS: Record<IconName, LucideIcon> = {
  sparkles: Sparkles,
  compass: Compass,
  heart: Heart,
  calendar: Calendar,
  tag: Tag,
  award: Award,
  utensils: Utensils,
  bed: BedDouble,
  ticket: Ticket,
  "shopping-bag": ShoppingBag,
  wrench: Wrench,
  "map-pin": MapPin,
  home: House,
  search: Search,
  megaphone: Megaphone,
  briefcase: Briefcase,
  store: Store,
};

/** Names an editor may type into the CMS, for the admin field's help text. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function Icon({
  name,
  className,
  strokeWidth = 1.75,
}: {
  name: IconName | string;
  className?: string;
  strokeWidth?: number;
}) {
  const Component = ICONS[name as IconName] ?? MapPin;
  return <Component className={className} strokeWidth={strokeWidth} aria-hidden />;
}
