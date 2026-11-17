// E-PROFILS-GENERATION [D58, D114, D183, D184] : profils de generation de
// l'espace (moderateurs et OWNER). Bureau : liste a gauche, profil a droite ;
// mobile : profils en pastilles au-dessus du profil. Toujours un profil par
// defaut ; le dernier ne se supprime pas ; supprimer le profil par defaut
// demande son remplacant.
import {
  MAX_COOLDOWN_DAYS,
  PROFILE_DESCRIPTION_MAX,
  PROFILE_NAME_MAX,
  generationProfileSchema,
  type GenerationProfile,
  type GenerationProfileSummary,
  type Rule,
  type UpdateGenerationProfileBody,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useMediaQuery } from "../../lib/use-media-query.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { ActionMenu } from "../../ui/action-menu.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Chip, RadioGroup, Stepper, Switch } from "../../ui/controls.tsx";
import { cx } from "../../ui/cx.ts";
import { Badge, EmptyState, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { ruleDetail } from "./format.ts";
import { ProfileGrid } from "./profile-grid.tsx";
import { profileQuery, profilesKey, profilesQuery, settingsQuery } from "./queries.ts";
import { RuleSheet } from "./rule-sheet.tsx";

const WIDE = "(min-width: 1024px)";

/** Nom et description : nouveau profil, ou renommer celui-ci. */
function NameForm({
  spaceId,
  profile,
  onDone,
}: {
  spaceId: string;
  profile: GenerationProfile | null;
  onDone: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const guard = useWriteGuard();
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [nameError, setNameError] = useState<string>();
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || null };
      const path = `/spaces/${spaceId}/meal-plan/profiles`;
      return profile
        ? api.patch(`${path}/${profile.id}`, body, generationProfileSchema)
        : api.post(path, body, generationProfileSchema);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(profileQuery(spaceId, saved.id).queryKey, saved);
      await queryClient.invalidateQueries({ queryKey: profilesKey(spaceId) });
      onDone(saved.id);
    },
  });
  return (
    <form
      className="fm-stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setNameError("Donne un nom au profil.");
          return;
        }
        setNameError(undefined);
        save.mutate();
      }}
    >
      <FormAlert message={save.isError ? errorMessage(save.error) : undefined} />
      <Field
        label="Nom"
        value={name}
        maxLength={PROFILE_NAME_MAX}
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <Field
        multiline
        rows={2}
        label="Description (facultatif)"
        value={description}
        maxLength={PROFILE_DESCRIPTION_MAX}
        onChange={(e) => {
          setDescription(e.target.value);
        }}
      />
      <SheetFooter>
        <Button
          type="submit"
          variant="primary"
          block
          disabled={save.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
        >
          {profile ? "Enregistrer" : "Créer"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function DeleteForm({
  spaceId,
  profile,
  others,
  onDone,
}: {
  spaceId: string;
  profile: GenerationProfile;
  others: readonly GenerationProfileSummary[];
  onDone: (nextId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guard = useWriteGuard();
  const [defaultId, setDefaultId] = useState<string>();
  const remove = useMutation({
    mutationFn: () =>
      api.delete(
        `/spaces/${spaceId}/meal-plan/profiles/${profile.id}`,
        profile.isDefault ? { defaultId } : {}
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: profilesKey(spaceId) });
      toast(`Profil « ${profile.name} » supprimé`, { tone: "success" });
      onDone(defaultId ?? null);
    },
  });
  const missing = profile.isDefault && !defaultId;
  return (
    <div className="fm-stack">
      <FormAlert message={remove.isError ? errorMessage(remove.error) : undefined} />
      {profile.isDefault ? (
        <RadioGroup
          label="Nouveau profil par défaut"
          options={others.map((other) => ({ value: other.id, label: other.name }))}
          value={defaultId}
          onChange={setDefaultId}
        />
      ) : null}
      <p className="m-0 text-sm text-ink-muted">
        {profile.isDefault
          ? "C'est le profil par défaut : choisis celui qui le remplace. Ses règles et sa grille sont supprimées."
          : "Ses règles et sa grille sont supprimées. Le planning n'est pas modifié."}
      </p>
      <SheetFooter>
        <Button
          variant="danger"
          block
          disabled={missing || remove.isPending || guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={() => {
            remove.mutate();
          }}
        >
          Supprimer le profil
        </Button>
      </SheetFooter>
    </div>
  );
}

function RuleRow({ rule, onOpen }: { rule: Rule; onOpen: () => void }) {
  const tag = rule.target.kind === "TAG" ? rule.target.tag : null;
  const recipe = rule.target.kind === "RECIPE" ? rule.target.recipe : null;
  const asleep = tag?.status === "DELETED" || (recipe !== null && recipe.title === null);
  const name = tag ? tag.name : (recipe?.title ?? "Recette indisponible");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <b className={cx("text-[15px]", asleep && "line-through")}>{name}</b>
          <span className="text-sm text-ink-muted">
            {asleep
              ? tag
                ? "Tag supprimé : règle ignorée"
                : "Recette plus visible dans l'espace : règle ignorée"
              : ruleDetail(rule)}
          </span>
        </span>
        <Badge tone={tag ? "accent" : "second"}>{tag ? "Tag" : "Recette"}</Badge>
        <Icon name="chevron-right" />
      </button>
    </li>
  );
}

function ProfileDetail({
  spaceId,
  profile,
  summaries,
  onSelect,
}: {
  spaceId: string;
  profile: GenerationProfile;
  summaries: readonly GenerationProfileSummary[];
  onSelect: (id: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const guard = useWriteGuard();
  const settings = useQuery(settingsQuery(spaceId));
  const [sheet, setSheet] = useState<"rename" | "delete" | null>(null);
  const [rule, setRule] = useState<{ rule: Rule | null } | null>(null);
  const others = summaries.filter((s) => s.id !== profile.id);

  const patch = useMutation({
    mutationFn: (body: UpdateGenerationProfileBody) =>
      api.patch(
        `/spaces/${spaceId}/meal-plan/profiles/${profile.id}`,
        body,
        generationProfileSchema
      ),
    onSuccess: async (saved) => {
      queryClient.setQueryData(profileQuery(spaceId, saved.id).queryKey, saved);
      await queryClient.invalidateQueries({ queryKey: [...profilesKey(spaceId), "list"] });
    },
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });
  const duplicate = useMutation({
    mutationFn: () =>
      api.post(
        `/spaces/${spaceId}/meal-plan/profiles/${profile.id}/duplicate`,
        undefined,
        generationProfileSchema
      ),
    onSuccess: async (copy) => {
      queryClient.setQueryData(profileQuery(spaceId, copy.id).queryKey, copy);
      await queryClient.invalidateQueries({ queryKey: [...profilesKey(spaceId), "list"] });
      toast(`Profil « ${copy.name} » créé`, { tone: "success" });
      onSelect(copy.id);
    },
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });

  const items = [
    { id: "rename" as const, label: "Renommer", icon: "pencil" as const },
    { id: "duplicate" as const, label: "Dupliquer", icon: "copy" as const },
    ...(profile.isDefault
      ? []
      : [{ id: "default" as const, label: "Utiliser par défaut", icon: "check" as const }]),
    ...(others.length > 0
      ? [{ id: "delete" as const, label: "Supprimer", icon: "trash" as const, danger: true }]
      : []),
  ];

  return (
    <div className="fm-stack min-w-0 flex-1">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-display text-xl font-bold">{profile.name}</h2>
            {profile.isDefault ? <Badge tone="accent">Par défaut</Badge> : null}
          </div>
          {profile.description ? (
            <p className="m-0 text-sm text-ink-muted">{profile.description}</p>
          ) : null}
        </div>
        <ActionMenu
          label="Actions du profil"
          trigger={<IconButton icon="more" label="Actions du profil" />}
          items={items}
          disabled={guard.disabled}
          onSelect={(id) => {
            if (id === "duplicate") duplicate.mutate();
            else if (id === "default") patch.mutate({ isDefault: true });
            else setSheet(id);
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="fm-label">Délai avant de reproposer une recette</span>
        <Stepper
          label="Délai avant de reproposer une recette"
          min={0}
          max={MAX_COOLDOWN_DAYS}
          value={profile.cooldownDays}
          format={(days) => (days === 0 ? "Aucun" : `${String(days)} j`)}
          onChange={(cooldownDays) => {
            patch.mutate({ cooldownDays });
          }}
        />
      </div>
      <Switch
        label="Proposer aussi les idées de repas"
        checked={profile.useIdeas}
        disabled={guard.disabled}
        onChange={(useIdeas) => {
          patch.mutate({ useIdeas });
        }}
      />

      <section aria-labelledby="profile-rules-title" className="fm-stack">
        <h3 id="profile-rules-title" className="m-0 text-base font-bold">
          Règles
        </h3>
        {profile.rules.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">
            Aucune règle : toutes les recettes ont la même chance.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {profile.rules.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                onOpen={() => {
                  setRule({ rule: r });
                }}
              />
            ))}
          </ul>
        )}
        <Button
          icon="plus"
          className="self-start"
          disabled={guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={() => {
            setRule({ rule: null });
          }}
        >
          Ajouter une règle
        </Button>
      </section>

      {settings.data ? (
        <ProfileGrid
          spaceId={spaceId}
          profile={profile}
          mealTimes={settings.data.mealTimes}
          weekStartsOn={settings.data.weekStartsOn}
        />
      ) : null}

      <RuleSheet
        open={rule !== null}
        onClose={() => {
          setRule(null);
        }}
        spaceId={spaceId}
        profileId={profile.id}
        rule={rule?.rule ?? null}
      />
      <Sheet
        open={sheet === "rename"}
        onClose={() => {
          setSheet(null);
        }}
        title="Renommer le profil"
      >
        {sheet === "rename" ? (
          <NameForm
            spaceId={spaceId}
            profile={profile}
            onDone={() => {
              setSheet(null);
            }}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={sheet === "delete"}
        onClose={() => {
          setSheet(null);
        }}
        title={`Supprimer « ${profile.name} » ?`}
      >
        {sheet === "delete" ? (
          <DeleteForm
            spaceId={spaceId}
            profile={profile}
            others={others}
            onDone={(next) => {
              setSheet(null);
              onSelect(next);
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

export function ProfilesPage() {
  const { spaceId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery(WIDE);
  const guard = useWriteGuard();
  const settings = useQuery(settingsQuery(spaceId));
  const list = useQuery({ ...profilesQuery(spaceId), enabled: settings.data?.can.manage === true });
  const [creating, setCreating] = useState(false);
  const wanted = params.get("profile");
  const summaries = list.data ?? [];
  const selectedId =
    summaries.find((p) => p.id === wanted)?.id ??
    summaries.find((p) => p.isDefault)?.id ??
    summaries[0]?.id ??
    null;
  const profile = useQuery({
    ...profileQuery(spaceId, selectedId ?? ""),
    enabled: selectedId !== null,
  });
  const select = (id: string | null) => {
    setParams(id ? { profile: id } : {}, { replace: true });
  };

  const newButton = (
    <Button
      icon="plus"
      disabled={guard.disabled}
      aria-describedby={guard["aria-describedby"]}
      onClick={() => {
        setCreating(true);
      }}
    >
      Nouveau profil
    </Button>
  );

  let content;
  if (settings.data && !settings.data.can.manage) {
    content = (
      <EmptyState icon="lock" title="Réservé aux modérateurs">
        Seuls les modérateurs et le propriétaire règlent la génération.
      </EmptyState>
    );
  } else if (list.isError || profile.isError) {
    content = (
      <EmptyState
        icon="info"
        title="Impossible de charger les profils"
        action={
          <Button onClick={() => void Promise.all([list.refetch(), profile.refetch()])}>
            Réessayer
          </Button>
        }
      >
        {errorMessage(list.error ?? profile.error)}
      </EmptyState>
    );
  } else if (!list.data || !profile.data) {
    content = <Skeleton />;
  } else {
    const picker = wide ? (
      <nav aria-label="Profils" className="flex w-64 shrink-0 flex-col gap-2">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {summaries.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-current={p.id === selectedId ? "true" : undefined}
                className={cx(
                  "flex w-full flex-col rounded-md px-3 py-2 text-left",
                  p.id === selectedId ? "bg-accent-soft text-accent-text" : "hover:bg-surface"
                )}
                onClick={() => {
                  select(p.id);
                }}
              >
                <b className="text-[15px]">{p.name}</b>
                <span className="text-xs text-ink-muted">
                  {[
                    p.isDefault ? "Par défaut" : null,
                    `${String(p.ruleCount)} ${p.ruleCount > 1 ? "règles" : "règle"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {newButton}
      </nav>
    ) : (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Profils">
        {summaries.length > 1
          ? summaries.map((p) => (
              <Chip
                key={p.id}
                selected={p.id === selectedId}
                onToggle={() => {
                  select(p.id);
                }}
              >
                {p.name}
              </Chip>
            ))
          : null}
        {newButton}
      </div>
    );
    content = (
      <div className={cx("flex gap-6", wide ? "flex-row items-start" : "flex-col")}>
        {picker}
        <ProfileDetail
          key={profile.data.id}
          spaceId={spaceId}
          profile={profile.data}
          summaries={summaries}
          onSelect={select}
        />
      </div>
    );
  }

  return (
    <div className="fm-stack mx-auto w-full max-w-5xl p-4">
      <div className="flex items-center gap-2">
        <Link
          to={`/s/${spaceId}/meal-plan`}
          className="fm-iconbtn"
          aria-label="Retour au planning"
          title="Retour au planning"
        >
          <Icon name="chevron-right" className="-scale-x-100" />
        </Link>
        <h1 className="m-0 font-display text-2xl font-bold">Profils de génération</h1>
      </div>
      {content}
      <Sheet
        open={creating}
        onClose={() => {
          setCreating(false);
        }}
        title="Nouveau profil"
      >
        {creating ? (
          <NameForm
            spaceId={spaceId}
            profile={null}
            onDone={(id) => {
              setCreating(false);
              select(id);
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
