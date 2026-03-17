-- CreateIndex
CREATE INDEX "Recipe_creatorId_communityId_deletedAt_idx" ON "Recipe"("creatorId", "communityId", "deletedAt");

-- CreateIndex
CREATE INDEX "Recipe_communityId_deletedAt_isVariant_idx" ON "Recipe"("communityId", "deletedAt", "isVariant");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");
