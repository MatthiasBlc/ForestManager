// Champ d'ajout de E-COURSES [D228] : toujours en bas (zone du pouce), un seul champ.
// La quantite se tape avec le produit ("2 citrons") ; suggestions du catalogue
// d'ingredients, sinon le texte tel quel. Entree ajoute, vide le champ et garde le
// focus pour enchainer ("lait", entree, "piles", entree).
import type { CreateShoppingItemBody, Ingredient, Unit } from "@fm/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { useDebounced } from "../../lib/use-debounced.ts";
import { OFFLINE_REASON_ID } from "../../pwa/use-write-guard.ts";
import { useOnline } from "../../pwa/use-online.ts";
import { cx } from "../../ui/cx.ts";
import { Icon } from "../../ui/icon.tsx";
import { ingredientSearchQuery } from "../recipes/queries.ts";
import { matchIngredient, parseEntry, type Entry } from "./entry.ts";

interface Choice {
  id: string;
  ingredient: Ingredient | null;
}

/** Propositions : l'ingredient au meme nom, le texte tel quel, puis les autres. */
function choicesOf(entry: Entry | null, found: readonly Ingredient[]): Choice[] {
  if (!entry) return [];
  const exact = matchIngredient(entry.name, found);
  const others = found.filter((ingredient) => ingredient !== exact);
  return [
    ...(exact ? [{ id: exact.id, ingredient: exact }] : []),
    { id: "text", ingredient: null },
    ...others.map((ingredient) => ({ id: ingredient.id, ingredient })),
  ];
}

export function AddBar({
  units,
  onAdd,
}: {
  units: readonly Unit[];
  onAdd: (body: CreateShoppingItemBody) => void;
}) {
  const queryClient = useQueryClient();
  const online = useOnline();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  // Choix deplace aux fleches ; sinon le premier.
  const [active, setActive] = useState<number | null>(null);
  const entry = parseEntry(text, units);
  const term = useDebounced(entry?.name ?? "");
  const search = useQuery(ingredientSearchQuery(term));
  const found = term === entry?.name ? (search.data ?? []) : [];
  const choices = choicesOf(entry, found);
  const current = Math.min(active ?? 0, Math.max(0, choices.length - 1));
  const open = choices.length > 0;

  const add = (value: Entry, ingredient: Ingredient | null) => {
    onAdd(
      ingredient
        ? { ingredientId: ingredient.id, parts: value.parts }
        : { label: value.name, parts: value.parts }
    );
    setText("");
    setActive(null);
    input.current?.focus();
  };

  const submit = async () => {
    if (!entry) return;
    if (active !== null) {
      add(entry, choices[current]?.ingredient ?? null);
      return;
    }
    // Entree avant la fin de la recherche : on l'attend pour proposer l'ingredient.
    const results = await queryClient.query(ingredientSearchQuery(entry.name));
    add(entry, matchIngredient(entry.name, results) ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    } else if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setActive((current + 1) % choices.length);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive((current - 1 + choices.length) % choices.length);
    } else if (event.key === "Escape") {
      setText("");
      setActive(null);
    }
  };

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <div className="fm-shop-add">
      {open ? (
        <ul id={listId} role="listbox" aria-label="Suggestions" className="fm-shop-suggest">
          {choices.map((choice, index) => (
            <li
              key={choice.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === current}
              className={cx(index === current && "fm-shop-suggest-on")}
              // Garde le focus (et le clavier du telephone) dans le champ.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                if (entry) add(entry, choice.ingredient);
              }}
            >
              {choice.ingredient ? (
                <b>{choice.ingredient.name}</b>
              ) : (
                <span>« {entry?.name} » tel quel</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="fm-shop-add-row">
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-label="Ajouter un article"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open ? optionId(current) : undefined}
          aria-describedby={online ? undefined : OFFLINE_REASON_ID}
          disabled={!online}
          placeholder={online ? "Ajouter un article" : "L'ajout attend le réseau"}
          enterKeyHint="enter"
          autoComplete="off"
          className="fm-shop-add-input"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(null);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="fm-shop-add-btn"
          aria-label="Ajouter"
          disabled={!online || !entry}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            void submit();
          }}
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}
