// F-SUPPRIMER-COMPTE [D20, D51, D116] : consequences espace par espace, puis mot de passe.
import { accountDeletionPreviewSchema, type AccountDeletionPreview } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { api } from "../../lib/api.ts";
import { applyApiError } from "../../lib/form-errors.ts";
import { SpaceIcon } from "../../patterns/space-icon.tsx";
import { Button } from "../../ui/button.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { ProfileLayout } from "./profile-layout.tsx";

function effect(item: AccountDeletionPreview["spaces"][number]): string {
  if (item.outcome === "TRANSFERRED") {
    return `Tu en es propriétaire : propriété transférée à ${item.newOwner?.username ?? "un membre"}`;
  }
  if (item.outcome === "DELETED")
    return "Tu en es le seul membre : l'espace est supprimé (restauration impossible)";
  return "Tu quittes l'espace";
}

export function DeleteAccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const preview = useQuery({
    queryKey: ["me", "deletion-preview"],
    queryFn: () => api.get("/me/deletion-preview", accountDeletionPreviewSchema),
    staleTime: 0,
  });
  const form = useForm({ defaultValues: { password: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      await api.delete("/me", { password });
      queryClient.clear();
      queryClient.setQueryData(["me"], null);
      toast("Ton compte a été supprimé");
      void navigate("/", { replace: true });
    } catch (error) {
      applyApiError(error, form.setError, { AUTH_005: "password" });
    }
  });

  return (
    <ProfileLayout title="Supprimer mon compte" back="/profile">
      <h1 className="font-display text-2xl font-bold">Supprimer mon compte</h1>
      <p>Voici ce qui se passera. Rien n'est supprimé avant ta confirmation.</p>
      {preview.isPending ? <Skeleton kind="row" /> : null}
      <ul className="fm-stack">
        {preview.data?.spaces.map((item) => (
          <li key={item.space.id} aria-label={item.space.name} className="flex items-center gap-3">
            <SpaceIcon
              space={{
                id: item.space.id,
                name: item.space.name,
                tint: item.space.tintIndex,
                image: item.space.avatarUrl,
              }}
            />
            <span className="flex flex-col">
              <b>{item.space.name}</b>
              <small className="text-ink-muted">{effect(item)}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-ink-muted">
        Tes recettes partagées dans ces espaces restent, signées « Ancien membre ». Ton espace perso
        et tes recettes perso sont supprimés.
      </p>
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register("password", { required: "Indique ton mot de passe." })}
        />
        <Button type="submit" variant="danger" block disabled={isSubmitting}>
          Supprimer définitivement mon compte
        </Button>
      </form>
    </ProfileLayout>
  );
}
