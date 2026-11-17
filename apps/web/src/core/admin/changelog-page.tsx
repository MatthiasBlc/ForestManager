// A10 : changelog [D187, D127]. Chaque deploiement en production prepare un
// brouillon a partir des commits ; l'admin le reformule, puis le publie (en
// prevenant tout le monde ou non), le masque ou le reaffiche.
import {
  RELEASE_ITEM_MAX,
  RELEASE_TITLE_MAX,
  adminReleaseSchema,
  listSchema,
  type AdminRelease,
  type ChangelogStatus,
  type ReleaseContent,
  type ReleaseSection,
} from "@fm/shared";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Switch } from "../../ui/controls.tsx";
import { Badge, EmptyState, Skeleton, type Tone } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { SECTION_LABELS, releaseDate, sectionsOf } from "../changelog/sections.ts";

const adminReleasesQuery = queryOptions({
  queryKey: ["admin", "releases"],
  queryFn: async () => (await api.get("/admin/releases", listSchema(adminReleaseSchema))).data,
});

const STATUS: Readonly<Record<ChangelogStatus, [string, Tone]>> = {
  DRAFT: ["Brouillon", "warning"],
  PUBLISHED: ["Publiée", "success"],
  HIDDEN: ["Masquée", "neutral"],
};

function lineCount(content: ReleaseContent): number {
  return content.features.length + content.improvements.length + content.fixes.length;
}

function meta(release: AdminRelease): string {
  if (release.status === "DRAFT") return `Préparée le ${releaseDate(release.createdAt)}`;
  if (release.status === "HIDDEN") return "Masquée aux utilisateurs";
  const count = lineCount(release.content);
  return `${releaseDate(release.publishedAt ?? release.createdAt)} · ${String(count)} ligne${count > 1 ? "s" : ""}`;
}

function VersionLink({ release, selected }: { release: AdminRelease; selected: boolean }) {
  const [label, tone] = STATUS[release.status];
  return (
    <Link
      to={`/admin/changelog?version=${release.version}`}
      aria-current={selected ? "page" : undefined}
      className={`flex flex-col gap-1 rounded-md border px-3.5 py-3 text-ink no-underline ${
        selected ? "border-transparent bg-accent-soft" : "border-line bg-surface-raised"
      }`}
    >
      <span className="flex items-center gap-2">
        <b className="font-mono">{release.version}</b>
        <Badge tone={tone}>{label}</Badge>
      </span>
      <span className="text-sm text-ink-muted">{meta(release)}</span>
    </Link>
  );
}

type Editing = { section: ReleaseSection; index: number } | null;

/** Retire les lignes vides avant l'envoi. */
function cleaned(content: ReleaseContent): ReleaseContent {
  const keep = (items: ReleaseContent[ReleaseSection]) =>
    items.map((item) => ({ text: item.text.trim() })).filter((item) => item.text !== "");
  return {
    features: keep(content.features),
    improvements: keep(content.improvements),
    fixes: keep(content.fixes),
  };
}

