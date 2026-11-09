// Messages des notifications du socle et des modules (D34 : traduits cote client
// a partir du type et des parametres). Un type inconnu donne un message neutre.
import type { Notification } from "@fm/shared";

import type {
  NotificationCategoryLabel,
  NotificationEnv,
  NotificationRenderer,
  NotificationView,
} from "../../app/registry.ts";
import { WEB_MODULES } from "../../modules/index.ts";
import { moduleInfo } from "../modules/module-info.ts";

/** Libelles des categories du socle (E-NOTIF-PREFERENCES). */
const CORE_CATEGORIES: Record<string, NotificationCategoryLabel> = {
  "core.members": {
    label: "Invitations et membres",
    hint: "Invitations reçues, arrivées dans tes espaces",
  },
  "core.releases": {
    label: "Nouveautés de Forest Manager",
    hint: "Une nouvelle version est disponible",
  },
};

export function categoryLabel(key: string): NotificationCategoryLabel {
  return (
    CORE_CATEGORIES[key] ??
    WEB_MODULES.map((module) => module.notificationCategories?.[key]).find(Boolean) ?? {
      label: key,
      hint: "",
    }
  );
}

function text(notification: Notification, key: string): string {
  const value = notification.data?.[key];
  return typeof value === "string" ? value : "";
}

/** Nom de l'espace : celui du lien, sinon celui garde dans les parametres. */
function spaceName(notification: Notification): string {
  return notification.space?.name ?? text(notification, "spaceName");
}

/** " et 2 autres" quand plusieurs evenements sont regroupes ("Sam et 2 autres ..."). */
export function others(notification: Notification): string {
  const extra = notification.count - 1;
  if (extra <= 0) return "";
  return extra === 1 ? "et 1 autre " : `et ${String(extra)} autres `;
}

function verb(notification: Notification, one: string, many: string): string {
  return notification.count > 1 ? many : one;
}

const spacePath = (n: Notification, path: string) => (n.space ? `/s/${n.space.id}/${path}` : null);

const CORE: Record<string, NotificationRenderer> = {
  "core.invitation.received": (n, env) => ({
    text: `t'invite dans ${spaceName(n)}.`,
    to: `/s/${env.personalSpaceId}/home`,
  }),
  "core.transfer.proposed": (n, env) => ({
    text: `te propose de devenir propriétaire de ${spaceName(n)}.`,
    to: `/s/${env.personalSpaceId}/home`,
  }),
  "core.transfer.accepted": (n) => ({
    text: `est maintenant propriétaire de ${spaceName(n)}.`,
    to: spacePath(n, "members"),
  }),
  "core.transfer.declined": (n) => ({
    text: `a refusé de devenir propriétaire de ${spaceName(n)}.`,
    to: spacePath(n, "members"),
  }),
  "core.member.joined": (n) => ({
    text: `${others(n)}${verb(n, "a rejoint", "ont rejoint")} ${spaceName(n)}.`,
    to: spacePath(n, "members"),
  }),
  "core.member.left": (n) => ({
    text: `${others(n)}${verb(n, "a quitté", "ont quitté")} ${spaceName(n)}.`,
    to: spacePath(n, "members"),
  }),
  "core.member.excluded": (n) => ({
    text: `Tu ne fais plus partie de ${spaceName(n)}.`,
    actor: false,
    to: null,
  }),
  "core.space.deleted": (n) => ({ text: `a supprimé ${spaceName(n)}.`, to: null }),
  "core.space.restored": (n) => ({ text: `a restauré ${spaceName(n)}.`, to: spacePath(n, "") }),
  "core.module.granted": (n) => ({
    text: `Le module ${moduleInfo(text(n, "moduleCode")).name} est disponible pour ${spaceName(n)}.`,
    actor: false,
    to: spacePath(n, "modules"),
  }),
  "core.module.rejected": (n) => {
    const reason = text(n, "reason");
    return {
      text: `Ta demande du module ${moduleInfo(text(n, "moduleCode")).name} pour ${spaceName(n)} a été refusée${reason ? ` : ${reason}` : "."}`,
      actor: false,
      to: spacePath(n, "modules"),
    };
  },
  "core.moderation.opened": (n) => ({
    text: `Un administrateur consulte ${spaceName(n)} en lecture seule pendant 30 minutes. Motif : ${text(n, "reason")}.`,
    actor: false,
    to: null,
  }),
  "core.release.published": (n) => ({
    text: `La version ${text(n, "version")} est disponible : découvre les nouveautés.`,
    actor: false,
    to: "/news",
  }),
};

export function renderNotification(
  notification: Notification,
  env: NotificationEnv
): NotificationView {
  const renderer =
    CORE[notification.type] ??
    WEB_MODULES.map((module) => module.notifications?.[notification.type]).find(Boolean);
  if (!renderer) return { text: "Nouvelle notification.", actor: false, to: notification.url };
  const view = renderer(notification, env);
  return { ...view, actor: view.actor !== false && notification.actor !== null };
}
