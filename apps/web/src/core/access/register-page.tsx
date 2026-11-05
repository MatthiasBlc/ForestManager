// E-INSCRIPTION puis, avec SMTP, E-VERIF-EMAIL (non bloquant, D21).
import { meSchema, registerBodySchema, type Me } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";

import { api } from "../../lib/api.ts";
import { applyApiError, safeNext } from "../../lib/form-errors.ts";
import { zodResolver } from "../../lib/form.ts";
import { Button } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { configQuery } from "../session/queries.ts";
import { AuthLayout, FormAlert } from "./auth-layout.tsx";

function VerifyEmailSent({ me, onContinue }: { me: Me; onContinue: () => void }) {
  return (
    <AuthLayout title="Confirme ton adresse">
      <p>
        Nous avons envoyé un lien à <b>{me.email}</b>. Il reste valable 24 heures.
      </p>
      <p className="text-ink-muted">
        Rien n'est bloqué : tu peux déjà créer ou rejoindre un espace.
      </p>
      <Button variant="primary" block onClick={onContinue}>
        Continuer
      </Button>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get("next") ? safeNext(params.get("next")) : null;
  const config = useQuery(configQuery);
  const [created, setCreated] = useState<Me | null>(null);
  const form = useForm({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { email: "", username: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const done = () => void navigate(next ?? "/welcome", { replace: true });

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const me = await api.post("/auth/register", body, meSchema);
      queryClient.clear();
      queryClient.setQueryData(["me"], me);
      if (config.data?.features.email && !me.emailVerified) setCreated(me);
      else done();
    } catch (error) {
      applyApiError(error, form.setError, {
        AUTH_003: "username",
        AUTH_004: "email",
        AUTH_009: "password",
      });
    }
  });

  if (created) return <VerifyEmailSent me={created} onContinue={done} />;

  const loginLink = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  return (
    <AuthLayout title="Créer un compte">
      <p className="text-ink-muted">Ton espace perso est créé en même temps.</p>
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register("email")}
        />
        <Field
          label="Nom d'utilisateur"
          autoComplete="username"
          hint="Visible par les membres de tes espaces. Il sert aussi à t'inviter."
          error={errors.username?.message}
          {...form.register("username")}
        />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          hint="10 caractères minimum."
          error={errors.password?.message}
          {...form.register("password")}
        />
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          Créer mon compte
        </Button>
      </form>
      <p className="text-ink-muted">
        Déjà inscrit ? <Link to={loginLink}>Se connecter</Link>
      </p>
    </AuthLayout>
  );
}
