// E-CONNEXION : email ou nom d'utilisateur, mot de passe, "Rester connecte" [D13].
import { loginBodySchema, meSchema } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";

import { api } from "../../lib/api.ts";
import { applyApiError, safeNext } from "../../lib/form-errors.ts";
import { zodResolver } from "../../lib/form.ts";
import { Button } from "../../ui/button.tsx";
import { Switch } from "../../ui/controls.tsx";
import { Field } from "../../ui/field.tsx";
import { errors as errorMessages } from "../../i18n/fr/errors.ts";
import { configQuery } from "../session/queries.ts";
import { AuthLayout, FormAlert } from "./auth-layout.tsx";
import { DiscordButton } from "./discord.tsx";
import { discordStartUrl } from "./discord-url.ts";

/** Message d'un retour en echec de Discord (`?error=CODE`), seulement pour un code connu. */
function returnedError(code: string | null): string | undefined {
  return code && code in errorMessages
    ? errorMessages[code as keyof typeof errorMessages]
    : undefined;
}

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const config = useQuery(configQuery);
  const form = useForm({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { identifier: "", password: "", rememberMe: false },
  });
  const { errors, isSubmitting } = form.formState;
  const rememberMe = useWatch({ control: form.control, name: "rememberMe" });
  const returned = returnedError(params.get("error"));

  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const me = await api.post("/auth/login", body, meSchema);
      queryClient.clear();
      queryClient.setQueryData(["me"], me);
      void navigate(next, { replace: true });
    } catch (error) {
      applyApiError(error, form.setError);
    }
  });

  const registerLink = params.get("next")
    ? `/register?next=${encodeURIComponent(next)}`
    : "/register";
  return (
    <AuthLayout title="Se connecter">
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message ?? returned} />
        <Field
          label="E-mail ou nom d'utilisateur"
          autoComplete="username"
          error={errors.identifier?.message}
          {...form.register("identifier")}
        />
        <Field
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...form.register("password")}
        />
        <Controller
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <Switch label="Rester connecté" checked={field.value} onChange={field.onChange} />
          )}
        />
        {config.data?.features.email ? (
          <Link to="/forgot-password">Mot de passe oublié ?</Link>
        ) : null}
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          Se connecter
        </Button>
      </form>
      {config.data?.features.discord ? (
        <DiscordButton
          href={discordStartUrl("login", {
            next: params.get("next") ? next : null,
            remember: rememberMe,
          })}
        />
      ) : null}
      <p className="text-ink-muted">
        Pas encore de compte ?{" "}
        <Link to={registerLink} className="text-accent-text underline">
          Créer un compte
        </Link>
      </p>
    </AuthLayout>
  );
}
