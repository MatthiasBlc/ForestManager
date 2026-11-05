// E-RECETTE-EDITION : creer ou modifier une recette (F-REC-1, F-REC-4, D102,
// D104, D108, D136). En-tete en mode edition, brouillon garde sur l'appareil,
// F-CONFIRMER avant de quitter sans enregistrer. Blocs lies (D24, D107).
import {
  createRecipeBodySchema,
  formatQuantity,
  ingredientSchema,
  recipeSchema,
  type Recipe,
  type Tag,
  type Unit,
} from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { PageChrome } from "../../core/shell/page-chrome.tsx";
import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { TopBar } from "../../patterns/top-bar.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Chip, Stepper, Switch } from "../../ui/controls.tsx";
import { Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { AddBlockSheet, LinkRecipeSheet } from "./components/link-recipe-sheet.tsx";
import { QuantityInput } from "./components/quantity-input.tsx";
import {
  clearDraft,
  draftErrors,
  draftFromRecipe,
  draftKey,
  draftToBody,
  emptyBlock,
  emptyDraft,
  emptyLine,
  hasErrors,
  newKey,
  readDraft,
  writeDraft,
  type Draft,
  type DraftErrors,
  type DraftLinkedBlock,
  type DraftLocalBlock,
} from "./draft.ts";
import { RecipeNotFound } from "./recipe-page.tsx";
import { globalTagsQuery, recipeQuery, recipesKey, spaceTagsQuery, unitsQuery } from "./queries.ts";

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

function BlockEditor({
  block,
  index,
  titled,
  units,
  errors,
  onChange,
  onRemove,
}: {
  block: DraftLocalBlock;
  index: number;
  titled: boolean;
  units: readonly Unit[];
  errors: DraftErrors["lines"];
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
          {block.steps.map((step, i) => (
            <div key={step.key} className="flex items-start gap-2">
              <Field
                multiline
                label={stepLabel(i)}
                className="flex-1"
                rows={2}
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
          ))}
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

function Editor({
  spaceId,
  spaceName,
  recipe,
  units,
}: {
  spaceId: string;
  spaceName: string;
  recipe?: Recipe;
  units: readonly Unit[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const globalTags = useQuery(globalTagsQuery);
  const spaceTags = useQuery(spaceTagsQuery(spaceId));
  const key = draftKey(spaceId, recipe);
  const [restored] = useState(() => readDraft(key));
  const [draft, setDraft] = useState<Draft>(
    () => restored ?? (recipe ? draftFromRecipe(recipe) : emptyDraft())
  );
  const [dirty, setDirty] = useState(restored !== null);
  const [errors, setErrors] = useState<DraftErrors>({ lines: {} });
  const [failure, setFailure] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

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
      const saved = recipe
        ? await api.put(
            `/spaces/${spaceId}/recipes/${recipe.id}`,
            { ...parsed.data, revision: recipe.currentRevision },
            recipeSchema
          )
        : await api.post(`/spaces/${spaceId}/recipes`, parsed.data, recipeSchema);
      clearDraft(key);
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
            title={recipe ? "Modifier la recette" : "Nouvelle recette"}
            onCancel={() => {
              if (dirty) setConfirmOpen(true);
              else back();
            }}
            action={
              recipe ? `Enregistrer la révision ${recipe.currentRevision + 1}` : "Enregistrer"
            }
            actionDisabled={saving}
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
        <FormAlert message={failure} />
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

export function RecipeEditorPage() {
  const { spaceId = "", recipeId } = useParams();
  const space = useQuery(spaceQuery(spaceId));
  const units = useQuery(unitsQuery);
  const recipe = useQuery({ ...recipeQuery(spaceId, recipeId ?? ""), enabled: !!recipeId });
  if (recipeId && recipe.isError) return <RecipeNotFound spaceId={spaceId} />;
  if (!space.data || !units.data || (recipeId && !recipe.data)) return <Skeleton />;
  if (recipe.data && !recipe.data.can.edit) return <RecipeNotFound spaceId={spaceId} />;
  return (
    <Editor
      key={recipe.data ? `${recipe.data.id}@${recipe.data.currentRevision}` : "new"}
      spaceId={spaceId}
      spaceName={space.data.name}
      recipe={recipe.data}
      units={units.data}
    />
  );
}
