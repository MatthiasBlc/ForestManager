// Registre web des modules [D71] : un manifeste par module, liste statique dans
// `modules/index.ts`. Le shell ne connait aucun module : il lit leurs entrees de
// navigation et monte leurs routes sous /s/:spaceId/<code>/*.
import type { SpaceKind } from "@fm/shared";
import type { ComponentType, LazyExoticComponent } from "react";

import type { IconName } from "../ui/icon.tsx";

export interface ModuleNavEntry {
  id: string;
  label: string;
  icon: IconName;
  /** Chemin relatif a /s/:spaceId (ex. "recipes", "recipes/mine"). */
  path: string;
}

/** Section d'un module dans F-QUITTER (D84) : explique et prepare le depart. */
export interface LeaveSectionProps {
  spaceId: string;
  spaceName: string;
  /** Action a executer juste avant le depart (retraits choisis) ; null pour l'annuler. */
  onPrepare: (prepare: (() => Promise<void>) | null) => void;
}

export interface WebModule {
  /** Meme code que l'API et la base. */
  code: string;
  /** Entrees de navigation selon le type d'espace (D95 : "Mes recettes" dans l'espace perso). */
  nav: (kind: SpaceKind) => readonly ModuleNavEntry[];
  /** Routes du module, chargees a la demande, relatives a /s/:spaceId/<code>. */
  Routes: LazyExoticComponent<ComponentType>;
  /** Section facultative de F-QUITTER, quand le module est actif dans l'espace. */
  LeaveSection?: LazyExoticComponent<ComponentType<LeaveSectionProps>>;
}
