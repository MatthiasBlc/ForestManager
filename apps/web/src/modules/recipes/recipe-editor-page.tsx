// E-RECETTE-EDITION : creer ou modifier une recette (F-REC-1, F-REC-4, D102,
// D104, D108, D136). En-tete en mode edition, brouillon garde sur l'appareil,
// F-CONFIRMER avant de quitter sans enregistrer. Blocs lies (D24, D107).
// Mode suggestion (E-SUGGESTION-EDITION, D04) : sans tags, envoye a l'auteur.
import {
  createRecipeBodySchema,
  imageResponseSchema,
  formatQuantity,
  ingredientSchema,
  recipeSchema,
  suggestionSummarySchema,
  type ImportedRecipe,
  type Recipe,
  type Tag,
  type Unit,
} from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { ImagePicker } from "../../patterns/image-picker.tsx";
import { TopBar } from "../../patterns/top-bar.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Chip, Stepper, Switch } from "../../ui/controls.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { cx } from "../../ui/cx.ts";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { AddBlockSheet, LinkRecipeSheet } from "./components/link-recipe-sheet.tsx";
import { QuantityInput } from "./components/quantity-input.tsx";
import {
  clearDraft,
  draftErrors,
  draftFromImport,
  draftFromRecipe,
  draftKey,
  draftToBody,
  emptyBlock,
  emptyDraft,
  emptyLine,
  hasErrors,
  newKey,
  readDraft,
  suggestionMarks,
  writeDraft,
  type Draft,
  type DraftErrors,
  type DraftLinkedBlock,
  type DraftLocalBlock,
  type SuggestionMark,
} from "./draft.ts";
import { scaledAmount } from "./format.ts";
import { useOnline } from "../../pwa/use-online.ts";
import { RecipeNotFound, RecipeUnavailable } from "./recipe-page.tsx";
import {
  globalTagsQuery,
  recipeFailure,
  recipeQuery,
  recipesKey,
  recipeSuggestionsQuery,
  spaceTagsQuery,
  unitsQuery,
} from "./queries.ts";

/** Bloc lie : seule la quantite utilisee se modifie ici ; la recette liee vit a part. */
function LinkedBlockEditor({
  block,
  index,
  units,
  error,
  onChange,
  onRemove,
}: {
  block: DraftLinkedBlock;
  index: number;
  units: readonly Unit[];
  error?: string;
  onChange: (block: DraftLinkedBlock) => void;
  onRemove?: () => void;
}) {
  const unit = units.find((u) => u.id === block.unitId);
  return (
    <div
      role="group"
      aria-label={`Recette liée : ${block.title}`}
      className="fm-block fm-block-linked"
    >
      <div className="fm-block-head">
        <Icon name="link" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="fm-block-kind">Recette liée</span>
          <b>{block.title}</b>
        </div>
        {onRemove ? (
          <IconButton icon="trash" label={`Retirer le bloc ${index + 1}`} onClick={onRemove} />
        ) : null}
      </div>
      <div className="flex items-end gap-2 p-3">
        <Field
          label="Quantité utilisée"
          className="w-40"
          inputMode="decimal"
          value={block.quantity}
          error={error}
          onChange={(e) => {
            onChange({ ...block, quantity: e.target.value });
          }}
        />
        <span className="pb-3 text-sm text-ink-muted">
          {unit ? unit.abbreviation : "pers."}
          {block.yieldQuantity !== null ? ` sur ${formatQuantity(block.yieldQuantity)}` : ""}
        </span>
      </div>
    </div>
  );
}

function markOf(
  mark: SuggestionMark | undefined,
  units: readonly Unit[]
): { kind: "changed" | "added"; before?: string } | undefined {
  if (!mark) return undefined;
  if (mark.kind === "added" || !mark.before) return { kind: mark.kind };
  return { kind: "changed", before: scaledAmount(mark.before, units, 1) || "sans quantité" };
}

