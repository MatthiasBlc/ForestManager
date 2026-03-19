import { useState, useEffect } from "react";
import { FaBan, FaThumbtack, FaSearch } from "react-icons/fa";
import toast from "react-hot-toast";
import APIManager from "../../network/api";
import { DayOfWeek, MealTime, MealSlotExclusion, MealSlotPin } from "../../models/mealPlan";
import { TagSearchResult } from "../../models/recipe";

interface Props {
  communityId: string;
  paramsId: string;
  exclusions: MealSlotExclusion[];
  slotPins: MealSlotPin[];
  isModerator: boolean;
  onExclusionsUpdated: (exclusions: MealSlotExclusion[]) => void;
  onPinsUpdated: (pins: MealSlotPin[]) => void;
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "MON", label: "Monday", short: "Mon" },
  { key: "TUE", label: "Tuesday", short: "Tue" },
  { key: "WED", label: "Wednesday", short: "Wed" },
  { key: "THU", label: "Thursday", short: "Thu" },
  { key: "FRI", label: "Friday", short: "Fri" },
  { key: "SAT", label: "Saturday", short: "Sat" },
  { key: "SUN", label: "Sunday", short: "Sun" },
];

const MEALS: { key: MealTime; label: string }[] = [
  { key: "LUNCH", label: "Lunch" },
  { key: "DINNER", label: "Dinner" },
];

