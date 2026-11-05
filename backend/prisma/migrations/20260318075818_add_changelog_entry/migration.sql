-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminActionType" ADD VALUE 'CHANGELOG_CREATED';
ALTER TYPE "AdminActionType" ADD VALUE 'CHANGELOG_UPDATED';
ALTER TYPE "AdminActionType" ADD VALUE 'CHANGELOG_DELETED';

-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangelogEntry_version_key" ON "ChangelogEntry"("version");

-- CreateIndex
CREATE INDEX "ChangelogEntry_publishedAt_idx" ON "ChangelogEntry"("publishedAt");

-- CreateIndex
CREATE INDEX "ChangelogEntry_deletedAt_idx" ON "ChangelogEntry"("deletedAt");