function BlockEditor({
  block,
  index,
  titled,
  units,
  errors,
  marks,
  onChange,
  onRemove,
}: {
  block: DraftLocalBlock;
  index: number;
  titled: boolean;
  units: readonly Unit[];
  errors: DraftErrors["lines"];
  /** Mode suggestion : marques par cle de ligne ou d'etape. */
  marks: Record<string, SuggestionMark>;
  onChange: (block: DraftLocalBlock) => void;
  onRemove?: () => void;
}) {
  const lineLabel = (i: number) =>
    titled ? `Ingrédient ${i + 1} du bloc ${index + 1}` : `Ingrédient ${i + 1}`;
  const stepLabel = (i: number) =>
    titled ? `Étape ${i + 1} du bloc ${index + 1}` : `Étape ${i + 1}`;
  return (
    <div className="fm-stack">
      {titled ? (
        <div className="flex items-end gap-2">
          <Field
            label={`Titre du bloc ${index + 1}`}
            className="flex-1"
            placeholder="Ex : Sauce, Pâte, Assemblage"
            value={block.title}
            onChange={(e) => {
              onChange({ ...block, title: e.target.value });
            }}
          />
          {onRemove ? (
            <IconButton icon="trash" label={`Retirer le bloc ${index + 1}`} onClick={onRemove} />
          ) : null}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-md border border-line bg-surface-raised">
        <h2 className="bg-surface px-3 py-2 font-display text-base font-semibold">Ingrédients</h2>
        <div className="flex flex-col gap-2 p-3">
          {block.lines.map((line, i) => (
            <QuantityInput
              key={line.key}
              label={lineLabel(i)}
              value={line}
              units={units}
              error={errors[line.key]}
              mark={markOf(marks[line.key], units)}
              onChange={(value) => {
                onChange({
                  ...block,
                  lines: block.lines.map((l) => (l.key === line.key ? { ...l, ...value } : l)),
                });
              }}
              onRemove={
                block.lines.length > 1
                  ? () => {
                      onChange({ ...block, lines: block.lines.filter((l) => l.key !== line.key) });
                    }
                  : undefined
              }
            />
          ))}
          <Button
            variant="ghost"
            icon="plus"
            className="self-start"
            onClick={() => {
              onChange({ ...block, lines: [...block.lines, emptyLine()] });
            }}
          >
            Ajouter un ingrédient
          </Button>
        </div>
      </section>
      <section className="overflow-hidden rounded-md border border-line bg-surface-raised">
        <h2 className="bg-surface px-3 py-2 font-display text-base font-semibold">Étapes</h2>
        <div className="flex flex-col gap-2 p-3">
          {block.steps.map((step, i) => {
            const mark = marks[step.key];
            const markId = `mark-${step.key}`;
            return (
              <div
                key={step.key}
                className={cx("flex items-start gap-2", mark && `fm-mark-${mark.kind}`)}
              >
                <Field
                  multiline
                  label={stepLabel(i)}
                  className="flex-1"
                  rows={2}
                  aria-describedby={mark ? markId : undefined}
                  value={step.text}
                  onChange={(e) => {
                    onChange({
                      ...block,
                      steps: block.steps.map((s) =>
                        s.key === step.key ? { ...s, text: e.target.value } : s
                      ),
                    });
                  }}
                />
                {mark ? (
                  <span id={markId} className="fm-mark self-center">
                    {mark.kind === "added" ? (
                      <Badge tone="success">Ajouté</Badge>
                    ) : (
                      <Badge tone="warning">Modifié</Badge>
                    )}
                  </span>
                ) : null}
                {block.steps.length > 1 ? (
                  <IconButton
                    icon="x"
                    label={`Retirer ${stepLabel(i)}`}
                    onClick={() => {
                      onChange({ ...block, steps: block.steps.filter((s) => s.key !== step.key) });
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          <Button
            variant="ghost"
            icon="plus"
            className="self-start"
            onClick={() => {
              onChange({ ...block, steps: [...block.steps, { key: newKey(), text: "" }] });
            }}
          >
            Ajouter une étape
          </Button>
        </div>
      </section>
    </div>
  );
}

function TagPicker({
  label,
  tags,
  selected,
  onChange,
}: {
  label: string;
  tags: readonly Tag[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <span className="fm-label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Chip
            key={tag.id}
            selected={selected.includes(tag.id)}
            onToggle={(on) => {
              onChange(on ? [...selected, tag.id] : selected.filter((id) => id !== tag.id));
            }}
          >
            {tag.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Photo choisie pour une recette pas encore creee : rattachee a l'enregistrement. */
interface PendingPhoto {
  uploadId: string;
  preview: string;
}

/**
 * Photo hors revisions [D167] : sur une recette existante elle change tout de
 * suite (meme si on quitte l'editeur) ; sur une nouvelle, a l'enregistrement.
 */
function PhotoField({
  spaceId,
  recipe,
  pending,
  onPending,
}: {
  spaceId: string;
  recipe?: Recipe;
  pending: PendingPhoto | null;
  onPending: (photo: PendingPhoto | null) => void;
}) {
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl ?? null);
  const shown = recipe ? imageUrl : (pending?.preview ?? null);

  const saved = async (url: string | null) => {
    if (!recipe) return;
    setImageUrl(url);
    queryClient.setQueryData(recipeQuery(spaceId, recipe.id).queryKey, (current) =>
      current ? { ...current, imageUrl: url } : current
    );
    await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
  };
  const path = recipe ? `/spaces/${spaceId}/recipes/${recipe.id}/photo` : null;

  return (
    <div className="fm-stack gap-2">
      {shown ? (
        <img
          src={shown}
          alt="Photo de la recette"
          className="h-[180px] w-full rounded-md object-cover"
        />
      ) : null}
      <ImagePicker
        kind="photo"
        hasImage={shown !== null}
        onUploaded={async (uploadId, file) => {
          if (!path) {
            onPending({ uploadId, preview: URL.createObjectURL(file) });
            return;
          }
          const { url } = await api.put(path, { uploadId }, imageResponseSchema);
          await saved(url);
        }}
        onRemove={async () => {
          if (!path) {
            onPending(null);
            return;
          }
          await api.delete(path, undefined, imageResponseSchema);
          await saved(null);
        }}
      />
    </div>
  );
}

function Editor({
  spaceId,
  spaceName,
  recipe,
  units,
  suggest = false,
  imported,
}: {
  spaceId: string;
  spaceName: string;
  recipe?: Recipe;
  units: readonly Unit[];
  /** Recette lue par un import (C3.8) : pre-remplit une nouvelle recette. */
  imported?: ImportedRecipe;
  /** E-SUGGESTION-EDITION : les changements partent en suggestion a l'auteur [D04]. */
  suggest?: boolean;
}) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const globalTags = useQuery(globalTagsQuery);
  const spaceTags = useQuery(spaceTagsQuery(spaceId));
  const key = `${draftKey(spaceId, recipe)}${suggest ? ":suggest" : ""}`;
  // Un import remplace le brouillon garde d'une nouvelle recette.
  const [restored] = useState(() => (imported ? null : readDraft(key)));
  const [draft, setDraft] = useState<Draft>(
    () =>
      restored ??
      (recipe
        ? draftFromRecipe(recipe)
        : imported
          ? draftFromImport(imported, units)
          : emptyDraft())
  );
  const [dirty, setDirty] = useState(restored !== null || imported !== undefined);
  // Mode suggestion : ce que la suggestion change, ligne par ligne.
  const [base] = useState(() => (suggest && recipe ? draftFromRecipe(recipe) : null));
  const marks = base ? suggestionMarks(base, draft) : {};
  const toCheck = imported?.ingredients.filter((line) => line.check).length ?? 0;
  const [errors, setErrors] = useState<DraftErrors>({ lines: {} });
  const [failure, setFailure] = useState<string>();
  const [saving, setSaving] = useState(false);
  const online = useOnline();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);

  // Apercu local d'une photo en attente : libere quand elle change ou a la sortie.
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.preview);
    },
    [photo]
  );

  useEffect(() => {
    if (dirty) writeDraft(key, draft);
  }, [dirty, key, draft]);

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };
  const back = () => {
    void navigate(recipe ? `/s/${spaceId}/recipes/${recipe.id}` : `/s/${spaceId}/recipes`);
  };
  const quit = () => {
    clearDraft(key);
    back();
  };

  const save = async () => {
    const found = draftErrors(draft);
    setErrors(found);
    setFailure(undefined);
    if (hasErrors(found)) return;
    setSaving(true);
    try {
      // Ingredients saisis sans choisir de proposition : trouves ou crees (D09).
      const ids = new Map<string, string>();
      for (const block of draft.blocks) {
        if (block.kind !== "LOCAL") continue;
        for (const line of block.lines) {
          if (line.ingredientId === null && line.name.trim()) {
            const ingredient = await api.post(
              "/ingredients",
              { name: line.name.trim() },
              ingredientSchema
            );
            ids.set(line.key, ingredient.id);
          }
        }
      }
      const parsed = createRecipeBodySchema.safeParse(draftToBody(draft, ids));
      if (!parsed.success) {
        setFailure("Certains champs sont invalides : vérifie les temps, le lien et les étapes.");
        return;
      }
      if (suggest && recipe) {
        const { globalTagIds: _global, spaceTagIds: _space, ...content } = parsed.data;
        await api.post(
          `/spaces/${spaceId}/recipes/${recipe.id}/suggestions`,
          {
            ...content,
            revision: recipe.currentRevision,
            ...(message.trim() ? { message: message.trim() } : {}),
          },
          suggestionSummarySchema
        );
        clearDraft(key);
        await queryClient.invalidateQueries({
          queryKey: recipeSuggestionsQuery(spaceId, recipe.id).queryKey,
        });
        toast(`Suggestion envoyée à ${recipe.author.username}`, { tone: "success" });
        back();
        return;
      }
      let saved = recipe
        ? await api.put(
            `/spaces/${spaceId}/recipes/${recipe.id}`,
            { ...parsed.data, revision: recipe.currentRevision },
            recipeSchema
          )
        : await api.post(
            `/spaces/${spaceId}/recipes`,
            imported ? { ...parsed.data, imported: true } : parsed.data,
            recipeSchema
          );
      clearDraft(key);
      if (!recipe && photo) {
        try {
          const { url } = await api.put(
            `/spaces/${spaceId}/recipes/${saved.id}/photo`,
            { uploadId: photo.uploadId },
            imageResponseSchema
          );
          saved = { ...saved, imageUrl: url };
        } catch (error) {
          toast(`Recette enregistrée, mais pas sa photo : ${errorMessage(error)}`, {
            tone: "danger",
          });
        }
      }
      queryClient.setQueryData(recipeQuery(spaceId, saved.id).queryKey, saved);
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "list"] });
      void navigate(`/s/${spaceId}/recipes/${saved.id}`, { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const yieldUnit = units.find((u) => u.id === draft.yieldUnitId);
  const titled = draft.blocks.length > 1;

  return (
    <>
      <PageChrome
        top={
          <TopBar
            title={
              suggest
                ? "Suggérer une modification"
                : recipe
                  ? "Modifier la recette"
                  : "Nouvelle recette"
            }
            titleShort={suggest ? "Suggestion" : undefined}
            onCancel={() => {
              if (dirty) setConfirmOpen(true);
              else back();
            }}
            action={
              suggest
                ? "Envoyer la suggestion"
                : recipe
                  ? `Enregistrer la révision ${recipe.currentRevision + 1}`
                  : "Enregistrer"
            }
            actionShort={suggest ? "Envoyer" : recipe ? "Enregistrer" : undefined}
            // Hors ligne : le brouillon reste sur l'appareil, l'envoi attend le reseau (D106).
            actionDisabled={saving || !online}
            onAction={() => void save()}
          />
        }
      />
      <div className="fm-stack mx-auto w-full max-w-3xl p-4">
        {restored ? (
          <p
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-warning-text"
          >
            <span>
              <b>Brouillon restauré.</b> Tes modifications non enregistrées sont revenues.
            </span>
          </p>
        ) : null}
        {imported && !recipe ? (
          <p role="status" className="m-0 rounded-md bg-accent-soft px-3 py-2 text-accent-text">
            <b>Recette importée.</b> Vérifie tout avant d'enregistrer
            {toCheck > 0
              ? ` : ${String(toCheck)} ${toCheck > 1 ? "quantités" : "quantité"} à vérifier.`
              : "."}
          </p>
        ) : null}
        <FormAlert message={failure} />
        {suggest && recipe ? (
          <>
            <p role="status" className="m-0 rounded-md bg-accent-soft px-3 py-2 text-accent-text">
              Mode suggestion : {recipe.author.username} verra tes changements et décidera.
            </p>
            <Field
              label={`Un mot pour ${recipe.author.username} (facultatif)`}
              maxLength={280}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
              }}
            />
          </>
        ) : null}
        {suggest ? null : (
          <PhotoField spaceId={spaceId} recipe={recipe} pending={photo} onPending={setPhoto} />
        )}
        <Field
          label="Titre"
          value={draft.title}
          error={errors.title}
          maxLength={120}
          onChange={(e) => {
            update({ title: e.target.value });
          }}
        />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className="fm-label">Pour</span>
            <Stepper
              label="Portions"
              value={draft.yieldQuantity}
              min={1}
              max={100}
              unit={yieldUnit ? yieldUnit.abbreviation : "pers."}
              onChange={(value) => {
                update({ yieldQuantity: value });
              }}
            />
          </div>
          {(
            [
              ["prepMinutes", "Préparation (min)"],
              ["cookMinutes", "Cuisson (min)"],
              ["restMinutes", "Repos (min)"],
            ] as const
          ).map(([field, label]) => (
            <Field
              key={field}
              label={label}
              className="w-32"
              type="number"
              inputMode="numeric"
              min={0}
              value={draft[field]}
              onChange={(e) => {
                update({ [field]: e.target.value });
              }}
            />
          ))}
        </div>
        {draft.blocks.map((block, index) => {
          const replace = (next: DraftLocalBlock | DraftLinkedBlock) => {
            update({ blocks: draft.blocks.map((b) => (b.key === block.key ? next : b)) });
          };
          const remove = titled
            ? () => {
                update({ blocks: draft.blocks.filter((b) => b.key !== block.key) });
              }
            : undefined;
          return block.kind === "RECIPE" ? (
            <LinkedBlockEditor
              key={block.key}
              block={block}
              index={index}
              units={units}
              error={errors.lines[block.key]}
              onChange={replace}
              onRemove={remove}
            />
          ) : (
            <BlockEditor
              key={block.key}
              block={block}
              index={index}
              titled={titled}
              units={units}
              errors={errors.lines}
              marks={marks}
              onChange={replace}
              onRemove={remove}
            />
          );
        })}
        <Button
          icon="plus"
          block
          onClick={() => {
            setAddOpen(true);
          }}
        >
          Ajouter un bloc
        </Button>
        {suggest ? null : (
          <>
            <TagPicker
              label="Tags"
              tags={globalTags.data ?? []}
              selected={draft.globalTagIds}
              onChange={(ids) => {
                update({ globalTagIds: ids });
              }}
            />
            <TagPicker
              label={`Tags de ${spaceName}`}
              tags={spaceTags.data ?? []}
              selected={draft.spaceTagIds}
              onChange={(ids) => {
                update({ spaceTagIds: ids });
              }}
            />
          </>
        )}
        <Switch
          label="Recette de base (sauce, pâte…) : pas proposée seule au planning"
          checked={draft.isBase}
          onChange={(on) => {
            update({ isBase: on });
          }}
        />
        <Field
          multiline
          label="Notes"
          rows={3}
          value={draft.notes}
          onChange={(e) => {
            update({ notes: e.target.value });
          }}
        />
        <Field
          label="Source (lien)"
          type="url"
          placeholder="https://"
          value={draft.sourceUrl}
          onChange={(e) => {
            update({ sourceUrl: e.target.value });
          }}
        />
      </div>
      <AddBlockSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
        }}
        onLocal={() => {
          setAddOpen(false);
          update({ blocks: [...draft.blocks, emptyBlock()] });
        }}
        onLink={() => {
          setAddOpen(false);
          setLinkOpen(true);
        }}
      />
      <LinkRecipeSheet
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false);
        }}
        spaceId={spaceId}
        currentRecipeId={recipe?.id}
        units={units}
        onLink={(block) => {
          setLinkOpen(false);
          update({ blocks: [...draft.blocks, { ...block, key: newKey() }] });
        }}
      />
      <Sheet
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
        }}
        title="Quitter sans enregistrer ?"
      >
        <p>
          {draft.title.trim()
            ? `Ta recette « ${draft.title.trim()} » n'est pas enregistrée.`
            : "Ta recette n'est pas enregistrée."}{" "}
          Quitter supprime aussi le brouillon gardé sur cet appareil.
        </p>
        <SheetFooter>
          <Button variant="danger" onClick={quit}>
            Quitter
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirmOpen(false);
            }}
          >
            Continuer l'édition
          </Button>
        </SheetFooter>
      </Sheet>
    </>
  );
}

