import { UserCommunity, Community } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      userCommunity?: UserCommunity & {
        community: Pick<
          Community,
          "id" | "name" | "description" | "visibility" | "deletedAt"
        >;
      };
    }
  }
}

export {};
