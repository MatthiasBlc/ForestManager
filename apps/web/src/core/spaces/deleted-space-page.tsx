// E-ESPACE-EN-SUPPRESSION : seul l'OWNER voit un espace supprime encore restaurable [D22].
import type { SpaceSummary } from "@fm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { SpaceIcon } from "../../patterns/space-icon.tsx";
import { Button } from "../../ui/button.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { toVisual } from "../shell/space-visual.ts";

export function DeletedSpacePage({ space }: { space: SpaceSummary }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const visual = toVisual(space);
  const purge = space.purgeAfter
    ? new Date(space.purgeAfter).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : "";
  const restore = useMutation({
    mutationFn: () => api.post(`/spaces/${space.id}/restore`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["spaces"] });
      toast(`${space.name} restauré`, { tone: "success" });
    },
  });
  return (
    <div className="fm-stack mx-auto w-full max-w-lg items-center p-6 text-center">
      <SpaceIcon space={visual} />
      <p className="text-danger-text">Suppression dans {visual.deleting?.daysLeft ?? 0} jours</p>
      <h1 className="font-display text-2xl font-bold">{space.name} est en cours de suppression</h1>
      <p className="text-ink-muted">
        Les membres ne la voient plus. Le {purge}, l'espace et ses recettes seront effacés pour de
        bon.
      </p>
      <FormAlert message={restore.isError ? errorMessage(restore.error) : undefined} />
      <Button variant="primary" disabled={restore.isPending} onClick={() => restore.mutate()}>
        {`Restaurer ${space.name}`}
      </Button>
      <small className="text-ink-muted">Seul toi, propriétaire, vois cet écran.</small>
    </div>
  );
}
