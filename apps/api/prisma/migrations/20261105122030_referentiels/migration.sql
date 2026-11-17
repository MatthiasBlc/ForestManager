-- CreateEnum
CREATE TYPE "UnitDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT', 'NONE');

-- CreateEnum
CREATE TYPE "IngredientStatus" AS ENUM ('ACTIVE', 'NEW', 'MERGED');

-- CreateEnum
CREATE TYPE "TagScope" AS ENUM ('GLOBAL', 'SPACE');

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dimension" "UnitDimension" NOT NULL,
    "toBase" DOUBLE PRECISION,
    "metric" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitTranslation" (
    "unitId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "namePlural" TEXT,
    "abbreviation" TEXT NOT NULL,

    CONSTRAINT "UnitTranslation_pkey" PRIMARY KEY ("unitId","locale")
);

-- CreateTable
CREATE TABLE "Aisle" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Aisle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AisleTranslation" (
    "aisleId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AisleTranslation_pkey" PRIMARY KEY ("aisleId","locale")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "status" "IngredientStatus" NOT NULL DEFAULT 'NEW',
    "defaultUnitId" TEXT,
    "aisleId" TEXT,
    "mergedIntoId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientTranslation" (
    "ingredientId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "namePlural" TEXT,
    "normalized" TEXT NOT NULL,

    CONSTRAINT "IngredientTranslation_pkey" PRIMARY KEY ("ingredientId","locale")
);

-- CreateTable
CREATE TABLE "IngredientUnitWeight" (
    "ingredientId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "IngredientUnitWeight_pkey" PRIMARY KEY ("ingredientId","unitId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "scope" "TagScope" NOT NULL,
    "spaceId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdById" TEXT,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagTranslation" (
    "tagId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TagTranslation_pkey" PRIMARY KEY ("tagId","locale")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Aisle_code_key" ON "Aisle"("code");

-- CreateIndex
CREATE INDEX "Ingredient_status_idx" ON "Ingredient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientTranslation_locale_normalized_key" ON "IngredientTranslation"("locale", "normalized");

-- CreateIndex
CREATE INDEX "Tag_scope_deletedAt_idx" ON "Tag"("scope", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_spaceId_slug_key" ON "Tag"("spaceId", "slug");

-- AddForeignKey
ALTER TABLE "UnitTranslation" ADD CONSTRAINT "UnitTranslation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AisleTranslation" ADD CONSTRAINT "AisleTranslation_aisleId_fkey" FOREIGN KEY ("aisleId") REFERENCES "Aisle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_defaultUnitId_fkey" FOREIGN KEY ("defaultUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_aisleId_fkey" FOREIGN KEY ("aisleId") REFERENCES "Aisle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientTranslation" ADD CONSTRAINT "IngredientTranslation_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientUnitWeight" ADD CONSTRAINT "IngredientUnitWeight_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientUnitWeight" ADD CONSTRAINT "IngredientUnitWeight_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagTranslation" ADD CONSTRAINT "TagTranslation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tags : un tag global n'a pas d'espace, un tag d'espace en a un.
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_scope_space_check"
  CHECK (("scope" = 'SPACE') = ("spaceId" IS NOT NULL));

-- Slug unique des tags globaux (l'unique (spaceId, slug) ne couvre pas spaceId NULL).
CREATE UNIQUE INDEX "Tag_global_slug_key" ON "Tag"("slug") WHERE "spaceId" IS NULL;

-- Autocompletion des ingredients par prefixe et par ressemblance (pg_trgm, D160).
CREATE INDEX "IngredientTranslation_normalized_trgm_idx"
  ON "IngredientTranslation" USING gin ("normalized" gin_trgm_ops);
