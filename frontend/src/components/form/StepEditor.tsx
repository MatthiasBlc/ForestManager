import { useState } from "react";
import { FaPlus, FaArrowUp, FaArrowDown, FaTimes, FaGripVertical } from "react-icons/fa";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface StepInput {
  instruction: string;
}

interface StepEditorProps {
  value: StepInput[];
  onChange: (steps: StepInput[]) => void;
}

interface StepWithId extends StepInput {
  id: string;
}

interface SortableStepProps {
  step: StepWithId;
  index: number;
  total: number;
  onUpdate: (index: number, instruction: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

const SortableStep = ({ step, index, total, onUpdate, onRemove, onMove }: SortableStepProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start">
      <button
        type="button"
        className="btn btn-ghost btn-xs mt-3 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <FaGripVertical />
      </button>
      <div className="badge badge-neutral mt-3">{index + 1}</div>
      <textarea
        className="textarea textarea-bordered flex-1"
        value={step.instruction}
        onChange={(e) => onUpdate(index, e.target.value)}
        rows={3}
        placeholder={`Etape ${index + 1}...`}
        maxLength={5000}
      />
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label="Move up"
        >
          <FaArrowUp />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label="Move down"
        >
          <FaArrowDown />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs text-error"
          onClick={() => onRemove(index)}
          disabled={total === 1}
          aria-label="Remove step"
        >
          <FaTimes />
        </button>
      </div>
    </div>
  );
};

let nextId = 1;
const generateId = () => `step-${nextId++}`;

const StepEditor = ({ value, onChange }: StepEditorProps) => {
  const [stepsWithIds, setStepsWithIds] = useState<StepWithId[]>(() =>
    value.map((s) => ({ ...s, id: generateId() }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const syncAndNotify = (updated: StepWithId[]) => {
    setStepsWithIds(updated);
    onChange(updated.map(({ instruction }) => ({ instruction })));
  };

  const updateStep = (index: number, instruction: string) => {
    const updated = [...stepsWithIds];
    updated[index] = { ...updated[index], instruction };
    syncAndNotify(updated);
  };

  const addStep = () => {
    syncAndNotify([...stepsWithIds, { instruction: "", id: generateId() }]);
  };

  const removeStep = (index: number) => {
    if (stepsWithIds.length <= 1) return;
    syncAndNotify(stepsWithIds.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stepsWithIds.length) return;
    const updated = [...stepsWithIds];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    syncAndNotify(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stepsWithIds.findIndex((s) => s.id === active.id);
    const newIndex = stepsWithIds.findIndex((s) => s.id === over.id);
    syncAndNotify(arrayMove(stepsWithIds, oldIndex, newIndex));
  };

  // Sync internal state when value changes externally (e.g. parent reset)
  const isOutOfSync =
    value.length !== stepsWithIds.length ||
    value.some((s, i) => s.instruction !== stepsWithIds[i]?.instruction);
  if (isOutOfSync) {
    setStepsWithIds(value.map((s, i) => ({ ...s, id: stepsWithIds[i]?.id || generateId() })));
  }

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={stepsWithIds.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {stepsWithIds.map((step, index) => (
            <SortableStep
              key={step.id}
              step={step}
              index={index}
              total={stepsWithIds.length}
              onUpdate={updateStep}
              onRemove={removeStep}
              onMove={moveStep}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" className="btn btn-outline btn-sm gap-2" onClick={addStep}>
        <FaPlus /> Ajouter une etape
      </button>
    </div>
  );
};

export default StepEditor;
