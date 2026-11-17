// Feuille de saisie d'un nom en francais et en anglais (rayons, tags globaux,
// ajout d'ingredient) [D34]. L'anglais est facultatif : vide = a traduire.
import { useState, type ReactNode } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { Button } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { FormAlert } from "../access/auth-layout.tsx";

export interface TranslatedName {
  fr: string;
  en: string | null;
}

export function TranslatedNameSheet({
  open,
  title,
  submitLabel,
  initial,
  maxLength,
  description,
  extra,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initial?: TranslatedName;
  maxLength: number;
  description?: string;
  /** Action secondaire sous le formulaire (supprimer...). */
  extra?: ReactNode;
  onClose: () => void;
  onSubmit: (value: TranslatedName) => Promise<unknown>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} description={description}>
      {/* Remonte a chaque ouverture : les champs repartent de `initial`. */}
      {open ? (
        <NameForm
          initial={initial}
          submitLabel={submitLabel}
          maxLength={maxLength}
          extra={extra}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Sheet>
  );
}

function NameForm({
  initial,
  submitLabel,
  maxLength,
  extra,
  onClose,
  onSubmit,
}: {
  initial?: TranslatedName;
  submitLabel: string;
  maxLength: number;
  extra?: ReactNode;
  onClose: () => void;
  onSubmit: (value: TranslatedName) => Promise<unknown>;
}) {
  const [fr, setFr] = useState(initial?.fr ?? "");
  const [en, setEn] = useState(initial?.en ?? "");
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  return (
    <form
      className="fm-stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!fr.trim()) {
          setMissing(true);
          return;
        }
        setPending(true);
        setError(undefined);
        onSubmit({ fr: fr.trim(), en: en.trim() || null })
          .then(onClose)
          .catch((cause: unknown) => {
            setError(errorMessage(cause));
          })
          .finally(() => {
            setPending(false);
          });
      }}
    >
      <FormAlert message={error} />
      <Field
        label="Nom en français"
        value={fr}
        maxLength={maxLength}
        autoComplete="off"
        error={missing && !fr.trim() ? "Le nom en français est obligatoire." : undefined}
        onChange={(event) => {
          setFr(event.target.value);
        }}
      />
      <Field
        label="Nom en anglais"
        hint="Facultatif : sans lui, l'élément reste à traduire."
        value={en}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => {
          setEn(event.target.value);
        }}
      />
      {extra}
      <SheetFooter>
        <Button type="button" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {submitLabel}
        </Button>
      </SheetFooter>
    </form>
  );
}
