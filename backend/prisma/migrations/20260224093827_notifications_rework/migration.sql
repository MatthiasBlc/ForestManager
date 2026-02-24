-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('INVITATION', 'RECIPE_PROPOSAL', 'TAG', 'INGREDIENT', 'MODERATION');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "actorId" TEXT,
    "communityId" TEXT,
    "recipeId" TEXT,
    "groupKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- MigrateData: ModeratorNotificationPreference -> NotificationPreference (category = TAG)
INSERT INTO "NotificationPreference" ("id", "userId", "communityId", "category", "enabled", "updatedAt")
SELECT
    gen_random_uuid(),
    "userId",
    "communityId",
    'TAG'::"NotificationCategory",
    "tagNotifications",
    "updatedAt"
FROM "ModeratorNotificationPreference";

-- DropForeignKey
ALTER TABLE "ModeratorNotificationPreference" DROP CONSTRAINT "ModeratorNotificationPreference_communityId_fkey";

-- DropForeignKey
ALTER TABLE "ModeratorNotificationPreference" DROP CONSTRAINT "ModeratorNotificationPreference_userId_fkey";

-- AlterTable
ALTER TABLE "Ingredient" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tag" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "ModeratorNotificationPreference";

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_groupKey_createdAt_idx" ON "Notification"("userId", "groupKey", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_communityId_category_key" ON "NotificationPreference"("userId", "communityId", "category");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
