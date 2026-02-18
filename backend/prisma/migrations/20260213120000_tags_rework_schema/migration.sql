-- CreateEnum
CREATE TYPE "TagScope" AS ENUM ('GLOBAL', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('APPROVED', 'PENDING');

-- CreateEnum
CREATE TYPE "TagSuggestionStatus" AS ENUM ('PENDING_OWNER', 'PENDING_MODERATOR', 'APPROVED', 'REJECTED');

-- AlterTable: Enrich Tag model
-- Step 1: Add columns with defaults for existing rows
ALTER TABLE "Tag" ADD COLUMN "scope" "TagScope" NOT NULL DEFAULT 'GLOBAL';
ALTER TABLE "Tag" ADD COLUMN "status" "TagStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Tag" ADD COLUMN "communityId" TEXT;
ALTER TABLE "Tag" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Tag" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Tag" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Step 2: Drop old unique constraint on name, add new compound unique
DROP INDEX "Tag_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_communityId_key" ON "Tag"("name", "communityId");

-- Partial unique index for global tags (communityId IS NULL)
-- PostgreSQL treats NULLs as distinct in regular unique constraints
CREATE UNIQUE INDEX "Tag_name_global_unique" ON "Tag"("name") WHERE "communityId" IS NULL;

-- CreateIndex
CREATE INDEX "Tag_communityId_status_idx" ON "Tag"("communityId", "status");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TagSuggestion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "suggestedById" TEXT NOT NULL,
    "status" "TagSuggestionStatus" NOT NULL DEFAULT 'PENDING_OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TagSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TagSuggestion_recipeId_tagName_suggestedById_key" ON "TagSuggestion"("recipeId", "tagName", "suggestedById");

-- CreateIndex
CREATE INDEX "TagSuggestion_recipeId_status_idx" ON "TagSuggestion"("recipeId", "status");

-- AddForeignKey
ALTER TABLE "TagSuggestion" ADD CONSTRAINT "TagSuggestion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagSuggestion" ADD CONSTRAINT "TagSuggestion_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "UserCommunityTagPreference" (
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "showTags" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCommunityTagPreference_pkey" PRIMARY KEY ("userId","communityId")
);

-- AddForeignKey
ALTER TABLE "UserCommunityTagPreference" ADD CONSTRAINT "UserCommunityTagPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCommunityTagPreference" ADD CONSTRAINT "UserCommunityTagPreference_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ModeratorNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT,
    "tagNotifications" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeratorNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModeratorNotificationPreference_userId_communityId_key" ON "ModeratorNotificationPreference"("userId", "communityId");

-- AddForeignKey
ALTER TABLE "ModeratorNotificationPreference" ADD CONSTRAINT "ModeratorNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratorNotificationPreference" ADD CONSTRAINT "ModeratorNotificationPreference_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
