-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CONVERTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "RecipeRevision" ADD COLUMN     "suggestionId" TEXT;

-- CreateTable
CREATE TABLE "RecipeSuggestion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "proposed" JSONB NOT NULL,
    "message" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionMessage" TEXT,
    "convertedRecipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeSuggestion_recipeId_status_idx" ON "RecipeSuggestion"("recipeId", "status");

-- CreateIndex
CREATE INDEX "RecipeSuggestion_proposerId_idx" ON "RecipeSuggestion"("proposerId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeRevision_suggestionId_key" ON "RecipeRevision"("suggestionId");

-- AddForeignKey
ALTER TABLE "RecipeRevision" ADD CONSTRAINT "RecipeRevision_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "RecipeSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSuggestion" ADD CONSTRAINT "RecipeSuggestion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSuggestion" ADD CONSTRAINT "RecipeSuggestion_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSuggestion" ADD CONSTRAINT "RecipeSuggestion_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSuggestion" ADD CONSTRAINT "RecipeSuggestion_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Une seule suggestion en attente par personne et par recette [D166].
CREATE UNIQUE INDEX "RecipeSuggestion_pending_key" ON "RecipeSuggestion"("recipeId", "proposerId") WHERE "status" = 'PENDING';
