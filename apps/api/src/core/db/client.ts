// Client Prisma 7 sur le driver pg.
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client.ts";

export type Db = PrismaClient;
export { Prisma } from "../../generated/prisma/client.ts";

export function createDb(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
