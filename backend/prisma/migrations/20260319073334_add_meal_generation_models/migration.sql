-- CreateEnum
CREATE TYPE "FrequencyPer" AS ENUM ('PER_WEEK', 'PER_PLANNING');

-- CreateTable
CREATE TABLE "MealGenerationParams" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cooldownDays" INTEGER NOT NULL DEFAULT 3,
    "useIdeas" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MealGenerationParams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealSlotExclusion" (
    "id" TEXT NOT NULL,
    "paramsId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "mealTime" "MealTime" NOT NULL,

    CONSTRAINT "MealSlotExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealGenerationRule" (
    "id" TEXT NOT NULL,
    "paramsId" TEXT NOT NULL,
    "tagId" TEXT,
    "recipeId" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "mealTimeConstraint" "MealTime",
    "frequencyMin" INTEGER,
    "frequencyMax" INTEGER,
    "frequencyPer" "FrequencyPer",
    "tagCooldownDays" INTEGER,

    CONSTRAINT "MealGenerationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealSlotPin" (
    "id" TEXT NOT NULL,
    "paramsId" TEXT NOT NULL,
    "day" "DayOfWeek" NOT NULL,
    "mealTime" "MealTime" NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "MealSlotPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealGenerationParams_communityId_deletedAt_idx" ON "MealGenerationParams"("communityId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MealSlotExclusion_paramsId_day_mealTime_key" ON "MealSlotExclusion"("paramsId", "day", "mealTime");

-- CreateIndex
CREATE INDEX "MealGenerationRule_paramsId_idx" ON "MealGenerationRule"("paramsId");

-- CreateIndex
CREATE UNIQUE INDEX "MealSlotPin_paramsId_day_mealTime_key" ON "MealSlotPin"("paramsId", "day", "mealTime");

-- AddForeignKey
ALTER TABLE "MealGenerationParams" ADD CONSTRAINT "MealGenerationParams_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlotExclusion" ADD CONSTRAINT "MealSlotExclusion_paramsId_fkey" FOREIGN KEY ("paramsId") REFERENCES "MealGenerationParams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_paramsId_fkey" FOREIGN KEY ("paramsId") REFERENCES "MealGenerationParams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlotPin" ADD CONSTRAINT "MealSlotPin_paramsId_fkey" FOREIGN KEY ("paramsId") REFERENCES "MealGenerationParams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlotPin" ADD CONSTRAINT "MealSlotPin_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
