// Ordre des espaces dans le rail et le selecteur [D218] : propre a chaque personne,
// garde dans le compte. L'ordre change tout de suite ; la reponse le confirme.
import { listSchema, spaceSummarySchema, type SpaceSummary } from "@fm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useToast } from "../../ui/use-toast.ts";
import { spacesQuery } from "./queries.ts";

function reordered(spaces: readonly SpaceSummary[], ids: readonly string[]): SpaceSummary[] {
  const rank = (space: SpaceSummary) => {
    if (space.kind === "PERSONAL") return -1;
    const index = ids.indexOf(space.id);
    return index < 0 ? ids.length : index;
  };
  return [...spaces].sort((a, b) => rank(a) - rank(b));
}

export function useSpaceOrder() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: async (spaceIds: string[]) =>
      (await api.put("/me/space-order", { spaceIds }, listSchema(spaceSummarySchema))).data,
    onMutate: async (spaceIds) => {
      await queryClient.cancelQueries({ queryKey: spacesQuery.queryKey });
      queryClient.setQueryData(spacesQuery.queryKey, (old) =>
        old ? reordered(old, spaceIds) : old
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(spacesQuery.queryKey, data);
    },
    onError: async (error) => {
      toast(errorMessage(error), { tone: "danger" });
      await queryClient.invalidateQueries({ queryKey: spacesQuery.queryKey });
    },
  });
  return mutation.mutate;
}
