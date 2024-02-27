import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";


export const getCommunities: RequestHandler = async (req, res, next) => {
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);
    const community = await prisma.community.findMany({
      where: {
        communityToUsers: {
          some: {
            user: {
              is: {
                id: authenticatedUserId
              }
            },
          }
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAT: true,
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
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAT: true,
        communityToUsers: true,
      },
    })

    if (!community) {
      throw createHttpError(404, "Community not found");
    }

    if (!community.communityToUsers.filter((x) => x.userId === authenticatedUserId).length) {
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
        communityToUsers: {
          create: {
            userId: authenticatedUserId,
            role: "ADMIN",
          }
        },
      },
      include: {
        communityToUsers: true,
      },
    });
    res.status(201).json(newCommunity);

  } catch (error) {
    next(error);
  }

};


