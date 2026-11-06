// Fabriques de reponses de l'API pour MSW [D157] : chaque objet est valide contre
// le schema partage au moment de sa construction (une derive du contrat casse le test).
import {
  catalogModuleSchema,
  invitationSchema,
  memberSchema,
  meSchema,
  ownershipTransferSchema,
  recipeRevisionSchema,
  recipeSchema,
  recipeSummarySchema,
  spaceDetailSchema,
  spaceSummarySchema,
  type CatalogModule,
  type Invitation,
  type Me,
  type Member,
  type OwnershipTransfer,
  type Recipe,
  type RecipeRevision,
  type RecipeSummary,
  type Unit,
  type SpaceDetail,
  type SpaceSummary,
} from "@fm/shared";
import type { z } from "zod";

let seq = 0;
/** UUID v4 deterministe pour les tests. */
export function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${seq.toString(16).padStart(12, "0")}`;
}

function valid<S extends z.ZodType>(schema: S, data: z.input<S>): z.output<S> {
  return schema.parse(data);
}

const NOW = "2026-11-05T10:00:00.000Z";

export function buildMe(over: Partial<Me> = {}): Me {
  return valid(meSchema, {
    id: uuid(),
    email: "matthias@exemple.fr",
    username: "matthias",
    emailVerified: true,
    avatarUrl: null,
    personalSpaceId: uuid(),
    preferences: {
      ambiance: "BRAISE",
      colorMode: "DARK",
      density: "COMFORTABLE",
      textScale: 100,
      locale: "fr",
    },
    createdAt: NOW,
    ...over,
  });
}

export function buildSpace(over: Partial<SpaceSummary> = {}): SpaceSummary {
  return valid(spaceSummarySchema, {
    id: uuid(),
    kind: "GROUP",
    name: "Famille",
    description: null,
    tintIndex: 1,
    avatarUrl: null,
    myRole: "OWNER",
    memberCount: 6,
    createdAt: NOW,
    deletedAt: null,
    purgeAfter: null,
    ...over,
  });
}

export function buildSpaceDetail(over: Partial<SpaceDetail> = {}): SpaceDetail {
  return valid(spaceDetailSchema, {
    ...buildSpace(over),
    modules: [{ code: "recipes", sortOrder: 0 }],
    ...over,
  });
}

/** Espace perso d'un utilisateur. */
export function buildPersonalSpace(me: Me, over: Partial<SpaceDetail> = {}): SpaceDetail {
  return buildSpaceDetail({
    id: me.personalSpaceId,
    kind: "PERSONAL",
    name: me.username,
    memberCount: 1,
    ...over,
  });
}

export function buildMember(over: Partial<Member> = {}): Member {
  return valid(memberSchema, {
    user: { id: uuid(), username: "lea", avatarUrl: null },
    role: "MEMBER",
    joinedAt: NOW,
    ...over,
  });
}

export function buildInvitation(over: Partial<Invitation> = {}): Invitation {
  return valid(invitationSchema, {
    id: uuid(),
    space: { id: uuid(), name: "Famille", tintIndex: 1, avatarUrl: null },
    inviter: { id: uuid(), username: "lea", avatarUrl: null },
    invitee: { id: uuid(), username: "matthias", avatarUrl: null },
    status: "PENDING",
    createdAt: NOW,
    respondedAt: null,
    ...over,
  });
}

export function buildTransfer(over: Partial<OwnershipTransfer> = {}): OwnershipTransfer {
  return valid(ownershipTransferSchema, {
    id: uuid(),
    spaceId: uuid(),
    fromUser: { id: uuid(), username: "lea", avatarUrl: null },
    toUser: { id: uuid(), username: "matthias", avatarUrl: null },
    status: "PENDING",
    createdAt: NOW,
    respondedAt: null,
    ...over,
  });
}

export function buildCatalogModule(over: Partial<CatalogModule> = {}): CatalogModule {
  return valid(catalogModuleSchema, {
    code: "recipes",
    status: "AVAILABLE",
    isDefault: true,
    granted: true,
    enabled: true,
    sortOrder: 0,
    lastRequest: null,
    ...over,
  });
}

/** Unites du seed (sous-ensemble) avec des identifiants fixes. */
export const UNITS: Unit[] = [
  { code: "g", dimension: "MASS", toBase: 1, metric: true, name: "gramme", abbreviation: "g" },
  {
    code: "kg",
    dimension: "MASS",
    toBase: 1000,
    metric: true,
    name: "kilogramme",
    abbreviation: "kg",
  },
  {
    code: "ml",
    dimension: "VOLUME",
    toBase: 1,
    metric: true,
    name: "millilitre",
    abbreviation: "ml",
  },
  {
    code: "tbsp",
    dimension: "VOLUME",
    toBase: 15,
    metric: false,
    name: "cuillère à soupe",
    abbreviation: "c. à soupe",
  },
  {
    code: "piece",
    dimension: "COUNT",
    toBase: null,
    metric: false,
    name: "pièce",
    abbreviation: "pièce",
  },
  {
    code: "to-taste",
    dimension: "NONE",
    toBase: null,
    metric: false,
    name: "à goût",
    abbreviation: "à goût",
  },
].map((unit, index) => ({
  ...unit,
  dimension: unit.dimension as Unit["dimension"],
  namePlural: null,
  id: `00000000-0000-4000-8000-0000000a${index.toString(16).padStart(4, "0")}`,
}));

export function unitId(code: string): string {
  const unit = UNITS.find((u) => u.code === code);
  if (!unit) throw new Error(`unknown unit ${code}`);
  return unit.id;
}

export type RecipeOverrides = Partial<Omit<Recipe, "can">> & { can?: Partial<Recipe["can"]> };

export function buildRecipe({ can, ...over }: RecipeOverrides = {}): Recipe {
  const homeSpaceId = over.homeSpaceId ?? uuid();
  return valid(recipeSchema, {
    id: uuid(),
    homeSpaceId,
    homeSpace: { id: homeSpaceId, name: "Foyer" },
    shareCount: 0,
    sharedIn: [],
    title: "Gratin de pâtes",
    imageUrl: null,
    yieldQuantity: 4,
    yieldUnitId: null,
    totalMinutes: 45,
    isBase: false,
    author: { id: uuid(), username: "lea", avatarUrl: null },
    tags: [],
    updatedAt: NOW,
    description: null,
    notes: null,
    sourceUrl: null,
    prepMinutes: 15,
    cookMinutes: 30,
    restMinutes: null,
    currentRevision: 1,
    createdAt: NOW,
    usedBy: 0,
    blocks: [
      {
        kind: "LOCAL",
        title: null,
        ingredients: [
          {
            ingredientId: uuid(),
            name: "Pâtes",
            namePlural: null,
            quantity: 500,
            unitId: unitId("g"),
            note: null,
            optional: false,
          },
          {
            ingredientId: uuid(),
            name: "Sel",
            namePlural: null,
            quantity: null,
            unitId: unitId("to-taste"),
            note: null,
            optional: false,
          },
        ],
        steps: ["Cuire les pâtes.", "Gratiner 20 min."],
      },
    ],
    ...over,
    can: { edit: true, delete: true, share: true, removeFromSpace: false, ...can },
  });
}

export function toSummary(recipe: Recipe): RecipeSummary {
  return valid(recipeSummarySchema, { ...recipe, isComposed: false });
}

export function buildRevision(over: Partial<RecipeRevision> = {}): RecipeRevision {
  return valid(recipeRevisionSchema, {
    number: 1,
    source: "CREATE",
    author: { id: uuid(), username: "lea", avatarUrl: null },
    createdAt: NOW,
    changes: [],
    ...over,
  });
}
