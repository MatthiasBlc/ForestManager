-- Noms d'ingredients avec l'initiale en minuscule [R3], comme les ecrit desormais l'API
-- (`ingredientDisplayName`) : "Beurre" -> "beurre". Les sigles ("AOP") restent tels quels :
-- seule une initiale suivie d'une lettre minuscule change. `normalized` ne bouge pas.
UPDATE "IngredientTranslation"
SET "name" = lower(left("name", 1)) || substr("name", 2)
WHERE substr("name", 2, 1) = lower(substr("name", 2, 1))
  AND substr("name", 2, 1) <> upper(substr("name", 2, 1))
  AND left("name", 1) <> lower(left("name", 1));

UPDATE "IngredientTranslation"
SET "namePlural" = lower(left("namePlural", 1)) || substr("namePlural", 2)
WHERE "namePlural" IS NOT NULL
  AND substr("namePlural", 2, 1) = lower(substr("namePlural", 2, 1))
  AND substr("namePlural", 2, 1) <> upper(substr("namePlural", 2, 1))
  AND left("namePlural", 1) <> lower(left("namePlural", 1));
