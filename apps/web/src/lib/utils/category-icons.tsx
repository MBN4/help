import {
  Briefcase,
  Car,
  GraduationCap,
  Hotel,
  PartyPopper,
  Scissors,
  ShoppingBag,
  Stethoscope,
  Store,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/** Maps the seeded category tree's kebab-case `icon` field (docs/04-database.md) to a lucide-react
 * component. `Store` is the fallback for any category added later without a matching mapping here. */
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  utensils: Utensils,
  stethoscope: Stethoscope,
  scissors: Scissors,
  wrench: Wrench,
  car: Car,
  'shopping-bag': ShoppingBag,
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  hotel: Hotel,
  'party-popper': PartyPopper,
};

export function categoryIcon(icon: string | null): LucideIcon {
  return (icon && CATEGORY_ICON_MAP[icon]) || Store;
}
