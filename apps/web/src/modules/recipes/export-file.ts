// Lecture d'un export de recettes sur l'appareil [D225] : l'archive zip telle
// que telechargee (photos comprises) ou le `recettes.json` seul. Rien ne part
// vers l'API tant que le fichier n'est pas reconnu.
import { ERRORS, recipesExportSchema, type ExportedRecipe } from "@fm/shared";
import { strFromU8, unzipSync } from "fflate";

const EXPORT_JSON = "recettes.json";

/** Fichier refuse, avec le message a montrer tel quel. */
export class ExportFileError extends Error {}

export interface ExportFile {
  recipes: ExportedRecipe[];
  /** Photos de l'archive par chemin (`photos/...`) ; null pour un `recettes.json` seul. */
  photos: Map<string, Uint8Array> | null;
}

const notAnExport = () => new ExportFileError(ERRORS.RECIPE_022.message);

function parseJson(bytes: Uint8Array): ExportedRecipe[] {
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(bytes));
  } catch {
    throw notAnExport();
  }
  const parsed = recipesExportSchema.safeParse(raw);
  if (!parsed.success) throw notAnExport();
  if (parsed.data.recipes.length === 0) {
    throw new ExportFileError("Cet export ne contient aucune recette.");
  }
  return parsed.data.recipes;
}

function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
}

export async function readExportFile(file: Blob): Promise<ExportFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isZip(bytes)) return { recipes: parseJson(bytes), photos: null };

  const seen = { markdown: false };
  let entries: Record<string, Uint8Array>;
  try {
    // Seuls le JSON et les photos sont decompresses (les .md sont ignores).
    entries = unzipSync(bytes, {
      filter: ({ name }) => {
        if (name.endsWith(".md")) seen.markdown = true;
        return name.endsWith(EXPORT_JSON) || name.includes("photos/");
      },
    });
  } catch {
    throw notAnExport();
  }
  // L'archive a pu etre re-compressee dans un dossier : chemins relatifs au JSON.
  const jsonPath = Object.keys(entries).find((name) => name.endsWith(EXPORT_JSON));
  const json = jsonPath ? entries[jsonPath] : undefined;
  if (!jsonPath || !json) {
    throw seen.markdown
      ? new ExportFileError(
          "Cet export est au format Markdown : refais un export au format JSON pour le réimporter."
        )
      : notAnExport();
  }
  const root = jsonPath.slice(0, -EXPORT_JSON.length);
  const photos = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(entries)) {
    if (name !== jsonPath && name.startsWith(root)) photos.set(name.slice(root.length), data);
  }
  return { recipes: parseJson(json), photos };
}

const PHOTO_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
};

/** Photo de l'archive prete a etre envoyee (type deduit de l'extension). */
export function photoBlob(path: string, data: Uint8Array): Blob {
  const ext = path.split(".").at(-1)?.toLowerCase() ?? "";
  return new Blob([data as Uint8Array<ArrayBuffer>], {
    type: PHOTO_TYPES[ext] ?? "application/octet-stream",
  });
}
