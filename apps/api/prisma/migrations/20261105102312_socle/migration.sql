-- Extensions de recherche texte (titres, ingredients) [D72].
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "Ambiance" AS ENUM ('BRAISE', 'SOUSBOIS', 'POTAGER');

-- CreateEnum
CREATE TYPE "ColorMode" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "Density" AS ENUM ('COMFORTABLE', 'COMPACT');

-- CreateEnum
CREATE TYPE "AuthTokenKind" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'TEMP_PASSWORD');

-- CreateEnum
CREATE TYPE "SpaceKind" AS ENUM ('PERSONAL', 'GROUP');

-- CreateEnum
CREATE TYPE "SpaceRole" AS ENUM ('MEMBER', 'MODERATOR', 'OWNER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('AVAILABLE', 'BETA', 'COMING_SOON', 'RETIRED');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "avatarKey" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "ambiance" "Ambiance" NOT NULL DEFAULT 'BRAISE',
    "colorMode" "ColorMode" NOT NULL DEFAULT 'SYSTEM',
    "density" "Density" NOT NULL DEFAULT 'COMFORTABLE',
    "textScale" INTEGER NOT NULL DEFAULT 100,
    "homeWidgets" JSONB,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AuthTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "kind" "SpaceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatarKey" TEXT,
    "tintIndex" INTEGER NOT NULL DEFAULT 1,
    "personalUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "allowMembersToShare" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceInviteLink" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceInviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceInvitation" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "SpaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceOwnershipTransfer" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "SpaceOwnershipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "code" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'COMING_SOON',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "SpaceModule" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedByAdminId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledChangedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SpaceModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleAccessRequest" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "moduleCode" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "message" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByAdminId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "totpSecret" TEXT NOT NULL,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_kind_idx" ON "AuthToken"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_sid_key" ON "UserSession"("sid");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Space_personalUserId_key" ON "Space"("personalUserId");

-- CreateIndex
CREATE INDEX "Space_deletedAt_idx" ON "Space"("deletedAt");

-- CreateIndex
CREATE INDEX "Space_purgeAfter_idx" ON "Space"("purgeAfter");

-- CreateIndex
CREATE INDEX "Membership_userId_leftAt_idx" ON "Membership"("userId", "leftAt");

-- CreateIndex
CREATE INDEX "Membership_spaceId_role_idx" ON "Membership"("spaceId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_spaceId_userId_key" ON "Membership"("spaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceInviteLink_codeHash_key" ON "SpaceInviteLink"("codeHash");

-- CreateIndex
CREATE INDEX "SpaceInviteLink_spaceId_revokedAt_idx" ON "SpaceInviteLink"("spaceId", "revokedAt");

-- CreateIndex
CREATE INDEX "SpaceInvitation_inviteeId_status_idx" ON "SpaceInvitation"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "SpaceInvitation_spaceId_status_idx" ON "SpaceInvitation"("spaceId", "status");

-- CreateIndex
CREATE INDEX "SpaceOwnershipTransfer_toUserId_status_idx" ON "SpaceOwnershipTransfer"("toUserId", "status");

-- CreateIndex
CREATE INDEX "SpaceOwnershipTransfer_spaceId_status_idx" ON "SpaceOwnershipTransfer"("spaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SpaceModule_spaceId_moduleCode_key" ON "SpaceModule"("spaceId", "moduleCode");

-- CreateIndex
CREATE INDEX "ModuleAccessRequest_status_createdAt_idx" ON "ModuleAccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModuleAccessRequest_spaceId_idx" ON "ModuleAccessRequest"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_personalUserId_fkey" FOREIGN KEY ("personalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInviteLink" ADD CONSTRAINT "SpaceInviteLink_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInviteLink" ADD CONSTRAINT "SpaceInviteLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceOwnershipTransfer" ADD CONSTRAINT "SpaceOwnershipTransfer_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceOwnershipTransfer" ADD CONSTRAINT "SpaceOwnershipTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceOwnershipTransfer" ADD CONSTRAINT "SpaceOwnershipTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceModule" ADD CONSTRAINT "SpaceModule_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceModule" ADD CONSTRAINT "SpaceModule_moduleCode_fkey" FOREIGN KEY ("moduleCode") REFERENCES "Module"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceModule" ADD CONSTRAINT "SpaceModule_grantedByAdminId_fkey" FOREIGN KEY ("grantedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleAccessRequest" ADD CONSTRAINT "ModuleAccessRequest_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleAccessRequest" ADD CONSTRAINT "ModuleAccessRequest_moduleCode_fkey" FOREIGN KEY ("moduleCode") REFERENCES "Module"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleAccessRequest" ADD CONSTRAINT "ModuleAccessRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleAccessRequest" ADD CONSTRAINT "ModuleAccessRequest_decidedByAdminId_fkey" FOREIGN KEY ("decidedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Contraintes non exprimables en Prisma (voir la fin du schema cible)
-- =============================================================================

-- Username unique sans tenir compte de la casse (invitation par username exact [D07]).
CREATE UNIQUE INDEX "User_username_lower_key" ON "User"(lower("username"));

-- 1. Un seul OWNER actif par espace [D06].
CREATE UNIQUE INDEX "Membership_one_owner" ON "Membership"("spaceId")
  WHERE "role" = 'OWNER' AND "leftAt" IS NULL;

-- 2. Espace perso <=> personalUserId.
ALTER TABLE "Space" ADD CONSTRAINT "Space_personal_user_check"
  CHECK (("kind" = 'PERSONAL') = ("personalUserId" IS NOT NULL));

-- 3. Teinte entre 1 et 5 [D32].
ALTER TABLE "Space" ADD CONSTRAINT "Space_tint_check" CHECK ("tintIndex" BETWEEN 1 AND 5);

-- 4. Une invitation PENDING par (espace, invite).
CREATE UNIQUE INDEX "SpaceInvitation_one_pending" ON "SpaceInvitation"("spaceId", "inviteeId")
  WHERE "status" = 'PENDING';

-- 5. Une demande d'acces PENDING par (espace, module).
CREATE UNIQUE INDEX "ModuleAccessRequest_one_pending" ON "ModuleAccessRequest"("spaceId", "moduleCode")
  WHERE "status" = 'PENDING';

-- 13. Une proposition de transfert de propriete PENDING par espace [D92].
CREATE UNIQUE INDEX "SpaceOwnershipTransfer_one_pending" ON "SpaceOwnershipTransfer"("spaceId")
  WHERE "status" = 'PENDING';

-- Bornes simples des liens d'invitation [D94].
ALTER TABLE "SpaceInviteLink" ADD CONSTRAINT "SpaceInviteLink_uses_check"
  CHECK ("useCount" >= 0 AND ("maxUses" IS NULL OR "maxUses" >= 1));
