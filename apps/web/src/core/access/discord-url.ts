// Depart vers Discord [D210] : URL de l'API qui redirige vers Discord.
import { API_PREFIX } from "@fm/shared";

export function discordStartUrl(
  intent: "login" | "link",
  { next, remember }: { next?: string | null; remember?: boolean } = {}
): string {
  const params = new URLSearchParams({ intent });
  if (next) params.set("next", next);
  if (remember) params.set("remember", "true");
  return `${API_PREFIX}/auth/discord/start?${params.toString()}`;
}
