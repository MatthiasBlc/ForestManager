import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";


export const getCommunities: RequestHandler = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);
    const community = await prisma.community.findMany({
      where: {
        members: {
          some: {
            userId: authenticatedUserId,
            deletedAt: null,
          }
        },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    res.status(200).json(community);
  } catch (error) {
    next(error);
  }
};

export const getCommunity: RequestHandler = async (req, res, next) => {
  const communityId = req.params.communityId;
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);

    const community = await prisma.community.findUnique({
      where: {
        id: communityId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        members: {
          where: { deletedAt: null },
        },
      },
    })

    if (!community) {
      throw createHttpError(404, "Community not found");
    }

    if (!community.members.filter((x) => x.userId === authenticatedUserId).length) {
      throw createHttpError(401, "You cannot access this community");
    }


    res.status(200).json(community);
  } catch (error) {
    next(error);
  }
}

interface CreateCommunityBody {
  name?: string,
}

export const createCommunity: RequestHandler<unknown, unknown, CreateCommunityBody, unknown> = async (req, res, next) => {
  const name = req.body.name;
  const authenticatedUserId = req.session.userId;


  try {
    assertIsDefine(authenticatedUserId);

    if (!name) {
      throw createHttpError(400, "Community must have a name");
    }
    const newCommunity = await prisma.community.create({
      data: {
        name: name,
        members: {
          create: {
            userId: authenticatedUserId,
            role: "MODERATOR",
          }
        },
      },
      include: {
        members: true,
      },
    });
    res.status(201).json(newCommunity);

  } catch (error) {
    next(error);
  }

};


interface UpdateCommunityParams {
  communityId: string;
}

interface UpdateCommunityBody {
  name?: string,
}

export const updateCommunity: RequestHandler<UpdateCommunityParams, unknown, UpdateCommunityBody, unknown> = async (req, res, next) => {
  const communityId = req.params.communityId;
  const newName = req.body.name;
  const authenticatedUserId = req.session.userId;


  try {
    assertIsDefine(authenticatedUserId);

    if (!newName) {
      throw createHttpError(400, "Community must have a title");
    }

    try {
      const updatedCommunity = await prisma.community.update({
        where: {
          id: communityId,
          deletedAt: null,
          members: {
            some: {
              userId: authenticatedUserId,
              role: 'MODERATOR',
              deletedAt: null,
            }
          }
        },
        data: {
          name: newName,
        },
        include: {
          members: {
            where: { deletedAt: null },
          },
        }
      })
      if (!updatedCommunity) {
        throw createHttpError(404, "Community not found");
      }

      if (!updatedCommunity.members.filter((member) => member.userId === authenticatedUserId).length) {
        throw createHttpError(401, "You cannot access this community");
      }

      res.status(200).json(updatedCommunity);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2025') {
          throw createHttpError(401, "You cannot access this community");
        }
      }
      throw e;
    }

  } catch (error) {
    next(error);
  }

};
