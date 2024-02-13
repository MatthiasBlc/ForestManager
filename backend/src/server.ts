import app from "./app";
import env from "./util/validateEnv";
import prisma from './util/db'

const port = env.PORT;



async function main() {
  await app.listen(port, () => {
    console.log(`server running on port: ${port}!`);
  })
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect())

