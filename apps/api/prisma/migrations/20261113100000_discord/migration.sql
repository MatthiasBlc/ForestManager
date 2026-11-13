-- Connexion avec Discord [D202, D210] : compte relie, compte sans mot de passe.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
ALTER TABLE "User" ADD COLUMN "discordUsername" TEXT;
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
