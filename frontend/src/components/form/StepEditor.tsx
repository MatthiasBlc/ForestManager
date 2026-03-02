import { FaPlus, FaArrowUp, FaArrowDown, FaTimes } from "react-icons/fa";

interface StepInput {
  instruction: string;
}

interface StepEditorProps {
  value: StepInput[];
  onChange: (steps: StepInput[]) => void;
}

const StepEditor = ({ value, onChange }: StepEditorProps) => {
  const updateStep = (index: number, instruction: string) => {
    const updated = [...value];
    updated[index] = { instruction };
    onChange(updated);
  };

  const addStep = () => {
    onChange([...value, { instruction: "" }]);
  };

  const removeStep = (index: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const updated = [...value];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {value.map((step, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="badge badge-neutral mt-3">{index + 1}</div>
          <textarea
            className="textarea textarea-bordered flex-1"
            value={step.instruction}
            onChange={(e) => updateStep(index, e.target.value)}
            rows={3}
            placeholder={`Etape ${index + 1}...`}
            maxLength={5000}
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => moveStep(index, -1)}
              disabled={index === 0}
              aria-label="Move up"
            >
              <FaArrowUp />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => moveStep(index, 1)}
              disabled={index === value.length - 1}
              aria-label="Move down"
            >
              <FaArrowDown />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs text-error"
              onClick={() => removeStep(index)}
              disabled={value.length === 1}
              aria-label="Remove step"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm gap-2"
        onClick={addStep}
      >
        <FaPlus /> Ajouter une etape
      </button>
    </div>
  );
};

export default StepEditor;
