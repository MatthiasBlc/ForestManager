-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
