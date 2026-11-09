// Registre web des modules [D71] : un manifeste par module, liste statique dans
// `modules/index.ts`. Le shell ne connait aucun module : il lit leurs entrees de
// navigation et monte leurs routes sous /s/:spaceId/<code>/*.
import type { Notification, SpaceKind } from "@fm/shared";
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

/** Libelle d'une categorie de notification dans les preferences (E-NOTIF-PREFERENCES). */
export interface NotificationCategoryLabel {
  label: string;
  hint: string;
}

/** Message d'une notification : texte apres le nom de l'acteur, et ecran a ouvrir. */
export interface NotificationView {
  text: string;
  /** Faux : pas de nom d'acteur devant le texte (avis de la plateforme). */
  actor?: boolean;
  to: string | null;
}

export interface NotificationEnv {
  personalSpaceId: string;
}

export type NotificationRenderer = (
  notification: Notification,
  env: NotificationEnv
) => NotificationView;

export interface WebModule {
  /** Meme code que l'API et la base. */
  code: string;
  /** Entrees de navigation selon le type d'espace (D95 : "Mes recettes" dans l'espace perso). */
  nav: (kind: SpaceKind) => readonly ModuleNavEntry[];
  /** Routes du module, chargees a la demande, relatives a /s/:spaceId/<code>. */
  Routes: LazyExoticComponent<ComponentType>;
  /** Section facultative de F-QUITTER, quand le module est actif dans l'espace. */
  LeaveSection?: LazyExoticComponent<ComponentType<LeaveSectionProps>>;
  /** Libelles des categories de notification declarees par le module (API). */
  notificationCategories?: Readonly<Record<string, NotificationCategoryLabel>>;
  /** Messages des types de notification du module (traduits ici, D34). */
  notifications?: Readonly<Record<string, NotificationRenderer>>;
}
