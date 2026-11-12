// E-MDP-OUBLIE et E-MDP-NOUVEAU [D21].
import { emailSchema, meSchema, passwordSchema } from "@fm/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";

import { errorMessage } from "../../i18n/index.ts";
import { api, ApiRequestError } from "../../lib/api.ts";
import { applyApiError } from "../../lib/form-errors.ts";
import { zodResolver } from "../../lib/form.ts";
import { Button } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { useLogout } from "../profile/use-logout.ts";
import { meQuery } from "../session/queries.ts";
import { AuthLayout, FormAlert } from "./auth-layout.tsx";

const forgotSchema = z.object({ email: emailSchema });

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (body) => {
    try {
      await api.post("/auth/forgot-password", body);
      setSent(true);
    } catch (error) {
      applyApiError(error, form.setError);
    }
  });
  return (
    <AuthLayout title="Mot de passe oublié">
      <p className="text-ink-muted">
        Indique l'adresse de ton compte : nous t'envoyons un lien pour choisir un nouveau mot de
        passe.
      </p>
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register("email")}
        />
        {sent ? (
          <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-success-text">
            Lien envoyé. Pense à regarder dans tes indésirables.
          </p>
        ) : null}
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          Envoyer le lien
        </Button>
      </form>
      <Link to="/login">Revenir à la connexion</Link>
    </AuthLayout>
  );
}

const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Les deux mots de passe ne sont pas identiques.",
  });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = params.get("token") ?? "";
  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      await api.post("/auth/reset-password", { token, password });
      toast("Mot de passe enregistré. Connecte-toi avec le nouveau.", { tone: "success" });
      void navigate("/login", { replace: true });
    } catch (error) {
      applyApiError(error, form.setError, { AUTH_009: "password" });
    }
  });
  return (
    <AuthLayout title="Choisis un nouveau mot de passe">
      <p className="text-ink-muted">Toutes tes sessions seront fermées, y compris celle-ci.</p>
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          hint="10 caractères minimum."
          error={errors.password?.message}
          {...form.register("password")}
        />
        <Field
          label="Confirme-le"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...form.register("confirm")}
        />
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          Enregistrer le mot de passe
        </Button>
      </form>
    </AuthLayout>
  );
}

/**
 * Apres une connexion par un mot de passe temporaire [D134] : l'application reste
 * fermee tant qu'un nouveau mot de passe n'est pas choisi (PasswordChoiceGate).
 */
export function ChoosePasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      const me = await api.post("/auth/choose-password", { password }, meSchema);
      queryClient.setQueryData(meQuery.queryKey, me);
      toast("Mot de passe enregistré. Tes autres sessions sont fermées.", { tone: "success" });
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "AUTH_014") {
        // La session restreinte est fermee : retour a la connexion.
        toast(errorMessage(error), { tone: "danger" });
        queryClient.setQueryData(meQuery.queryKey, null);
        void navigate("/login", { replace: true });
        return;
      }
      applyApiError(error, form.setError, { AUTH_009: "password" });
    }
  });
  return (
    <AuthLayout title="Choisis ton mot de passe">
      <p className="text-ink-muted">
        Tu t&apos;es connecté avec un mot de passe temporaire. Choisis le tien pour continuer : tes
        autres sessions seront fermées.
      </p>
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          hint="10 caractères minimum."
          error={errors.password?.message}
          {...form.register("password")}
        />
        <Field
          label="Confirme-le"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...form.register("confirm")}
        />
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          Enregistrer et continuer
        </Button>
      </form>
      <Button variant="ghost" onClick={() => void logout()}>
        Se déconnecter
      </Button>
    </AuthLayout>
  );
}
