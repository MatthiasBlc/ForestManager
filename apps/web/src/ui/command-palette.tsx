// CommandPalette : recherche globale et raccourcis (F-RECHERCHE) [D119].
// Composant pilote : la requete, les groupes et le choix appartiennent a
// l'appelant. Fleches pour naviguer (a travers les groupes), Entree pour ouvrir,
// Echap pour fermer (Radix Dialog : piege a focus et retour au declencheur).
// Plein ecran sur mobile, centree en haut a partir de 768px (CSS).
import { Dialog } from "radix-ui";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Icon, type IconName } from "./icon.tsx";

export interface PaletteItem {
  /** Unique dans toute la palette. */
  id: string;
  label: string;
  icon: IconName;
  hint?: string;
}

export interface PaletteGroup {
  id: string;
  label: string;
  items: readonly PaletteItem[];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: readonly PaletteGroup[];
  onSelect: (id: string) => void;
  /** Affiche quand aucun groupe n'a de resultat. */
  empty?: ReactNode;
  /** Ligne d'etat sous le champ (chargement, erreur). */
  status?: ReactNode;
  placeholder?: string;
}

export function CommandPalette(props: CommandPaletteProps) {
  const { open, onClose, query, onQueryChange, groups, onSelect } = props;
  const baseId = useId();
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // Selection liee a la liste affichee : une nouvelle liste repart du haut.
  const flat = groups.flatMap((group) => group.items);
  const signature = flat.map((item) => item.id).join("|");
  const [selection, setSelection] = useState({ signature, index: 0 });
  const current =
    selection.signature === signature ? Math.min(selection.index, Math.max(0, flat.length - 1)) : 0;
  const setActive = (index: number) => {
    setSelection({ signature, index });
  };
  const optionId = (index: number) => `${baseId}-o${String(index)}`;
  // Premier indice de chaque groupe dans la liste a plat.
  const starts = groups.map((_, at) =>
    groups.slice(0, at).reduce((sum, group) => sum + group.items.length, 0)
  );

  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement)
      opener.current = document.activeElement;
  }, [open]);
  useEffect(() => {
    // jsdom n'a pas scrollIntoView.
    const option = document.getElementById(optionId(current)) as Partial<HTMLElement> | null;
    option?.scrollIntoView?.({ block: "nearest" });
  });

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(flat.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      const item = flat[current];
      if (item) {
        event.preventDefault();
        onSelect(item.id);
      }
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <div className="fm-layer fm-root fm-cmd-layer">
          <Dialog.Overlay className="fm-overlay" />
          <Dialog.Content
            className="fm-cmd"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              input.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              if (opener.current?.isConnected) {
                event.preventDefault();
                opener.current.focus();
              }
            }}
          >
            <Dialog.Title className="fm-sr">Recherche</Dialog.Title>
            <div className="fm-cmd-input">
              <Icon name="search" />
              <input
                ref={input}
                role="combobox"
                aria-label="Rechercher"
                aria-expanded={flat.length > 0}
                aria-controls={`${baseId}-results`}
                aria-autocomplete="list"
                aria-activedescendant={flat.length > 0 ? optionId(current) : undefined}
                autoComplete="off"
                enterKeyHint="go"
                value={query}
                placeholder={
                  props.placeholder ?? "Rechercher une recette, un ingrédient, un membre"
                }
                onChange={(event) => {
                  onQueryChange(event.target.value);
                }}
                onKeyDown={onKeyDown}
              />
              <span className="fm-kbd fm-cmd-esc" aria-hidden="true">
                Échap
              </span>
              <Dialog.Close className="fm-cmd-close">Fermer</Dialog.Close>
            </div>
            <div id={`${baseId}-results`} className="fm-cmd-results">
              {props.status ? <p className="fm-cmd-status">{props.status}</p> : null}
              {groups.map((group, groupAt) =>
                group.items.length === 0 ? null : (
                  <div
                    key={group.id}
                    className="fm-cmd-group"
                    role="listbox"
                    aria-label={group.label}
                  >
                    <span aria-hidden="true">{group.label}</span>
                    {group.items.map((item, itemAt) => {
                      const at = (starts[groupAt] ?? 0) + itemAt;
                      return (
                        <div
                          key={item.id}
                          id={optionId(at)}
                          role="option"
                          tabIndex={-1}
                          className="fm-cmd-item"
                          aria-selected={at === current}
                          onMouseMove={() => {
                            if (at !== current) setActive(at);
                          }}
                          onClick={() => {
                            onSelect(item.id);
                          }}
                        >
                          <Icon name={item.icon} />
                          {/* Nom accessible tire du texte affiche, "Gratin Famille" (pas
                              d'aria-label : axe label-content-name-mismatch). */}
                          <span className="fm-cmd-label">{item.label}</span>
                          {item.hint ? (
                            <>
                              {" "}
                              <small>{item.hint}</small>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
              {flat.length === 0 && props.empty ? (
                <p className="fm-cmd-status">{props.empty}</p>
              ) : null}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
