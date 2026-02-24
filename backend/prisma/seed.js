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
      content: "# Pizza Margherita\n\nLa classique napolitaine. Etaler la pate finement, napper de sauce tomate, disposer la mozzarella en morceaux. Cuire au four a 250C pendant 8-10 minutes. Ajouter le basilic frais a la sortie du four.",
      creatorId: alice.id,
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
      content: "# Risotto aux champignons\n\nFaire revenir l'oignon emince dans le beurre. Ajouter le riz et nacrer 2 minutes. Deglace au vin blanc. Ajouter le bouillon louche par louche en remuant. A mi-cuisson, ajouter les champignons sautes. Terminer avec le parmesan et une noix de beurre.",
      creatorId: alice.id,
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
      content: "# Salade Caprese\n\nAlterner les tranches de tomates et de mozzarella dans un plat. Parsemer de feuilles de basilic. Arroser d'huile d'olive, saler et poivrer. Servir frais.",
      creatorId: alice.id,
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
      content: "# Pain maison\n\nMelanger farine, sel et levure. Ajouter l'eau tiede et petrir 10 minutes. Laisser lever 1h. Faconner, laisser lever 30min. Cuire a 230C pendant 25 minutes avec un bol d'eau dans le four pour la croute.",
      creatorId: bob.id,
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
      content: "# Quiche Lorraine\n\nEtaler la pate dans un moule. Faire revenir les lardons. Battre les oeufs avec la creme et le lait, saler, poivrer, muscade. Disposer les lardons sur la pate, verser l'appareil. Cuire 35 minutes a 180C.",
      creatorId: bob.id,
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
      content: "# Pad Thai express\n\nFaire tremper les nouilles de riz. Sauter le poulet emince avec l'ail et le gingembre. Ajouter les nouilles egouttees, la sauce soja, le jus de citron et le sucre. Servir avec cacahuetes concassees et coriandre.",
      creatorId: charlie.id,
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
      content: "# Ratatouille express\n\nCouper tous les legumes en des. Faire revenir l'oignon et l'ail dans l'huile d'olive. Ajouter aubergine et poivron, cuire 5min. Ajouter courgette et tomate. Assaisonner avec thym et romarin. Laisser mijoter 20 minutes.",
      creatorId: charlie.id,
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
      content: "# Tarte au citron meringuee\n\nPreparer une pate sucree (farine, beurre, sucre, oeuf). Cuire a blanc 15min. Preparer la creme citron : jus de citron, sucre, oeufs, beurre au bain-marie. Verser sur le fond de tarte. Monter les blancs en neige ferme avec sucre, dresser a la poche. Carameliser au chalumeau.",
      creatorId: diana.id,
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
      content: "# Fondant au chocolat\n\nFondre le chocolat avec le beurre. Battre les oeufs avec le sucre jusqu'a blanchiment. Incorporer le chocolat fondu puis la farine. Verser dans des moules beurres. Cuire 12 minutes a 200C. Le coeur doit rester coulant.",
      creatorId: diana.id,
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
      content: "# Creme brulee a la vanille\n\nChauffer la creme avec la gousse de vanille fendue. Battre les jaunes d'oeufs avec le sucre. Verser la creme chaude sur les jaunes en fouettant. Repartir dans les ramequins. Cuire au bain-marie 45min a 150C. Refroidir puis carameliser le sucre au chalumeau.",
      creatorId: diana.id,
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
      content: "# Poke bowl au saumon\n\nCuire le riz et laisser refroidir. Couper le saumon frais en cubes. Preparer la marinade : sauce soja, huile de sesame, gingembre rape. Assembler : riz, saumon marine, avocat, edamame, carotte rapee, graines de sesame.",
      creatorId: eve.id,
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
      content: "# Gaspacho andalou\n\nMixer les tomates bien mures, le concombre, le poivron, l'ail et l'oignon. Ajouter l'huile d'olive, le vinaigre, sel et poivre. Mixer finement. Refrigerer au moins 2h. Servir tres frais avec des croutons.",
      creatorId: eve.id,
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
