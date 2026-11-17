-- C4.1 : compte admin, session isolee, journal d'audit [D128, D174].

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "totpLastStep" INTEGER;

-- Username admin unique sans casse (comme celui des utilisateurs).
CREATE UNIQUE INDEX "AdminUser_username_lower_key" ON "AdminUser"(lower("username"));

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_sid_key" ON "AdminSession"("sid");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Journal non modifiable [D128] : UPDATE et DELETE refuses ligne par ligne.
-- TRUNCATE reste possible (remise a zero des bases de test seulement).
CREATE FUNCTION "admin_audit_log_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AdminAuditLog_immutable"
  BEFORE UPDATE OR DELETE ON "AdminAuditLog"
  FOR EACH ROW EXECUTE FUNCTION "admin_audit_log_immutable"();
