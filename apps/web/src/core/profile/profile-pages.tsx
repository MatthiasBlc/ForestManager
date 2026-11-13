// E-PROFIL, compte (username, email), mot de passe [F-ACC-4].
import { imageResponseSchema, meSchema } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useSearchParams } from "react-router";

import { api } from "../../lib/api.ts";
import { errorMessage } from "../../i18n/index.ts";
import { applyApiError } from "../../lib/form-errors.ts";
import { ImagePicker } from "../../patterns/image-picker.tsx";
import { AMBIANCES } from "../../theme/themes.ts";
import { Button } from "../../ui/button.tsx";
import { Avatar } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { DiscordLogo } from "../access/discord.tsx";
import { discordStartUrl } from "../access/discord-url.ts";
import { errors as errorMessages } from "../../i18n/fr/errors.ts";
import { ExportSheet } from "../exports/export-sheet.tsx";
import { configQuery, meQuery } from "../session/queries.ts";
import { ProfileLayout } from "./profile-layout.tsx";
import { useLogout } from "./use-logout.ts";

const MODE_LABELS = { SYSTEM: "système", LIGHT: "clair", DARK: "sombre" } as const;

function Row({
  icon,
  label,
  value,
  to,
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string;
  to?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="fm-option-icon">
        <Icon name={icon} />
      </span>
      <span className="fm-option-text">
        <b>{label}</b>
        {/* L'espace separe les deux textes dans le nom accessible de la ligne. */}
        {value ? (
          <>
            {" "}
            <small>{value}</small>
          </>
        ) : null}
      </span>
      {to ? <Icon name="chevron-right" className="fm-option-go" /> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="fm-option" onClick={onClick}>
        {content}
      </button>
    );
  }
  return to ? (
    <Link to={to} className="fm-option">
      {content}
    </Link>
  ) : (
    <div className="fm-option">{content}</div>
  );
}

/** Encart tant que le compte (cree par Discord) n'a pas de mot de passe [D210]. */
function BackupPasswordCallout() {
  return (
    <section
      aria-labelledby="backup-password"
      className="fm-stack gap-2 rounded-lg bg-warning-soft p-4 text-warning-text"
    >
      <b id="backup-password">Ajoute un mot de passe de secours</b>
      <p>Il te connectera si Discord n'est pas disponible ou si tu délies ton compte.</p>
      <Link to="/profile/password" className="fm-btn fm-btn-primary self-start">
        Définir un mot de passe
      </Link>
    </section>
  );
}

/** Ligne "Compte Discord" : relier (aller-retour chez Discord) ou delier [D210]. */
function DiscordRow({ linkedAs }: { linkedAs: string | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const unlink = async () => {
    setBusy(true);
    try {
      await api.delete("/me/discord");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast("Compte Discord délié", { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fm-option">
      <span className="fm-option-icon fm-discord-icon">
        <DiscordLogo />
      </span>
      <span className="fm-option-text">
        <b>Compte Discord</b>{" "}
        <small>{linkedAs ? `Relié à ${linkedAs}` : "Pour te connecter en un geste"}</small>
      </span>
      {linkedAs ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void unlink()}>
          Délier
        </Button>
      ) : (
        <a href={discordStartUrl("link")} className="fm-btn fm-btn-sm fm-btn-primary">
          Relier
        </a>
      )}
    </div>
  );
}

/** Message du retour de Discord (`?discord=linked` ou `?discordError=CODE`), une fois. */
function useDiscordReturn() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const linked = params.get("discord") === "linked";
  const code = params.get("discordError");
  useEffect(() => {
    if (!linked && !code) return;
    if (linked) toast("Compte Discord relié", { tone: "success" });
    else if (code)
      toast(code in errorMessages ? errorMessages[code as keyof typeof errorMessages] : code, {
        tone: "danger",
      });
    setParams({}, { replace: true });
  }, [linked, code, toast, setParams]);
}

export function ProfilePage() {
  const me = useQuery(meQuery);
  const config = useQuery(configQuery);
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [exportOpen, setExportOpen] = useState(false);
  // L'espace perso sans photo prend l'avatar du compte (rail, selecteur).
  const refreshAvatar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["spaces"] }),
    ]);
  useDiscordReturn();
  if (!me.data) return null;
  const { preferences } = me.data;
  const showDiscord = Boolean(config.data?.features.discord) || me.data.discord !== null;
  return (
    <ProfileLayout title="Profil">
      <div className="flex items-center gap-4">
        <Avatar name={me.data.username} src={me.data.avatarUrl} size={64} />
        <div className="fm-stack gap-1">
          <h1 className="font-display text-2xl font-bold">{me.data.username}</h1>
          <p className="text-ink-muted">{me.data.email}</p>
          <ImagePicker
            kind="avatar"
            crop="round"
            hasImage={me.data.avatarUrl !== null}
            onUploaded={async (uploadId) => {
              await api.put("/me/avatar", { uploadId }, imageResponseSchema);
              await refreshAvatar();
            }}
            onRemove={async () => {
              await api.delete("/me/avatar", undefined, imageResponseSchema);
              await refreshAvatar();
            }}
          />
        </div>
      </div>
      {me.data.hasPassword ? null : <BackupPasswordCallout />}
      <nav aria-label="Réglages du profil" className="fm-options">
        <Row icon="pencil" label="Nom et adresse e-mail" to="/profile/account" />
        <Row
          icon="sparkles"
          label="Apparence"
          value={`${AMBIANCES[preferences.ambiance].label} · ${MODE_LABELS[preferences.colorMode]}`}
          to="/profile/appearance"
        />
        <Row icon="bell" label="Notifications" to="/profile/notifications" />
        <Row
          icon="lock"
          label="Mot de passe"
          value={me.data.hasPassword ? undefined : "Aucun pour l'instant"}
          to="/profile/password"
        />
        {showDiscord ? <DiscordRow linkedAs={me.data.discord?.username ?? null} /> : null}
        <Row icon="home" label="Langue" value="Français" />
        <Row
          icon="arrow-down"
          label="Exporter mes recettes"
          value="Archive JSON ou Markdown"
          onClick={() => setExportOpen(true)}
        />
        <Row
          icon="sparkles"
          label="Nouveautés"
          value="Ce qui a changé dans Forest Manager"
          to="/news"
        />
      </nav>
      <div className="fm-stack">
        <Button icon="log-out" onClick={() => void logout()}>
          Se déconnecter
        </Button>
        <Link to="/profile/delete" className="fm-btn fm-btn-ghost text-danger-text">
          Supprimer mon compte
        </Link>
      </div>
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
    </ProfileLayout>
  );
}

