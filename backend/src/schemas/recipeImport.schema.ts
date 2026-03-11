import { z } from "zod";
import { IMPORT_001 } from "../constants/errorCodes";

/** Schema for importing a recipe from a URL */
export const importRecipeUrlSchema = z.object({
  url: z.string({ error: () => IMPORT_001 }).url(IMPORT_001),
});

export type ImportRecipeUrlInput = z.infer<typeof importRecipeUrlSchema>;
