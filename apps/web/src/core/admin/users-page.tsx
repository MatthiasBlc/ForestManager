// A12 : utilisateurs. Le compte seulement, jamais le contenu ; se connecter a la
// place d'un utilisateur est impossible. A12b : mot de passe temporaire [D134],
// affiche une seule fois et transmis par l'admin lui-meme.
import {
  ADMIN_USER_FILTERS,
  adminUserSchema,
  offsetPageSchema,
  temporaryPasswordSchema,
  type AdminUser,
  type AdminUserFilter,
  type TemporaryPassword,
} from "@fm/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { SegmentedControl } from "../../ui/controls.tsx";
import { Avatar, Badge, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { configQuery } from "../session/queries.ts";
import { whenLabel } from "./format.ts";

const PAGE = 50;
/** Plafond de la pagination admin (offsetQuerySchema) : au-dela, affiner la recherche. */
const MAX = 100;

const FILTER_LABELS: Record<AdminUserFilter, string> = {
  ALL: "Tous",
  OWNERS: "OWNER d'un espace",
  INACTIVE: "Inactifs depuis 6 mois",
};
const FILTERS = ADMIN_USER_FILTERS.map((value) => ({ value, label: FILTER_LABELS[value] }));

function usersQuery(filter: AdminUserFilter, query: string, limit: number) {
  const params = new URLSearchParams({ filter, limit: String(limit) });
  if (query) params.set("query", query);
  return {
    queryKey: ["admin", "users", filter, query, limit],
    queryFn: () => api.get(`/admin/users?${params.toString()}`, offsetPageSchema(adminUserSchema)),
  };
}

function spacesLabel(user: AdminUser): string {
  if (user.spaces.length === 0) return "Aucun espace groupe";
  return user.spaces.map((s) => (s.owner ? `${s.name} (OWNER)` : s.name)).join(", ");
}

function TemporaryPasswordSheet({
  user,
  temp,
  onClose,
}: {
  user: AdminUser | null;
  temp: TemporaryPassword | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const name = user?.username ?? "";
  return (
    <Sheet
      open={user !== null && temp !== null}
      onClose={onClose}
      title={`Nouveau mot de passe pour ${name}`}
    >
      <div className="fm-stack">
        <p className="m-0">
          Un mot de passe temporaire a été généré. Transmets-le à {name} toi-même, de vive voix ou
          par message : il ne sera plus affiché après fermeture.
        </p>
        <div className="flex items-end gap-2">
          <Field
            className="flex-1"
            label="Mot de passe temporaire"
            value={temp?.password ?? ""}
            readOnly
            autoComplete="off"
            onFocus={(event) => {
              event.target.select();
            }}
          />
          <Button
            icon="copy"
            onClick={() => {
              void navigator.clipboard.writeText(temp?.password ?? "").then(() => {
                toast("Copié");
              });
            }}
          >
            Copier
          </Button>
        </div>
        <ul className="m-0 flex flex-col gap-1 pl-5 text-sm text-ink-muted">
          <li>
            Valable 24 heures, une seule fois : à la connexion, {name} choisit son propre mot de
            passe.
          </li>
          <li>
            Son mot de passe actuel reste valable jusque-là ; ensuite, ses autres sessions sont
            fermées.
          </li>
          <li>Enregistré dans le journal d&apos;audit.</li>
        </ul>
        <SheetFooter>
          <Button variant="primary" onClick={onClose}>
            C&apos;est transmis
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

export function UsersPage() {
  const config = useQuery(configQuery);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<AdminUserFilter>("ALL");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const users = useQuery({
    ...usersQuery(filter, search.trim(), limit),
    placeholderData: keepPreviousData,
  });
  const [issued, setIssued] = useState<{ user: AdminUser; temp: TemporaryPassword } | null>(null);
  const reset = useMutation({
    mutationFn: (user: AdminUser) =>
      api.post(`/admin/users/${user.id}/temporary-password`, undefined, temporaryPasswordSchema),
    onSuccess: async (temp, user) => {
      setIssued({ user, temp });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-2xl font-bold">Utilisateurs</h1>
        <p className="m-0 text-ink-muted">
          {users.data ? `${String(users.data.total)} comptes. ` : ""}Tu vois leur compte, pas leur
          contenu : se connecter à la place d&apos;un utilisateur est impossible.
        </p>
      </div>
      {config.data && !config.data.features.email ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md bg-surface-raised px-4 py-3"
        >
          <Icon name="lock" size={18} />
          <span className="text-sm">
            <b>E-mails non configurés.</b> « Mot de passe oublié » est masqué pour les utilisateurs
            : quand l&apos;un d&apos;eux est bloqué, réinitialise son mot de passe ici et
            transmets-le lui toi-même.
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <Field
          className="min-w-0 flex-[1_1_16rem]"
          label="Rechercher"
          placeholder="Nom d'utilisateur ou e-mail"
          value={search}
          autoComplete="off"
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(PAGE);
          }}
        />
        {/* min-w-0 : le filtre defile sur lui-meme au lieu d'elargir la page (mobile). */}
        <div className="max-w-full min-w-0">
          <SegmentedControl
            label="Filtrer les comptes"
            options={FILTERS}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setLimit(PAGE);
            }}
          />
        </div>
      </div>
      {users.isPending ? (
        <Skeleton label="Chargement des comptes" />
      ) : users.isError ? (
        <FormAlert message={errorMessage(users.error)} />
      ) : users.data.data.length === 0 ? (
        <p className="m-0 text-ink-muted">Aucun compte ne correspond.</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Comptes" className="fm-table">
            <thead>
              <tr>
                <th scope="col">Utilisateur</th>
                <th scope="col">Espaces</th>
                <th scope="col">Inscription</th>
                <th scope="col">Dernière connexion</th>
                <th scope="col">
                  <span className="fm-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.data.data.map((user) => (
                <tr key={user.id}>
                  <th scope="row">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.username} src={user.avatarUrl} size={36} />
                      <div className="flex min-w-0 flex-col">
                        <b>{user.username}</b>
                        <span className="text-sm font-normal text-ink-muted">{user.email}</span>
                      </div>
                    </div>
                  </th>
                  <td>{spacesLabel(user)}</td>
                  <td>{whenLabel(user.createdAt)}</td>
                  <td>{user.lastLoginAt ? whenLabel(user.lastLoginAt) : "Jamais"}</td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {user.temporaryPasswordPending ? (
                        <Badge tone="warning">Temporaire en attente</Badge>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Réinitialiser le mot de passe de ${user.username}`}
                        disabled={reset.isPending}
                        onClick={() => {
                          reset.mutate(user);
                        }}
                      >
                        Réinitialiser le mot de passe
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {users.data ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 text-sm text-ink-muted">
            {users.data.data.length < users.data.total
              ? `${String(users.data.data.length)} premiers comptes sur ${String(users.data.total)}, par dernière connexion${limit >= MAX ? " : affine la recherche pour voir les autres" : ""}. `
              : ""}
            Chaque réinitialisation est enregistrée dans le journal d&apos;audit.
          </p>
          {users.data.data.length < users.data.total && limit < MAX ? (
            <Button
              size="sm"
              onClick={() => {
                setLimit(Math.min(limit + PAGE, MAX));
              }}
            >
              Afficher plus
            </Button>
          ) : null}
        </div>
      ) : null}
      <TemporaryPasswordSheet
        user={issued?.user ?? null}
        temp={issued?.temp ?? null}
        onClose={() => {
          setIssued(null);
        }}
      />
    </>
  );
}
