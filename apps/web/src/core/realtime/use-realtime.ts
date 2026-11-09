// Flux temps reel (SSE, D188) : un seul EventSource par onglet connecte. Les
// evenements ne portent que des identifiants ; on relit les requetes concernees.
// EventSource se reconnecte seul ; apres une coupure, tout ce qui est affiche est relu.
import { API_PREFIX, realtimeEventSchema } from "@fm/shared";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";

/** Regroupe les relectures d'une rafale d'evenements. */
const BATCH_MS = 150;

export function useRealtime(enabled: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const source = new EventSource(`${API_PREFIX}/events`);
    const pending = new Map<string, { queryKey: QueryKey; exact: boolean }>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let opened = false;

    const invalidate = (queryKey: QueryKey, exact = false) => {
      pending.set(JSON.stringify([queryKey, exact]), { queryKey, exact });
      clearTimeout(timer);
      timer = setTimeout(() => {
        const batch = [...pending.values()];
        pending.clear();
        for (const filters of batch) void queryClient.invalidateQueries(filters);
      }, BATCH_MS);
    };

    const read = (event: MessageEvent) => {
      try {
        const parsed = realtimeEventSchema.safeParse(JSON.parse(String(event.data)));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    };

    source.addEventListener("open", () => {
      // Reconnexion : des evenements ont pu etre manques.
      if (opened) void queryClient.invalidateQueries();
      opened = true;
    });
    source.addEventListener("notification", () => {
      invalidate(["notifications"]);
      // Une notification accompagne souvent une invitation, un transfert ou un acces.
      invalidate(["me", "invitations"]);
      invalidate(["me", "transfers"]);
      invalidate(["spaces"], true);
    });
    source.addEventListener("invalidate", (event: MessageEvent) => {
      const data = read(event);
      if (data?.type !== "invalidate") return;
      if (data.module) {
        invalidate(["spaces", data.spaceId, data.module]);
      } else {
        invalidate(["spaces", data.spaceId]);
        invalidate(["spaces"], true);
      }
    });
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [enabled, queryClient]);
}
