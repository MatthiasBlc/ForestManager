-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('LOCAL', 'RECIPE');

-- CreateEnum
CREATE TYPE "RevisionSource" AS ENUM ('CREATE', 'EDIT', 'SUGGESTION', 'RESTORE', 'IMPORT');

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "homeSpaceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "sourceUrl" TEXT,
    "imageKey" TEXT,
    "yieldQuantity" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "yieldUnitId" TEXT,
    "prepMinutes" INTEGER,
    "cookMinutes" INTEGER,
    "restMinutes" INTEGER,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "currentRevision" INTEGER NOT NULL DEFAULT 1,
    "adaptedFromId" TEXT,
    "adaptedFromRevision" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeBlock" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "title" TEXT,
    "subRecipeId" TEXT,
    "subQuantity" DOUBLE PRECISION,
    "subUnitId" TEXT,

    CONSTRAINT "RecipeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unitId" TEXT,
    "note" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeRevision" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "source" "RevisionSource" NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeGlobalTag" (
    "recipeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "RecipeGlobalTag_pkey" PRIMARY KEY ("recipeId","tagId")
);

-- CreateTable
CREATE TABLE "RecipeSpaceTag" (
    "recipeId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "RecipeSpaceTag_pkey" PRIMARY KEY ("recipeId","spaceId","tagId")
);

-- CreateIndex
CREATE INDEX "Recipe_homeSpaceId_deletedAt_idx" ON "Recipe"("homeSpaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "Recipe_authorId_deletedAt_idx" ON "Recipe"("authorId", "deletedAt");

-- CreateIndex
CREATE INDEX "Recipe_adaptedFromId_idx" ON "Recipe"("adaptedFromId");

-- CreateIndex
CREATE INDEX "RecipeBlock_subRecipeId_idx" ON "RecipeBlock"("subRecipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeBlock_recipeId_position_key" ON "RecipeBlock"("recipeId", "position");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_blockId_position_key" ON "RecipeIngredient"("blockId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_blockId_position_key" ON "RecipeStep"("blockId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeRevision_recipeId_number_key" ON "RecipeRevision"("recipeId", "number");

-- CreateIndex
CREATE INDEX "RecipeGlobalTag_tagId_idx" ON "RecipeGlobalTag"("tagId");

-- CreateIndex
CREATE INDEX "RecipeSpaceTag_spaceId_tagId_idx" ON "RecipeSpaceTag"("spaceId", "tagId");

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_homeSpaceId_fkey" FOREIGN KEY ("homeSpaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_yieldUnitId_fkey" FOREIGN KEY ("yieldUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_adaptedFromId_fkey" FOREIGN KEY ("adaptedFromId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeBlock" ADD CONSTRAINT "RecipeBlock_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeBlock" ADD CONSTRAINT "RecipeBlock_subRecipeId_fkey" FOREIGN KEY ("subRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeBlock" ADD CONSTRAINT "RecipeBlock_subUnitId_fkey" FOREIGN KEY ("subUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "RecipeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "RecipeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRevision" ADD CONSTRAINT "RecipeRevision_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRevision" ADD CONSTRAINT "RecipeRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeGlobalTag" ADD CONSTRAINT "RecipeGlobalTag_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeGlobalTag" ADD CONSTRAINT "RecipeGlobalTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSpaceTag" ADD CONSTRAINT "RecipeSpaceTag_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSpaceTag" ADD CONSTRAINT "RecipeSpaceTag_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSpaceTag" ADD CONSTRAINT "RecipeSpaceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contraintes hors Prisma (schema cible, liste de fin de fichier).
-- 7. Bloc lie <=> sous-recette et quantite renseignees [D24].
ALTER TABLE "RecipeBlock" ADD CONSTRAINT "RecipeBlock_kind_check"
  CHECK (("kind" = 'RECIPE') = ("subRecipeId" IS NOT NULL AND "subQuantity" IS NOT NULL));
