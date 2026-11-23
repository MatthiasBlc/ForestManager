// Reglages des courses [D141, D228] : le proprietaire choisit le role minimal pour
// modifier la liste (ajouter, cocher, retirer, gerer les sections). Lire : tout membre.
import { shoppingSettingsSchema, type SpaceRole } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup } from "../../ui/controls.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { EDIT_ROLE_LABELS } from "../meal-plan/format.ts";
import { settingsQuery, shoppingKey } from "./queries.ts";

const EDIT_ROLES: readonly { value: SpaceRole; label: string; hint: string }[] = [
  { value: "MEMBER", label: EDIT_ROLE_LABELS.MEMBER, hint: "Tout le monde remplit la liste." },
  {
    value: "MODERATOR",
    label: EDIT_ROLE_LABELS.MODERATOR,
    hint: "Les membres consultent seulement.",
  },
  { value: "OWNER", label: EDIT_ROLE_LABELS.OWNER, hint: "Toi seul modifies la liste." },
];

function SettingsForm({
  spaceId,
  editRole: initial,
  onDone,
}: {
  spaceId: string;
  editRole: SpaceRole;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guard = useWriteGuard();
  const [editRole, setEditRole] = useState(initial);
  const save = useMutation({
    mutationFn: () =>
      api.put(`/spaces/${spaceId}/shopping/settings`, { editRole }, shoppingSettingsSchema),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shoppingKey(spaceId) });
      toast("Réglages enregistrés", { tone: "success" });
      onDone();
    },
  });
  return (
    <div className="fm-stack">
      <FormAlert message={save.isError ? errorMessage(save.error) : undefined} />
      <RadioGroup
        label="Qui peut modifier la liste"
        options={EDIT_ROLES}
        value={editRole}
        onChange={setEditRole}
      />
      <SheetFooter>
        <Button
          variant="primary"
          block
          disabled={save.isPending || guard.disabled === true}
          onClick={() => {
            if (editRole === initial) onDone();
            else save.mutate();
          }}
        >
          Enregistrer
        </Button>
      </SheetFooter>
    </div>
  );
}

export function ShoppingSettingsSheet({
  spaceId,
  onClose,
}: {
  spaceId: string;
  onClose: () => void;
}) {
  const settings = useQuery(settingsQuery(spaceId));
  return (
    <Sheet open onClose={onClose} title="Réglages des courses">
      {settings.data ? (
        <SettingsForm spaceId={spaceId} editRole={settings.data.editRole} onDone={onClose} />
      ) : settings.isError ? (
        <FormAlert message={errorMessage(settings.error)} />
      ) : (
        <Skeleton kind="row" count={3} label="Chargement des réglages…" />
      )}
    </Sheet>
  );
}
