// Regroupement d'une notification : " et 2 autres" ("Sam et 2 autres ont rejoint ...").
// A part de messages.ts : les modules l'importent sans dependre du registre.
import type { Notification } from "@fm/shared";

export function others(notification: Notification): string {
  const extra = notification.count - 1;
  if (extra <= 0) return "";
  return extra === 1 ? "et 1 autre " : `et ${String(extra)} autres `;
}
