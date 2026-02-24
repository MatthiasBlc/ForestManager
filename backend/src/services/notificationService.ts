import { NotificationCategory, Prisma } from "@prisma/client";
import prisma from "../util/db";
import logger from "../util/logger";

// =============================================================================
// TYPE -> CATEGORY MAPPING
// =============================================================================

const typeCategoryMap: Record<string, NotificationCategory> = {
  // Invitations
  INVITE_SENT: "INVITATION",
  INVITE_ACCEPTED: "INVITATION",
  INVITE_REJECTED: "INVITATION",
  INVITE_CANCELLED: "INVITATION",

  // Recettes & Proposals
  VARIANT_PROPOSED: "RECIPE_PROPOSAL",
  PROPOSAL_ACCEPTED: "RECIPE_PROPOSAL",
  PROPOSAL_REJECTED: "RECIPE_PROPOSAL",
  RECIPE_CREATED: "RECIPE_PROPOSAL",
  RECIPE_SHARED: "RECIPE_PROPOSAL",

  // Tags
  TAG_SUGGESTION_CREATED: "TAG",
  TAG_SUGGESTION_ACCEPTED: "TAG",
  TAG_SUGGESTION_REJECTED: "TAG",
  "tag-suggestion:pending-mod": "TAG",
  "tag:pending": "TAG",
  "tag:approved": "TAG",
  "tag:rejected": "TAG",

  // Ingredients
  INGREDIENT_APPROVED: "INGREDIENT",
  INGREDIENT_MODIFIED: "INGREDIENT",
  INGREDIENT_MERGED: "INGREDIENT",
  INGREDIENT_REJECTED: "INGREDIENT",

  // Moderation
  USER_PROMOTED: "MODERATION",
  USER_KICKED: "MODERATION",
  USER_LEFT: "MODERATION",
  USER_JOINED: "MODERATION",
};

export function getCategoryForType(type: string): NotificationCategory | null {
  return typeCategoryMap[type] ?? null;
}

// =============================================================================
// NOTIFICATION TEMPLATES
// =============================================================================

interface NotificationTemplate {
  title: string;
  message: (vars: Record<string, string>) => string;
  actionUrl: ((vars: Record<string, string>) => string) | null;
  groupKey: ((vars: Record<string, string>) => string) | null;
}

