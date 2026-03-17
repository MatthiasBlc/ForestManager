-- AlterTable: rename imageUrl -> imageKey on Recipe
ALTER TABLE "Recipe" RENAME COLUMN "imageUrl" TO "imageKey";

-- AlterTable: add imageKey on Community
ALTER TABLE "Community" ADD COLUMN "imageKey" TEXT;
