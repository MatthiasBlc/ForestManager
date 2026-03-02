import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seed() {
  // ===========================================
  // Units (always upsert - idempotent)
  // ===========================================
  const unitData = [
    { name: "gramme", abbreviation: "g", category: "WEIGHT", sortOrder: 1 },
    { name: "kilogramme", abbreviation: "kg", category: "WEIGHT", sortOrder: 2 },
    { name: "millilitre", abbreviation: "ml", category: "VOLUME", sortOrder: 1 },
    { name: "centilitre", abbreviation: "cl", category: "VOLUME", sortOrder: 2 },
    { name: "decilitre", abbreviation: "dl", category: "VOLUME", sortOrder: 3 },
    { name: "litre", abbreviation: "l", category: "VOLUME", sortOrder: 4 },
    { name: "cuillere a cafe", abbreviation: "cac", category: "SPOON", sortOrder: 1 },
    { name: "cuillere a soupe", abbreviation: "cas", category: "SPOON", sortOrder: 2 },
    { name: "piece", abbreviation: "pc", category: "COUNT", sortOrder: 1 },
    { name: "tranche", abbreviation: "tr", category: "COUNT", sortOrder: 2 },
    { name: "gousse", abbreviation: "gse", category: "COUNT", sortOrder: 3 },
    { name: "botte", abbreviation: "bte", category: "COUNT", sortOrder: 4 },
    { name: "feuille", abbreviation: "fle", category: "COUNT", sortOrder: 5 },
    { name: "brin", abbreviation: "brn", category: "COUNT", sortOrder: 6 },
    { name: "pincee", abbreviation: "pincee", category: "QUALITATIVE", sortOrder: 1 },
    { name: "a gout", abbreviation: "a gout", category: "QUALITATIVE", sortOrder: 2 },
    { name: "selon besoin", abbreviation: "selon besoin", category: "QUALITATIVE", sortOrder: 3 },
  ];

  const units = {};
  for (const unit of unitData) {
    units[unit.abbreviation] = await prisma.unit.upsert({
      where: { name: unit.name },
      update: { abbreviation: unit.abbreviation, category: unit.category, sortOrder: unit.sortOrder },
      create: unit,
    });
  }
  console.log("Units seeded:", unitData.length);

  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log("Database already seeded (users exist), skipping rest...");
    return;
  }

  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("password123", 10);

  // ===========================================
  // Feature MVP
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
  console.log("Feature MVP:", featureMvp.code);

  // ===========================================
  // Users
  // ===========================================
  const alice = await prisma.user.create({
    data: { username: "alice_chef", email: "alice@example.com", password: hashedPassword },
  });
  const bob = await prisma.user.create({
    data: { username: "bob_boulanger", email: "bob@example.com", password: hashedPassword },
  });
  const charlie = await prisma.user.create({
    data: { username: "charlie_cook", email: "charlie@example.com", password: hashedPassword },
  });
  const diana = await prisma.user.create({
    data: { username: "diana_patissiere", email: "diana@example.com", password: hashedPassword },
  });
  const eve = await prisma.user.create({
    data: { username: "eve_gourmet", email: "eve@example.com", password: hashedPassword },
  });
  console.log("Users created: 5");

  // ===========================================
  // Tags
  // ===========================================
  const tagNames = [
    "italien", "francais", "asiatique", "mexicain",
    "vegetarien", "vegan", "sans-gluten",
    "dessert", "entree", "plat-principal", "aperitif",
    "rapide", "facile", "gastronomique",
    "ete", "hiver", "comfort-food",
  ];
  const tags = {};
  for (const name of tagNames) {
    tags[name] = await prisma.tag.create({ data: { name } });
  }
  console.log("Tags created:", tagNames.length);

  // ===========================================
  // Ingredients
  // ===========================================
  const ingredientNames = [
    "farine", "beurre", "oeufs", "sucre", "sel", "poivre",
    "huile d'olive", "ail", "oignon", "tomate",
    "mozzarella", "parmesan", "creme fraiche", "lait",
    "poulet", "boeuf", "saumon",
    "riz", "pates", "pomme de terre",
    "carotte", "courgette", "aubergine", "poivron",
    "basilic", "thym", "romarin", "persil", "coriandre",
    "citron", "pomme", "chocolat", "vanille",
    "sauce soja", "gingembre", "piment",
  ];
  const ingredients = {};
  for (const name of ingredientNames) {
    ingredients[name] = await prisma.ingredient.create({ data: { name } });
  }
  console.log("Ingredients created:", ingredientNames.length);

  // ===========================================
  // Communities
  // ===========================================
  const cuisineItalienne = await prisma.community.create({
    data: { name: "Cuisine Italienne", description: "Partagez vos meilleures recettes italiennes : pates, pizzas, risottos et plus encore !" },
  });
  const patisserieFine = await prisma.community.create({
    data: { name: "Patisserie Fine", description: "Pour les amateurs de patisserie, du classique au creatif." },
  });
  const cuisineRapide = await prisma.community.create({
    data: { name: "Cuisine Rapide & Facile", description: "Des recettes simples pour le quotidien, prets en moins de 30 minutes." },
  });
  console.log("Communities created: 3");

  // Grant MVP feature to all communities
  for (const community of [cuisineItalienne, patisserieFine, cuisineRapide]) {
    await prisma.communityFeature.create({
      data: { communityId: community.id, featureId: featureMvp.id },
    });
  }

  // ===========================================
  // Members
  // ===========================================
  // Cuisine Italienne: alice (mod), bob (mod), charlie (member), eve (member)
  await prisma.userCommunity.create({
    data: { userId: alice.id, communityId: cuisineItalienne.id, role: "MODERATOR" },
  });
  await prisma.userCommunity.create({
    data: { userId: bob.id, communityId: cuisineItalienne.id, role: "MODERATOR" },
  });
  await prisma.userCommunity.create({
    data: { userId: charlie.id, communityId: cuisineItalienne.id, role: "MEMBER" },
  });
  await prisma.userCommunity.create({
    data: { userId: eve.id, communityId: cuisineItalienne.id, role: "MEMBER" },
  });

  // Patisserie Fine: diana (mod), alice (member), eve (member)
  await prisma.userCommunity.create({
    data: { userId: diana.id, communityId: patisserieFine.id, role: "MODERATOR" },
  });
  await prisma.userCommunity.create({
    data: { userId: alice.id, communityId: patisserieFine.id, role: "MEMBER" },
  });
  await prisma.userCommunity.create({
    data: { userId: eve.id, communityId: patisserieFine.id, role: "MEMBER" },
  });

  // Cuisine Rapide: charlie (mod), bob (member)
  await prisma.userCommunity.create({
    data: { userId: charlie.id, communityId: cuisineRapide.id, role: "MODERATOR" },
  });
  await prisma.userCommunity.create({
    data: { userId: bob.id, communityId: cuisineRapide.id, role: "MEMBER" },
  });
  console.log("Members assigned to communities");

  // ===========================================
  // Invitations
  // ===========================================
  // Pending: diana invited to Cuisine Italienne by alice
  await prisma.communityInvite.create({
    data: {
      communityId: cuisineItalienne.id,
      inviterId: alice.id,
      inviteeId: diana.id,
      status: "PENDING",
    },
  });
  // Pending: bob invited to Patisserie Fine by diana
  await prisma.communityInvite.create({
    data: {
      communityId: patisserieFine.id,
      inviterId: diana.id,
      inviteeId: bob.id,
      status: "PENDING",
    },
  });
  // Accepted: charlie joined Cuisine Italienne (historical)
  await prisma.communityInvite.create({
    data: {
      communityId: cuisineItalienne.id,
      inviterId: alice.id,
      inviteeId: charlie.id,
      status: "ACCEPTED",
      respondedAt: new Date(),
    },
  });
  console.log("Invitations created");

  // ===========================================
  // Recipes (personal catalog with proper tags & ingredients)
  // ===========================================

  // --- Alice's recipes ---
  const pizzaMargherita = await prisma.recipe.create({
    data: {
      title: "Pizza Margherita",
      servings: 4,
      prepTime: 30,
      cookTime: 10,
      restTime: 60,
      creatorId: alice.id,
      steps: {
        create: [
          { order: 0, instruction: "Melanger la farine, le sel et la levure. Ajouter l'eau tiede et petrir 10 minutes jusqu'a obtenir une pate lisse et elastique." },
          { order: 1, instruction: "Laisser reposer la pate 1h sous un linge humide." },
          { order: 2, instruction: "Etaler la pate finement sur un plan farine." },
          { order: 3, instruction: "Napper de sauce tomate, disposer la mozzarella en morceaux et arroser d'un filet d'huile d'olive." },
          { order: 4, instruction: "Cuire au four a 250C pendant 8-10 minutes. Ajouter le basilic frais et une pincee de sel a la sortie du four." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: pizzaMargherita.id, tagId: tags["italien"].id },
      { recipeId: pizzaMargherita.id, tagId: tags["facile"].id },
      { recipeId: pizzaMargherita.id, tagId: tags["plat-principal"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: pizzaMargherita.id, ingredientId: ingredients["farine"].id, quantity: 300, unitId: units["g"].id, order: 1 },
      { recipeId: pizzaMargherita.id, ingredientId: ingredients["tomate"].id, quantity: 200, unitId: units["g"].id, order: 2 },
      { recipeId: pizzaMargherita.id, ingredientId: ingredients["mozzarella"].id, quantity: 200, unitId: units["g"].id, order: 3 },
      { recipeId: pizzaMargherita.id, ingredientId: ingredients["basilic"].id, quantity: 5, unitId: units["fle"].id, order: 4 },
      { recipeId: pizzaMargherita.id, ingredientId: ingredients["huile d'olive"].id, quantity: 2, unitId: units["cas"].id, order: 5 },
      { recipeId: pizzaMargherita.id, ingredientId: ingredients["sel"].id, quantity: 1, unitId: units["pincee"].id, order: 6 },
    ],
  });

  const risottoChampignons = await prisma.recipe.create({
    data: {
      title: "Risotto aux champignons",
      servings: 4,
      prepTime: 15,
      cookTime: 30,
      creatorId: alice.id,
      steps: {
        create: [
          { order: 0, instruction: "Faire revenir l'oignon emince dans le beurre a feu moyen jusqu'a ce qu'il soit translucide." },
          { order: 1, instruction: "Ajouter le riz et nacrer 2 minutes en remuant." },
          { order: 2, instruction: "Deglacer au vin blanc et laisser absorber." },
          { order: 3, instruction: "Ajouter le bouillon louche par louche en remuant regulierement. A mi-cuisson, ajouter les champignons sautes." },
          { order: 4, instruction: "Terminer avec le parmesan rape et une noix de beurre. Servir immediatement." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: risottoChampignons.id, tagId: tags["italien"].id },
      { recipeId: risottoChampignons.id, tagId: tags["plat-principal"].id },
      { recipeId: risottoChampignons.id, tagId: tags["vegetarien"].id },
      { recipeId: risottoChampignons.id, tagId: tags["comfort-food"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: risottoChampignons.id, ingredientId: ingredients["riz"].id, quantity: 300, unitId: units["g"].id, order: 1 },
      { recipeId: risottoChampignons.id, ingredientId: ingredients["oignon"].id, quantity: 1, unitId: units["pc"].id, order: 2 },
      { recipeId: risottoChampignons.id, ingredientId: ingredients["beurre"].id, quantity: 50, unitId: units["g"].id, order: 3 },
      { recipeId: risottoChampignons.id, ingredientId: ingredients["parmesan"].id, quantity: 80, unitId: units["g"].id, order: 4 },
    ],
  });

  const saladeCaprese = await prisma.recipe.create({
    data: {
      title: "Salade Caprese",
      servings: 2,
      prepTime: 10,
      creatorId: alice.id,
      steps: {
        create: [
          { order: 0, instruction: "Couper les tomates et la mozzarella en tranches regulieres." },
          { order: 1, instruction: "Alterner les tranches de tomates et de mozzarella dans un plat de service." },
          { order: 2, instruction: "Parsemer de feuilles de basilic frais, arroser d'huile d'olive, saler et poivrer. Servir frais." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: saladeCaprese.id, tagId: tags["italien"].id },
      { recipeId: saladeCaprese.id, tagId: tags["entree"].id },
      { recipeId: saladeCaprese.id, tagId: tags["rapide"].id },
      { recipeId: saladeCaprese.id, tagId: tags["ete"].id },
      { recipeId: saladeCaprese.id, tagId: tags["vegetarien"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: saladeCaprese.id, ingredientId: ingredients["tomate"].id, quantity: 4, unitId: units["pc"].id, order: 1 },
      { recipeId: saladeCaprese.id, ingredientId: ingredients["mozzarella"].id, quantity: 250, unitId: units["g"].id, order: 2 },
      { recipeId: saladeCaprese.id, ingredientId: ingredients["basilic"].id, quantity: 1, unitId: units["bte"].id, order: 3 },
      { recipeId: saladeCaprese.id, ingredientId: ingredients["huile d'olive"].id, quantity: 3, unitId: units["cas"].id, order: 4 },
    ],
  });

  // --- Bob's recipes ---
  const painMaison = await prisma.recipe.create({
    data: {
      title: "Pain maison",
      servings: 6,
      prepTime: 20,
      cookTime: 25,
      restTime: 90,
      creatorId: bob.id,
      steps: {
        create: [
          { order: 0, instruction: "Melanger la farine, le sel et la levure dans un grand saladier." },
          { order: 1, instruction: "Ajouter l'eau tiede et petrir 10 minutes jusqu'a obtenir une pate souple." },
          { order: 2, instruction: "Couvrir d'un linge et laisser lever 1h a temperature ambiante." },
          { order: 3, instruction: "Degazer, faconner le pain et laisser lever encore 30 minutes." },
          { order: 4, instruction: "Cuire a 230C pendant 25 minutes avec un bol d'eau dans le four pour une belle croute." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: painMaison.id, tagId: tags["francais"].id },
      { recipeId: painMaison.id, tagId: tags["facile"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: painMaison.id, ingredientId: ingredients["farine"].id, quantity: 500, unitId: units["g"].id, order: 1 },
      { recipeId: painMaison.id, ingredientId: ingredients["sel"].id, quantity: 10, unitId: units["g"].id, order: 2 },
    ],
  });

  const quicheLorraine = await prisma.recipe.create({
    data: {
      title: "Quiche Lorraine",
      servings: 6,
      prepTime: 20,
      cookTime: 35,
      creatorId: bob.id,
      steps: {
        create: [
          { order: 0, instruction: "Etaler la pate brisee dans un moule a tarte beurre." },
          { order: 1, instruction: "Faire revenir les lardons a la poele sans matiere grasse." },
          { order: 2, instruction: "Battre les oeufs avec la creme fraiche et le lait. Saler, poivrer, ajouter une pincee de muscade." },
          { order: 3, instruction: "Disposer les lardons sur le fond de tarte, verser l'appareil par-dessus." },
          { order: 4, instruction: "Cuire 35 minutes a 180C jusqu'a ce que la quiche soit bien doree." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: quicheLorraine.id, tagId: tags["francais"].id },
      { recipeId: quicheLorraine.id, tagId: tags["plat-principal"].id },
      { recipeId: quicheLorraine.id, tagId: tags["comfort-food"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: quicheLorraine.id, ingredientId: ingredients["oeufs"].id, quantity: 4, unitId: units["pc"].id, order: 1 },
      { recipeId: quicheLorraine.id, ingredientId: ingredients["creme fraiche"].id, quantity: 20, unitId: units["cl"].id, order: 2 },
      { recipeId: quicheLorraine.id, ingredientId: ingredients["lait"].id, quantity: 10, unitId: units["cl"].id, order: 3 },
      { recipeId: quicheLorraine.id, ingredientId: ingredients["farine"].id, quantity: 250, unitId: units["g"].id, order: 4 },
      { recipeId: quicheLorraine.id, ingredientId: ingredients["beurre"].id, quantity: 125, unitId: units["g"].id, order: 5 },
    ],
  });

  // --- Charlie's recipes ---
  const padThai = await prisma.recipe.create({
    data: {
      title: "Pad Thai express",
      servings: 2,
      prepTime: 10,
      cookTime: 10,
      creatorId: charlie.id,
      steps: {
        create: [
          { order: 0, instruction: "Faire tremper les nouilles de riz dans l'eau chaude selon les instructions du paquet." },
          { order: 1, instruction: "Faire sauter le poulet emince avec l'ail et le gingembre dans un wok bien chaud." },
          { order: 2, instruction: "Ajouter les nouilles egouttees, la sauce soja, le jus de citron et le sucre. Bien melanger." },
          { order: 3, instruction: "Servir avec cacahuetes concassees et coriandre fraiche." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: padThai.id, tagId: tags["asiatique"].id },
      { recipeId: padThai.id, tagId: tags["rapide"].id },
      { recipeId: padThai.id, tagId: tags["plat-principal"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: padThai.id, ingredientId: ingredients["poulet"].id, quantity: 200, unitId: units["g"].id, order: 1 },
      { recipeId: padThai.id, ingredientId: ingredients["riz"].id, quantity: 200, unitId: units["g"].id, order: 2 },
      { recipeId: padThai.id, ingredientId: ingredients["sauce soja"].id, quantity: 3, unitId: units["cas"].id, order: 3 },
      { recipeId: padThai.id, ingredientId: ingredients["citron"].id, quantity: 2, unitId: units["pc"].id, order: 4 },
      { recipeId: padThai.id, ingredientId: ingredients["ail"].id, quantity: 3, unitId: units["gse"].id, order: 5 },
      { recipeId: padThai.id, ingredientId: ingredients["gingembre"].id, quantity: 2, unitId: units["pc"].id, order: 6 },
      { recipeId: padThai.id, ingredientId: ingredients["coriandre"].id, quantity: 1, unitId: units["bte"].id, order: 7 },
    ],
  });

  const ratatouilleExpress = await prisma.recipe.create({
    data: {
      title: "Ratatouille express",
      servings: 4,
      prepTime: 15,
      cookTime: 25,
      creatorId: charlie.id,
      steps: {
        create: [
          { order: 0, instruction: "Couper tous les legumes en des de taille reguliere." },
          { order: 1, instruction: "Faire revenir l'oignon et l'ail dans l'huile d'olive a feu moyen." },
          { order: 2, instruction: "Ajouter l'aubergine et le poivron, cuire 5 minutes en remuant." },
          { order: 3, instruction: "Ajouter la courgette et la tomate. Assaisonner avec le thym et le romarin." },
          { order: 4, instruction: "Laisser mijoter 20 minutes a feu doux. Rectifier l'assaisonnement avant de servir." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: ratatouilleExpress.id, tagId: tags["francais"].id },
      { recipeId: ratatouilleExpress.id, tagId: tags["vegetarien"].id },
      { recipeId: ratatouilleExpress.id, tagId: tags["vegan"].id },
      { recipeId: ratatouilleExpress.id, tagId: tags["rapide"].id },
      { recipeId: ratatouilleExpress.id, tagId: tags["ete"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["aubergine"].id, quantity: 1, unitId: units["pc"].id, order: 1 },
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["courgette"].id, quantity: 2, unitId: units["pc"].id, order: 2 },
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["poivron"].id, quantity: 2, unitId: units["pc"].id, order: 3 },
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["tomate"].id, quantity: 4, unitId: units["pc"].id, order: 4 },
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["oignon"].id, quantity: 1, unitId: units["pc"].id, order: 5 },
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["ail"].id, quantity: 3, unitId: units["gse"].id, order: 6 },
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["thym"].id, quantity: 2, unitId: units["brn"].id, order: 7 },
      { recipeId: ratatouilleExpress.id, ingredientId: ingredients["huile d'olive"].id, quantity: 3, unitId: units["cas"].id, order: 8 },
    ],
  });

  // --- Diana's recipes ---
  const tarteAuCitron = await prisma.recipe.create({
    data: {
      title: "Tarte au citron meringuee",
      servings: 8,
      prepTime: 40,
      cookTime: 30,
      restTime: 120,
      creatorId: diana.id,
      steps: {
        create: [
          { order: 0, instruction: "Preparer la pate sucree : melanger farine, beurre pommade, sucre et oeuf. Fraiser et filmer, refrigerer 30 minutes." },
          { order: 1, instruction: "Etaler la pate, foncer le moule et cuire a blanc 15 minutes a 180C." },
          { order: 2, instruction: "Preparer la creme citron : chauffer au bain-marie le jus de citron, le sucre, les oeufs et le beurre en remuant jusqu'a epaississement." },
          { order: 3, instruction: "Verser la creme citron sur le fond de tarte. Laisser refroidir completement." },
          { order: 4, instruction: "Monter les blancs en neige ferme avec le sucre, dresser a la poche sur la tarte et carameliser au chalumeau." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: tarteAuCitron.id, tagId: tags["dessert"].id },
      { recipeId: tarteAuCitron.id, tagId: tags["francais"].id },
      { recipeId: tarteAuCitron.id, tagId: tags["gastronomique"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: tarteAuCitron.id, ingredientId: ingredients["citron"].id, quantity: 4, unitId: units["pc"].id, order: 1 },
      { recipeId: tarteAuCitron.id, ingredientId: ingredients["sucre"].id, quantity: 200, unitId: units["g"].id, order: 2 },
      { recipeId: tarteAuCitron.id, ingredientId: ingredients["oeufs"].id, quantity: 6, unitId: units["pc"].id, order: 3 },
      { recipeId: tarteAuCitron.id, ingredientId: ingredients["beurre"].id, quantity: 150, unitId: units["g"].id, order: 4 },
      { recipeId: tarteAuCitron.id, ingredientId: ingredients["farine"].id, quantity: 250, unitId: units["g"].id, order: 5 },
    ],
  });

  const fondantChocolat = await prisma.recipe.create({
    data: {
      title: "Fondant au chocolat",
      servings: 4,
      prepTime: 15,
      cookTime: 12,
      creatorId: diana.id,
      steps: {
        create: [
          { order: 0, instruction: "Fondre le chocolat avec le beurre au bain-marie ou au micro-ondes." },
          { order: 1, instruction: "Battre les oeufs avec le sucre jusqu'a blanchiment du melange." },
          { order: 2, instruction: "Incorporer le chocolat fondu puis la farine tamisee delicatement." },
          { order: 3, instruction: "Verser dans des moules individuels beurres et farine." },
          { order: 4, instruction: "Cuire 12 minutes a 200C. Le coeur doit rester coulant. Demouler aussitot." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: fondantChocolat.id, tagId: tags["dessert"].id },
      { recipeId: fondantChocolat.id, tagId: tags["francais"].id },
      { recipeId: fondantChocolat.id, tagId: tags["facile"].id },
      { recipeId: fondantChocolat.id, tagId: tags["comfort-food"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: fondantChocolat.id, ingredientId: ingredients["chocolat"].id, quantity: 200, unitId: units["g"].id, order: 1 },
      { recipeId: fondantChocolat.id, ingredientId: ingredients["beurre"].id, quantity: 100, unitId: units["g"].id, order: 2 },
      { recipeId: fondantChocolat.id, ingredientId: ingredients["oeufs"].id, quantity: 4, unitId: units["pc"].id, order: 3 },
      { recipeId: fondantChocolat.id, ingredientId: ingredients["sucre"].id, quantity: 100, unitId: units["g"].id, order: 4 },
      { recipeId: fondantChocolat.id, ingredientId: ingredients["farine"].id, quantity: 50, unitId: units["g"].id, order: 5 },
    ],
  });

  const cremeBrulee = await prisma.recipe.create({
    data: {
      title: "Creme brulee a la vanille",
      servings: 4,
      prepTime: 15,
      cookTime: 45,
      restTime: 180,
      creatorId: diana.id,
      steps: {
        create: [
          { order: 0, instruction: "Chauffer la creme avec la gousse de vanille fendue et grattee. Porter presque a ebullition puis retirer du feu." },
          { order: 1, instruction: "Battre les jaunes d'oeufs avec le sucre jusqu'a ce que le melange blanchisse." },
          { order: 2, instruction: "Verser la creme chaude sur les jaunes en fouettant energiquement. Filtrer la preparation." },
          { order: 3, instruction: "Repartir dans les ramequins. Cuire au bain-marie 45 minutes a 150C." },
          { order: 4, instruction: "Laisser refroidir puis refrigerer au moins 3h. Avant de servir, saupoudrer de sucre et carameliser au chalumeau." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: cremeBrulee.id, tagId: tags["dessert"].id },
      { recipeId: cremeBrulee.id, tagId: tags["francais"].id },
      { recipeId: cremeBrulee.id, tagId: tags["gastronomique"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: cremeBrulee.id, ingredientId: ingredients["creme fraiche"].id, quantity: 50, unitId: units["cl"].id, order: 1 },
      { recipeId: cremeBrulee.id, ingredientId: ingredients["oeufs"].id, quantity: 5, unitId: units["pc"].id, order: 2 },
      { recipeId: cremeBrulee.id, ingredientId: ingredients["sucre"].id, quantity: 100, unitId: units["g"].id, order: 3 },
      { recipeId: cremeBrulee.id, ingredientId: ingredients["vanille"].id, quantity: 1, unitId: units["pc"].id, order: 4 },
    ],
  });

  // --- Eve's recipes ---
  const bowlSaumon = await prisma.recipe.create({
    data: {
      title: "Poke bowl au saumon",
      servings: 2,
      prepTime: 20,
      cookTime: 15,
      creatorId: eve.id,
      steps: {
        create: [
          { order: 0, instruction: "Cuire le riz selon les instructions du paquet et laisser refroidir." },
          { order: 1, instruction: "Couper le saumon frais en cubes de 2 cm." },
          { order: 2, instruction: "Preparer la marinade : melanger sauce soja, huile de sesame et gingembre rape. Mariner le saumon 10 minutes." },
          { order: 3, instruction: "Assembler les bowls : repartir le riz, le saumon marine, la carotte rapee dans les bols." },
          { order: 4, instruction: "Parsemer de graines de sesame et servir frais." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: bowlSaumon.id, tagId: tags["asiatique"].id },
      { recipeId: bowlSaumon.id, tagId: tags["rapide"].id },
      { recipeId: bowlSaumon.id, tagId: tags["plat-principal"].id },
      { recipeId: bowlSaumon.id, tagId: tags["ete"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: bowlSaumon.id, ingredientId: ingredients["saumon"].id, quantity: 200, unitId: units["g"].id, order: 1 },
      { recipeId: bowlSaumon.id, ingredientId: ingredients["riz"].id, quantity: 150, unitId: units["g"].id, order: 2 },
      { recipeId: bowlSaumon.id, ingredientId: ingredients["sauce soja"].id, quantity: 2, unitId: units["cas"].id, order: 3 },
      { recipeId: bowlSaumon.id, ingredientId: ingredients["gingembre"].id, quantity: 1, unitId: units["pc"].id, order: 4 },
      { recipeId: bowlSaumon.id, ingredientId: ingredients["carotte"].id, quantity: 1, unitId: units["pc"].id, order: 5 },
    ],
  });

  const gaspacho = await prisma.recipe.create({
    data: {
      title: "Gaspacho andalou",
      servings: 4,
      prepTime: 15,
      restTime: 120,
      creatorId: eve.id,
      steps: {
        create: [
          { order: 0, instruction: "Laver et couper grossierement les tomates, le concombre, le poivron, l'ail et l'oignon." },
          { order: 1, instruction: "Mixer le tout finement au blender." },
          { order: 2, instruction: "Ajouter l'huile d'olive, le vinaigre, saler et poivrer. Mixer a nouveau." },
          { order: 3, instruction: "Refrigerer au moins 2h. Servir tres frais avec des croutons." },
        ],
      },
    },
  });
  await prisma.recipeTag.createMany({
    data: [
      { recipeId: gaspacho.id, tagId: tags["entree"].id },
      { recipeId: gaspacho.id, tagId: tags["vegan"].id },
      { recipeId: gaspacho.id, tagId: tags["ete"].id },
      { recipeId: gaspacho.id, tagId: tags["rapide"].id },
      { recipeId: gaspacho.id, tagId: tags["sans-gluten"].id },
    ],
  });
  await prisma.recipeIngredient.createMany({
    data: [
      { recipeId: gaspacho.id, ingredientId: ingredients["tomate"].id, quantity: 1, unitId: units["kg"].id, order: 1 },
      { recipeId: gaspacho.id, ingredientId: ingredients["poivron"].id, quantity: 1, unitId: units["pc"].id, order: 2 },
      { recipeId: gaspacho.id, ingredientId: ingredients["ail"].id, quantity: 1, unitId: units["gse"].id, order: 3 },
      { recipeId: gaspacho.id, ingredientId: ingredients["oignon"].id, quantity: 0.5, unitId: units["pc"].id, order: 4 },
      { recipeId: gaspacho.id, ingredientId: ingredients["huile d'olive"].id, quantity: 4, unitId: units["cas"].id, order: 5 },
    ],
  });

  console.log("Recipes created: 11 (with tags & ingredients)");

  // ===========================================
  // Activity logs
  // ===========================================
  for (const community of [cuisineItalienne, patisserieFine, cuisineRapide]) {
    await prisma.activityLog.create({
      data: { type: "RECIPE_CREATED", userId: alice.id, communityId: community.id },
    });
  }
  console.log("Activity logs created");

  console.log("\nSeeding complete!");
  console.log("Login credentials for all users: password123");
  console.log("Users: alice_chef, bob_boulanger, charlie_cook, diana_patissiere, eve_gourmet");
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
