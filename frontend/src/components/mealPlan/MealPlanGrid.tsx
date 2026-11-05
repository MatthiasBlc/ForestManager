import { useEffect, useMemo, useState } from "react";
import {
  FaPlus,
  FaLock,
  FaLockOpen,
  FaBan,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";
import { MealPlan, MealSlot, MealTime } from "../../models/mealPlan";
import { useIsMobile } from "../../hooks/useIsMobile";
import SlotEditModal from "./SlotEditModal";
import APIManager from "../../network/api";

interface Props {
  communityId: string;
  plan: MealPlan;
  isModerator: boolean;
  hasDefaultGenerationParams: boolean;
  onSlotUpdated: (slotId: string, updates: Partial<MealSlot>) => void;
  onSlotsSwapped: (slotAId: string, slotBId: string, slotA: MealSlot, slotB: MealSlot) => void;
  onPlanUpdated: (plan: MealPlan) => void;
}

interface DayData {
  date: Date;
  dateStr: string;
  lunch: MealSlot | null;
  dinner: MealSlot | null;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

const MealPlanGrid = ({
  communityId,
  plan,
  isModerator,
  hasDefaultGenerationParams,
  onSlotUpdated,
  onSlotsSwapped,
  onPlanUpdated,
}: Props) => {
  const isMobile = useIsMobile();
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<MealSlot | null>(null);
  const [replacingSlotId, setReplacingSlotId] = useState<string | null>(null);
  const [confirmReplaceSlot, setConfirmReplaceSlot] = useState<MealSlot | null>(null);
  const [defaultParamsId, setDefaultParamsId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasDefaultGenerationParams) {
      setDefaultParamsId(null);
      return;
    }
    APIManager.listMealGenerationParams(communityId).then((res) => {
      const def = res.data.find((p) => p.isDefault);
      setDefaultParamsId(def?.id ?? null);
    });
  }, [communityId, hasDefaultGenerationParams]);

  // Group slots by date
  const days: DayData[] = useMemo(() => {
    const slotsByDate = new Map<string, { lunch: MealSlot | null; dinner: MealSlot | null }>();

    // Initialize with all dates in range
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateStr = formatDateInput(current);
      slotsByDate.set(dateStr, { lunch: null, dinner: null });
      current.setDate(current.getDate() + 1);
    }

    // Fill in slots
    for (const slot of plan.slots) {
      const dateStr = slot.date.split("T")[0];
      const existing = slotsByDate.get(dateStr);
      if (existing) {
        if (slot.mealTime === "LUNCH") {
          existing.lunch = slot;
        } else {
          existing.dinner = slot;
        }
      }
    }

    // Convert to array
    return Array.from(slotsByDate.entries()).map(([dateStr, slots]) => ({
      date: new Date(dateStr),
      dateStr,
      lunch: slots.lunch,
      dinner: slots.dinner,
    }));
  }, [plan]);

  const canEdit = isModerator || plan.editableByMembers;

  const [togglingLock, setTogglingLock] = useState<string | null>(null);

  const handleSlotClick = (slot: MealSlot | null) => {
    if (!slot || !canEdit) return;
    setEditingSlot(slot);
  };

  const handleToggleLock = async (e: React.MouseEvent, slot: MealSlot) => {
    e.stopPropagation();
    if (togglingLock) return;
    setTogglingLock(slot.id);
    try {
      const updated = await APIManager.updateMealSlot(communityId, slot.id, {
        locked: !slot.locked,
      });
      onSlotUpdated(slot.id, updated);
    } catch (err) {
      console.error("Toggle lock failed:", err);
    } finally {
      setTogglingLock(null);
    }
  };

  const handleSlotSaved = async (slot: MealSlot) => {
    onSlotUpdated(slot.id, slot);
    setEditingSlot(null);
  };

  const handleReplaceSlot = async (slot: MealSlot) => {
    if (!defaultParamsId) return;
    setConfirmReplaceSlot(null);
    setReplacingSlotId(slot.id);
    try {
      const result = await APIManager.replaceMealSlot(communityId, slot.id, defaultParamsId);
      onPlanUpdated(result.plan);
      toast.success("Slot replaced");
    } catch (err) {
      toastError(err, "Replace failed");
    } finally {
      setReplacingSlotId(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, slot: MealSlot) => {
    if (!canEdit || slot.disabled) return;
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetSlot: MealSlot) => {
    e.preventDefault();
    if (!draggedSlot || !canEdit || targetSlot.disabled || draggedSlot.id === targetSlot.id) {
      setDraggedSlot(null);
      return;
    }

    try {
      const result = await APIManager.swapMealSlots(communityId, draggedSlot.id, targetSlot.id);
      onSlotsSwapped(draggedSlot.id, targetSlot.id, result.slotA, result.slotB);
    } catch (err) {
      console.error("Swap failed:", err);
    }
    setDraggedSlot(null);
  };

  const handleDragEnd = () => {
    setDraggedSlot(null);
  };

  // Render a slot card
  const renderSlot = (slot: MealSlot | null, mealTime: MealTime) => {
    if (!slot) {
      return (
        <div className="h-24 bg-base-200 rounded-lg flex items-center justify-center text-base-content/30">
          No slot
        </div>
      );
    }

    const isDisabled = slot.disabled;
    const isLocked = slot.locked;
    const isEmpty = slot.type === "EMPTY";
    const isDeleted = slot.recipe?.isDeleted;

    const cardClasses = `
      h-24 rounded-lg p-2 flex flex-col cursor-pointer transition-all
      ${isDisabled ? "bg-base-200/50 opacity-60" : isLocked ? "bg-warning/10 ring-1 ring-warning/30 hover:bg-warning/15" : "bg-base-200 hover:bg-base-300"}
      ${draggedSlot?.id === slot.id ? "opacity-50" : ""}
      ${!canEdit ? "cursor-default" : ""}
    `;

    return (
      <div
        className={cardClasses}
        onClick={() => handleSlotClick(slot)}
        draggable={canEdit && !isDisabled}
        onDragStart={(e) => handleDragStart(e, slot)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, slot)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-base-content/60">
            {mealTime === "LUNCH" ? "Lunch" : "Dinner"}
          </span>
          <div className="flex items-center gap-1">
            {isModerator && !isDisabled && !isLocked && defaultParamsId && !isEmpty && (
              <button
                className="btn btn-ghost btn-xs p-0 min-h-0 h-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmReplaceSlot(slot);
                }}
                disabled={replacingSlotId === slot.id}
                title="Replace with new suggestion"
                aria-label="Replace slot"
              >
                {replacingSlotId === slot.id ? (
                  <span className="loading loading-spinner w-3 h-3" />
                ) : (
                  <FaSyncAlt className="w-3 h-3 text-base-content/30 hover:text-primary" />
                )}
              </button>
            )}
            {isModerator && !isDisabled && (
              <button
                className={`btn btn-ghost btn-xs p-0 min-h-0 h-auto ${togglingLock === slot.id ? "loading" : ""}`}
                onClick={(e) => handleToggleLock(e, slot)}
                title={isLocked ? "Unlock slot" : "Lock slot"}
                aria-label={isLocked ? "Unlock slot" : "Lock slot"}
              >
                {isLocked ? (
                  <FaLock className="w-3 h-3 text-warning" />
                ) : (
                  <FaLockOpen className="w-3 h-3 text-base-content/30 hover:text-warning" />
                )}
              </button>
            )}
            {!isModerator && isLocked && <FaLock className="w-3 h-3 text-warning" />}
            {isDisabled && <FaBan className="w-3 h-3 text-base-content/40" />}
            {isDeleted && <FaExclamationTriangle className="w-3 h-3 text-error" />}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {isDisabled ? (
            <span className="text-xs text-base-content/40">Disabled</span>
          ) : isEmpty ? (
            <FaPlus className="w-5 h-5 text-base-content/30" />
          ) : (
            <div className="text-center">
              <p
                className={`text-sm font-medium truncate ${isDeleted ? "line-through text-base-content/50" : ""}`}
              >
                {slot.type === "RECIPE" ? slot.recipe?.title : slot.freeText}
              </p>
              {isDeleted && <span className="text-xs text-error">Deleted recipe</span>}
            </div>
          )}
        </div>

        {!isDisabled && !isEmpty && (
          <div className="text-xs text-base-content/60 text-right">{slot.servings} servings</div>
        )}
      </div>
    );
  };

  // Mobile layout: vertical cards
  if (isMobile) {
    return (
      <div className="space-y-4">
        {days.map((day) => (
          <div key={day.dateStr} className="bg-base-200/50 rounded-lg p-3">
            <div className="font-medium mb-2">
              {DAYS_OF_WEEK[day.date.getDay()]} {day.date.getDate()}/{day.date.getMonth() + 1}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {renderSlot(day.lunch, "LUNCH")}
              {renderSlot(day.dinner, "DINNER")}
            </div>
          </div>
        ))}

        {editingSlot && (
          <SlotEditModal
            communityId={communityId}
            slot={editingSlot}
            isModerator={isModerator}
            onSaved={handleSlotSaved}
            onClose={() => setEditingSlot(null)}
          />
        )}

        {confirmReplaceSlot && (
          <div className="modal modal-open">
            <div className="modal-box max-w-sm">
              <h3 className="font-bold text-lg mb-2">Replace this slot?</h3>
              <p className="text-sm text-base-content/70">
                Replace this meal with a new suggestion using the default generation params?
              </p>
              <div className="modal-action">
                <button className="btn btn-ghost" onClick={() => setConfirmReplaceSlot(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleReplaceSlot(confirmReplaceSlot)}
                  disabled={replacingSlotId !== null}
                >
                  {replacingSlotId ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Replace"
                  )}
                </button>
              </div>
            </div>
            <div className="modal-backdrop" onClick={() => setConfirmReplaceSlot(null)} />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout: horizontal grid
  return (
    <div className="overflow-x-auto">
      <table className="table w-full">
        <thead>
          <tr>
            <th className="w-20" />
            {days.map((day) => (
              <th key={day.dateStr} className="text-center min-w-[120px]">
                <div className="font-medium">{DAYS_OF_WEEK[day.date.getDay()]}</div>
                <div className="text-xs text-base-content/60">
                  {day.date.getDate()}/{day.date.getMonth() + 1}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="font-medium">Lunch</td>
            {days.map((day) => (
              <td key={`${day.dateStr}-lunch`} className="p-1">
                {renderSlot(day.lunch, "LUNCH")}
              </td>
            ))}
          </tr>
          <tr>
            <td className="font-medium">Dinner</td>
            {days.map((day) => (
              <td key={`${day.dateStr}-dinner`} className="p-1">
                {renderSlot(day.dinner, "DINNER")}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {editingSlot && (
        <SlotEditModal
          communityId={communityId}
          slot={editingSlot}
          isModerator={isModerator}
          onSaved={handleSlotSaved}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  );
};

export default MealPlanGrid;
