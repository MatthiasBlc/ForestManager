import { z } from "zod";

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

// ===================================
// Meal Generation API (generate / replace)
// ===================================

export const generateSchema = z.object({
  paramsId: z.string().uuid("VALIDATION_001: Invalid paramsId"),
  fillEmptyOnly: z.boolean().optional().default(false),
});

export type GenerateInput = z.infer<typeof generateSchema>;

export const replaceSlotSchema = z.object({
  paramsId: z.string().uuid("VALIDATION_001: Invalid paramsId"),
});

export type ReplaceSlotInput = z.infer<typeof replaceSlotSchema>;
