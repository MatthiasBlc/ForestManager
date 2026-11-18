// Reimport d'un export de recettes [D192, D225] : fichier lu sur l'appareil,
// apercu a cocher (titres deja dans l'espace decoches), import tout ou rien,
// puis photos de l'archive recette par recette (un echec n'annule rien).
import {
  IMPORT_EXPORT_MAX,
  imageResponseSchema,
  importExportPreviewSchema,
  importExportResultSchema,
  type ExportedRecipe,
} from "@fm/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { FormAlert } from "../../core/access/auth-layout.tsx";
import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { plural } from "../../lib/plural.ts";
import { uploadImage } from "../../lib/upload.ts";
import { useUploadsEnabled } from "../../patterns/use-uploads.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Badge } from "../../ui/display.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { ExportFileError, photoBlob, readExportFile, type ExportFile } from "./export-file.ts";
import { recipesKey } from "./queries.ts";

/** Fichier lu et titres deja presents dans l'espace. */
interface Loaded extends ExportFile {
  existing: Set<string>;
}

async function existingTitles(spaceId: string, recipes: ExportedRecipe[]): Promise<Set<string>> {
  const titles = recipes.map((recipe) => recipe.title);
  const existing = new Set<string>();
  // L'apercu prend au plus IMPORT_EXPORT_MAX titres par appel.
  for (let i = 0; i < titles.length; i += IMPORT_EXPORT_MAX) {
    const result = await api.post(
      `/spaces/${spaceId}/recipes/import-export/preview`,
      { titles: titles.slice(i, i + IMPORT_EXPORT_MAX) },
      importExportPreviewSchema
    );
    for (const title of result.existing) existing.add(title);
  }
  return existing;
}

export function ImportExportSheet({
  open,
  onClose,
  spaceId,
  spaceName,
}: {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  spaceName: string;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const uploads = useUploadsEnabled();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  const reset = () => {
    setLoaded(null);
    setSelected(new Set());
    setAlert(undefined);
  };
  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ""; // reprendre le meme fichier
    if (!file) return;
    setAlert(undefined);
    setBusy("Lecture du fichier…");
    try {
      const read = await readExportFile(file);
      const existing = await existingTitles(spaceId, read.recipes);
      const fresh = read.recipes.filter((recipe) => !existing.has(recipe.title));
      setSelected(new Set(fresh.slice(0, IMPORT_EXPORT_MAX).map((recipe) => recipe.ref)));
      setLoaded({ ...read, existing });
    } catch (error) {
      setAlert(error instanceof ExportFileError ? error.message : errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  /** Photos de l'archive, envoyees une a une : renvoie le nombre de photos non reprises. */
  const sendPhotos = async (
    file: Loaded,
    recipes: ExportedRecipe[],
    created: Map<string, string>
  ): Promise<number> => {
    if (!file.photos) return 0;
    const withPhoto = recipes.filter((recipe) => recipe.photo);
    let failed = 0;
    for (const [index, recipe] of withPhoto.entries()) {
      setBusy(`Photos ${String(index + 1)}/${String(withPhoto.length)}…`);
      const data = recipe.photo ? file.photos.get(recipe.photo) : undefined;
      const recipeId = created.get(recipe.ref);
      if (!uploads || !data || !recipe.photo || !recipeId) {
        failed += 1;
        continue;
      }
      try {
        const uploadId = await uploadImage(photoBlob(recipe.photo, data), "photo");
        await api.put(
          `/spaces/${spaceId}/recipes/${recipeId}/photo`,
          { uploadId },
          imageResponseSchema
        );
      } catch {
        failed += 1;
      }
    }
    return failed;
  };

  const submit = async (file: Loaded) => {
    const recipes = file.recipes.filter((recipe) => selected.has(recipe.ref));
    setAlert(undefined);
    setBusy("Import en cours…");
    try {
      const result = await api.post(
        `/spaces/${spaceId}/recipes/import-export`,
        { recipes },
        importExportResultSchema
      );
      const created = new Map(result.data.map((row) => [row.ref, row.recipeId]));
      await queryClient.invalidateQueries({ queryKey: recipesKey(spaceId) });
      toast(`${plural(created.size, "recette importée", "recettes importées")} dans ${spaceName}`, {
        tone: "success",
      });
      const failed = await sendPhotos(file, recipes, created);
      if (failed > 0) {
        toast(plural(failed, "photo non reprise", "photos non reprises"), { tone: "warning" });
      }
      if (file.photos && recipes.some((recipe) => recipe.photo)) {
        await queryClient.invalidateQueries({ queryKey: recipesKey(spaceId) });
      }
      close();
    } catch (error) {
      setAlert(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  if (loaded) {
    const n = selected.size;
    const full = n >= IMPORT_EXPORT_MAX;
    const count = plural(n, "recette", "recettes");
    return (
      <Sheet open={open} onClose={close} title="Recettes à importer">
        <div className="fm-stack">
          <div className="flex items-center gap-2">
            <IconButton icon="arrow-left" label="Retour" onClick={reset} />
            <small className="text-ink-muted">
              Les recettes importées dans {spaceName} sont à ton nom.
            </small>
          </div>
          <ul className="fm-pick-list">
            {loaded.recipes.map((recipe) => {
              const checked = selected.has(recipe.ref);
              const already = loaded.existing.has(recipe.title);
              return (
                <li key={recipe.ref}>
                  <label className="fm-pick">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={(event) => {
                        const on = event.target.checked;
                        setSelected((current) => {
                          const next = new Set(current);
                          if (on) next.add(recipe.ref);
                          else next.delete(recipe.ref);
                          return next;
                        });
                      }}
                    />
                    <span className="fm-pick-text">
                      <b>
                        {recipe.title}
                        {recipe.isBase ? (
                          <>
                            {" "}
                            <Badge tone="second">Base</Badge>
                          </>
                        ) : null}
                      </b>
                      {already ? <small>Déjà dans l'espace</small> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <FormAlert message={alert} />
          <SheetFooter>
            <div className="fm-stack fm-pick-foot">
              <div className="fm-pick-count">
                <span>{n === 0 ? "Aucune choisie" : plural(n, "choisie", "choisies")}</span>
                <span>{IMPORT_EXPORT_MAX} max</span>
              </div>
              <Button
                variant="primary"
                block
                disabled={n === 0 || busy !== null}
                onClick={() => void submit(loaded)}
              >
                {busy ?? (n === 0 ? "Choisis au moins une recette" : `Importer ${count}`)}
              </Button>
            </div>
          </SheetFooter>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title="Importer un export">
      <div className="fm-stack">
        {/* Visible : sans elle, la feuille n'est qu'un titre et deux boutons. */}
        <p className="text-sm text-ink-muted">
          L'archive .zip téléchargée depuis Forest Manager (photos comprises) ou son fichier
          recettes.json : les recettes arrivent dans {spaceName}.
        </p>
        <input
          ref={input}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          className="sr-only"
          aria-label="Fichier d'export"
          tabIndex={-1}
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
        <FormAlert message={alert} />
        <SheetFooter>
          <Button onClick={close}>Annuler</Button>
          <Button variant="primary" disabled={busy !== null} onClick={() => input.current?.click()}>
            {busy ?? "Choisir le fichier"}
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}
