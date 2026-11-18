// Reimport d'un export de recettes [D192, D225] : "Creer" > "Importer un
// export", fichier lu sur l'appareil (zip ou recettes.json), apercu a cocher
// (doublons decoches), envoi tout ou rien, puis photos recette par recette.
import {
  ERRORS,
  RECIPES_EXPORT_FORMAT,
  RECIPES_EXPORT_VERSION,
  type ExportedRecipe,
} from "@fm/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { strToU8, zipSync } from "fflate";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../app/App.tsx";
import { axeViolations } from "../../test/axe.ts";
import { NOW } from "../../test/fixtures.ts";
import { recipeServer } from "../../test/recipe-server.ts";
import { renderWithProviders } from "../../test/render.tsx";
import { server } from "../../test/server.ts";
import { mockUploads } from "../../test/uploads.ts";

vi.mock("../../lib/image.ts", () => import("../../test/fake-image.ts"));

type Server = ReturnType<typeof recipeServer>;

function exported(ref: string, title: string, photo: string | null = null): ExportedRecipe {
  return {
    ref,
    title,
    description: null,
    author: "lea",
    space: "Foyer",
    isBase: false,
    yield: { quantity: 4, unit: null },
    prepMinutes: 10,
    cookMinutes: null,
    restMinutes: null,
    tags: [],
    blocks: [{ kind: "LOCAL", title: null, ingredients: [], steps: ["Cuire."] }],
    notes: null,
    sourceUrl: null,
    photo,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function archiveJson(recipes: ExportedRecipe[]): string {
  return JSON.stringify({
    format: RECIPES_EXPORT_FORMAT,
    version: RECIPES_EXPORT_VERSION,
    exportedAt: NOW,
    recipes,
  });
}

function jsonFile(recipes: ExportedRecipe[]): File {
  return new File([archiveJson(recipes)], "recettes.json", { type: "application/json" });
}

function zipFile(entries: Record<string, Uint8Array>, name = "export.zip"): File {
  return new File([zipSync(entries)], name, { type: "application/zip" });
}

async function openImport(s: Server) {
  const rendered = renderWithProviders(<App />, { route: `/s/${s.space.id}/recipes` });
  await rendered.user.click(
    (await screen.findAllByRole("button", { name: "Ajouter une recette" }))[0]!
  );
  const root = screen.getByRole("dialog", { name: "Ajouter une recette dans Famille" });
  await rendered.user.click(within(root).getByRole("button", { name: /Créer/ }));
  const create = screen.getByRole("dialog", { name: "Créer une recette" });
  await rendered.user.click(within(create).getByRole("button", { name: /Importer un export/ }));
  return {
    ...rendered,
    sheet: await screen.findByRole("dialog", { name: "Importer un export" }),
  };
}

async function choose(user: Awaited<ReturnType<typeof openImport>>["user"], file: File) {
  await user.upload(screen.getByLabelText("Fichier d'export"), file);
}

describe("importer un export (F-IMP, D225)", () => {
  it("recettes.json seul : apercu a cocher, doublon decoche, import sans photos", async () => {
    const s = recipeServer();
    s.recipes.importExisting = ["Gratin dauphinois"];
    const { user, container } = await openImport(s);
    await choose(
      user,
      jsonFile([
        exported("gratin-dauphinois", "Gratin dauphinois", "photos/gratin-dauphinois.webp"),
        exported("soupe-de-potiron", "Soupe de potiron"),
      ])
    );

    const picker = await screen.findByRole("dialog", { name: "Recettes à importer" });
    const gratin = within(picker).getByRole("checkbox", { name: /Gratin dauphinois/ });
    expect(gratin).not.toBeChecked();
    expect(within(picker).getByText("Déjà dans l'espace")).toBeInTheDocument();
    expect(within(picker).getByRole("checkbox", { name: /Soupe de potiron/ })).toBeChecked();
    expect(s.recipes.bodies.importPreview).toEqual({
      titles: ["Gratin dauphinois", "Soupe de potiron"],
    });
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(picker).getByRole("button", { name: "Importer 1 recette" }));
    expect(await screen.findByText("1 recette importée dans Famille")).toBeInTheDocument();
    const body = s.recipes.bodies.importExport as { recipes: ExportedRecipe[] };
    expect(body.recipes.map((r) => r.ref)).toEqual(["soupe-de-potiron"]);
    expect(s.recipes.calls.filter((c) => c.startsWith("photo:"))).toEqual([]);
    // La liste de l'espace est relue : la recette importee y figure.
    expect(await screen.findByRole("article", { name: "Soupe de potiron" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Recettes à importer" })).not.toBeInTheDocument();
  });

  it("un doublon peut etre recoche ; rien de coche, pas d'import", async () => {
    const s = recipeServer();
    s.recipes.importExisting = ["Gratin dauphinois"];
    const { user } = await openImport(s);
    await choose(user, jsonFile([exported("gratin-dauphinois", "Gratin dauphinois")]));
    const picker = await screen.findByRole("dialog", { name: "Recettes à importer" });
    expect(
      within(picker).getByRole("button", { name: "Choisis au moins une recette" })
    ).toBeDisabled();
    await user.click(within(picker).getByRole("checkbox", { name: /Gratin dauphinois/ }));
    expect(within(picker).getByText("1 choisie")).toBeInTheDocument();
    expect(within(picker).getByRole("button", { name: "Importer 1 recette" })).toBeEnabled();
  });

  it("archive zip avec photos : chaque photo est envoyee puis rattachee a sa recette", async () => {
    const s = recipeServer();
    const { uploadIds } = mockUploads();
    const { user } = await openImport(s);
    await choose(
      user,
      zipFile({
        "recettes.json": strToU8(
          archiveJson([
            exported("gratin", "Gratin dauphinois", "photos/gratin.webp"),
            exported("soupe", "Soupe de potiron", "photos/soupe.jpg"),
            exported("tarte", "Tarte fine"),
          ])
        ),
        "photos/gratin.webp": new Uint8Array([1, 2, 3]),
        "photos/soupe.jpg": new Uint8Array([4, 5, 6]),
      })
    );
    const picker = await screen.findByRole("dialog", { name: "Recettes à importer" });
    expect(within(picker).getByText("3 choisies")).toBeInTheDocument();
    await user.click(within(picker).getByRole("button", { name: "Importer 3 recettes" }));

    expect(await screen.findByText("3 recettes importées dans Famille")).toBeInTheDocument();
    const byTitle = (title: string) => s.recipes.recipes.find((r) => r.title === title)!.id;
    await waitFor(() => {
      expect(s.recipes.calls.filter((c) => c.startsWith("photo:"))).toEqual([
        `photo:${byTitle("Gratin dauphinois")}`,
        `photo:${byTitle("Soupe de potiron")}`,
      ]);
    });
    expect(uploadIds).toHaveLength(2);
    expect(screen.queryByText(/non reprise/)).not.toBeInTheDocument();
  });

  it("une photo qui echoue n'annule rien : toast des photos non reprises", async () => {
    const s = recipeServer();
    mockUploads();
    let photos = 0;
    server.use(
      http.put(`${s.base}/:recipeId/photo`, () => {
        photos += 1;
        return photos === 1
          ? HttpResponse.json({ url: "http://storage.test/ok.webp" })
          : HttpResponse.json({ error: { code: "STORAGE_003", message: "x" } }, { status: 502 });
      })
    );
    const { user } = await openImport(s);
    await choose(
      user,
      zipFile({
        "recettes.json": strToU8(
          archiveJson([
            exported("gratin", "Gratin dauphinois", "photos/gratin.webp"),
            exported("soupe", "Soupe de potiron", "photos/soupe.webp"),
            // Photo annoncee mais absente de l'archive : non reprise non plus.
            exported("tarte", "Tarte fine", "photos/tarte.webp"),
          ])
        ),
        "photos/gratin.webp": new Uint8Array([1, 2, 3]),
        "photos/soupe.webp": new Uint8Array([4, 5, 6]),
      })
    );
    const picker = await screen.findByRole("dialog", { name: "Recettes à importer" });
    await user.click(within(picker).getByRole("button", { name: "Importer 3 recettes" }));
    expect(await screen.findByText("3 recettes importées dans Famille")).toBeInTheDocument();
    expect(await screen.findByText("2 photos non reprises")).toBeInTheDocument();
  });

  it("fichier qui n'est pas un export : message clair, pas d'apercu", async () => {
    const s = recipeServer();
    const { user, sheet } = await openImport(s);
    await choose(user, new File(['{"hello":1}'], "notes.json", { type: "application/json" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(ERRORS.RECIPE_022.message);

    await choose(user, zipFile({ "autre.txt": strToU8("rien") }));
    await waitFor(() => {
      expect(within(sheet).getByRole("alert")).toHaveTextContent(ERRORS.RECIPE_022.message);
    });

    await choose(user, new File(["pas du tout un zip"], "export.zip", { type: "application/zip" }));
    await waitFor(() => {
      expect(within(sheet).getByRole("alert")).toHaveTextContent(ERRORS.RECIPE_022.message);
    });
    expect(s.recipes.bodies.importPreview).toBeUndefined();
  });

  it("export Markdown : explique qu'il faut un export JSON", async () => {
    const s = recipeServer();
    const { user, sheet } = await openImport(s);
    await choose(user, zipFile({ "gratin.md": strToU8("# Gratin") }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(/format JSON/);
  });

  it("refus de l'API : le message s'affiche, l'apercu reste ouvert", async () => {
    const s = recipeServer();
    s.recipes.importFails = "RECIPE_023";
    const { user } = await openImport(s);
    await choose(user, jsonFile([exported("gratin", "Gratin dauphinois")]));
    const picker = await screen.findByRole("dialog", { name: "Recettes à importer" });
    await user.click(within(picker).getByRole("button", { name: "Importer 1 recette" }));
    expect(await within(picker).findByRole("alert")).toHaveTextContent(ERRORS.RECIPE_023.message);
    expect(within(picker).getByRole("button", { name: "Importer 1 recette" })).toBeEnabled();
  });
});
