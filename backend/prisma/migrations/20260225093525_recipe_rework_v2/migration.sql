-- CreateTable: RecipeStep
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProposalStep
CREATE TABLE "ProposalStep" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,

    CONSTRAINT "ProposalStep_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Recipe - add new columns
ALTER TABLE "Recipe" ADD COLUMN "servings" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Recipe" ADD COLUMN "prepTime" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN "cookTime" INTEGER;
ALTER TABLE "Recipe" ADD COLUMN "restTime" INTEGER;

-- AlterTable: RecipeUpdateProposal - add new columns
ALTER TABLE "RecipeUpdateProposal" ADD COLUMN "proposedServings" INTEGER;
ALTER TABLE "RecipeUpdateProposal" ADD COLUMN "proposedPrepTime" INTEGER;
ALTER TABLE "RecipeUpdateProposal" ADD COLUMN "proposedCookTime" INTEGER;
ALTER TABLE "RecipeUpdateProposal" ADD COLUMN "proposedRestTime" INTEGER;

-- DataMigration: Convert Recipe.content to RecipeStep (including soft-deleted)
INSERT INTO "RecipeStep" ("id", "recipeId", "order", "instruction")
SELECT gen_random_uuid(), "id", 0, "content"
FROM "Recipe"
WHERE "content" IS NOT NULL AND "content" != '';

-- DataMigration: Convert RecipeUpdateProposal.proposedContent to ProposalStep (including soft-deleted)
INSERT INTO "ProposalStep" ("id", "proposalId", "order", "instruction")
SELECT gen_random_uuid(), "id", 0, "proposedContent"
FROM "RecipeUpdateProposal"
WHERE "proposedContent" IS NOT NULL AND "proposedContent" != '';

-- AlterTable: Recipe - drop old column
ALTER TABLE "Recipe" DROP COLUMN "content";

-- AlterTable: RecipeUpdateProposal - drop old column
ALTER TABLE "RecipeUpdateProposal" DROP COLUMN "proposedContent";

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalStep" ADD CONSTRAINT "ProposalStep_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "RecipeUpdateProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RecipeStep_recipeId_order_idx" ON "RecipeStep"("recipeId", "order");

-- CreateIndex
CREATE INDEX "ProposalStep_proposalId_order_idx" ON "ProposalStep"("proposalId", "order");
