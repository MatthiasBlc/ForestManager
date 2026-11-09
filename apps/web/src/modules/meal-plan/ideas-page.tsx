// E-IDEES [P10, D182] : idees de repas de l'espace en texte libre. Tout membre en
// ajoute ; l'auteur et les moderateurs les modifient ou les suppriment ;
// "Transformer en recette" ouvre l'editeur pre-rempli, l'idee est retiree une
// fois la recette enregistree [F-MPL-4].
import { MEAL_COMMENT_MAX, MEAL_IDEA_NAME_MAX, mealIdeaSchema, type MealIdea } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { ActionMenu } from "../../ui/action-menu.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Avatar, EmptyState, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import type { RecipePrefill } from "../recipes/prefill.ts";
import { ideasQuery } from "./queries.ts";

/** Feuille ouverte : nouvelle idee, ou modification d'une idee. */
type Editing = { idea: MealIdea | null } | null;

function IdeaForm({
  spaceId,
  idea,
  onDone,
}: {
  spaceId: string;
  idea: MealIdea | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const guard = useWriteGuard();
  const [name, setName] = useState(idea?.name ?? "");
  const [comment, setComment] = useState(idea?.comment ?? "");
  const [nameError, setNameError] = useState<string>();
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), comment: comment.trim() || null };
      const path = `/spaces/${spaceId}/meal-plan/ideas`;
      return idea
        ? api.put(`${path}/${idea.id}`, body, mealIdeaSchema)
        : api.post(path, body, mealIdeaSchema);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ideasQuery(spaceId).queryKey });
      onDone();
    },
  });

  return (
    <form
      className="fm-stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setNameError("Donne un nom à l'idée.");
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
        maxLength={MEAL_IDEA_NAME_MAX}
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
      <Field
        multiline
        rows={3}
        label="Commentaire (facultatif)"
        value={comment}
        maxLength={MEAL_COMMENT_MAX}
        onChange={(e) => {
          setComment(e.target.value);
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
          {idea ? "Enregistrer" : "Ajouter"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function IdeaCard({
  idea,
  canConvert,
  onEdit,
  onDelete,
  onConvert,
}: {
  idea: MealIdea;
  canConvert: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConvert: () => void;
}) {
  const guard = useWriteGuard();
  const headingId = `idea-${idea.id}`;
  const items = [
    ...(idea.can.edit ? [{ id: "edit" as const, label: "Modifier", icon: "pencil" as const }] : []),
    ...(idea.can.delete
      ? [{ id: "delete" as const, label: "Supprimer", icon: "trash" as const, danger: true }]
      : []),
  ];
  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised px-3 pt-3 pb-2"
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={idea.author?.username ?? "?"} size={28} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id={headingId} className="m-0 text-[15px] leading-5 font-bold">
            {idea.name}
          </h2>
          {idea.comment ? (
            <span className="text-[13px] leading-[18px] whitespace-pre-line text-ink-muted">
              {idea.comment}
            </span>
          ) : null}
          <span className="text-xs text-ink-muted">
            {idea.author ? `Proposée par ${idea.author.username}` : "Auteur parti"}
          </span>
        </div>
        {items.length > 0 ? (
          <ActionMenu
            label={`Actions de l'idée ${idea.name}`}
            trigger={<IconButton icon="more" label={`Actions de l'idée ${idea.name}`} />}
            items={items}
            disabled={guard.disabled}
            onSelect={(id) => {
              if (id === "edit") onEdit();
              else onDelete();
            }}
          />
        ) : null}
      </div>
      {canConvert ? (
        <Button
          variant="ghost"
          size="sm"
          icon="chef-hat"
          className="self-start"
          disabled={guard.disabled}
          aria-describedby={guard["aria-describedby"]}
          onClick={onConvert}
        >
          Transformer en recette
        </Button>
      ) : null}
    </article>
  );
}

export function IdeasPage() {
  const { spaceId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const space = useQuery(spaceQuery(spaceId));
  // Relue a chaque ouverture : une idee a pu etre transformee depuis l'editeur.
  const ideas = useQuery({ ...ideasQuery(spaceId), refetchOnMount: "always" });
  const [editing, setEditing] = useState<Editing>(null);
  const guard = useWriteGuard();
  const remove = useMutation({
    mutationFn: (idea: MealIdea) => api.delete(`/spaces/${spaceId}/meal-plan/ideas/${idea.id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ideasQuery(spaceId).queryKey });
      toast("Idée supprimée", { tone: "success" });
    },
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });
  const canConvert = space.data?.modules.some((m) => m.code === "recipes") ?? false;

  const convert = (idea: MealIdea) => {
    const author = idea.author ? ` de ${idea.author.username}` : "";
    const prefill: RecipePrefill = {
      title: idea.name,
      notes: idea.comment,
      heading: "Nouvelle recette depuis une idée",
      banner: `Créée depuis l'idée de repas${author} dans le planning de ${space.data?.name ?? ""} : le titre et la note sont repris, complète le reste.`,
      afterSave: `/spaces/${spaceId}/meal-plan/ideas/${idea.id}/convert`,
    };
    void navigate(`/s/${spaceId}/recipes/new`, { state: { prefill } });
  };

  const add = (
    <Button
      variant="primary"
      icon="plus"
      className="self-start"
      disabled={guard.disabled}
      aria-describedby={guard["aria-describedby"]}
      onClick={() => {
        setEditing({ idea: null });
      }}
    >
      Nouvelle idée
    </Button>
  );

  let content;
  if (ideas.isError) {
    content = (
      <EmptyState
        icon="info"
        title="Impossible de charger les idées"
        action={<Button onClick={() => void ideas.refetch()}>Réessayer</Button>}
      >
        {errorMessage(ideas.error)}
      </EmptyState>
    );
  } else if (!ideas.data) {
    content = <Skeleton />;
  } else if (ideas.data.length === 0) {
    content = (
      <EmptyState icon="lightbulb" title="Aucune idée pour l'instant" action={add}>
        Note un plat qui vous tente : la génération pourra le proposer.
      </EmptyState>
    );
  } else {
    content = (
      <>
        {add}
        {ideas.data.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            canConvert={canConvert}
            onEdit={() => {
              setEditing({ idea });
            }}
            onDelete={() => {
              remove.mutate(idea);
            }}
            onConvert={() => {
              convert(idea);
            }}
          />
        ))}
      </>
    );
  }

  return (
    <div className="fm-stack mx-auto w-full max-w-3xl p-4">
      <div className="flex items-center gap-2">
        <Link
          to={`/s/${spaceId}/meal-plan`}
          className="fm-iconbtn"
          aria-label="Retour au planning"
          title="Retour au planning"
        >
          <Icon name="chevron-right" className="-scale-x-100" />
        </Link>
        <h1 className="m-0 font-display text-2xl font-bold">Idées de repas</h1>
      </div>
      <p className="m-0 text-sm text-ink-muted">
        Ce qu'on aimerait cuisiner un jour. La génération peut les proposer dans le planning.
      </p>
      {content}
      <Sheet
        open={editing !== null}
        onClose={() => {
          setEditing(null);
        }}
        title={editing?.idea ? "Modifier l'idée" : "Nouvelle idée"}
      >
        {/* Remonte a chaque ouverture : le formulaire repart de l'idee enregistree. */}
        {editing ? (
          <IdeaForm
            spaceId={spaceId}
            idea={editing.idea}
            onDone={() => {
              setEditing(null);
            }}
          />
        ) : null}
      </Sheet>
    </div>
  );
}
