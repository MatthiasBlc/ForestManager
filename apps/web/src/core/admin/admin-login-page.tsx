// Connexion admin : A01 (identifiant), A01a (configurer la 2FA, premiere fois),
// A01b (code). Pas de compteur d'etapes : les titres suffisent [D138].
import {
  adminLoginBodySchema,
  adminLoginResultSchema,
  adminMeSchema,
  adminTotpBodySchema,
  type AdminLoginResult,
} from "@fm/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { api } from "../../lib/api.ts";
import { applyApiError } from "../../lib/form-errors.ts";
import { zodResolver } from "../../lib/form.ts";
import { Button } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { adminMeQuery } from "./queries.ts";

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="fm-root flex min-h-full items-center justify-center bg-bg px-4 py-12 text-ink">
      <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-lg border border-line bg-surface-raised p-6 shadow-md sm:p-8">
        {children}
      </div>
    </div>
  );
}

function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="m-0 font-display text-[22px] leading-7 font-bold">{title}</h1>
      <p className="m-0 text-ink-muted">{children}</p>
    </div>
  );
}

/** Cle TOTP groupee par 4 caracteres, plus facile a recopier. */
function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

type CodeStepState = AdminLoginResult & { identifier: string };

export function AdminLoginPage() {
  const [step, setStep] = useState<CodeStepState | null>(null);
  if (!step) {
    return (
      <CredentialsStep
        onDone={(result, identifier) => {
          setStep({ ...result, identifier });
        }}
      />
    );
  }
  return (
    <CodeStep
      key={step.step}
      step={step}
      onBack={() => {
        setStep(null);
      }}
    />
  );
}

function CredentialsStep({
  onDone,
}: {
  onDone: (result: AdminLoginResult, identifier: string) => void;
}) {
  const form = useForm({
    resolver: zodResolver(adminLoginBodySchema),
    defaultValues: { identifier: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (body) => {
    try {
      onDone(await api.post("/admin/auth/login", body, adminLoginResultSchema), body.identifier);
    } catch (error) {
      applyApiError(error, form.setError);
    }
  });
  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-md bg-accent font-display text-[15px] font-bold text-on-accent"
        >
          FM
        </span>
        <span className="font-display font-bold">Forest Manager</span>
      </div>
      <Heading title="Administration">
        Accès réservé aux administrateurs de la plateforme. Ce compte est distinct de ton compte
        utilisateur.
      </Heading>
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Identifiant ou e-mail"
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
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          Continuer
        </Button>
      </form>
      <p className="m-0 text-sm text-ink-muted">
        Un code de ton application d&apos;authentification te sera demandé. La session expire après
        30 minutes.
      </p>
    </Card>
  );
}

function CodeStep({ step, onBack }: { step: CodeStepState; onBack: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const setup = step.step === "SETUP" ? step : null;
  const form = useForm({ resolver: zodResolver(adminTotpBodySchema), defaultValues: { code: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (body) => {
    try {
      const me = await api.post("/admin/auth/totp", body, adminMeSchema);
      queryClient.setQueryData(adminMeQuery.queryKey, me);
    } catch (error) {
      // Le message va sous le champ du code (A01b).
      applyApiError(error, form.setError, { ADMIN_003: "code" });
    }
  });
  const copyKey = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      toast("Clé copiée", { tone: "success" });
    } catch {
      toast("Copie impossible : recopie la clé à la main", { tone: "danger" });
    }
  };

  const codeField = (
    <Field
      label={setup ? "Saisis le code affiché" : "Code à 6 chiffres"}
      hint={setup ? "Il change toutes les 30 secondes." : undefined}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      className="fm-totp"
      error={errors.code?.message}
      {...form.register("code")}
    />
  );
  return (
    <Card>
      {setup ? (
        <Heading title="Protège ton compte admin">
          La vérification en deux étapes est obligatoire pour l&apos;administration. Il te faut une
          application d&apos;authentification sur ton téléphone (Aegis, Google Authenticator,
          1Password…).
        </Heading>
      ) : (
        <Heading title="Code de vérification">
          Saisis les 6 chiffres affichés par ton application d&apos;authentification pour{" "}
          {step.identifier}.
        </Heading>
      )}
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        {setup ? (
          <>
            <section className="flex flex-col gap-3" aria-labelledby="totp-scan">
              <h2 id="totp-scan" className="m-0 text-base font-semibold">
                1. Scanne ce code avec ton application
              </h2>
              <img
                src={setup.qrCode}
                alt="QR code de la vérification en deux étapes"
                width={180}
                height={180}
                className="self-center rounded-md bg-white p-2"
              />
              <p className="m-0 text-sm text-ink-muted">
                Pas de caméra ? Saisis cette clé à la main :
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-base tracking-wider">{groupKey(setup.secret)}</code>
                <Button size="sm" icon="copy" onClick={() => void copyKey()}>
                  Copier la clé
                </Button>
              </div>
            </section>
            <section className="flex flex-col gap-3" aria-labelledby="totp-check">
              <h2 id="totp-check" className="m-0 text-base font-semibold">
                2. Prouve que ton application est bien reliée
              </h2>
              {codeField}
            </section>
          </>
        ) : (
          codeField
        )}
        <Button type="submit" variant="primary" block disabled={isSubmitting}>
          {setup ? "Activer et continuer" : "Se connecter"}
        </Button>
      </form>
      {setup ? (
        <p className="m-0 text-sm text-ink-muted">
          Ensuite, chaque connexion admin demandera ce code. Activation enregistrée dans le journal
          d&apos;audit.
        </p>
      ) : null}
      <Button variant="ghost" onClick={onBack} className="self-center">
        Revenir à l&apos;identifiant
      </Button>
    </Card>
  );
}
