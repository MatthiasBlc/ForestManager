// Registre web des modules [D71] : un manifeste par module, liste statique dans
// `modules/index.ts`. Le shell ne connait aucun module : il lit leurs entrees de
// navigation et monte leurs routes sous /s/:spaceId/<code>/*.
import type { ActivityEvent, Notification, SearchItem, SpaceDetail, SpaceKind } from "@fm/shared";
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

/** Ligne du fil d'activite : texte apres le nom de l'acteur, et ecran a ouvrir. */
export type ActivityRenderer = (
  event: ActivityEvent,
  spaceId: string
) => { text: string; to: string | null };

/** Ligne de la recherche globale pour un resultat de l'API [D191]. */
export interface SearchResultView {
  label: string;
  icon: IconName;
  hint?: string;
  /** Ecran a ouvrir, et etat de navigation facultatif. */
  to: string;
  state?: unknown;
}

/** Groupe de resultats declare par un module (cle `<code>.<nom>` de l'API). */
export interface SearchGroupView {
  label: string;
  render: (item: SearchItem) => SearchResultView;
}

/** Action de la palette [D119] : sans appel API, filtree par le texte tape. */
export interface PaletteAction {
  id: string;
  label: string;
  icon: IconName;
  to: string;
  /** Mots en plus du libelle pour la correspondance. */
  keywords?: string;
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
  /** Libelles des categories de notification declarees par le module (API). */
  notificationCategories?: Readonly<Record<string, NotificationCategoryLabel>>;
  /** Messages des types de notification du module (traduits ici, D34). */
  notifications?: Readonly<Record<string, NotificationRenderer>>;
  /** Messages des evenements du fil d'activite du module. */
  activity?: Readonly<Record<string, ActivityRenderer>>;
  /** Ce qu'un membre laisse en attente en partant (P08), par cle declaree par l'API. */
  pendingTexts?: Readonly<Record<string, (count: number) => string>>;
  /** Groupes de la recherche globale fournis par le module, par cle. */
  searchGroups?: Readonly<Record<string, SearchGroupView>>;
  /** Actions de la palette dans l'espace courant (module actif), selon les droits connus. */
  actions?: (space: SpaceDetail) => readonly PaletteAction[];
}