const templates: Record<string, NotificationTemplate> = {
  // --- Invitations ---
  INVITE_SENT: {
    title: "Nouvelle invitation",
    message: (v) => `${v.actorName} vous invite a rejoindre ${v.communityName}`,
    actionUrl: () => "/invitations",
    groupKey: null,
  },
  INVITE_ACCEPTED: {
    title: "Invitation acceptee",
    message: (v) => `${v.actorName} a accepte votre invitation pour ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}`,
    groupKey: null,
  },
  INVITE_REJECTED: {
    title: "Invitation refusee",
    message: (v) => `${v.actorName} a decline votre invitation pour ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}`,
    groupKey: null,
  },
  INVITE_CANCELLED: {
    title: "Invitation annulee",
    message: (v) => `L'invitation pour ${v.communityName} a ete annulee`,
    actionUrl: null,
    groupKey: null,
  },

  // --- Recettes & Proposals ---
  VARIANT_PROPOSED: {
    title: "Nouvelle proposal",
    message: (v) => `${v.actorName} propose une modification sur '${v.recipeName}'`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: null,
  },
  PROPOSAL_ACCEPTED: {
    title: "Proposal acceptee",
    message: (v) => `Votre proposal sur '${v.recipeName}' a ete acceptee`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: null,
  },
  PROPOSAL_REJECTED: {
    title: "Proposal refusee",
    message: (v) => `Votre proposal sur '${v.recipeName}' a ete refusee`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: null,
  },
  RECIPE_CREATED: {
    title: "Nouvelle recette",
    message: (v) => `${v.actorName} a cree '${v.recipeName}' dans ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: (v) => `community:${v.communityId}:RECIPE_CREATED`,
  },
  RECIPE_SHARED: {
    title: "Recette partagee",
    message: (v) => `${v.actorName} a partage '${v.recipeName}' dans ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: (v) => `community:${v.communityId}:RECIPE_SHARED`,
  },

  // --- Tags ---
  TAG_SUGGESTION_CREATED: {
    title: "Suggestion de tag",
    message: (v) => `${v.actorName} suggere le tag '${v.tagName}' sur '${v.recipeName}'`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: null,
  },
  TAG_SUGGESTION_ACCEPTED: {
    title: "Suggestion acceptee",
    message: (v) => `Votre suggestion de tag '${v.tagName}' a ete acceptee`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: null,
  },
  TAG_SUGGESTION_REJECTED: {
    title: "Suggestion refusee",
    message: (v) => `Votre suggestion de tag '${v.tagName}' a ete refusee`,
    actionUrl: (v) => `/communities/${v.communityId}/recipes/${v.recipeId}`,
    groupKey: null,
  },
  "tag-suggestion:pending-mod": {
    title: "Tag en attente",
    message: (v) => `Un tag suggere attend votre validation dans ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}/tags`,
    groupKey: null,
  },
  "tag:pending": {
    title: "Tag en attente",
    message: (v) => `Un nouveau tag attend validation dans ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}/tags`,
    groupKey: null,
  },
  "tag:approved": {
    title: "Tag valide",
    message: (v) => `Votre tag '${v.tagName}' a ete valide dans ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}`,
    groupKey: null,
  },
  "tag:rejected": {
    title: "Tag rejete",
    message: (v) => `Votre tag '${v.tagName}' a ete rejete dans ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}`,
    groupKey: null,
  },

  // --- Ingredients ---
  INGREDIENT_APPROVED: {
    title: "Ingredient valide",
    message: (v) => `Votre ingredient '${v.ingredientName}' a ete valide`,
    actionUrl: null,
    groupKey: null,
  },
  INGREDIENT_MODIFIED: {
    title: "Ingredient renomme",
    message: (v) => `Votre ingredient a ete valide sous le nom '${v.newName}'`,
    actionUrl: null,
    groupKey: null,
  },
  INGREDIENT_MERGED: {
    title: "Ingredient fusionne",
    message: (v) => `Votre ingredient '${v.ingredientName}' a ete fusionne avec '${v.targetName}'`,
    actionUrl: null,
    groupKey: null,
  },
  INGREDIENT_REJECTED: {
    title: "Ingredient rejete",
    message: (v) => `Votre ingredient '${v.ingredientName}' a ete rejete : ${v.reason}`,
    actionUrl: null,
    groupKey: null,
  },

  // --- Moderation ---
  USER_PROMOTED: {
    title: "Promotion moderateur",
    message: (v) => `Vous etes maintenant moderateur de ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}`,
    groupKey: null,
  },
  USER_KICKED: {
    title: "Exclusion",
    message: (v) => `Vous avez ete retire de ${v.communityName}`,
    actionUrl: null,
    groupKey: null,
  },
  USER_JOINED: {
    title: "Nouveau membre",
    message: (v) => `${v.actorName} a rejoint ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}`,
    groupKey: (v) => `community:${v.communityId}:USER_JOINED`,
  },
  USER_LEFT: {
    title: "Depart",
    message: (v) => `${v.actorName} a quitte ${v.communityName}`,
    actionUrl: (v) => `/communities/${v.communityId}`,
    groupKey: (v) => `community:${v.communityId}:USER_LEFT`,
  },
};

// Types de notifications toujours envoyees (ignorent les preferences)
const NON_DISABLEABLE_TYPES = new Set(["USER_KICKED", "INVITE_SENT"]);

// =============================================================================
// PREFERENCE CHECK
// =============================================================================

/**
 * Verifie si un utilisateur a la categorie de notification activee.
 * Hierarchie : pref communaute > pref globale > defaut (true).
 */
