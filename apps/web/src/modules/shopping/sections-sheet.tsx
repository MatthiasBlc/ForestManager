// F-SECTIONS [D228, D231] : les sections de l'espace, dans l'ordre du magasin.
// Ajouter, renommer, monter ou descendre, supprimer (ses articles passent dans
// "Autres", qui reste en fin et ne se supprime pas). Comme les familles de tags.
import {
  SHOPPING_SECTION_NAME_MAX,
  shoppingSectionSchema,
  type ShoppingItem,
  type ShoppingSection,
} from "@fm/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { useWriteGuard } from "../../pwa/use-write-guard.ts";
import { ActionMenu } from "../../ui/action-menu.tsx";
import { Button, IconButton } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet } from "../../ui/sheet.tsx";
import { shoppingKey } from "./queries.ts";

function NameForm({
  label,
  initial = "",
  submit,
  disabled,
  autoFocus,
  onSave,
}: {
  label: string;
  initial?: string;
  submit: string;
  disabled: boolean;
  autoFocus?: boolean;
  /** Resout vrai quand le nom est enregistre : le champ se vide. */
  onSave: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed === "") return;
        void onSave(trimmed).then((saved) => {
          if (saved) setName("");
        });
      }}
    >
      <Field
        label={label}
        className="flex-1"
        value={name}
        maxLength={SHOPPING_SECTION_NAME_MAX}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <Button type="submit" variant="secondary" disabled={disabled || name.trim() === ""}>
        {submit}
      </Button>
    </form>
  );
}

export function SectionsSheet({
  spaceId,
  sections,
  items,
  onClose,
}: {
  spaceId: string;
  sections: readonly ShoppingSection[];
  items: readonly ShoppingItem[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const guard = useWriteGuard();
  const off = guard.disabled === true;
  const base = `/spaces/${spaceId}/shopping/sections`;
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [alert, setAlert] = useState<string>();

  const write = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onMutate: () => {
      setAlert(undefined);
    },
    onError: (error) => {
      setAlert(errorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKey(spaceId) }),
  });
  const run = (call: () => Promise<unknown>) =>
    write.mutateAsync(call).then(
      () => true,
      () => false
    );

  const move = (index: number, delta: number) => {
    const ids = sections.map((section) => section.id);
    const [id] = ids.splice(index, 1);
    if (!id) return;
    ids.splice(index + delta, 0, id);
    void run(() => api.put(`${base}/order`, { ids }));
  };

  return (
    <Sheet open onClose={onClose} title="Sections">
      <div className="fm-stack">
        <p className="m-0 text-sm text-ink-muted">
          Dans l'ordre de ton parcours en magasin. Un article sans section va dans « Autres ».
        </p>
        <ul aria-label="Sections" className="fm-shop-section-list">
          {sections.map((section, index) => {
            const count = items.filter((item) => item.sectionId === section.id).length;
            if (renaming === section.id) {
              return (
                <li key={section.id}>
                  <NameForm
                    label="Nom de la section"
                    initial={section.name}
                    submit="OK"
                    disabled={off}
                    autoFocus
                    onSave={async (name) => {
                      const saved = await run(() =>
                        api.patch(`${base}/${section.id}`, { name }, shoppingSectionSchema)
                      );
                      if (saved) setRenaming(null);
                      return saved;
                    }}
                  />
                </li>
              );
            }
            return (
              <li key={section.id}>
                <div className="flex items-center gap-2">
                  <span className="flex-1">{section.name}</span>
                  <ActionMenu
                    label={`Actions de la section ${section.name}`}
                    disabled={off}
                    trigger={
                      <IconButton icon="more" label={`Actions de la section ${section.name}`} />
                    }
                    items={[
                      { id: "rename", label: "Renommer", icon: "pencil" },
                      { id: "up", label: "Monter", icon: "arrow-up", disabled: index === 0 },
                      {
                        id: "down",
                        label: "Descendre",
                        icon: "arrow-down",
                        disabled: index === sections.length - 1,
                      },
                      "-",
                      { id: "delete", label: "Supprimer", icon: "trash", danger: true },
                    ]}
                    onSelect={(id) => {
                      setDeleting(null);
                      if (id === "rename") setRenaming(section.id);
                      else if (id === "delete") setDeleting(section.id);
                      else move(index, id === "up" ? -1 : 1);
                    }}
                  />
                </div>
                {deleting === section.id ? (
                  <div className="fm-shop-confirm">
                    <span>
                      {`Supprimer « ${section.name} » ?`}
                      {count === 0
                        ? ""
                        : count === 1
                          ? " Son article passe dans Autres."
                          : ` Ses ${String(count)} articles passent dans Autres.`}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setDeleting(null);
                        }}
                      >
                        Garder
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        aria-label={`Supprimer « ${section.name} »`}
                        disabled={off}
                        onClick={() => {
                          setDeleting(null);
                          void run(() => api.delete(`${base}/${section.id}`));
                        }}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
          <li>
            <div className="flex items-center gap-2 text-ink-muted">
              <span className="flex-1">Autres</span>
              <small>toujours en fin</small>
            </div>
          </li>
        </ul>
        <FormAlert message={alert} />
        <NameForm
          label="Nouvelle section"
          submit="Ajouter"
          disabled={off}
          onSave={(name) => run(() => api.post(base, { name }, shoppingSectionSchema))}
        />
      </div>
    </Sheet>
  );
}
