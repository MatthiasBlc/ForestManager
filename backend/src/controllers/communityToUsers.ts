import { RequestHandler } from "express";
import prisma from "../util/db";
import createHttpError from "http-errors";
import { assertIsDefine } from "../util/assertIsDefine";


interface CreateRecipeBody {
  communityLinked: string;
  userAdded: string;

}


const getUserAdded: RequestHandler<unknown, unknown, CreateRecipeBody, unknown> = async (req, res, next) => {
  const userAdded = req.body.userAdded;

  try {
    const userAddedId = await prisma.user.findUnique({
      where: {
        username: userAdded,
      },
      select: {
        id: true,
      },
    })
    return userAddedId?.id;
  } catch (error) {
    next(error);
  }
};

const getCommunityLinkedId: RequestHandler<unknown, unknown, CreateRecipeBody, unknown> = async (req, res, next) => {
  const communityLinked = req.body.communityLinked;
  const authenticatedUserId = req.session.userId;

  try {
    const communityLinkedId = await prisma.community.findFirst({
      where: {
        name: communityLinked,
        communityToUsers: {
          some: {
            user: {
              is: {
                id: authenticatedUserId,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    })
    return communityLinkedId?.id;

  } catch (error) {
    next(error);
  }
};


export const joinCommunity: RequestHandler<unknown, unknown, CreateRecipeBody, unknown> = async (req, res, next) => {

  const userAddedId = await getUserAdded(req, res, next)
  const communityLinkedId = await getCommunityLinkedId(req, res, next)
  const authenticatedUserId = req.session.userId;

  try {
    assertIsDefine(authenticatedUserId);
    assertIsDefine(userAddedId);
    assertIsDefine(communityLinkedId);


    if (!communityLinkedId || !userAddedId) {
      throw createHttpError(400, "The user and the community must exist");
    }

    const newCommunityToUser = await prisma.communityToUser.create({
      data: {
        communityId: communityLinkedId,
        userId: userAddedId,
        role: "USER",
      },
    });
    res.status(201).json(newCommunityToUser);
  } catch (error) {
    next(error);
  }

};
