import { Request, Response } from 'supertest';
import bcrypt from 'bcrypt';
import { testPrisma } from './globalSetup';
import { authenticator } from 'otplib';

// Types pour les donnees de test
interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
}

interface TestAdmin {
  id: string;
  username: string;
  email: string;
  password: string;
  totpSecret: string;
}

interface TestRecipe {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  creatorId: string;
}

// =====================================
// Factories - Creer des entites de test
// =====================================

/**
 * Creer un utilisateur de test dans la DB
 */
export async function createTestUser(data?: Partial<{
  username: string;
  email: string;
  password: string;
}>): Promise<TestUser> {
  const password = data?.password ?? 'Test123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await testPrisma.user.create({
    data: {
      username: data?.username ?? `testuser_${Date.now()}`,
      email: data?.email ?? `test_${Date.now()}@example.com`,
      password: hashedPassword,
    },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    password, // Password en clair pour les tests de login
  };
}

/**
 * Creer un admin de test dans la DB avec TOTP configure
 */
export async function createTestAdmin(data?: Partial<{
  username: string;
  email: string;
  password: string;
}>): Promise<TestAdmin> {
  const password = data?.password ?? 'AdminTest123!';
  const hashedPassword = await bcrypt.hash(password, 10);
  const totpSecret = authenticator.generateSecret();

  const admin = await testPrisma.adminUser.create({
    data: {
      username: data?.username ?? `testadmin_${Date.now()}`,
      email: data?.email ?? `admin_${Date.now()}@example.com`,
      password: hashedPassword,
      totpSecret,
      totpEnabled: true,
    },
  });

  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    password, // Password en clair pour les tests de login
    totpSecret,
  };
}

/**
 * Creer un admin sans TOTP configure (premiere connexion)
 */
export async function createTestAdminWithoutTotp(data?: Partial<{
  username: string;
  email: string;
  password: string;
}>): Promise<Omit<TestAdmin, 'totpSecret'> & { totpSecret: null }> {
  const password = data?.password ?? 'AdminTest123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await testPrisma.adminUser.create({
    data: {
      username: data?.username ?? `testadmin_${Date.now()}`,
      email: data?.email ?? `admin_${Date.now()}@example.com`,
      password: hashedPassword,
      totpSecret: null,
      totpEnabled: false,
    },
  });

  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    password,
    totpSecret: null,
  };
}

/**
 * Creer une recette de test
 */
export async function createTestRecipe(
  creatorId: string,
  data?: Partial<{
    title: string;
    content: string;
    imageUrl: string | null;
    tags: string[];
    ingredients: Array<{ name: string; quantity?: string }>;
  }>
): Promise<TestRecipe> {
  const recipe = await testPrisma.recipe.create({
    data: {
      title: data?.title ?? `Test Recipe ${Date.now()}`,
      content: data?.content ?? 'Test recipe content',
      imageUrl: data?.imageUrl ?? null,
      creatorId,
      tags: data?.tags ? {
        create: data.tags.map(tagName => ({
          tag: {
            connectOrCreate: {
              where: { name: tagName.toLowerCase().trim() },
              create: { name: tagName.toLowerCase().trim() },
            },
          },
        })),
      } : undefined,
      ingredients: data?.ingredients ? {
        create: data.ingredients.map((ing, index) => ({
          order: index,
          quantity: ing.quantity ?? null,
          ingredient: {
            connectOrCreate: {
              where: { name: ing.name.toLowerCase().trim() },
              create: { name: ing.name.toLowerCase().trim() },
            },
          },
        })),
      } : undefined,
    },
  });

  return {
    id: recipe.id,
    title: recipe.title,
    content: recipe.content,
    imageUrl: recipe.imageUrl,
    creatorId: recipe.creatorId,
  };
}

/**
 * Creer un tag de test
 */
export async function createTestTag(name?: string) {
  return testPrisma.tag.create({
    data: {
      name: name ?? `tag_${Date.now()}`,
    },
  });
}

/**
 * Creer un ingredient de test
 */
export async function createTestIngredient(name?: string) {
  return testPrisma.ingredient.create({
    data: {
      name: name ?? `ingredient_${Date.now()}`,
    },
  });
}

// =====================================
// Auth Helpers
// =====================================

/**
 * Extraire le cookie de session de la reponse
 */
export function extractSessionCookie(res: Response, cookieName = 'connect.sid'): string | null {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return null;

  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const sessionCookie = cookieArray.find(c => c.startsWith(`${cookieName}=`));

  if (!sessionCookie) return null;

  // Extraire seulement la valeur du cookie
  return sessionCookie.split(';')[0];
}

/**
 * Generer un code TOTP valide pour un admin
 */
export function generateTotpCode(secret: string): string {
  return authenticator.generate(secret);
}

// =====================================
// Request Helpers
// =====================================

/**
 * Ajouter le cookie de session a une requete supertest
 */
export function withCookie(request: Request, cookie: string | null): Request {
  if (cookie) {
    return request.set('Cookie', cookie);
  }
  return request;
}
