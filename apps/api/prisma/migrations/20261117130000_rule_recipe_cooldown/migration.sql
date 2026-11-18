-- Delai de recette propre aux recettes d'un tag, a la place de celui du profil [D214].
ALTER TABLE "MealGenerationRule" ADD COLUMN "recipeCooldownDays" INTEGER;

-- Regle de tag seulement, de 0 a 30 jours.
ALTER TABLE "MealGenerationRule" ADD CONSTRAINT "MealGenerationRule_recipe_cooldown_check"
  CHECK ("recipeCooldownDays" IS NULL OR ("tagId" IS NOT NULL AND "recipeCooldownDays" BETWEEN 0 AND 30));
