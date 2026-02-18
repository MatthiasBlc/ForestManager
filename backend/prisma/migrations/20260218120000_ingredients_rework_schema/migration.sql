-- CreateEnum
CREATE TYPE "UnitCategory" AS ENUM ('WEIGHT', 'VOLUME', 'SPOON', 'COUNT', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "IngredientStatus" AS ENUM ('APPROVED', 'PENDING');

-- CreateTable: Unit
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "category" "UnitCategory" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_abbreviation_key" ON "Unit"("abbreviation");

-- CreateIndex
CREATE INDEX "Unit_category_sortOrder_idx" ON "Unit"("category", "sortOrder");

-- AlterTable: Enrich Ingredient model
ALTER TABLE "Ingredient" ADD COLUMN "status" "IngredientStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Ingredient" ADD COLUMN "defaultUnitId" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Ingredient" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Ingredient_status_idx" ON "Ingredient"("status");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_defaultUnitId_fkey" FOREIGN KEY ("defaultUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Modify RecipeIngredient (quantity String? -> Float?, add unitId)
-- Step 1: Drop old quantity column
ALTER TABLE "RecipeIngredient" DROP COLUMN "quantity";

-- Step 2: Add new quantity as Float and unitId
ALTER TABLE "RecipeIngredient" ADD COLUMN "quantity" DOUBLE PRECISION;
ALTER TABLE "RecipeIngredient" ADD COLUMN "unitId" TEXT;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ProposalIngredient
CREATE TABLE "ProposalIngredient" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unitId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProposalIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProposalIngredient_proposalId_ingredientId_key" ON "ProposalIngredient"("proposalId", "ingredientId");

-- CreateIndex
CREATE INDEX "ProposalIngredient_proposalId_idx" ON "ProposalIngredient"("proposalId");

-- AddForeignKey
ALTER TABLE "ProposalIngredient" ADD CONSTRAINT "ProposalIngredient_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "RecipeUpdateProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalIngredient" ADD CONSTRAINT "ProposalIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalIngredient" ADD CONSTRAINT "ProposalIngredient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
