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

// ===================================
// Meal Ideas
// ===================================

export const createMealIdeaSchema = z.object({
  name: z
    .string()
    .min(1, "VALIDATION_001: Name is required")
    .max(255, "VALIDATION_001: Name must be at most 255 characters"),
  comment: z.string().max(500, "VALIDATION_001: Comment must be at most 500 characters").optional(),
  recipeId: z.string().uuid("VALIDATION_001: Invalid recipeId").optional(),
});

export type CreateMealIdeaInput = z.infer<typeof createMealIdeaSchema>;

export const updateMealIdeaSchema = z
  .object({
    name: z
      .string()
      .min(1, "VALIDATION_001: Name cannot be empty")
      .max(255, "VALIDATION_001: Name must be at most 255 characters")
      .optional(),
    comment: z
      .string()
      .max(500, "VALIDATION_001: Comment must be at most 500 characters")
      .optional()
      .nullable(),
    recipeId: z.string().uuid("VALIDATION_001: Invalid recipeId").optional().nullable(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "VALIDATION_001: At least one field required",
  });

export type UpdateMealIdeaInput = z.infer<typeof updateMealIdeaSchema>;

// ===================================
// Meal Generation Params
// ===================================

export const createMealGenerationParamsSchema = z.object({
  name: z
    .string()
    .min(1, "VALIDATION_001: Name is required")
    .max(100, "VALIDATION_001: Name must be at most 100 characters"),
  description: z
    .string()
    .max(500, "VALIDATION_001: Description must be at most 500 characters")
    .optional()
    .nullable(),
  cooldownDays: z
    .number()
    .int()
    .min(0, "VALIDATION_001: cooldownDays must be >= 0")
    .optional()
    .default(3),
  useIdeas: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
});

export type CreateMealGenerationParamsInput = z.infer<typeof createMealGenerationParamsSchema>;

export const updateMealGenerationParamsSchema = z
  .object({
    name: z
      .string()
      .min(1, "VALIDATION_001: Name cannot be empty")
      .max(100, "VALIDATION_001: Name must be at most 100 characters")
      .optional(),
    description: z
      .string()
      .max(500, "VALIDATION_001: Description must be at most 500 characters")
      .optional()
      .nullable(),
    cooldownDays: z.number().int().min(0, "VALIDATION_001: cooldownDays must be >= 0").optional(),
    useIdeas: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "VALIDATION_001: At least one field required",
  });

export type UpdateMealGenerationParamsInput = z.infer<typeof updateMealGenerationParamsSchema>;

// ===================================
// Meal Generation Exclusions
// ===================================

const dayOfWeekEnum = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const mealTimeEnum = z.enum(["LUNCH", "DINNER"]);

export const setExclusionsSchema = z.object({
  exclusions: z.array(
    z.object({
      day: dayOfWeekEnum,
      mealTime: mealTimeEnum,
    })
  ),
});

export type SetExclusionsInput = z.infer<typeof setExclusionsSchema>;

// ===================================
// Meal Generation Rules
// ===================================

export const createRuleSchema = z.object({
  tagId: z.string().uuid("VALIDATION_001: Invalid tagId").optional().nullable(),
  recipeId: z.string().uuid("VALIDATION_001: Invalid recipeId").optional().nullable(),
  weight: z.number().min(0).max(2).optional().default(1.0),
  mealTimeConstraint: mealTimeEnum.optional().nullable(),
  frequencyMin: z.number().int().min(0).optional().nullable(),
  frequencyMax: z.number().int().min(0).optional().nullable(),
  frequencyPer: z.enum(["PER_WEEK", "PER_PLANNING"]).optional().nullable(),
  tagCooldownDays: z.number().int().min(0).optional().nullable(),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z
  .object({
    weight: z.number().min(0).max(2).optional(),
    mealTimeConstraint: mealTimeEnum.optional().nullable(),
    frequencyMin: z.number().int().min(0).optional().nullable(),
    frequencyMax: z.number().int().min(0).optional().nullable(),
    frequencyPer: z.enum(["PER_WEEK", "PER_PLANNING"]).optional().nullable(),
    tagCooldownDays: z.number().int().min(0).optional().nullable(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "VALIDATION_001: At least one field required",
  });

export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;

// ===================================
// Meal Generation Pins
// ===================================

export const setPinsSchema = z.object({
  pins: z.array(
    z.object({
      day: dayOfWeekEnum,
      mealTime: mealTimeEnum,
      tagId: z.string().uuid("VALIDATION_001: Invalid tagId"),
    })
  ),
});

export type SetPinsInput = z.infer<typeof setPinsSchema>;
