-- Facultatif d'une ligne d'ingredient [D232] : l'import mettait "(facultatif)"
-- dans la precision [D222]. Le flag devient visible et editable : les precisions
-- qui ne sont que ce mot passent au flag, et le suffixe ", facultatif" est retire.
-- Lignes vivantes seulement : les instantanes des revisions restent tels quels.
UPDATE "RecipeIngredient"
SET "optional" = true, "note" = NULL
WHERE "note" ~* '^\s*(facultati(f|ve)|optionnel(le)?|en option)\s*$';

UPDATE "RecipeIngredient"
SET "optional" = true,
    "note" = regexp_replace("note", '\s*,\s*(facultati(f|ve)|optionnel(le)?|en option)\s*$', '', 'i')
WHERE "note" ~* '\S\s*,\s*(facultati(f|ve)|optionnel(le)?|en option)\s*$';