export async function isNotificationEnabled(
  userId: string,
  category: NotificationCategory,
  communityId: string | null
): Promise<boolean> {
  const whereConditions = communityId
    ? [{ userId, communityId: null, category }, { userId, communityId, category }]
    : [{ userId, communityId: null, category }];

  const prefs = await prisma.notificationPreference.findMany({
    where: { OR: whereConditions },
  });

  let globalEnabled: boolean | undefined;
  let communityEnabled: boolean | undefined;

  for (const pref of prefs) {
    if (pref.communityId === null) {
      globalEnabled = pref.enabled;
    } else {
      communityEnabled = pref.enabled;
    }
  }

  // Communaute > global > defaut (true)
  if (communityEnabled !== undefined) return communityEnabled;
  if (globalEnabled !== undefined) return globalEnabled;
  return true;
}

/**
 * Filtre un tableau d'userIds en ne gardant que ceux ayant la categorie activee.
 * Optimise : une seule requete pour tous les users.
 */
export async function filterByPreference(
  userIds: string[],
  category: NotificationCategory,
  communityId: string | null
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const whereConditions = communityId
    ? { userId: { in: userIds }, category, OR: [{ communityId: null }, { communityId }] }
    : { userId: { in: userIds }, category, communityId: null };

  const prefs = await prisma.notificationPreference.findMany({
    where: whereConditions,
  });

  // Map userId -> { global, community }
  const prefMap = new Map<string, { global?: boolean; community?: boolean }>();
  for (const pref of prefs) {
    const entry = prefMap.get(pref.userId) ?? {};
    if (pref.communityId === null) {
      entry.global = pref.enabled;
    } else {
      entry.community = pref.enabled;
    }
    prefMap.set(pref.userId, entry);
  }

  return userIds.filter((userId) => {
    const entry = prefMap.get(userId);
    if (!entry) return true;
    if (entry.community !== undefined) return entry.community;
    if (entry.global !== undefined) return entry.global;
    return true;
  });
}

// =============================================================================
// NOTIFICATION CREATION
// =============================================================================

interface CreateNotificationInput {
  userId: string;
  type: string;
  actorId: string | null;
  communityId: string | null;
  recipeId?: string | null;
  metadata?: Record<string, unknown>;
  /** Variables de template pre-resolues (actorName, communityName, etc.) */
  templateVars: Record<string, string>;
}

/**
 * Cree une notification pour un utilisateur.
 * Verifie les preferences sauf pour les types non-desactivables.
 * Retourne la notification creee ou null si desactivee par preference.
 */
export async function createNotification(
  input: CreateNotificationInput
) {
  const { userId, type, actorId, communityId, recipeId, metadata, templateVars } = input;

  const category = getCategoryForType(type);
  if (!category) {
    logger.warn({ type }, "Unknown notification type, skipping");
    return null;
  }

  const template = templates[type];
  if (!template) {
    logger.warn({ type }, "No template for notification type, skipping");
    return null;
  }

  // Verifier preferences (sauf pour les non-desactivables)
  if (!NON_DISABLEABLE_TYPES.has(type)) {
    const enabled = await isNotificationEnabled(userId, category, communityId);
    if (!enabled) return null;
  }

  const title = template.title;
  const message = template.message(templateVars);
  const actionUrl = template.actionUrl ? template.actionUrl(templateVars) : null;
  const groupKey = template.groupKey ? template.groupKey(templateVars) : null;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      category,
      title,
      message,
      actionUrl,
      metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      actorId,
      communityId,
      recipeId: recipeId ?? null,
      groupKey,
    },
  });

  return notification;
}

/**
 * Cree des notifications broadcast pour tous les membres d'une communaute (sauf l'acteur).
 * Retourne le tableau de notifications creees.
 */
