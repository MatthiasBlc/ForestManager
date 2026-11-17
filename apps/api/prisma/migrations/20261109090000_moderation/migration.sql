-- C4.5 : acces de moderation et recettes masquees [D52, D121, D122, D178].

-- CreateEnum
CREATE TYPE "ModerationReason" AS ENUM ('MEMBER_REPORT', 'OWNER_REQUEST', 'EXTERNAL_REPORT', 'OTHER');

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "hiddenAt" TIMESTAMP(3),
ADD COLUMN     "hiddenReason" TEXT;

-- CreateTable
CREATE TABLE "ModerationAccess" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "reason" "ModerationReason" NOT NULL,
    "note" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModerationAccess_adminId_spaceId_expiresAt_idx" ON "ModerationAccess"("adminId", "spaceId", "expiresAt");

-- CreateIndex
CREATE INDEX "ModerationAccess_spaceId_openedAt_idx" ON "ModerationAccess"("spaceId", "openedAt");

-- AddForeignKey
ALTER TABLE "ModerationAccess" ADD CONSTRAINT "ModerationAccess_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAccess" ADD CONSTRAINT "ModerationAccess_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