/** Rappel tant que l'adresse n'est pas confirmee [D90], avec un nouvel envoi du lien. */
function VerifyReminder() {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    try {
      await api.post("/auth/verify-email/resend");
      toast("Lien envoyé", { tone: "success" });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-ink-muted">Adresse pas encore confirmée.</p>
      <Button size="sm" disabled={sending} onClick={() => void resend()}>
        Renvoyer le lien
      </Button>
    </div>
  );
}

export function AccountPage() {
  const me = useQuery(meQuery);
  const config = useQuery(configQuery);
  const queryClient = useQueryClient();
  const toast = useToast();
  const form = useForm({
    values: { username: me.data?.username ?? "", email: me.data?.email ?? "", currentPassword: "" },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const emailChanged = useWatch({ control: form.control, name: "email" }) !== me.data?.email;

  const onSubmit = form.handleSubmit(async (values) => {
    const body: Record<string, string> = {};
    if (dirtyFields.username && values.username !== me.data?.username)
      body.username = values.username.trim();
    if (emailChanged) {
      body.email = values.email.trim();
      body.currentPassword = values.currentPassword;
    }
    if (Object.keys(body).length === 0) return;
    try {
      const updated = await api.patch("/me", body, meSchema);
      queryClient.setQueryData(["me"], updated);
      form.reset({ username: updated.username, email: updated.email, currentPassword: "" });
      toast("Profil enregistré", { tone: "success" });
    } catch (error) {
      applyApiError(error, form.setError, {
        AUTH_003: "username",
        AUTH_004: "email",
        AUTH_005: "currentPassword",
      });
    }
  });

  return (
    <ProfileLayout title="Nom et adresse e-mail" back="/profile">
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Nom d'utilisateur"
          autoComplete="username"
          error={errors.username?.message}
          {...form.register("username")}
        />
        <Field
          label="Adresse e-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register("email")}
          disabled={me.data?.hasPassword === false}
        />
        {me.data?.hasPassword === false ? (
          <p className="text-sm text-ink-muted">
            Pour changer d'adresse :{" "}
            <Link to="/profile/password">Définis d'abord un mot de passe</Link>.
          </p>
        ) : null}
        {config.data?.features.email && me.data && !me.data.emailVerified && !emailChanged ? (
          <VerifyReminder />
        ) : null}
        {emailChanged ? (
          <Field
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            hint="Nécessaire pour changer d'adresse."
            error={errors.currentPassword?.message}
            {...form.register("currentPassword")}
          />
        ) : null}
        <div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </form>
    </ProfileLayout>
  );
}

export function PasswordPage() {
  const me = useQuery(meQuery);
  const queryClient = useQueryClient();
  // Compte cree par Discord : il definit un mot de passe de secours, sans l'actuel [D210].
  const defining = me.data?.hasPassword === false;
  const [done, setDone] = useState<"changed" | "defined" | null>(null);
  const form = useForm({ defaultValues: { currentPassword: "", newPassword: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setDone(null);
    try {
      await api.put("/me/password", defining ? { newPassword } : { currentPassword, newPassword });
      form.reset();
      setDone(defining ? "defined" : "changed");
      if (defining) await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      applyApiError(error, form.setError, {
        AUTH_005: "currentPassword",
        AUTH_009: "newPassword",
        VALIDATION_001: "newPassword",
      });
    }
  });
  if (!me.data) return null;
  if (done === "defined") {
    // Le compte a maintenant un mot de passe : pas de bascule vers le formulaire "changer".
    return (
      <ProfileLayout title="Définir un mot de passe" back="/profile">
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-success-text">
          Mot de passe enregistré. Tu peux aussi te connecter avec lui.
        </p>
        <Link to="/profile" className="fm-btn fm-btn-secondary self-start">
          Retour au profil
        </Link>
      </ProfileLayout>
    );
  }
  return (
    <ProfileLayout title={defining ? "Définir un mot de passe" : "Mot de passe"} back="/profile">
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        {defining ? (
          <p className="text-ink-muted">
            Tu te connectes avec Discord. Ce mot de passe te servira de secours, avec ton nom
            d'utilisateur ou ton adresse e-mail.
          </p>
        ) : (
          <Field
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...form.register("currentPassword", { required: "Indique ton mot de passe actuel." })}
          />
        )}
        <Field
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          hint="10 caractères minimum."
          error={errors.newPassword?.message}
          {...form.register("newPassword", {
            minLength: { value: 10, message: "10 caractères minimum." },
          })}
        />
        {done ? (
          <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-success-text">
            Mot de passe changé. Tes autres appareils sont déconnectés.
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {defining ? "Enregistrer" : "Changer le mot de passe"}
          </Button>
        </div>
      </form>
    </ProfileLayout>
  );
}
