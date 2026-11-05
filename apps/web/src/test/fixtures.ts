// Fabriques de reponses de l'API pour MSW [D157] : chaque objet est valide contre
// le schema partage au moment de sa construction (une derive du contrat casse le test).
import {
  catalogModuleSchema,
  invitationSchema,
  memberSchema,
  meSchema,
  ownershipTransferSchema,
  spaceDetailSchema,
  spaceSummarySchema,
  type CatalogModule,
  type Invitation,
  type Me,
  type Member,
  type OwnershipTransfer,
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
