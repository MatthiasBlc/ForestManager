// Permissions du socle (matrice B2, `12-Permissions.md` : Compte, Espace perso,
// Espace groupe, Modules) et fonction pure `can()`, utilisee par l'API
// (requirePermission) et par le web (masquer ce qui est interdit).
//
// `can()` ne porte que la regle de role. Les cases "Cond." et "Soi" de la
// matrice ajoutent une regle metier verifiee par le service (lien encore
// valable, OWNER qui doit transferer avant de partir, SMTP configure...).
// Le super admin (ADM) a sa propre session et ses propres gardes : il n'est
// pas un acteur de `can()`. Un ancien membre (ANC) est un utilisateur connecte
// non membre (USER).

import { hasMinRole, type SpaceKind, type SpaceRole } from "../schemas/common.ts";

/** Acteur relatif a l'espace concerne (ou sans espace pour le compte). */
export const ACTORS = ["VISITOR", "USER", "MEMBER", "MODERATOR", "OWNER"] as const;
export type Actor = (typeof ACTORS)[number];

export type PermissionDefinition =
  /** Action sur le compte : pas d'espace, l'acteur est VISITOR ou USER. */
  | { readonly scope: "account"; readonly actors: readonly Actor[] }
  /** Action dans un espace : acteurs autorises selon le type d'espace. */
  | {
      readonly scope: "space";
      readonly group: readonly Actor[];
      readonly personal: readonly Actor[];
    };

const NONE: readonly Actor[] = [];
const MEMBERS: readonly Actor[] = ["MEMBER", "MODERATOR", "OWNER"];
const MODERATORS: readonly Actor[] = ["MODERATOR", "OWNER"];
const OWNER: readonly Actor[] = ["OWNER"];
const OUTSIDER: readonly Actor[] = ["USER"];

const account = (...actors: Actor[]): PermissionDefinition => ({ scope: "account", actors });
const space = (group: readonly Actor[], personal: readonly Actor[]): PermissionDefinition => ({
  scope: "space",
  group,
  personal,
});

export const CORE_PERMISSIONS = {
  // --- Compte ---
  "account.register": account("VISITOR"),
  "account.login": account("VISITOR"),
  /** Verification d'email et mot de passe oublie (Cond. : SMTP configure). */
  "account.recover": account("VISITOR"),
  /** Profil, mot de passe, apparence (Soi). */
  "account.update": account("USER"),
  "account.delete": account("USER"),
  /** Creer un espace groupe (Cond. : plafond de 20 espaces possedes, D51). */
  "spaces.create": account("USER"),

  // --- Espace (perso ou groupe) ---
  /** Voir le contenu de l'espace et ses modules actifs. */
  "space.view": space(MEMBERS, OWNER),
  "space.members.view": space(MEMBERS, OWNER),
  /** Renommer, description, teinte (perso : teinte seulement, regle du service). */
  "space.update": space(MODERATORS, OWNER),
  "space.delete": space(OWNER, NONE),
  "space.restore": space(OWNER, NONE),
  /** Quitter (Cond. OWNER : transfert prealable, D06). */
  "space.leave": space(MEMBERS, NONE),
  "space.ownership.transfer": space(OWNER, NONE),
  /** Rejoindre par un lien (Cond. : lien valable, pas un membre exclu). */
  "space.join": space(OUTSIDER, NONE),
  /** Accepter ou refuser une invitation recue (Soi). */
  "space.invitation.respond": space(OUTSIDER, NONE),
  /** Liens d'invitation, invitation par username, annulation. */
  "space.invites.manage": space(MODERATORS, NONE),
  "space.members.exclude.member": space(MODERATORS, NONE),
  "space.members.exclude.moderator": space(OWNER, NONE),
  /** Promouvoir MEMBER -> MODERATOR, retrograder MODERATOR -> MEMBER. */
  "space.members.role": space(OWNER, NONE),
  "space.export": space(OWNER, NONE),
  "space.activity.view": space(MEMBERS, NONE),

  // --- Modules ---
  /** Modules actifs et catalogue (D54). */
  "space.modules.view": space(MEMBERS, OWNER),
  /** Demander, annuler une demande, activer, desactiver, ordonner (D33, D131). */
  "space.modules.manage": space(OWNER, OWNER),
} as const satisfies Record<string, PermissionDefinition>;

export type CorePermissionKey = keyof typeof CORE_PERMISSIONS;

export interface PermissionContext {
  readonly authenticated: boolean;
  /** Espace concerne ; `role` null si l'utilisateur n'en est pas membre. */
  readonly space?: { readonly kind: SpaceKind; readonly role: SpaceRole | null };
}

export function actorOf(context: PermissionContext): Actor {
  if (!context.authenticated) return "VISITOR";
  return context.space?.role ?? "USER";
}

export function isAllowed(definition: PermissionDefinition, context: PermissionContext): boolean {
  if (definition.scope === "account") {
    return definition.actors.includes(context.authenticated ? "USER" : "VISITOR");
  }
  if (!context.space) return false;
  const actors = context.space.kind === "PERSONAL" ? definition.personal : definition.group;
  return actors.includes(actorOf(context));
}

/**
 * Permission declaree par un module : role minimal dans l'espace (matrice B2).
 * `configurable` : l'OWNER peut changer ce role minimal (D58, D141).
 */
export interface ModulePermission {
  readonly minRole: SpaceRole;
  readonly configurable?: boolean;
}

/** Une permission de module se lit comme une permission d'espace. */
export function modulePermissionDefinition(
  permission: ModulePermission,
  minRoleOverride?: SpaceRole
): PermissionDefinition {
  const minRole =
    (permission.configurable === true ? minRoleOverride : undefined) ?? permission.minRole;
  const actors = MEMBERS.filter((actor) => hasMinRole(actor as SpaceRole, minRole));
  // Espace perso : son unique membre est OWNER, il a donc tous les droits du module.
  return space(actors, OWNER);
}

/** Verifie une permission du socle. */
export function can(context: PermissionContext, key: CorePermissionKey): boolean {
  return isAllowed(CORE_PERMISSIONS[key], context);
}
