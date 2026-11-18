-- Ordre des tags dans leur famille, choisi comme celui des familles.
ALTER TABLE "Tag" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Point de depart : l'ordre alphabetique affiche jusqu'ici, famille par famille.
UPDATE "Tag" t SET "sortOrder" = o.rank
FROM (
  SELECT id, (row_number() OVER (PARTITION BY "familyId" ORDER BY name) - 1)::int AS rank
  FROM "Tag" WHERE "familyId" IS NOT NULL
) o
WHERE t.id = o.id;

DROP INDEX "Tag_familyId_idx";
CREATE INDEX "Tag_familyId_sortOrder_idx" ON "Tag"("familyId", "sortOrder");
