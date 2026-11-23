-- Liste de courses (C9) [D228, D231] : reglages, sections, articles et leurs parts, sources, sections favorites.
-- CreateTable
CREATE TABLE "ShoppingSettings" (
    "spaceId" TEXT NOT NULL,
    "editRole" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingSettings_pkey" PRIMARY KEY ("spaceId")
);

-- CreateTable
CREATE TABLE "ShoppingSection" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "aisleId" TEXT,

    CONSTRAINT "ShoppingSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "sectionId" TEXT,
    "ingredientId" TEXT,
    "label" TEXT,
    "productKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "checkedAt" TIMESTAMP(3),
    "checkedById" TEXT,
    "checkChangedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItemPart" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitId" TEXT,

    CONSTRAINT "ShoppingItemPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItemSource" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "mealSlotId" TEXT,
    "recipeId" TEXT,
    "recipeTitle" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealTime" "MealTime" NOT NULL,
    "parts" JSONB NOT NULL,

    CONSTRAINT "ShoppingItemSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingPlacement" (
    "spaceId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,

    CONSTRAINT "ShoppingPlacement_pkey" PRIMARY KEY ("spaceId","productKey")
);

-- CreateIndex
CREATE INDEX "ShoppingSection_spaceId_sortOrder_idx" ON "ShoppingSection"("spaceId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShoppingItem_spaceId_sectionId_sortOrder_idx" ON "ShoppingItem"("spaceId", "sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ShoppingItem_ingredientId_idx" ON "ShoppingItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingItemPart_itemId_position_key" ON "ShoppingItemPart"("itemId", "position");

-- CreateIndex
CREATE INDEX "ShoppingItemSource_itemId_idx" ON "ShoppingItemSource"("itemId");

-- CreateIndex
CREATE INDEX "ShoppingItemSource_mealSlotId_idx" ON "ShoppingItemSource"("mealSlotId");

-- CreateIndex
CREATE INDEX "ShoppingPlacement_sectionId_idx" ON "ShoppingPlacement"("sectionId");

-- AddForeignKey
ALTER TABLE "ShoppingSettings" ADD CONSTRAINT "ShoppingSettings_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingSection" ADD CONSTRAINT "ShoppingSection_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingSection" ADD CONSTRAINT "ShoppingSection_aisleId_fkey" FOREIGN KEY ("aisleId") REFERENCES "Aisle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ShoppingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemPart" ADD CONSTRAINT "ShoppingItemPart_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShoppingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemPart" ADD CONSTRAINT "ShoppingItemPart_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemSource" ADD CONSTRAINT "ShoppingItemSource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShoppingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemSource" ADD CONSTRAINT "ShoppingItemSource_mealSlotId_fkey" FOREIGN KEY ("mealSlotId") REFERENCES "MealSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItemSource" ADD CONSTRAINT "ShoppingItemSource_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingPlacement" ADD CONSTRAINT "ShoppingPlacement_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingPlacement" ADD CONSTRAINT "ShoppingPlacement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ShoppingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
