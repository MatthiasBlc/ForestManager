// Sections de la liste d'un espace [D228, D231] : ajout en fin, renommage, ordre
// complet, suppression (ses articles vont dans "Autres", ses favorites sont oubliees).
import { MAX_SHOPPING_SECTIONS, normalizeName, type ShoppingSection } from "@fm/shared";

import type { Db } from "../../core/db/client.ts";
import { AppError } from "../../core/http/errors.ts";

const sectionSelect = { id: true, name: true, aisleId: true } as const;

export function listSections(db: Db, spaceId: string): Promise<ShoppingSection[]> {
  return db.shoppingSection.findMany({
    where: { spaceId },
    select: sectionSelect,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

async function assertNameFree(db: Db, spaceId: string, name: string, exceptId?: string) {
  const key = normalizeName(name);
  const sections = await db.shoppingSection.findMany({
    where: { spaceId, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  if (sections.some((section) => normalizeName(section.name) === key)) {
    throw new AppError("SHOPPING_003");
  }
}

export async function assertSection(db: Db, spaceId: string, sectionId: string): Promise<void> {
  const section = await db.shoppingSection.findFirst({
    where: { id: sectionId, spaceId },
    select: { id: true },
  });
  if (!section) throw new AppError("SHOPPING_002");
}

export async function createSection(
  db: Db,
  spaceId: string,
  name: string
): Promise<ShoppingSection> {
  const sections = await db.shoppingSection.findMany({
    where: { spaceId },
    select: { sortOrder: true },
  });
  if (sections.length >= MAX_SHOPPING_SECTIONS) throw new AppError("SHOPPING_006");
  await assertNameFree(db, spaceId, name);
  const sortOrder = Math.max(-1, ...sections.map((section) => section.sortOrder)) + 1;
  return db.shoppingSection.create({ data: { spaceId, name, sortOrder }, select: sectionSelect });
}

export async function renameSection(
  db: Db,
  spaceId: string,
  sectionId: string,
  name: string
): Promise<ShoppingSection> {
  await assertSection(db, spaceId, sectionId);
  await assertNameFree(db, spaceId, name, sectionId);
  return db.shoppingSection.update({
    where: { id: sectionId },
    data: { name },
    select: sectionSelect,
  });
}

export async function deleteSection(db: Db, spaceId: string, sectionId: string): Promise<void> {
  await assertSection(db, spaceId, sectionId);
  // Articles : sectionId mis a null par la cle etrangere ; favorites : supprimees en cascade.
  await db.shoppingSection.delete({ where: { id: sectionId } });
}

export async function reorderSections(
  db: Db,
  spaceId: string,
  ids: readonly string[]
): Promise<ShoppingSection[]> {
  const current = await db.shoppingSection.findMany({ where: { spaceId }, select: { id: true } });
  const known = new Set(current.map((section) => section.id));
  if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
    throw new AppError("SHOPPING_004");
  }
  await db.$transaction(
    ids.map((id, sortOrder) => db.shoppingSection.update({ where: { id }, data: { sortOrder } }))
  );
  return listSections(db, spaceId);
}
