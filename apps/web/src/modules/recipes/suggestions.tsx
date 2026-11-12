// Bandeaux des suggestions [D166] : sur le detail d'une recette (en attente, et
// les siennes refusees) et en tete des listes (suggestions a trancher).
import type { SuggestionSummary } from "@fm/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { meQuery } from "../../core/session/queries.ts";
import { Icon } from "../../ui/icon.tsx";
import { recipeSuggestionsQuery, suggestionsToDecideQuery } from "./queries.ts";

function SuggestionLink({ to, title, text }: { to: string; title: string; text?: string }) {
  return (
    <Link to={to} className="fm-option">
      <span className="fm-option-icon">
        <Icon name="pencil" />
      </span>
      <span className="fm-option-text">
        <b>{title}</b>
        {text ? <small>{text}</small> : null}
      </span>
      <Icon name="chevron-right" className="fm-option-go" />
    </Link>
  );
}

const path = (spaceId: string, s: SuggestionSummary) =>
  `/s/${spaceId}/recipes/${s.recipe.id}/suggestions/${s.id}`;

export function RecipeSuggestionsBanner({
  spaceId,
  recipeId,
}: {
  spaceId: string;
  recipeId: string;
}) {
  const me = useQuery(meQuery);
  const list = useQuery(recipeSuggestionsQuery(spaceId, recipeId));
  const meId = me.data?.id;
  const all = list.data ?? [];
  const pending = all.filter((s) => s.status === "PENDING");
  const refused = all.find(
    (s) => s.proposer.id === meId && s.status === "REJECTED" && s.convertedRecipeId === null
  );
  if (pending.length === 0 && !refused) return null;
  return (
    <div className="fm-stack gap-2">
      {pending.map((s) =>
        s.proposer.id === meId ? (
          <SuggestionLink key={s.id} to={path(spaceId, s)} title="Ta suggestion est en attente" />
        ) : (
          <SuggestionLink
            key={s.id}
            to={path(spaceId, s)}
            title={`Suggestion de ${s.proposer.username}`}
            text={s.message ?? undefined}
          />
        )
      )}
      {refused ? (
        <SuggestionLink
          to={path(spaceId, refused)}
          title="Ta suggestion a été refusée"
          text="Tes changements ne sont pas perdus : tu peux en faire ton adaptation."
        />
      ) : null}
    </div>
  );
}

/** En tete de "Mes recettes" et de la liste d'un groupe : suggestions a trancher. */
export function SuggestionsToDecideBanner({ spaceId }: { spaceId: string }) {
  const list = useQuery(suggestionsToDecideQuery(spaceId));
  const first = list.data?.[0];
  if (!first) return null;
  const count = list.data?.length ?? 0;
  return (
    <SuggestionLink
      to={path(first.recipe.homeSpaceId, first)}
      title={`${String(count)} suggestion${count > 1 ? "s" : ""} à examiner`}
      text={`${first.proposer.username} propose de modifier ${first.recipe.title}`}
    />
  );
}
