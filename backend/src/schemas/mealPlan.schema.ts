import { z } from "zod";

// Regex pour date YYYY-MM-DD
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "VALIDATION_001: Date must be YYYY-MM-DD format")
  .refine((d) => !isNaN(new Date(d).getTime()), "VALIDATION_001: Invalid date");

export const createMealPlanSchema = z.object({
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  defaultServings: z.number().int().min(1).max(100).optional().default(4),
  disabledSlots: z
    .array(
      z.object({
        date: dateStringSchema,
        mealTime: z.enum(["LUNCH", "DINNER"]),
      })
    )
    .optional(),
  copyDisabledFromPrevious: z.boolean().optional().default(false),
});

export type CreateMealPlanInput = z.infer<typeof createMealPlanSchema>;

export const updateMealPlanSchema = z
  .object({
    defaultServings: z.number().int().min(1).max(100).optional(),
    editableByMembers: z.boolean().optional(),
  })
  .refine((data) => data.defaultServings !== undefined || data.editableByMembers !== undefined, {
    message: "VALIDATION_001: At least one field required (defaultServings or editableByMembers)",
  });

export type UpdateMealPlanInput = z.infer<typeof updateMealPlanSchema>;

export const updateSlotSchema = z
  .object({
    type: z.enum(["EMPTY", "RECIPE", "FREE_TEXT"]).optional(),
    recipeId: z.string().uuid("VALIDATION_001: Invalid recipeId").optional(),
    freeText: z.string().min(1).max(255).optional(),
    comment: z.string().max(500).optional().nullable(),
    servings: z.number().int().min(1).max(100).optional(),
    disabled: z.boolean().optional(),
    locked: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Au moins un champ doit etre present
      return Object.values(data).some((v) => v !== undefined);
    },
    { message: "VALIDATION_001: At least one field required" }
  );

export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;

export const swapSlotsSchema = z.object({
  slotIdA: z.string().uuid("VALIDATION_001: Invalid slotIdA"),
  slotIdB: z.string().uuid("VALIDATION_001: Invalid slotIdB"),
});

export type SwapSlotsInput = z.infer<typeof swapSlotsSchema>;