export function RecipeEditorPage({ suggest = false }: { suggest?: boolean }) {
  const { spaceId = "", recipeId } = useParams();
  const space = useQuery(spaceQuery(spaceId));
  const units = useQuery(unitsQuery);
  const recipe = useQuery({ ...recipeQuery(spaceId, recipeId ?? ""), enabled: !!recipeId });
  const location = useLocation();
  const imported = recipeId
    ? undefined
    : (location.state as { imported?: ImportedRecipe } | null)?.imported;
  const failure = recipeId ? recipeFailure(recipe) : null;
  if (failure) {
    return (
      <RecipeUnavailable
        spaceId={spaceId}
        failure={failure}
        onRetry={() => void recipe.refetch()}
      />
    );
  }
  if (!space.data || !units.data || (recipeId && !recipe.data)) return <Skeleton />;
  // Modifier : le droit de modifier ; suggerer : tout membre sauf l'auteur (API, RECIPE_012).
  if (recipe.data && !suggest && !recipe.data.can.edit) return <RecipeNotFound spaceId={spaceId} />;
  return (
    <Editor
      key={recipe.data ? `${recipe.data.id}@${recipe.data.currentRevision}` : "new"}
      spaceId={spaceId}
      spaceName={space.data.name}
      recipe={recipe.data}
      units={units.data}
      suggest={suggest}
      imported={imported}
    />
  );
}
