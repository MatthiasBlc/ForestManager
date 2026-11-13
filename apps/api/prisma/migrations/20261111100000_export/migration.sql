-- Export de donnees (C6b.2) [D37, D192].


-- CreateEnum
CREATE TYPE "ExportScope" AS ENUM ('MY_RECIPES', 'SPACE');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('JSON', 'MARKDOWN');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "scope" "ExportScope" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "spaceId" TEXT,
    "format" "ExportFormat" NOT NULL DEFAULT 'JSON',
    "includePhotos" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "fileKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataExport_spaceId_createdAt_idx" ON "DataExport"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExport_requestedById_createdAt_idx" ON "DataExport"("requestedById", "createdAt");

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Un export d'espace porte son espace, un export de ses recettes n'en porte pas.
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_scope_check" CHECK (
  ("scope" = 'SPACE') = ("spaceId" IS NOT NULL)
);
