// F-CREER-ESPACE : nom et couleur ; on peut aussi coller un lien d'invitation.
import { createSpaceBodySchema, spaceDetailSchema } from "@fm/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { api } from "../../lib/api.ts";
import { applyApiError } from "../../lib/form-errors.ts";
import { zodResolver } from "../../lib/form.ts";
import { tintNames } from "../../theme/themes.ts";
import { useTheme } from "../../theme/use-theme.ts";
import { Button } from "../../ui/button.tsx";
import { TintPicker } from "../../ui/controls.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { inviteCodeFrom } from "./invite-code.ts";

export function CreateSpaceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const theme = useTheme();
  const [link, setLink] = useState("");
  const code = inviteCodeFrom(link);
  const form = useForm({
    resolver: zodResolver(createSpaceBodySchema),
    defaultValues: { name: "", tintIndex: 1 },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const space = await api.post("/spaces", body, spaceDetailSchema);
      queryClient.setQueryData(["spaces", space.id], space);
      await queryClient.invalidateQueries({ queryKey: ["spaces"], exact: true });
      toast("Espace créé", { tone: "success" });
      form.reset();
      onClose();
      void navigate(`/s/${space.id}`);
    } catch (error) {
      applyApiError(error, form.setError);
    }
  });

  return (
    <Sheet open={open} onClose={onClose} title="Créer un espace">
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Nom de l'espace"
          placeholder="Famille"
          error={errors.name?.message}
          {...form.register("name")}
        />
        <Controller
          control={form.control}
          name="tintIndex"
          render={({ field }) => (
            <div className="fm-stack">
              <span className="fm-label">Couleur de l'espace</span>
              <TintPicker
                label="Couleur de l'espace"
                value={field.value}
                onChange={field.onChange}
                names={tintNames(theme)}
              />
            </div>
          )}
        />
        <p className="text-ink-muted">
          Tu en seras le propriétaire. L'espace commence avec le module Recettes ; tu pourras
          inviter des membres juste après.
        </p>
        <SheetFooter>
          <Button type="submit" variant="primary" block disabled={isSubmitting}>
            Créer l'espace
          </Button>
        </SheetFooter>
      </form>
      <form
        className="fm-stack mt-6 border-t border-line pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code) {
            onClose();
            void navigate(`/join/${code}`);
          }
        }}
      >
        <Field
          label="Tu as un lien d'invitation ?"
          placeholder="Colle-le ici"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          error={link && !code ? "Colle le lien complet reçu." : undefined}
        />
        <Button type="submit" disabled={!code}>
          Rejoindre l'espace
        </Button>
      </form>
    </Sheet>
  );
}