const ExclusionPinGrid = ({
  communityId,
  paramsId,
  exclusions,
  slotPins,
  isModerator,
  onExclusionsUpdated,
  onPinsUpdated,
}: Props) => {
  const [savingExclusions, setSavingExclusions] = useState(false);
  const [savingPins, setSavingPins] = useState(false);
  // Pin editing state
  const [editingPin, setEditingPin] = useState<{ day: DayOfWeek; mealTime: MealTime } | null>(null);
  const [pinSearch, setPinSearch] = useState("");
  const [pinResults, setPinResults] = useState<TagSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Build exclusion set for quick lookup
  const exclusionSet = new Set(exclusions.map((e) => `${e.day}:${e.mealTime}`));

  // Build pin map for quick lookup
  const pinMap = new Map(slotPins.map((p) => [`${p.day}:${p.mealTime}`, p]));

  // Tag search for pins
  useEffect(() => {
    if (!pinSearch || pinSearch.length < 2) {
      setPinResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await APIManager.searchTags(pinSearch, 20, communityId);
        setPinResults(results);
      } catch {
        setPinResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pinSearch, communityId]);

  const toggleExclusion = async (day: DayOfWeek, mealTime: MealTime) => {
    if (!isModerator) return;
    const key = `${day}:${mealTime}`;
    const isExcluded = exclusionSet.has(key);

    // Cannot exclude a pinned slot
    if (!isExcluded && pinMap.has(key)) {
      toast.error("Cannot exclude a pinned slot. Remove the pin first.");
      return;
    }

    setSavingExclusions(true);
    try {
      let newExclusions: { day: string; mealTime: string }[];
      if (isExcluded) {
        newExclusions = exclusions
          .filter((e) => !(e.day === day && e.mealTime === mealTime))
          .map((e) => ({ day: e.day, mealTime: e.mealTime }));
      } else {
        newExclusions = [
          ...exclusions.map((e) => ({ day: e.day, mealTime: e.mealTime })),
          { day, mealTime },
        ];
      }
      const result = await APIManager.setMealExclusions(communityId, paramsId, newExclusions);
      onExclusionsUpdated(result.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update exclusions");
    } finally {
      setSavingExclusions(false);
    }
  };

  const handlePinSelect = async (day: DayOfWeek, mealTime: MealTime, tag: TagSearchResult) => {
    setSavingPins(true);
    try {
      const newPins = [
        ...slotPins
          .filter((p) => !(p.day === day && p.mealTime === mealTime))
          .map((p) => ({ day: p.day, mealTime: p.mealTime, tagId: p.tagId })),
        { day, mealTime, tagId: tag.id },
      ];
      const result = await APIManager.setMealPins(communityId, paramsId, newPins);
      onPinsUpdated(result.data);
      setEditingPin(null);
      setPinSearch("");
      setPinResults([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update pins");
    } finally {
      setSavingPins(false);
    }
  };

  const removePin = async (day: DayOfWeek, mealTime: MealTime) => {
    setSavingPins(true);
    try {
      const newPins = slotPins
        .filter((p) => !(p.day === day && p.mealTime === mealTime))
        .map((p) => ({ day: p.day, mealTime: p.mealTime, tagId: p.tagId }));
      const result = await APIManager.setMealPins(communityId, paramsId, newPins);
      onPinsUpdated(result.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove pin");
    } finally {
      setSavingPins(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Exclusions Grid */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <FaBan className="w-4 h-4 text-base-content/60" />
          Exclusions
          {savingExclusions && <span className="loading loading-spinner loading-xs" />}
        </h4>
        <p className="text-xs text-base-content/50 mb-3">
          Check slots where the community doesn't eat together. These slots will be skipped during
          generation.
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-20" />
                {DAYS.map((d) => (
                  <th key={d.key} className="text-center text-xs">
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEALS.map((meal) => (
                <tr key={meal.key}>
                  <td className="text-xs font-medium">{meal.label}</td>
                  {DAYS.map((day) => {
                    const key = `${day.key}:${meal.key}`;
                    const isExcluded = exclusionSet.has(key);
                    const isPinned = pinMap.has(key);
                    return (
                      <td key={key} className="text-center">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-error"
                          checked={isExcluded}
                          onChange={() => toggleExclusion(day.key, meal.key)}
                          disabled={!isModerator || savingExclusions || isPinned}
                          title={
                            isPinned
                              ? "Remove pin first"
                              : isExcluded
                                ? "Click to include"
                                : "Click to exclude"
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pins Grid */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <FaThumbtack className="w-4 h-4 text-base-content/60" />
          Slot Pins
          {savingPins && <span className="loading loading-spinner loading-xs" />}
        </h4>
        <p className="text-xs text-base-content/50 mb-3">
          Pin a tag to a slot to restrict generation to recipes with that tag (e.g., "Fish" on
          Friday dinner).
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-20" />
                {DAYS.map((d) => (
                  <th key={d.key} className="text-center text-xs">
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEALS.map((meal) => (
                <tr key={meal.key}>
                  <td className="text-xs font-medium">{meal.label}</td>
                  {DAYS.map((day) => {
                    const key = `${day.key}:${meal.key}`;
                    const isExcluded = exclusionSet.has(key);
                    const pin = pinMap.get(key);
                    const isEditingThis =
                      editingPin?.day === day.key && editingPin?.mealTime === meal.key;

                    return (
                      <td key={key} className="text-center min-w-[100px]">
                        {isExcluded ? (
                          <span className="text-xs text-base-content/30">--</span>
                        ) : isEditingThis ? (
                          <div className="relative">
                            <div className="flex items-center">
                              <input
                                type="text"
                                className="input input-bordered input-xs w-full"
                                placeholder="Tag..."
                                value={pinSearch}
                                onChange={(e) => setPinSearch(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setEditingPin(null);
                                    setPinSearch("");
                                    setPinResults([]);
                                  }
                                }}
                              />
                              {isSearching && (
                                <span className="loading loading-spinner loading-xs absolute right-1" />
                              )}
                            </div>
                            {pinResults.length > 0 && (
                              <div className="absolute z-10 mt-1 bg-base-100 shadow-lg rounded-lg max-h-32 overflow-y-auto w-40 left-0">
                                {pinResults.map((tag) => (
                                  <button
                                    key={tag.id}
                                    className="w-full text-left p-1.5 text-xs hover:bg-base-200"
                                    onClick={() => handlePinSelect(day.key, meal.key, tag)}
                                  >
                                    {tag.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : pin ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="badge badge-sm badge-primary">{pin.tag.name}</span>
                            {isModerator && (
                              <button
                                className="btn btn-ghost btn-xs p-0 min-h-0 h-auto text-error"
                                onClick={() => removePin(day.key, meal.key)}
                                title="Remove pin"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ) : isModerator ? (
                          <button
                            className="btn btn-ghost btn-xs text-base-content/30"
                            onClick={() => {
                              setEditingPin({ day: day.key, mealTime: meal.key });
                              setPinSearch("");
                              setPinResults([]);
                            }}
                            title="Pin a tag"
                          >
                            <FaSearch className="w-2.5 h-2.5" />
                          </button>
                        ) : (
                          <span className="text-xs text-base-content/20">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExclusionPinGrid;
