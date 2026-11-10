// Categories et types de notification et d'activite du socle [D41]. Les modules
// declarent les leurs dans leur manifeste ; tout est valide au demarrage.

export interface NotificationCategoryDefinition {
  /** Activee tant que l'utilisateur ne l'a pas coupee (vrai par defaut). */
  readonly defaultEnabled?: boolean;
  /** Ne se coupe pas et n'apparait pas dans les preferences. */
  readonly mandatory?: boolean;
  /** Reglable par espace (vrai par defaut) ; faux pour un avis sans espace. */
  readonly perSpace?: boolean;
}

export interface NotificationTypeDefinition {
  /** Categorie du socle ou du module qui declare le type. */
  readonly category: string;
}

export const CORE_NOTIFICATION_CATEGORIES = {
  /** Invitations, transferts, arrivees et departs, espace supprime ou restaure. */
  "core.members": {},
  /** Avis de la plateforme : adresse a confirmer [D90], decision sur un module, moderation [D121]. */
  "core.platform": { mandatory: true },
  /** Nouvelle version publiee [D127]. */
  "core.releases": { perSpace: false },
} as const satisfies Record<string, NotificationCategoryDefinition>;

export const CORE_NOTIFICATION_TYPES = {
  "core.invitation.received": { category: "core.members" },
  "core.transfer.proposed": { category: "core.members" },
  "core.transfer.accepted": { category: "core.members" },
  "core.transfer.declined": { category: "core.members" },
  "core.member.joined": { category: "core.members" },
  "core.member.left": { category: "core.members" },
  "core.member.excluded": { category: "core.members" },
  "core.space.deleted": { category: "core.members" },
  "core.space.restored": { category: "core.members" },
  "core.email.unverified": { category: "core.platform" },
  "core.module.granted": { category: "core.platform" },
  "core.module.rejected": { category: "core.platform" },
  "core.moderation.opened": { category: "core.platform" },
  "core.release.published": { category: "core.releases" },
} as const satisfies Record<string, NotificationTypeDefinition>;

export const CORE_ACTIVITY_TYPES = [
  "core.member.joined",
  "core.member.left",
  "core.module.enabled",
  "core.space.exported",
] as const;
