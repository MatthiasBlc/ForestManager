import { useState, useMemo } from "react";
import { FaTimes, FaArchive } from "react-icons/fa";
import APIManager from "../../network/api";
import { MealPlan, MealTime, CreateMealPlanInput } from "../../models/mealPlan";

interface Props {
  communityId: string;
  existingPlan: MealPlan | null;
  onCreated: (plan: MealPlan) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

const CreatePlanModal = ({ communityId, existingPlan, onCreated, onClose }: Props) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Default: start tomorrow, end in 7 days
  const defaultStart = addDays(today, 1);
  const defaultEnd = addDays(today, 7);

  const [startDate, setStartDate] = useState(formatDateInput(defaultStart));
  const [endDate, setEndDate] = useState(formatDateInput(defaultEnd));
  const [defaultServings, setDefaultServings] = useState(4);
  const [disabledSlots, setDisabledSlots] = useState<Set<string>>(new Set());
  const [copyFromPrevious, setCopyFromPrevious] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate days for preview
  const previewDays = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return [];
    // Limit to 31 days
    const maxEnd = addDays(start, 30);
    const actualEnd = end > maxEnd ? maxEnd : end;
    return getDaysBetween(start, actualEnd);
  }, [startDate, endDate]);

  const durationDays = previewDays.length;
  const totalSlots = durationDays * 2;
  const disabledCount = disabledSlots.size;

  // Toggle slot disabled state
  const toggleSlot = (date: string, mealTime: MealTime) => {
    const key = `${date}-${mealTime}`;
    const newSet = new Set(disabledSlots);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setDisabledSlots(newSet);
  };

  const isSlotDisabled = (date: string, mealTime: MealTime) => {
    return disabledSlots.has(`${date}-${mealTime}`);
  };

  // Copy from previous plan
  const handleCopyFromPrevious = () => {
    if (!existingPlan) return;
    const newSet = new Set<string>();

    // Get disabled slots from existing plan and apply to new dates
    const existingDisabled = existingPlan.slots.filter((s) => s.disabled);
    for (const slot of existingDisabled) {
      const slotDate = new Date(slot.date);
      const dayOfWeek = slotDate.getDay(); // 0=Sun, 1=Mon, ...

      // Find matching days in new plan
      for (const day of previewDays) {
        if (day.getDay() === dayOfWeek) {
          newSet.add(`${formatDateInput(day)}-${slot.mealTime}`);
        }
      }
    }

    setDisabledSlots(newSet);
    setCopyFromPrevious(true);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const input: CreateMealPlanInput = {
        startDate,
        endDate,
        defaultServings,
        disabledSlots: Array.from(disabledSlots).map((key) => {
          const [date, mealTime] = key.split("-") as [string, MealTime];
          return { date, mealTime };
        }),
        copyDisabledFromPrevious: false, // We handle this client-side
      };

      const response = await APIManager.createMealPlan(communityId, input);
      onCreated(response.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        <h3 className="font-bold text-lg mb-4">Create Meal Plan</h3>

        {/* Warning if existing plan */}
        {existingPlan && (
          <div className="alert alert-warning mb-4">
            <FaArchive className="w-5 h-5" />
            <span>
              The current plan ({new Date(existingPlan.startDate).toLocaleDateString()} -{" "}
              {new Date(existingPlan.endDate).toLocaleDateString()}) will be archived.
            </span>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Start date</span>
            </label>
            <input
              type="date"
              className="input input-bordered"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={formatDateInput(today)}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">End date</span>
            </label>
            <input
              type="date"
              className="input input-bordered"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Default servings</span>
            </label>
            <input
              type="number"
              className="input input-bordered"
              value={defaultServings}
              onChange={(e) => setDefaultServings(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={100}
            />
          </div>
        </div>

        {/* Duration info */}
        <div className="text-sm text-base-content/60 mb-4">
          Duration: {durationDays} day{durationDays !== 1 ? "s" : ""} ({totalSlots} slots
          {disabledCount > 0 && `, ${disabledCount} disabled`})
        </div>

        {/* Copy from previous option */}
        {existingPlan && previewDays.length > 0 && (
          <div className="mb-4">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleCopyFromPrevious}
              disabled={copyFromPrevious}
            >
              {copyFromPrevious ? "Copied from previous" : "Copy disabled slots from previous plan"}
            </button>
          </div>
        )}

        {/* Preview grid */}
        {previewDays.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium mb-2">
              Preview (click to disable/enable slots)
            </h4>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th />
                    {previewDays.map((day) => (
                      <th key={day.toISOString()} className="text-center">
                        <div className="text-xs">{DAYS_OF_WEEK[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                        <div className="text-xs text-base-content/60">
                          {day.getDate()}/{day.getMonth() + 1}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium">Lunch</td>
                    {previewDays.map((day) => {
                      const dateStr = formatDateInput(day);
                      const disabled = isSlotDisabled(dateStr, "LUNCH");
                      return (
                        <td key={`${dateStr}-LUNCH`} className="text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={!disabled}
                            onChange={() => toggleSlot(dateStr, "LUNCH")}
                            title={disabled ? "Click to enable" : "Click to disable"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="font-medium">Dinner</td>
                    {previewDays.map((day) => {
                      const dateStr = formatDateInput(day);
                      const disabled = isSlotDisabled(dateStr, "DINNER");
                      return (
                        <td key={`${dateStr}-DINNER`} className="text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={!disabled}
                            onChange={() => toggleSlot(dateStr, "DINNER")}
                            title={disabled ? "Click to enable" : "Click to disable"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-base-content/60 mt-2">
              Unchecked slots will be marked as disabled (e.g., for restaurant nights).
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || previewDays.length === 0}
          >
            {isSubmitting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Create Plan"
            )}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onClose} />
    </div>
  );
};

export default CreatePlanModal;
