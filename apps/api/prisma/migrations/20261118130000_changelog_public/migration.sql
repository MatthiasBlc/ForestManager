-- Changelog public [D226] : une version n'est lisible sans connexion que si
-- l'admin l'a cochee. Les versions deja en base restent reservees aux connectes.
ALTER TABLE "ChangelogEntry" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
