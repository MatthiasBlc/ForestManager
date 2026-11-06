// Import d'une recette (C3.8) : F-IMPORT-URL (page lue par l'API) et
// F-IMPORT-TEXTE (texte analyse sur l'appareil). Les deux ouvrent l'editeur
// pre-rempli : rien n'est enregistre sans relecture.
import {
  importedRecipeSchema,
  importRecipeBodySchema,
  parseRecipeText,
  type ImportedRecipe,
} from "@fm/shared";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";

export type ImportSheet = "url" | "text" | null;

function useOpenEditor(spaceId: string) {
  const navigate = useNavigate();
  return (imported: ImportedRecipe) => {
    void navigate(`/s/${spaceId}/recipes/new`, { state: { imported } });
  };
}

export function ImportUrlSheet({
  open,
  onClose,
  onPasteText,
  spaceId,
}: {
  open: boolean;
  onClose: () => void;
  onPasteText: () => void;
  spaceId: string;
}) {
  const openEditor = useOpenEditor(spaceId);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    const parsed = importRecipeBodySchema.safeParse({ url: url.trim() });
    if (!parsed.success) {
      setError("Colle un lien complet, qui commence par https://");
      return;
    }
    setBusy(true);
    try {
      openEditor(
        await api.post(`/spaces/${spaceId}/recipes/import`, parsed.data, importedRecipeSchema)
      );
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Importer depuis un lien">
      <form
        className="fm-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Lien de la recette"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
        />
        <p className="text-sm text-ink-muted">
          Les sites de recettes courants (Marmiton, HelloFresh, la plupart des blogs) sont lus
          automatiquement.
        </p>
        <FormAlert message={error} />
        <SheetFooter>
          {error ? (
            <Button onClick={onPasteText}>Coller le texte</Button>
          ) : (
            <Button onClick={onClose}>Annuler</Button>
          )}
          <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
            {busy ? "Lecture de la page…" : "Importer"}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}

const plural = (count: number, one: string, many: string) =>
  `${String(count)} ${count > 1 ? many : one}`;

export function ImportTextSheet({
  open,
  onClose,
  spaceId,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
}) {
  const openEditor = useOpenEditor(spaceId);
  const [text, setText] = useState("");
  const recipe = useMemo(() => parseRecipeText(text), [text]);
  const toCheck = recipe.ingredients.filter((line) => line.check).length;
  const found = [
    recipe.title ? "Titre repéré" : "Pas de titre repéré",
    plural(recipe.ingredients.length, "ingrédient", "ingrédients"),
    plural(recipe.steps.length, "étape", "étapes"),
    ...(toCheck > 0 ? [plural(toCheck, "quantité à vérifier", "quantités à vérifier")] : []),
  ];
  const empty = !recipe.title && recipe.ingredients.length === 0 && recipe.steps.length === 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Coller un texte"
      description="Depuis un mail, une note ou un PDF : le titre, les ingrédients et les étapes sont repérés ici, sur ton appareil."
    >
      <div className="fm-stack">
        <Field
          multiline
          rows={8}
          label="Texte de la recette"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        {empty ? null : (
          <p role="status" className="m-0 text-sm text-ink-muted">
            {found.join(" · ")}
          </p>
        )}
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={empty}
            onClick={() => {
              openEditor(recipe);
            }}
          >
            Ouvrir dans l'éditeur
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
