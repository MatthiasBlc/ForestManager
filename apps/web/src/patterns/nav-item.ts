import type { IconName } from "../ui/icon.tsx";

/** Entree de navigation (barre du module, barre d'onglets, "Plus"). */
export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  to: string;
}
