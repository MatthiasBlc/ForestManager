// F-QUITTER (D84) : recettes creees dans l'espace (elles restent, D18) et recettes
// perso partagees ici, a laisser ou a retirer avant le depart.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { LeaveSectionProps } from "../../app/registry.ts";
import { api } from "../../lib/api.ts";
import { SegmentedControl } from "../../ui/controls.tsx";
import { leavePreviewQuery } from "./queries.ts";

type Choice = "leave" | "remove";

export default function RecipesLeaveSection({ spaceId, spaceName, onPrepare }: LeaveSectionProps) {
  const preview = useQuery(leavePreviewQuery(spaceId));
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const removed = Object.keys(choices).filter((id) => choices[id] === "remove");
  const key = removed.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    onPrepare(
      ids.length === 0
        ? null
        : async () => {
            for (const id of ids) await api.delete(`/spaces/${spaceId}/recipes/${id}/share`);
          }
    );
  }, [key, spaceId, onPrepare]);

  if (!preview.data) return null;
  const { createdHere, personalShared } = preview.data;
  return (
    <>
      {createdHere > 0 ? (
        <p className="m-0 text-ink-muted">
          {createdHere > 1
            ? `Les ${String(createdHere)} recettes que tu as créées dans ${spaceName} y restent`
            : `La recette que tu as créée dans ${spaceName} y reste`}{" "}
          ; les modérateurs en prennent soin.
        </p>
      ) : null}
      {personalShared.length > 0 ? (
        <section className="fm-stack" aria-labelledby="leave-recipes">
          <h3 id="leave-recipes" className="m-0 text-sm font-semibold">
            Tes recettes perso partagées dans {spaceName}
          </h3>
          {personalShared.map((recipe) => (
            <div key={recipe.id} className="fm-stack gap-1">
              <span>{recipe.title}</span>
              <SegmentedControl<Choice>
                label={recipe.title}
                options={[
                  { value: "leave", label: `Laisser dans ${spaceName}` },
                  { value: "remove", label: `Retirer de ${spaceName}` },
                ]}
                value={choices[recipe.id] ?? "leave"}
                onChange={(value) => {
                  setChoices((current) => ({ ...current, [recipe.id]: value }));
                }}
              />
            </div>
          ))}
          <small className="text-ink-muted">
            Laissées dans {spaceName}, elles restent à toi : les membres continuent de les voir.
          </small>
        </section>
      ) : null}
    </>
  );
}
