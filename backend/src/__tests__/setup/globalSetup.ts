import { beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Instance Prisma pour les tests
export const testPrisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

beforeAll(async () => {
  // Connexion a la DB de test
  await testPrisma.$connect();
});

afterEach(async () => {
  // Nettoyer les donnees de test apres chaque test
  // Ordre important pour respecter les contraintes FK
  await testPrisma.$transaction([
    testPrisma.recipeIngredient.deleteMany(),
    testPrisma.recipeTag.deleteMany(),
    testPrisma.recipeView.deleteMany(),
    testPrisma.recipeAnalytics.deleteMany(),
    testPrisma.recipeUpdateProposal.deleteMany(),
    testPrisma.recipe.deleteMany(),
    testPrisma.tag.deleteMany(),
    testPrisma.ingredient.deleteMany(),
    testPrisma.activityLog.deleteMany(),
    testPrisma.communityInvite.deleteMany(),
    testPrisma.userCommunity.deleteMany(),
    testPrisma.communityFeature.deleteMany(),
    testPrisma.community.deleteMany(),
    testPrisma.feature.deleteMany(),
    testPrisma.session.deleteMany(),
    testPrisma.adminSession.deleteMany(),
    testPrisma.adminActivityLog.deleteMany(),
    testPrisma.adminUser.deleteMany(),
    testPrisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