export async function createBroadcastNotifications(input: {
  type: string;
  actorId: string;
  communityId: string;
  recipeId?: string | null;
  metadata?: Record<string, unknown>;
  templateVars: Record<string, string>;
}) {
  const { type, actorId, communityId, recipeId, metadata, templateVars } = input;

  const category = getCategoryForType(type);
  if (!category) {
    logger.warn({ type }, "Unknown notification type for broadcast, skipping");
    return [];
  }

  const template = templates[type];
  if (!template) {
    logger.warn({ type }, "No template for broadcast notification type, skipping");
    return [];
  }

  // Recuperer tous les membres de la communaute sauf l'acteur
  const members = await prisma.userCommunity.findMany({
    where: {
      communityId,
      deletedAt: null,
      userId: { not: actorId },
    },
    select: { userId: true },
  });

  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.userId);

  // Filtrer par preferences
  const enabledUserIds = await filterByPreference(memberIds, category, communityId);

  if (enabledUserIds.length === 0) return [];

  const title = template.title;
  const message = template.message(templateVars);
  const actionUrl = template.actionUrl ? template.actionUrl(templateVars) : null;
  const groupKey = template.groupKey ? template.groupKey(templateVars) : null;

  // Batch insert
  const data = enabledUserIds.map((userId) => ({
    userId,
    type,
    category,
    title,
    message,
    actionUrl,
    metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
    actorId,
    communityId,
    recipeId: recipeId ?? null,
    groupKey,
  }));

  await prisma.notification.createMany({ data });

  // Recuperer les notifications creees pour les retourner (createMany ne retourne pas les objets)
  const notifications = await prisma.notification.findMany({
    where: {
      type,
      communityId,
      actorId,
      userId: { in: enabledUserIds },
      createdAt: { gte: new Date(Date.now() - 5000) },
    },
    orderBy: { createdAt: "desc" },
    take: enabledUserIds.length,
  });

  return notifications;
}

// =============================================================================
// TEMPLATE VARS RESOLUTION
// =============================================================================

/**
 * Resout les variables de template a partir de l'evenement et des lookups DB.
 * Charge actorName, communityName, recipeName au besoin.
 */
export async function resolveTemplateVars(event: {
  type: string;
  userId: string;
  communityId: string | null;
  recipeId?: string;
  metadata?: Record<string, unknown>;
}): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};
  const meta = event.metadata ?? {};

  // Lookup actor
  const actor = await prisma.user.findUnique({
    where: { id: event.userId },
    select: { username: true },
  });
  vars.actorName = actor?.username ?? "Utilisateur";

  // Lookup community
  if (event.communityId) {
    vars.communityId = event.communityId;
    const community = await prisma.community.findUnique({
      where: { id: event.communityId },
      select: { name: true },
    });
    vars.communityName = community?.name ?? "Communaute";
  }

  // Lookup recipe
  if (event.recipeId) {
    vars.recipeId = event.recipeId;
    const recipe = await prisma.recipe.findUnique({
      where: { id: event.recipeId },
      select: { title: true },
    });
    vars.recipeName = recipe?.title ?? "Recette";
  }

  // Metadata passthrough pour les templates
  if (meta.tagName) vars.tagName = String(meta.tagName);
  if (meta.ingredientName) vars.ingredientName = String(meta.ingredientName);
  if (meta.newName) vars.newName = String(meta.newName);
  if (meta.targetName) vars.targetName = String(meta.targetName);
  if (meta.reason) vars.reason = String(meta.reason);

  return vars;
}

// =============================================================================
// LEGACY FUNCTION (kept for backward compatibility during migration)
// =============================================================================

/**
 * Retourne les IDs des moderateurs d'une communaute qui ont les notifications tags activees.
 * Filtre par NotificationPreference (category=TAG, global puis par communaute).
 */
export async function getModeratorIdsForTagNotification(
  communityId: string
): Promise<string[]> {
  const moderators = await prisma.userCommunity.findMany({
    where: {
      communityId,
      role: "MODERATOR",
      deletedAt: null,
    },
    select: { userId: true },
  });

  if (moderators.length === 0) return [];

  const moderatorIds = moderators.map((m) => m.userId);
  return filterByPreference(moderatorIds, "TAG", communityId);
}
