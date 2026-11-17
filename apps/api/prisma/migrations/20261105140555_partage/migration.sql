-- CreateEnum
CREATE TYPE "ShareRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RecipeShare" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viaRecipeId" TEXT,
    "approvedById" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "RecipeShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeShareRequest" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "sourceSpaceId" TEXT NOT NULL,
    "targetSpaceId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "message" TEXT,
    "status" "ShareRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeShareRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeShare_spaceId_removedAt_idx" ON "RecipeShare"("spaceId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeShare_recipeId_spaceId_key" ON "RecipeShare"("recipeId", "spaceId");

-- CreateIndex
CREATE INDEX "RecipeShareRequest_recipeId_status_idx" ON "RecipeShareRequest"("recipeId", "status");

-- CreateIndex
CREATE INDEX "RecipeShareRequest_targetSpaceId_status_idx" ON "RecipeShareRequest"("targetSpaceId", "status");

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_viaRecipeId_fkey" FOREIGN KEY ("viaRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShare" ADD CONSTRAINT "RecipeShare_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShareRequest" ADD CONSTRAINT "RecipeShareRequest_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShareRequest" ADD CONSTRAINT "RecipeShareRequest_sourceSpaceId_fkey" FOREIGN KEY ("sourceSpaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShareRequest" ADD CONSTRAINT "RecipeShareRequest_targetSpaceId_fkey" FOREIGN KEY ("targetSpaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShareRequest" ADD CONSTRAINT "RecipeShareRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeShareRequest" ADD CONSTRAINT "RecipeShareRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Une seule demande en attente par recette et espace cible [D81].
CREATE UNIQUE INDEX "RecipeShareRequest_pending_key" ON "RecipeShareRequest"("recipeId", "targetSpaceId") WHERE "status" = 'PENDING';
