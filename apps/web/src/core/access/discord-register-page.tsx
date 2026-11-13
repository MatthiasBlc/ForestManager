// E-INSCRIPTION-DISCORD [D210] : premiere connexion d'un compte Discord inconnu.
// Nom propose depuis Discord, email verifie repris ; jamais de liaison par email.
import { discordPendingSchema, discordRegisterBodySchema, meSchema, type Me } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { applyApiError, safeNext } from "../../lib/form-errors.ts";
import { zodResolver } from "../../lib/form.ts";
import { Button } from "../../ui/button.tsx";
import { Badge } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { configQuery } from "../session/queries.ts";
import { AuthLayout, FormAlert } from "./auth-layout.tsx";
import { DiscordLogo } from "./discord.tsx";
import { VerifyEmailSent } from "./register-page.tsx";

export function DiscordRegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get("next") ? safeNext(params.get("next")) : null;
  const config = useQuery(configQuery);
  const pending = useQuery({
    queryKey: ["discord-pending"],
    queryFn: () => api.get("/auth/discord/pending", discordPendingSchema),
    retry: false,
    staleTime: Infinity,
  });
  const [created, setCreated] = useState<Me | null>(null);
  const form = useForm({
    resolver: zodResolver(discordRegisterBodySchema),
    values: { username: pending.data?.username ?? "", email: pending.data?.email ?? "" },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting } = form.formState;
  const email = useWatch({ control: form.control, name: "email" });
  const done = () => void navigate(next ?? "/welcome", { replace: true });

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const me = await api.post("/auth/discord/register", body, meSchema);
      queryClient.clear();
      queryClient.setQueryData(["me"], me);
      if (config.data?.features.email && !me.emailVerified) setCreated(me);
      else done();
    } catch (error) {
      applyApiError(error, form.setError, { AUTH_003: "username", AUTH_004: "email" });
    }
  });

  if (created) return <VerifyEmailSent me={created} onContinue={done} />;
  const loginLink = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  if (pending.isError) {
    return (
      <AuthLayout title="Créer ton compte">
        <FormAlert message={errorMessage(pending.error)} />
        <Link to={loginLink} className="text-accent-text underline">
          Retour à la connexion
        </Link>
      </AuthLayout>
    );
  }
  if (!pending.data) return null;
  const verified =
    pending.data.emailVerified && email.trim().toLowerCase() === pending.data.email?.toLowerCase();

  return (
    <AuthLayout title="Créer ton compte">
      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
        <span className="fm-btn-discord grid size-10 flex-none place-items-center rounded-full">
          <DiscordLogo />
        </span>
        <div className="flex min-w-0 flex-col">
          <b>{pending.data.discordUsername}</b>
          <span className="text-sm text-ink-muted">Connecté avec Discord</span>
        </div>
      </div>
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Nom d'utilisateur"
          autoComplete="username"
          hint="Lettres, chiffres et _ ; visible par les membres de tes espaces."
          error={errors.username?.message}
          {...form.register("username")}
        />
        <Field
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          hint={
            verified
              ? undefined
              : "Si elle n'est pas confirmée, un lien de confirmation t'est envoyé."
          }
          error={errors.email?.message}
          {...form.register("email")}
        />
        {verified ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Badge tone="success" icon="check">
              Vérifiée
            </Badge>
            Adresse confirmée par Discord.
          </p>
        ) : null}
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          Créer mon compte
        </Button>
      </form>
      <p className="text-ink-muted">
        Tu as déjà un compte Forest Manager ?{" "}
        <Link to={loginLink} className="text-accent-text underline">
          Connecte-toi avec ton mot de passe
        </Link>
        , puis relie Discord depuis ton profil.
      </p>
    </AuthLayout>
  );
}
