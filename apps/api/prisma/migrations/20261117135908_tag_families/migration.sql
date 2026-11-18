-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "familyId" TEXT;

-- CreateTable
CREATE TABLE "TagFamily" (
    "id" TEXT NOT NULL,
    "scope" "TagScope" NOT NULL,
    "spaceId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagFamilyTranslation" (
    "familyId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TagFamilyTranslation_pkey" PRIMARY KEY ("familyId","locale")
);

-- CreateIndex
CREATE INDEX "TagFamily_scope_spaceId_sortOrder_idx" ON "TagFamily"("scope", "spaceId", "sortOrder");

-- CreateIndex
CREATE INDEX "Tag_familyId_idx" ON "Tag"("familyId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "TagFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagFamily" ADD CONSTRAINT "TagFamily_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagFamilyTranslation" ADD CONSTRAINT "TagFamilyTranslation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "TagFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