function ReleaseEditor({ release }: { release: AdminRelease }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState(release.title);
  const [content, setContent] = useState(release.content);
  const [editing, setEditing] = useState<Editing>(null);
  const [notifyAll, setNotifyAll] = useState(true);
  const readOnly = release.status === "HIDDEN";
  const [label, tone] = STATUS[release.status];
  const titleId = `release-${release.id}`;

  const replace = (updated: AdminRelease) => {
    queryClient.setQueryData(adminReleasesQuery.queryKey, (list) =>
      list?.map((item) => (item.id === updated.id ? updated : item))
    );
  };
  const save = () =>
    api.patch(
      `/admin/releases/${release.id}`,
      { title: title.trim(), content: cleaned(content) },
      adminReleaseSchema
    );
  const action = useMutation({
    mutationFn: async (kind: "save" | "publish" | "hide" | "show") => {
      if (kind === "save") return save();
      if (kind === "publish") {
        await save();
        return api.post(
          `/admin/releases/${release.id}/publish`,
          { notify: notifyAll },
          adminReleaseSchema
        );
      }
      return api.post(`/admin/releases/${release.id}/${kind}`, undefined, adminReleaseSchema);
    },
    onSuccess: (updated, kind) => {
      replace(updated);
      const messages = {
        save: "Version enregistrée",
        publish: `Version ${release.version} publiée`,
        hide: "Version masquée",
        show: "Version réaffichée",
      };
      toast(messages[kind], { tone: "success" });
    },
  });

  const setItems = (
    section: ReleaseSection,
    update: (items: ReleaseContent[ReleaseSection]) => ReleaseContent[ReleaseSection]
  ) => {
    setContent((current) => ({ ...current, [section]: update(current[section]) }));
  };
  /** Fin d'une reformulation : une ligne videe est retiree. */
  const finish = () => {
    if (!editing) return;
    const text = content[editing.section][editing.index]?.text.trim() ?? "";
    if (text === "") {
      setItems(editing.section, (items) => items.filter((_, i) => i !== editing.index));
    }
    setEditing(null);
  };

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={titleId} className="m-0 flex-1 font-display text-xl font-bold">
          Version {release.version}
        </h2>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <Field
        label="Titre"
        value={title}
        maxLength={RELEASE_TITLE_MAX}
        readOnly={readOnly}
        onChange={(event) => {
          setTitle(event.target.value);
        }}
      />
      {sectionsOf(content).map((section) => (
        <div key={section.key} className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{section.label}</span>
          {section.items.map((item, index) =>
            editing?.section === section.key && editing.index === index ? (
              <input
                key={index}
                className="fm-input"
                aria-label={`Ligne de ${section.label}`}
                value={item.text}
                maxLength={RELEASE_ITEM_MAX}
                autoFocus
                onChange={(event) => {
                  const text = event.target.value;
                  setItems(section.key, (items) =>
                    items.map((current, i) => (i === index ? { text } : current))
                  );
                }}
                onBlur={finish}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    finish();
                  }
                }}
              />
            ) : (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border border-line py-1.5 pr-1.5 pl-3"
              >
                <span className="min-w-0 flex-1">{item.text}</span>
                {readOnly ? null : (
                  <>
                    <IconButton
                      icon="pencil"
                      label={`Reformuler : ${item.text}`}
                      onClick={() => {
                        setEditing({ section: section.key, index });
                      }}
                    />
                    <IconButton
                      icon="trash"
                      label={`Retirer cette ligne : ${item.text}`}
                      onClick={() => {
                        setItems(section.key, (items) => items.filter((_, i) => i !== index));
                      }}
                    />
                  </>
                )}
              </div>
            )
          )}
          {readOnly ? null : (
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              className="self-start"
              aria-label={`Ajouter une ligne à ${SECTION_LABELS[section.key]}`}
              onClick={() => {
                setItems(section.key, (items) => [...items, { text: "" }]);
                setEditing({ section: section.key, index: section.items.length });
              }}
            >
              Ajouter une ligne
            </Button>
          )}
        </div>
      ))}
      {release.status === "DRAFT" ? (
        <Switch
          label="Prévenir tous les utilisateurs par une notification"
          checked={notifyAll}
          onChange={setNotifyAll}
        />
      ) : null}
      <FormAlert message={action.error ? errorMessage(action.error) : undefined} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        {release.status === "DRAFT" ? (
          <>
            <Button disabled={action.isPending} onClick={() => action.mutate("save")}>
              Enregistrer le brouillon
            </Button>
            <Button
              variant="primary"
              disabled={action.isPending}
              onClick={() => action.mutate("publish")}
            >
              Publier la version
            </Button>
          </>
        ) : null}
        {release.status === "PUBLISHED" ? (
          <>
            <Button disabled={action.isPending} onClick={() => action.mutate("hide")}>
              Masquer
            </Button>
            <Button
              variant="primary"
              disabled={action.isPending}
              onClick={() => action.mutate("save")}
            >
              Enregistrer
            </Button>
          </>
        ) : null}
        {release.status === "HIDDEN" ? (
          <Button disabled={action.isPending} onClick={() => action.mutate("show")}>
            Réafficher
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function ChangelogPage() {
  const releases = useQuery(adminReleasesQuery);
  const [params] = useSearchParams();
  const list = releases.data ?? [];
  const selected = list.find((release) => release.version === params.get("version")) ?? list[0];

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-2xl font-bold">Changelog</h1>
        <p className="m-0 text-ink-muted">
          Chaque déploiement en production prépare un brouillon à partir des commits. Relis-le,
          reformule pour les utilisateurs, puis publie.
        </p>
      </div>
      {releases.isPending ? <Skeleton label="Chargement des versions" /> : null}
      {releases.data?.length === 0 ? (
        <EmptyState icon="git-branch" title="Aucune version pour l'instant">
          Le prochain déploiement en production en préparera une.
        </EmptyState>
      ) : null}
      {selected ? (
        <div className="flex flex-wrap items-start gap-5">
          <nav aria-label="Versions" className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
            {list.map((release) => (
              <VersionLink
                key={release.id}
                release={release}
                selected={release.id === selected.id}
              />
            ))}
          </nav>
          <ReleaseEditor key={`${selected.id}-${selected.updatedAt}`} release={selected} />
        </div>
      ) : null}
    </>
  );
}
