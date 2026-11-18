// Section "Tags" de l'editeur [D216] : tags choisis (globaux et de l'espace ou
// l'editeur est ouvert), retirables ; "Ajouter des tags" ouvre la feuille de
// tags, qui cree un tag d'espace quand la recherche ne trouve rien.
import { tagSchema } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../../i18n/index.ts";
import { api } from "../../../lib/api.ts";
import { Button } from "../../../ui/button.tsx";
import { Icon } from "../../../ui/icon.tsx";
import { useToast } from "../../../ui/use-toast.ts";
import { recipesKey, tagCatalogQuery } from "../queries.ts";
import { sortByFamily } from "../tag-groups.ts";
import { TagSheet } from "./tag-sheet.tsx";

export function RecipeTagsField({
  spaceId,
  spaceName,
  globalTagIds,
  spaceTagIds,
  onChange,
}: {
  spaceId: string;
  spaceName: string;
  globalTagIds: readonly string[];
  spaceTagIds: readonly string[];
  onChange: (tags: { globalTagIds: string[]; spaceTagIds: string[] }) => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const catalog = useQuery(tagCatalogQuery(spaceId));
  const selected = [...globalTagIds, ...spaceTagIds];
  const chosen = sortByFamily(
    (catalog.data?.tags ?? []).filter((tag) => selected.includes(tag.id)),
    catalog.data
  );
  const spaceNames = chosen.filter((tag) => tag.scope === "SPACE").map((tag) => tag.name);

  const change = (ids: string[]) => {
    const scopeOf = (id: string) => catalog.data?.tags.find((tag) => tag.id === id)?.scope;
    onChange({
      globalTagIds: ids.filter((id) => scopeOf(id) === "GLOBAL"),
      spaceTagIds: ids.filter((id) => scopeOf(id) === "SPACE"),
    });
  };
  const create = async (name: string) => {
    try {
      const tag = await api.post(`/spaces/${spaceId}/recipes/tags`, { name }, tagSchema);
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "tag-catalog"] });
      await queryClient.invalidateQueries({ queryKey: [...recipesKey(spaceId), "tags"] });
      onChange({
        globalTagIds: [...globalTagIds],
        spaceTagIds: spaceTagIds.includes(tag.id) ? [...spaceTagIds] : [...spaceTagIds, tag.id],
      });
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    }
  };

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Tags">
      <span className="fm-label">Tags</span>
      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chosen.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="fm-chip"
              aria-pressed="true"
              aria-label={`${tag.name}, retirer le tag`}
              onClick={() => {
                change(selected.filter((id) => id !== tag.id));
              }}
            >
              {tag.name}
              <Icon name="x" size={16} />
            </button>
          ))}
        </div>
      ) : null}
      <Button
        icon="plus"
        className="self-start"
        onClick={() => {
          setOpen(true);
        }}
      >
        Ajouter des tags
      </Button>
      {spaceNames.length > 0 ? (
        <small className="text-ink-muted">
          {spaceNames.length > 1
            ? `${spaceNames.slice(0, -1).join(", ")} et ${spaceNames.at(-1) ?? ""} sont des tags de ${spaceName} : ils ne suivent pas la recette dans les autres espaces.`
            : `${spaceNames[0] ?? ""} est un tag de ${spaceName} : il ne suit pas la recette dans les autres espaces.`}
        </small>
      ) : null}
      <TagSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title="Tags de la recette"
        catalog={catalog.data}
        spaceName={spaceName}
        selected={selected}
        onChange={change}
        create={create}
      />
    </div>
  );
}
