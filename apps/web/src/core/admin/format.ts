import type { ModerationReason } from "@fm/shared";

// Dates de l'administration, comme les maquettes : "Aujourd'hui, 14 h 02", "Hier, 21 h 15", "28 oct.".

const DAY_MS = 24 * 60 * 60 * 1000;
const time = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function hourLabel(date: Date): string {
  return time.format(date).replace(":", " h ");
}

/** Date d'un evenement : jour relatif et heure, ou jour et mois. */
export function whenLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days === 0) return `Aujourd'hui, ${hourLabel(date)}`;
  if (days === 1) return `Hier, ${hourLabel(date)}`;
  return day.format(date);
}

/** Anciennete : "aujourd'hui", "hier", "il y a 3 jours". */
export function agoLabel(iso: string, now = new Date()): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${String(days)} jours`;
}

/** Nombre saisi a la francaise ("14,8") ; null si vide ou invalide. */
export function parseDecimal(value: string): number | null {
  const text = value.trim().replace(",", ".");
  if (text === "") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** Motifs d'un acces de moderation (A09b). */
export const REASON_LABELS: Record<ModerationReason, string> = {
  MEMBER_REPORT: "Signalement d'un membre",
  OWNER_REQUEST: "Demande de l'OWNER",
  EXTERNAL_REPORT: "Contenu illicite signalé hors de l'application",
  OTHER: "Autre",
};

// --- Journal d'audit (A11) ---

type AuditTone = "neutral" | "success" | "warning" | "danger";

const AUDIT_LABELS: Readonly<Record<string, [string, AuditTone]>> = {
  "auth.login": ["Connexion", "neutral"],
  "auth.logout": ["Déconnexion", "neutral"],
  "auth.totp-enabled": ["2FA configurée", "neutral"],
  "auth.totp-failed": ["Code 2FA refusé", "warning"],
  "auth.totp-locked": ["Connexion bloquée", "danger"],
  "module-request.approved": ["Demande accordée", "success"],
  "module-request.rejected": ["Demande refusée", "danger"],
  "module.granted": ["Module accordé", "success"],
  "module.revoked": ["Accès au module retiré", "danger"],
  "module.status-changed": ["Statut de module changé", "neutral"],
  "ingredient.created": ["Ingrédient ajouté", "neutral"],
  "ingredient.updated": ["Ingrédient modifié", "neutral"],
  "ingredient.verified": ["Ingrédient vérifié", "success"],
  "ingredient.merged": ["Ingrédient fusionné", "neutral"],
  "unit.created": ["Unité ajoutée", "neutral"],
  "unit.updated": ["Unité modifiée", "neutral"],
  "aisle.created": ["Rayon ajouté", "neutral"],
  "aisle.updated": ["Rayon modifié", "neutral"],
  "aisle.reordered": ["Rayons réordonnés", "neutral"],
  "tag.created": ["Tag créé", "neutral"],
  "tag.updated": ["Tag modifié", "neutral"],
  "tag.merged": ["Tag fusionné", "neutral"],
  "tag.deleted": ["Tag supprimé", "danger"],
  "user.temporary-password": ["Mot de passe réinitialisé", "warning"],
  "space.restored": ["Espace restauré", "success"],
  "space.deleted": ["Espace supprimé", "danger"],
  "moderation.opened": ["Accès de modération", "warning"],
  "moderation.closed": ["Accès de modération fermé", "neutral"],
  "recipe.hidden": ["Contenu masqué", "danger"],
  "recipe.unhidden": ["Contenu réaffiché", "success"],
  "recipe.removed": ["Recette retirée d'un espace", "danger"],
  "recipe.deleted": ["Recette supprimée", "danger"],
  "release.updated": ["Version modifiée", "neutral"],
  "release.published": ["Version publiée", "success"],
  "release.hidden": ["Version masquée", "warning"],
  "release.shown": ["Version réaffichée", "success"],
};

export function auditLabel(action: string): { label: string; tone: AuditTone } {
  const [label, tone] = AUDIT_LABELS[action] ?? [action, "neutral"];
  return { label, tone };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Cible lisible : nom, compte, titre ou code garde dans les donnees de l'entree. */
export function auditTarget(entry: {
  action: string;
  targetType: string | null;
  data: Record<string, unknown> | null;
}): string {
  const data = entry.data ?? {};
  if (entry.action.endsWith(".merged") && text(data.name) && text(data.intoName)) {
    return `${String(data.name)} → ${String(data.intoName)}`;
  }
  const named =
    text(data.name) ??
    text(data.username) ??
    text(data.title) ??
    text(data.code) ??
    text(data.moduleCode);
  if (named) return named;
  if (text(data.version)) return `Version ${String(data.version)}`;
  if (entry.action.startsWith("auth.")) return "Session admin";
  return entry.targetType ?? "-";
}

/** Motif ou detail : precision de moderation, nombre de recettes touchees, statut... */
export function auditDetail(entry: {
  action: string;
  data: Record<string, unknown> | null;
}): string {
  const data = entry.data ?? {};
  const note = text(data.note);
  if (entry.action === "moderation.opened") {
    const reason = REASON_LABELS[data.reason as ModerationReason] as string | undefined;
    return [reason, note].filter(Boolean).join(" : ");
  }
  if (note) return note;
  if (typeof data.recipeCount === "number" && entry.action.endsWith(".merged")) {
    return `${String(data.recipeCount)} recette${data.recipeCount > 1 ? "s" : ""} mise${data.recipeCount > 1 ? "s" : ""} à jour`;
  }
  if (entry.action === "module.status-changed") {
    return `${String(data.from)} → ${String(data.to)}`;
  }
  if (text(data.ip)) return `IP ${String(data.ip)}`;
  return "";
}
