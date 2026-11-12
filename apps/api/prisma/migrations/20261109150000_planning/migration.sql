-- C5.1 : module Planning en calendrier continu [D180 a D184].
-- CreateEnum
CREATE TYPE "MealTime" AS ENUM ('LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "MealSlotKind" AS ENUM ('RECIPE', 'TEXT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FrequencyPer" AS ENUM ('PER_WEEK', 'PER_PERIOD');

-- CreateTable
CREATE TABLE "MealPlanSettings" (
    "spaceId" TEXT NOT NULL,
    "mealTimes" "MealTime"[] DEFAULT ARRAY['LUNCH', 'DINNER']::"MealTime"[],
    "defaultServings" INTEGER NOT NULL DEFAULT 4,
    "editRole" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "weekStartsOn" "Weekday" NOT NULL DEFAULT 'MON',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanSettings_pkey" PRIMARY KEY ("spaceId")
);

-- CreateTable
CREATE TABLE "MealSlot" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealTime" "MealTime" NOT NULL,
    "kind" "MealSlotKind" NOT NULL,
    "recipeId" TEXT,
    "text" TEXT,
    "comment" TEXT,
    "servings" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealIdea" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comment" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MealIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealGenerationProfile" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cooldownDays" INTEGER NOT NULL DEFAULT 3,
    "useIdeas" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MealGenerationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealSlotExclusion" (
    "profileId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "mealTime" "MealTime" NOT NULL,

    CONSTRAINT "MealSlotExclusion_pkey" PRIMARY KEY ("profileId","weekday","mealTime")
);

-- CreateTable
CREATE TABLE "MealGenerationRule" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "tagId" TEXT,
    "recipeId" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "mealTime" "MealTime",
    "frequencyMin" INTEGER,
    "frequencyMax" INTEGER,
    "frequencyPer" "FrequencyPer",
    "tagCooldownDays" INTEGER,

    CONSTRAINT "MealGenerationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealSlotPin" (
    "profileId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "mealTime" "MealTime" NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "MealSlotPin_pkey" PRIMARY KEY ("profileId","weekday","mealTime")
);

-- CreateIndex
CREATE INDEX "MealSlot_recipeId_date_idx" ON "MealSlot"("recipeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MealSlot_spaceId_date_mealTime_key" ON "MealSlot"("spaceId", "date", "mealTime");

-- CreateIndex
CREATE INDEX "MealIdea_spaceId_deletedAt_idx" ON "MealIdea"("spaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "MealGenerationProfile_spaceId_deletedAt_idx" ON "MealGenerationProfile"("spaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "MealGenerationRule_profileId_idx" ON "MealGenerationRule"("profileId");

-- AddForeignKey
ALTER TABLE "MealPlanSettings" ADD CONSTRAINT "MealPlanSettings_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIdea" ADD CONSTRAINT "MealIdea_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIdea" ADD CONSTRAINT "MealIdea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGenerationProfile" ADD CONSTRAINT "MealGenerationProfile_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlotExclusion" ADD CONSTRAINT "MealSlotExclusion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MealGenerationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MealGenerationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlotPin" ADD CONSTRAINT "MealSlotPin_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MealGenerationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlotPin" ADD CONSTRAINT "MealSlotPin_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Contraintes metier (hors Prisma)

-- Regle : un tag OU une recette, jamais les deux ; poids de 0 a 2 [D184].
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_target_check"
  CHECK (("tagId" IS NULL) <> ("recipeId" IS NULL));
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_weight_check"
  CHECK ("weight" >= 0 AND "weight" <= 2);

-- Repas : un texte pour TEXT, rien pour SKIPPED [D181] (RECIPE garde son dernier titre).
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_kind_check" CHECK (
  ("kind" = 'TEXT' AND "text" IS NOT NULL AND "recipeId" IS NULL)
  OR ("kind" = 'SKIPPED' AND "recipeId" IS NULL AND NOT "locked")
  OR ("kind" = 'RECIPE' AND "text" IS NOT NULL)
);

-- Un seul profil par defaut vivant par espace [D183].
CREATE UNIQUE INDEX "MealGenerationProfile_default_key" ON "MealGenerationProfile"("spaceId")
  WHERE "isDefault" AND "deletedAt" IS NULL;
