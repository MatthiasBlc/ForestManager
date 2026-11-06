// Photo d'une recette (C3.7, D167) : hors revisions, droit de modifier,
// copiee par l'adaptation, liberee 30 jours apres la suppression.
import { IMAGE_MAX_SIDE } from "@fm/shared";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createContext } from "../src/core/http/app.ts";
import { sweepStorage } from "../src/core/storage/images.ts";
import { MODULES } from "../src/modules/index.ts";
import { createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv, testStorage } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";
import { createRecipe, recipeBody } from "./helpers/recipes.ts";
import { fetchImage, upload } from "./helpers/storage.ts";
import { webpBytes } from "./helpers/webp.ts";

const app = createTestApp();
const PHOTO = webpBytes(1600, 1200);

async function world() {
  const [author, moderator, member, outsider] = await Promise.all(
    Array.from({ length: 4 }, () => createUser())
  );
  if (!author || !moderator || !member || !outsider) throw new Error("users");
  const space = await createSpace(author.id);
  await addMember(space.id, moderator.id, "MODERATOR");
  await addMember(space.id, member.id);
  const [asAuthor, asModerator, asMember, asOutsider] = await Promise.all(
    [author, moderator, member, outsider].map((user) => loginAs(user, app))
  );
  if (!asAuthor || !asModerator || !asMember || !asOutsider) throw new Error("clients");
  const recipe = await createRecipe(asAuthor, space.id);
  const path = `/spaces/${space.id}/recipes/${recipe.id}`;
  return { author, space, recipe, path, asAuthor, asModerator, asMember, asOutsider };
}

describe("photo d'une recette", () => {
  it("se rattache sans nouvelle revision, et apparait dans le detail et la liste", async () => {
    const w = await world();
    const res = await w.asAuthor.put(`${w.path}/photo`, {
      uploadId: await upload(w.asAuthor, PHOTO),
    });
    expect(res.status).toBe(200);
    expect(await fetchImage(res.body.url as string)).toEqual(PHOTO);

    const detail = await w.asMember.get(w.path);
    expect(detail.body.imageUrl).toBe(res.body.url);
    expect(detail.body.currentRevision).toBe(1);
    const list = await w.asMember.get(`/spaces/${w.space.id}/recipes`);
    expect(list.body.data[0].imageUrl).toBe(res.body.url);
    const row = await db.recipe.findUniqueOrThrow({ where: { id: w.recipe.id } });
    expect(row.imageKey).toMatch(new RegExp(`^recipes/${w.recipe.id}/[0-9a-f-]{36}\\.webp$`));
  });

  it("suit le droit de modifier la recette", async () => {
    const w = await world();
    const asMember = await w.asMember.put(`${w.path}/photo`, {
      uploadId: await upload(w.asMember, PHOTO),
    });
    expect(asMember.body.error.code).toBe("SPACE_002");
    const asOutsider = await w.asOutsider.put(`${w.path}/photo`, {
      uploadId: await upload(w.asOutsider, PHOTO),
    });
    expect(asOutsider.body.error.code).toBe("SPACE_001");
    expect((await w.asMember.delete(`${w.path}/photo`)).body.error.code).toBe("SPACE_002");

    // Auteur parti : les moderateurs de l'espace d'origine prennent le relais.
    await db.membership.updateMany({
      where: { spaceId: w.space.id, userId: w.author.id },
      data: { leftAt: new Date() },
    });
    const asModerator = await w.asModerator.put(`${w.path}/photo`, {
      uploadId: await upload(w.asModerator, PHOTO),
    });
    expect(asModerator.status).toBe(200);
  });

  it("accepte une photo plus grande qu'un avatar, dans sa propre limite", async () => {
    const w = await world();
    const big = webpBytes(IMAGE_MAX_SIDE.photo + 1, 100);
    const res = await w.asAuthor.put(`${w.path}/photo`, {
      uploadId: await upload(w.asAuthor, big),
    });
    expect(res.body.error.code).toBe("STORAGE_003");
  });

  it("se remplace et se retire en effacant l'ancienne image", async () => {
    const w = await world();
    await w.asAuthor.put(`${w.path}/photo`, { uploadId: await upload(w.asAuthor, PHOTO) });
    const first = (await db.recipe.findUniqueOrThrow({ where: { id: w.recipe.id } })).imageKey;
    await w.asAuthor.put(`${w.path}/photo`, { uploadId: await upload(w.asAuthor, PHOTO) });
    const second = (await db.recipe.findUniqueOrThrow({ where: { id: w.recipe.id } })).imageKey;
    expect(second).not.toBe(first);
    expect(await testStorage.read(first ?? "", 10)).toBeNull();

    const removed = await w.asAuthor.delete(`${w.path}/photo`);
    expect(removed.status).toBe(200);
    expect(removed.body.url).toBeNull();
    expect((await w.asAuthor.get(w.path)).body.imageUrl).toBeNull();
    expect(await testStorage.read(second ?? "", 10)).toBeNull();
  });

  it("reste en place quand on restaure une ancienne revision", async () => {
    const w = await world();
    const { body } = await w.asAuthor.put(`${w.path}/photo`, {
      uploadId: await upload(w.asAuthor, PHOTO),
    });
    const edited = await w.asAuthor.put(w.path, {
      ...(await recipeBody(w.asAuthor, { title: "Gratin v2" })),
      revision: 1,
    });
    expect(edited.status).toBe(200);
    const restored = await w.asAuthor.post(`${w.path}/revisions/1/restore`, { revision: 2 });
    expect(restored.status).toBe(200);
    expect(restored.body.imageUrl).toBe(body.url);
  });

  it("est copiee dans l'adaptation, independante de l'original", async () => {
    const w = await world();
    const colloc = await createSpace(w.author.id);
    await w.asAuthor.put(`${w.path}/photo`, { uploadId: await upload(w.asAuthor, PHOTO) });
    const adapted = await w.asAuthor.post(`${w.path}/adapt`, { targetSpaceId: colloc.id });
    expect(adapted.status).toBe(201);
    const row = await db.recipe.findUniqueOrThrow({ where: { id: adapted.body.id } });
    expect(row.imageKey).toMatch(new RegExp(`^recipes/${row.id}/`));
    expect(await fetchImage(adapted.body.imageUrl as string)).toEqual(PHOTO);

    await w.asAuthor.delete(`${w.path}/photo`);
    expect(await fetchImage(adapted.body.imageUrl as string)).toEqual(PHOTO);
  });

  it("est liberee par le menage 30 jours apres la suppression de la recette", async () => {
    const w = await world();
    await w.asAuthor.put(`${w.path}/photo`, { uploadId: await upload(w.asAuthor, PHOTO) });
    const key = (await db.recipe.findUniqueOrThrow({ where: { id: w.recipe.id } })).imageKey;
    await w.asAuthor.delete(w.path);
    const ctx = createContext({
      env: testEnv,
      db,
      logger: pino({ level: "silent" }),
      modules: MODULES,
      storage: testStorage,
    });
    const day = 24 * 60 * 60 * 1000;

    await sweepStorage(ctx, new Date(Date.now() + 29 * day));
    expect(await testStorage.read(key ?? "", PHOTO.length)).toEqual(PHOTO);

    await sweepStorage(ctx, new Date(Date.now() + 31 * day));
    expect(await testStorage.read(key ?? "", PHOTO.length)).toBeNull();
    expect((await db.recipe.findUniqueOrThrow({ where: { id: w.recipe.id } })).imageKey).toBeNull();
  });
});
