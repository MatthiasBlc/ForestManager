import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seed() {
  // Check if database already has data
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Database is empty, seeding...");

  // ===========================================
  // Seed Feature MVP (required for communities)
  // ===========================================
  const featureMvp = await prisma.feature.upsert({
    where: { code: "MVP" },
    update: {},
    create: {
      code: "MVP",
      name: "Fonctionnalites de base",
      description: "Recettes, ingredients, tags, partage communautaire",
      isDefault: true,
    },
  });
  console.log("Feature MVP created:", featureMvp.code);

  // ===========================================
  // Seed test users
  // ===========================================
  const hashedPassword = await bcrypt.hash("password123", 10);

  const user1 = await prisma.user.create({
    data: {
      username: "pizza_lover",
      email: "pizza@example.com",
      password: hashedPassword,
    },
  });
  const user2 = await prisma.user.create({
    data: {
      username: "pie_fan",
      email: "pie@example.com",
      password: hashedPassword,
    },
  });
  console.log("Test users created:", user1.username, user2.username);

  // ===========================================
  // Seed test recipes (personal catalog)
  // ===========================================
  await prisma.recipe.create({
    data: {
      title: "Pizza Margherita",
      content: "# Pizza Margherita\n\n## Ingredients\n- Pate a pizza\n- Sauce tomate\n- Mozzarella\n- Basilic frais\n\n## Instructions\n1. Etaler la pate\n2. Ajouter la sauce tomate\n3. Disposer la mozzarella\n4. Cuire 15min a 220C\n5. Ajouter le basilic frais",
      creatorId: user1.id,
    },
  });
  await prisma.recipe.create({
    data: {
      title: "Tarte aux pommes",
      content: "# Tarte aux pommes\n\n## Ingredients\n- Pate brisee\n- 4 pommes\n- 50g sucre\n- Cannelle\n\n## Instructions\n1. Etaler la pate dans un moule\n2. Eplucher et couper les pommes\n3. Disposer les pommes en rosace\n4. Saupoudrer de sucre et cannelle\n5. Cuire 35min a 180C",
      creatorId: user2.id,
    },
  });
  console.log("Test recipes created");

  console.log("Seeding complete!");
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
