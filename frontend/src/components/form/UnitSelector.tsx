import { UnitsByCategory, UnitCategory } from "../../models/recipe";

interface UnitSelectorProps {
  value: string | null;
  onChange: (unitId: string | null) => void;
  units: UnitsByCategory;
  disabled?: boolean;
}

const CATEGORY_LABELS: Record<UnitCategory, string> = {
  WEIGHT: "Weight",
  VOLUME: "Volume",
  SPOON: "Spoon",
  COUNT: "Count",
  QUALITATIVE: "Qualitative",
};

const CATEGORY_ORDER: UnitCategory[] = ["WEIGHT", "VOLUME", "SPOON", "COUNT", "QUALITATIVE"];

const UnitSelector = ({ value, onChange, units, disabled }: UnitSelectorProps) => {
  const hasUnits = CATEGORY_ORDER.some((cat) => (units[cat]?.length ?? 0) > 0);

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="select select-bordered select-sm w-28"
      disabled={disabled || !hasUnits}
      aria-label="Unit"
    >
      <option value="">Unit</option>
      {CATEGORY_ORDER.filter((cat) => (units[cat]?.length ?? 0) > 0).map((cat) => (
        <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
          {units[cat]!.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.abbreviation}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default UnitSelector;
