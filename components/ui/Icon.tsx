import {
  Award,
  BedDouble,
  Calendar,
  Compass,
  Heart,
  MapPin,
  ShoppingBag,
  Sparkles,
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
};

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
