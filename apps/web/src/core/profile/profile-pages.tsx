// E-PROFIL, compte (username, email), mot de passe [F-ACC-4].
import { imageResponseSchema, meSchema } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";

import { api } from "../../lib/api.ts";
import { applyApiError } from "../../lib/form-errors.ts";
import { ImagePicker } from "../../patterns/image-picker.tsx";
import { AMBIANCES } from "../../theme/themes.ts";
import { Button } from "../../ui/button.tsx";
import { Avatar } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon, type IconName } from "../../ui/icon.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { meQuery } from "../session/queries.ts";
import { ProfileLayout } from "./profile-layout.tsx";
import { useLogout } from "./use-logout.ts";

const MODE_LABELS = { SYSTEM: "système", LIGHT: "clair", DARK: "sombre" } as const;

function Row({
  icon,
  label,
  value,
  to,
}: {
  icon: IconName;
  label: string;
  value?: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="fm-option-icon">
        <Icon name={icon} />
      </span>
      <span className="fm-option-text">
        <b>{label}</b>
        {value ? <small>{value}</small> : null}
      </span>
      {to ? <Icon name="chevron-right" className="fm-option-go" /> : null}
    </>
  );
  return to ? (
    <Link to={to} className="fm-option">
      {content}
    </Link>
  ) : (
    <div className="fm-option">{content}</div>
  );
}

export function ProfilePage() {
  const me = useQuery(meQuery);
  const queryClient = useQueryClient();
  const logout = useLogout();
  if (!me.data) return null;
  const { preferences } = me.data;
  return (
    <ProfileLayout title="Profil">
      <div className="flex items-center gap-4">
        <Avatar name={me.data.username} src={me.data.avatarUrl} size={64} />
        <div className="fm-stack gap-1">
          <h1 className="font-display text-2xl font-bold">{me.data.username}</h1>
          <p className="text-ink-muted">{me.data.email}</p>
          <ImagePicker
            kind="avatar"
            hasImage={me.data.avatarUrl !== null}
            onUploaded={async (uploadId) => {
              await api.put("/me/avatar", { uploadId }, imageResponseSchema);
              await queryClient.invalidateQueries({ queryKey: ["me"] });
            }}
            onRemove={async () => {
              await api.delete("/me/avatar", undefined, imageResponseSchema);
              await queryClient.invalidateQueries({ queryKey: ["me"] });
            }}
          />
        </div>
      </div>
      <nav aria-label="Réglages du profil" className="fm-options">
        <Row icon="pencil" label="Nom et adresse e-mail" to="/profile/account" />
        <Row
          icon="sparkles"
          label="Apparence"
          value={`${AMBIANCES[preferences.ambiance].label} · ${MODE_LABELS[preferences.colorMode]}`}
          to="/profile/appearance"
        />
        <Row icon="bell" label="Notifications" to="/profile/notifications" />
        <Row icon="lock" label="Mot de passe" to="/profile/password" />
        <Row icon="home" label="Langue" value="Français" />
      </nav>
      <div className="fm-stack">
        <Button icon="log-out" onClick={() => void logout()}>
          Se déconnecter
        </Button>
        <Link to="/profile/delete" className="fm-btn fm-btn-ghost text-danger-text">
          Supprimer mon compte
        </Link>
      </div>
    </ProfileLayout>
  );
}

export function AccountPage() {
  const me = useQuery(meQuery);
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
        />
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
  const [done, setDone] = useState(false);
  const form = useForm({ defaultValues: { currentPassword: "", newPassword: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (body) => {
    setDone(false);
    try {
      await api.put("/me/password", body);
      form.reset();
      setDone(true);
    } catch (error) {
      applyApiError(error, form.setError, {
        AUTH_005: "currentPassword",
        AUTH_009: "newPassword",
        VALIDATION_001: "newPassword",
      });
    }
  });
  return (
    <ProfileLayout title="Mot de passe" back="/profile">
      <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
        <FormAlert message={errors.root?.message} />
        <Field
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...form.register("currentPassword", { required: "Indique ton mot de passe actuel." })}
        />
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
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </ProfileLayout>
  );
}
