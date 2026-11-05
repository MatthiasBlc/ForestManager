import { useState, useEffect, useCallback } from "react";
import { FaPlus, FaTrash, FaTag, FaUtensils } from "react-icons/fa";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";
import APIManager from "../../network/api";
import {
  MealGenerationRule,
  MealTime,
  FrequencyPer,
  CreateMealGenerationRuleInput,
  UpdateMealGenerationRuleInput,
} from "../../models/mealPlan";
import { TagSearchResult } from "../../models/recipe";

interface Props {
  communityId: string;
  paramsId: string;
  rules: MealGenerationRule[];
  isModerator: boolean;
  onRulesUpdated: (rules: MealGenerationRule[]) => void;
}

type FrequencyMode = "none" | "exact" | "range";

function getFrequencyMode(rule: MealGenerationRule): FrequencyMode {
  if (rule.frequencyMin == null && rule.frequencyMax == null) return "none";
  if (
    rule.frequencyMin != null &&
    rule.frequencyMax != null &&
    rule.frequencyMin === rule.frequencyMax
  )
    return "exact";
  return "range";
}

const MEAL_TIME_OPTIONS: { value: MealTime | ""; label: string }[] = [
  { value: "", label: "Both" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
];

const RulesEditor = ({ communityId, paramsId, rules, isModerator, onRulesUpdated }: Props) => {
  const [addingType, setAddingType] = useState<"tag" | "recipe" | null>(null);
  const [search, setSearch] = useState("");
  const [tagResults, setTagResults] = useState<TagSearchResult[]>([]);
  const [recipeResults, setRecipeResults] = useState<{ id: string; title: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const tagRules = rules.filter((r) => r.tagId != null);
  const recipeRules = rules.filter((r) => r.recipeId != null);

  // Search for tags or recipes
  useEffect(() => {
    if (!addingType || !search || search.length < 2) {
      setTagResults([]);
      setRecipeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        if (addingType === "tag") {
          const results = await APIManager.searchTags(search, 20, communityId);
          // Exclude tags already used in rules
          const usedTagIds = new Set(tagRules.map((r) => r.tagId));
          setTagResults(results.filter((t) => !usedTagIds.has(t.id)));
        } else {
          const res = await APIManager.getCommunityRecipes(communityId, {
            search,
            limit: 20,
          });
          // Exclude recipes already used in rules
          const usedRecipeIds = new Set(recipeRules.map((r) => r.recipeId));
          setRecipeResults(
            res.data
              .filter((r) => !usedRecipeIds.has(r.id))
              .map((r) => ({ id: r.id, title: r.title }))
          );
        }
      } catch {
        setTagResults([]);
        setRecipeResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, addingType, communityId, tagRules, recipeRules]);

  const handleAddRule = async (input: CreateMealGenerationRuleInput) => {
    try {
      const created = await APIManager.createMealGenerationRule(communityId, paramsId, input);
      onRulesUpdated([...rules, created]);
      setAddingType(null);
      setSearch("");
      toast.success("Rule added");
    } catch (err) {
      toastError(err, "Failed to add rule");
    }
  };

  const handleUpdateRule = useCallback(
    async (ruleId: string, data: UpdateMealGenerationRuleInput) => {
      setSavingRuleId(ruleId);
      try {
        const updated = await APIManager.updateMealGenerationRule(
          communityId,
          paramsId,
          ruleId,
          data
        );
        onRulesUpdated(rules.map((r) => (r.id === ruleId ? updated : r)));
      } catch (err) {
        toastError(err, "Failed to update rule");
      } finally {
        setSavingRuleId(null);
      }
    },
    [communityId, paramsId, rules, onRulesUpdated]
  );

  const handleDeleteRule = async (ruleId: string) => {
    setDeletingRuleId(ruleId);
    try {
      await APIManager.deleteMealGenerationRule(communityId, paramsId, ruleId);
      onRulesUpdated(rules.filter((r) => r.id !== ruleId));
      toast.success("Rule deleted");
    } catch (err) {
      toastError(err, "Failed to delete rule");
    } finally {
      setDeletingRuleId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tag Rules */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <FaTag className="w-4 h-4 text-base-content/60" />
          Tag Rules
          <span className="badge badge-ghost badge-sm">{tagRules.length}</span>
        </h4>
        <p className="text-xs text-base-content/50 mb-3">
          Adjust weight, frequency, and cooldown for recipe tags.
        </p>

        {tagRules.length === 0 && (
          <p className="text-sm text-base-content/40 mb-3">No tag rules yet.</p>
        )}

        <div className="space-y-2">
          {tagRules.map((rule) => (
            <TagRuleCard
              key={rule.id}
              rule={rule}
              isModerator={isModerator}
              isSaving={savingRuleId === rule.id}
              isDeleting={deletingRuleId === rule.id}
              onUpdate={(data) => handleUpdateRule(rule.id, data)}
              onDelete={() => handleDeleteRule(rule.id)}
            />
          ))}
        </div>

        {/* Add tag rule */}
        {isModerator && (
          <div className="mt-3">
            {addingType === "tag" ? (
              <div className="relative">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full max-w-xs"
                  placeholder="Search for a tag..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAddingType(null);
                      setSearch("");
                    }
                  }}
                />
                {isSearching && (
                  <span className="loading loading-spinner loading-xs absolute right-2 top-2" />
                )}
                {tagResults.length > 0 && (
                  <div className="absolute z-10 mt-1 bg-base-100 shadow-lg rounded-lg max-h-48 overflow-y-auto w-full max-w-xs border border-base-300">
                    {tagResults.map((tag) => (
                      <button
                        key={tag.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 flex items-center justify-between"
                        onClick={() => handleAddRule({ tagId: tag.id })}
                      >
                        <span>{tag.name}</span>
                        {tag.scope && (
                          <span className="badge badge-ghost badge-xs">{tag.scope}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="btn btn-ghost btn-xs mt-1"
                  onClick={() => {
                    setAddingType(null);
                    setSearch("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => {
                  setAddingType("tag");
                  setSearch("");
                }}
              >
                <FaPlus className="w-3 h-3" /> Add tag rule
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recipe Rules */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <FaUtensils className="w-4 h-4 text-base-content/60" />
          Recipe Rules
          <span className="badge badge-ghost badge-sm">{recipeRules.length}</span>
        </h4>
        <p className="text-xs text-base-content/50 mb-3">Adjust weight for specific recipes.</p>

        {recipeRules.length === 0 && (
          <p className="text-sm text-base-content/40 mb-3">No recipe rules yet.</p>
        )}

        <div className="space-y-2">
          {recipeRules.map((rule) => (
            <RecipeRuleCard
              key={rule.id}
              rule={rule}
              isModerator={isModerator}
              isSaving={savingRuleId === rule.id}
              isDeleting={deletingRuleId === rule.id}
              onUpdate={(data) => handleUpdateRule(rule.id, data)}
              onDelete={() => handleDeleteRule(rule.id)}
            />
          ))}
        </div>

        {/* Add recipe rule */}
        {isModerator && (
          <div className="mt-3">
            {addingType === "recipe" ? (
              <div className="relative">
                <input
                  type="text"
                  className="input input-bordered input-sm w-full max-w-xs"
                  placeholder="Search for a recipe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setAddingType(null);
                      setSearch("");
                    }
                  }}
                />
                {isSearching && (
                  <span className="loading loading-spinner loading-xs absolute right-2 top-2" />
                )}
                {recipeResults.length > 0 && (
                  <div className="absolute z-10 mt-1 bg-base-100 shadow-lg rounded-lg max-h-48 overflow-y-auto w-full max-w-xs border border-base-300">
                    {recipeResults.map((recipe) => (
                      <button
                        key={recipe.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-base-200"
                        onClick={() => handleAddRule({ recipeId: recipe.id })}
                      >
                        {recipe.title}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="btn btn-ghost btn-xs mt-1"
                  onClick={() => {
                    setAddingType(null);
                    setSearch("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => {
                  setAddingType("recipe");
                  setSearch("");
                }}
              >
                <FaPlus className="w-3 h-3" /> Add recipe rule
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== Tag Rule Card ====================

interface TagRuleCardProps {
  rule: MealGenerationRule;
  isModerator: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onUpdate: (data: UpdateMealGenerationRuleInput) => void;
  onDelete: () => void;
}

const TagRuleCard = ({
  rule,
  isModerator,
  isSaving,
  isDeleting,
  onUpdate,
  onDelete,
}: TagRuleCardProps) => {
  const [weight, setWeight] = useState(rule.weight);
  const [mealTimeConstraint, setMealTimeConstraint] = useState<MealTime | "">(
    rule.mealTimeConstraint || ""
  );
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>(getFrequencyMode(rule));
  const [frequencyMin, setFrequencyMin] = useState<string>(
    rule.frequencyMin != null ? String(rule.frequencyMin) : ""
  );
  const [frequencyMax, setFrequencyMax] = useState<string>(
    rule.frequencyMax != null ? String(rule.frequencyMax) : ""
  );
  const [frequencyPer, setFrequencyPer] = useState<FrequencyPer>(rule.frequencyPer || "PER_WEEK");
  const [tagCooldownDays, setTagCooldownDays] = useState<string>(
    rule.tagCooldownDays != null ? String(rule.tagCooldownDays) : ""
  );
  const [exactFreq, setExactFreq] = useState<string>(
    rule.frequencyMin != null &&
      rule.frequencyMax != null &&
      rule.frequencyMin === rule.frequencyMax
      ? String(rule.frequencyMin)
      : ""
  );

  // Debounced save
  const [pendingSave, setPendingSave] = useState(false);

  const buildUpdateData = useCallback((): UpdateMealGenerationRuleInput => {
    const data: UpdateMealGenerationRuleInput = {
      weight,
      mealTimeConstraint: mealTimeConstraint || null,
      tagCooldownDays: tagCooldownDays !== "" ? parseInt(tagCooldownDays) : null,
    };

    if (frequencyMode === "none") {
      data.frequencyMin = null;
      data.frequencyMax = null;
      data.frequencyPer = null;
    } else if (frequencyMode === "exact") {
      const val = exactFreq !== "" ? parseInt(exactFreq) : null;
      data.frequencyMin = val;
      data.frequencyMax = val;
      data.frequencyPer = frequencyPer;
    } else {
      data.frequencyMin = frequencyMin !== "" ? parseInt(frequencyMin) : null;
      data.frequencyMax = frequencyMax !== "" ? parseInt(frequencyMax) : null;
      data.frequencyPer = frequencyPer;
    }

    return data;
  }, [
    weight,
    mealTimeConstraint,
    frequencyMode,
    exactFreq,
    frequencyMin,
    frequencyMax,
    frequencyPer,
    tagCooldownDays,
  ]);

  useEffect(() => {
    if (!pendingSave) return;
    const timer = setTimeout(() => {
      onUpdate(buildUpdateData());
      setPendingSave(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [pendingSave, buildUpdateData, onUpdate]);

  const triggerSave = () => setPendingSave(true);

  const weightPercent = Math.round(weight * 100);
  const weightLabel =
    weight === 0 ? "Excluded" : weight < 1 ? "Disfavored" : weight === 1 ? "Neutral" : "Favored";
  const weightColor =
    weight === 0
      ? "text-error"
      : weight < 1
        ? "text-warning"
        : weight === 1
          ? "text-base-content/60"
          : "text-success";

  return (
    <div className="card bg-base-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="badge badge-primary badge-sm">{rule.tag?.name || "Unknown tag"}</span>
          {isSaving && <span className="loading loading-spinner loading-xs" />}
        </div>
        {isModerator && (
          <button
            className="btn btn-ghost btn-xs text-error"
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete rule"
          >
            {isDeleting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FaTrash className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      {/* Weight slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span>Weight</span>
          <span className={weightColor}>
            {weightPercent}% — {weightLabel}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          value={weightPercent}
          className="range range-xs range-primary"
          disabled={!isModerator}
          onChange={(e) => {
            setWeight(parseInt(e.target.value) / 100);
            triggerSave();
          }}
        />
        <div className="flex justify-between text-[10px] text-base-content/30 px-0.5">
          <span>0%</span>
          <span>100%</span>
          <span>200%</span>
        </div>
      </div>

      {/* Meal time constraint */}
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="form-control">
          <label className="label py-0">
            <span className="label-text text-xs">Meal time</span>
          </label>
          <select
            className="select select-bordered select-xs"
            value={mealTimeConstraint}
            disabled={!isModerator}
            onChange={(e) => {
              setMealTimeConstraint(e.target.value as MealTime | "");
              triggerSave();
            }}
          >
            {MEAL_TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tag cooldown */}
        <div className="form-control">
          <label className="label py-0">
            <span className="label-text text-xs">Tag cooldown (days)</span>
          </label>
          <input
            type="number"
            className="input input-bordered input-xs w-20"
            min="0"
            value={tagCooldownDays}
            placeholder="-"
            disabled={!isModerator}
            onChange={(e) => {
              setTagCooldownDays(e.target.value);
              triggerSave();
            }}
          />
        </div>
      </div>

      {/* Frequency controls */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="label py-0">
            <span className="label-text text-xs">Frequency</span>
          </label>
          <div className="join">
            {(["none", "exact", "range"] as FrequencyMode[]).map((mode) => (
              <button
                key={mode}
                className={`join-item btn btn-xs ${frequencyMode === mode ? "btn-active" : ""}`}
                disabled={!isModerator}
                onClick={() => {
                  setFrequencyMode(mode);
                  triggerSave();
                }}
              >
                {mode === "none" ? "None" : mode === "exact" ? "Exact" : "Range"}
              </button>
            ))}
          </div>
        </div>

        {frequencyMode !== "none" && (
          <div className="flex flex-wrap items-center gap-2">
            {frequencyMode === "exact" ? (
              <input
                type="number"
                className="input input-bordered input-xs w-20"
                min="0"
                value={exactFreq}
                placeholder="Count"
                disabled={!isModerator}
                onChange={(e) => {
                  setExactFreq(e.target.value);
                  triggerSave();
                }}
              />
            ) : (
              <>
                <input
                  type="number"
                  className="input input-bordered input-xs w-16"
                  min="0"
                  value={frequencyMin}
                  placeholder="Min"
                  disabled={!isModerator}
                  onChange={(e) => {
                    setFrequencyMin(e.target.value);
                    triggerSave();
                  }}
                />
                <span className="text-xs">to</span>
                <input
                  type="number"
                  className="input input-bordered input-xs w-16"
                  min="0"
                  value={frequencyMax}
                  placeholder="Max"
                  disabled={!isModerator}
                  onChange={(e) => {
                    setFrequencyMax(e.target.value);
                    triggerSave();
                  }}
                />
              </>
            )}
            <select
              className="select select-bordered select-xs"
              value={frequencyPer}
              disabled={!isModerator}
              onChange={(e) => {
                setFrequencyPer(e.target.value as FrequencyPer);
                triggerSave();
              }}
            >
              <option value="PER_WEEK">Per week</option>
              <option value="PER_PLANNING">Per planning</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== Recipe Rule Card ====================

interface RecipeRuleCardProps {
  rule: MealGenerationRule;
  isModerator: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onUpdate: (data: UpdateMealGenerationRuleInput) => void;
  onDelete: () => void;
}

const RecipeRuleCard = ({
  rule,
  isModerator,
  isSaving,
  isDeleting,
  onUpdate,
  onDelete,
}: RecipeRuleCardProps) => {
  const [weight, setWeight] = useState(rule.weight);
  const [mealTimeConstraint, setMealTimeConstraint] = useState<MealTime | "">(
    rule.mealTimeConstraint || ""
  );

  const [pendingSave, setPendingSave] = useState(false);

  const buildUpdateData = useCallback(
    (): UpdateMealGenerationRuleInput => ({
      weight,
      mealTimeConstraint: mealTimeConstraint || null,
    }),
    [weight, mealTimeConstraint]
  );

  useEffect(() => {
    if (!pendingSave) return;
    const timer = setTimeout(() => {
      onUpdate(buildUpdateData());
      setPendingSave(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [pendingSave, buildUpdateData, onUpdate]);

  const triggerSave = () => setPendingSave(true);

  const weightPercent = Math.round(weight * 100);
  const weightLabel =
    weight === 0 ? "Excluded" : weight < 1 ? "Disfavored" : weight === 1 ? "Neutral" : "Favored";
  const weightColor =
    weight === 0
      ? "text-error"
      : weight < 1
        ? "text-warning"
        : weight === 1
          ? "text-base-content/60"
          : "text-success";

  const recipeTitle = rule.recipe
    ? rule.recipe.isDeleted
      ? `${rule.recipe.title} (deleted)`
      : rule.recipe.title
    : "Unknown recipe";

  return (
    <div className="card bg-base-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`badge badge-sm ${rule.recipe?.isDeleted ? "badge-ghost line-through" : "badge-secondary"}`}
          >
            {recipeTitle}
          </span>
          {isSaving && <span className="loading loading-spinner loading-xs" />}
        </div>
        {isModerator && (
          <button
            className="btn btn-ghost btn-xs text-error"
            onClick={onDelete}
            disabled={isDeleting}
            title="Delete rule"
          >
            {isDeleting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FaTrash className="w-3 h-3" />
            )}
          </button>
        )}
      </div>

      {/* Weight slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span>Weight</span>
          <span className={weightColor}>
            {weightPercent}% — {weightLabel}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          value={weightPercent}
          className="range range-xs range-secondary"
          disabled={!isModerator}
          onChange={(e) => {
            setWeight(parseInt(e.target.value) / 100);
            triggerSave();
          }}
        />
        <div className="flex justify-between text-[10px] text-base-content/30 px-0.5">
          <span>0%</span>
          <span>100%</span>
          <span>200%</span>
        </div>
      </div>

      {/* Meal time constraint */}
      <div className="form-control">
        <label className="label py-0">
          <span className="label-text text-xs">Meal time</span>
        </label>
        <select
          className="select select-bordered select-xs w-fit"
          value={mealTimeConstraint}
          disabled={!isModerator}
          onChange={(e) => {
            setMealTimeConstraint(e.target.value as MealTime | "");
            triggerSave();
          }}
        >
          {MEAL_TIME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default RulesEditor;
