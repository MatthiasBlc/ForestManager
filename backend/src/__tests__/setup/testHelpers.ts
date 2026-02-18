import { Request, Response } from 'supertest';
import bcrypt from 'bcrypt';
import { testPrisma } from './globalSetup';
import { generateSecret, generateSync } from 'otplib';

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
  const totpSecret = generateSecret();

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
 * Note: totpSecret est requis par le schema, on met une valeur placeholder
 * mais totpEnabled=false indique qu'il n'est pas encore configure
 */
export async function createTestAdminWithoutTotp(data?: Partial<{
  username: string;
  email: string;
  password: string;
}>): Promise<Omit<TestAdmin, 'totpSecret'> & { totpSecret: string }> {
  const password = data?.password ?? 'AdminTest123!';
  const hashedPassword = await bcrypt.hash(password, 10);
  // Le secret sera regenere lors de la premiere connexion
  const placeholderSecret = generateSecret();

  const admin = await testPrisma.adminUser.create({
    data: {
      username: data?.username ?? `testadmin_${Date.now()}`,
      email: data?.email ?? `admin_${Date.now()}@example.com`,
      password: hashedPassword,
      totpSecret: placeholderSecret,
      totpEnabled: false,
    },
  });

  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    password,
    totpSecret: placeholderSecret,
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
    ingredients: Array<{ name: string; quantity?: number }>;
  }>
): Promise<TestRecipe> {
  // Creer/trouver les tags en amont (compound unique avec nullable ne supporte pas connectOrCreate)
  const tagIds: string[] = [];
  if (data?.tags) {
    for (const tagName of data.tags) {
      const normalized = tagName.toLowerCase().trim();
      let tag = await testPrisma.tag.findFirst({ where: { name: normalized, communityId: null } });
      if (!tag) {
        tag = await testPrisma.tag.create({ data: { name: normalized } });
      }
      tagIds.push(tag.id);
    }
  }

  const recipe = await testPrisma.recipe.create({
    data: {
      title: data?.title ?? `Test Recipe ${Date.now()}`,
      content: data?.content ?? 'Test recipe content',
      imageUrl: data?.imageUrl ?? null,
      creatorId,
      tags: tagIds.length > 0 ? {
        create: tagIds.map(tagId => ({ tagId })),
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
export async function createTestTag(
  name?: string,
  options?: Partial<{
    scope: 'GLOBAL' | 'COMMUNITY';
    status: 'APPROVED' | 'PENDING';
    communityId: string;
    createdById: string;
  }>
) {
  return testPrisma.tag.create({
    data: {
      name: name ?? `tag_${Date.now()}`,
      scope: options?.scope,
      status: options?.status,
      communityId: options?.communityId,
      createdById: options?.createdById,
    },
  });
}

/**
 * Creer un ingredient de test
 */
export async function createTestIngredient(
  name?: string,
  options?: Partial<{
    status: 'APPROVED' | 'PENDING';
    defaultUnitId: string;
    createdById: string;
  }>
) {
  return testPrisma.ingredient.create({
    data: {
      name: name ?? `ingredient_${Date.now()}`,
      status: options?.status,
      defaultUnitId: options?.defaultUnitId,
      createdById: options?.createdById,
    },
  });
}

/**
 * Creer une unite de test
 */
export async function createTestUnit(
  data?: Partial<{
    name: string;
    abbreviation: string;
    category: 'WEIGHT' | 'VOLUME' | 'SPOON' | 'COUNT' | 'QUALITATIVE';
    sortOrder: number;
  }>
) {
  const suffix = Date.now();
  return testPrisma.unit.create({
    data: {
      name: data?.name ?? `unit_${suffix}`,
      abbreviation: data?.abbreviation ?? `u${suffix}`,
      category: data?.category ?? 'WEIGHT',
      sortOrder: data?.sortOrder ?? 0,
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
  return generateSync({ secret });
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

// =====================================
// Community & Feature Factories
// =====================================

interface TestCommunity {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
}

interface TestFeature {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

/**
 * Creer une communaute de test avec un createur comme admin
 */
export async function createTestCommunity(
  creatorId: string,
  data?: Partial<{
    name: string;
    description: string;
  }>
): Promise<TestCommunity> {
  const community = await testPrisma.community.create({
    data: {
      name: data?.name ?? `Test Community ${Date.now()}`,
      description: data?.description ?? 'Test community description',
      // visibility uses default INVITE_ONLY from schema
      members: {
        create: {
          userId: creatorId,
          role: 'MODERATOR',
        },
      },
    },
  });

  return {
    id: community.id,
    name: community.name,
    description: community.description,
    visibility: community.visibility,
  };
}

interface TestInvite {
  id: string;
  communityId: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  createdAt: Date;
}

/**
 * Creer une invitation de test
 */
export async function createTestInvite(
  communityId: string,
  inviterId: string,
  inviteeId: string,
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
): Promise<TestInvite> {
  const invite = await testPrisma.communityInvite.create({
    data: {
      communityId,
      inviterId,
      inviteeId,
      status: status ?? 'PENDING',
      respondedAt: status && status !== 'PENDING' ? new Date() : null,
    },
  });

  return {
    id: invite.id,
    communityId: invite.communityId,
    inviterId: invite.inviterId,
    inviteeId: invite.inviteeId,
    status: invite.status,
    createdAt: invite.createdAt,
  };
}

/**
 * Creer une feature de test
 */
export async function createTestFeature(data?: Partial<{
  code: string;
  name: string;
  description: string;
  isDefault: boolean;
}>): Promise<TestFeature> {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const code = data?.code ?? `FEATURE_${Date.now()}_${randomSuffix}`;

  const feature = await testPrisma.feature.create({
    data: {
      code,
      name: data?.name ?? `Feature ${code}`,
      description: data?.description ?? null,
      isDefault: data?.isDefault ?? false,
    },
  });

  return {
    id: feature.id,
    code: feature.code,
    name: feature.name,
    description: feature.description,
    isDefault: feature.isDefault,
  };
}

// =====================================
// TagSuggestion Factory
// =====================================

export async function createTestTagSuggestion(
  recipeId: string,
  suggestedById: string,
  tagName: string,
  status?: 'PENDING_OWNER' | 'PENDING_MODERATOR' | 'APPROVED' | 'REJECTED'
) {
  return testPrisma.tagSuggestion.create({
    data: {
      recipeId,
      suggestedById,
      tagName: tagName.trim().toLowerCase(),
      status: status ?? 'PENDING_OWNER',
      decidedAt: status && status !== 'PENDING_OWNER' && status !== 'PENDING_MODERATOR'
        ? new Date()
        : null,
    },
  });
}

// =====================================
// Admin Login Helper
// =====================================

import supertest from 'supertest';
import app from '../../app';

/**
 * Effectuer un login complet admin (password + TOTP) et retourner le cookie de session
 */
export async function loginAsAdmin(admin: TestAdmin): Promise<string> {
  // Step 1: Login avec password
  const loginRes = await supertest(app)
    .post('/api/admin/auth/login')
    .send({
      email: admin.email,
      password: admin.password,
    });

  const sessionCookie = extractSessionCookie(loginRes, 'admin.sid');
  if (!sessionCookie) {
    throw new Error('Failed to get admin session cookie from login');
  }

  // Step 2: Verifier TOTP
  const totpCode = generateTotpCode(admin.totpSecret);
  await supertest(app)
    .post('/api/admin/auth/totp/verify')
    .set('Cookie', sessionCookie)
    .send({ code: totpCode });

  return sessionCookie;
}
