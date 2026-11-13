// Controles de formulaire du design system : Switch, Stepper, SegmentedControl,
// Chip, RadioGroup, TintPicker. Switch repose sur Radix ; les autres sont des
// elements natifs (TintPicker gere ses fleches lui-meme).
import { Switch as RadixSwitch } from "radix-ui";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "./cx.ts";
import { Icon } from "./icon.tsx";
import { useControllable } from "./use-controllable.ts";

export interface SwitchProps {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export function Switch({
  label,
  checked,
  defaultChecked = false,
  disabled,
  onChange,
}: SwitchProps) {
  const [on, setOn] = useControllable(checked, defaultChecked, onChange);
  return (
    <label className="fm-switch">
      <RadixSwitch.Root
        className="fm-switch-track"
        checked={on}
        disabled={disabled}
        onCheckedChange={setOn}
      />
      <span>{label}</span>
    </label>
  );
}

export interface StepperProps {
  label: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  unit?: string;
  format?: (value: number) => string;
  onChange?: (value: number) => void;
}

export function Stepper({
  label,
  value,
  defaultValue,
  min = 1,
  max = 24,
  unit,
  format,
  onChange,
}: StepperProps) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? min, onChange);
  const set = (next: number) => {
    setCurrent(Math.max(min, Math.min(max, next)));
  };
  const text = format ? format(current) : `${current}${unit ? ` ${unit}` : ""}`;
  return (
    <div className="fm-stepper" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Moins"
        disabled={current <= min}
        onClick={() => {
          set(current - 1);
        }}
      >
        <Icon name="minus" />
      </button>
      <output aria-live="polite">{text}</output>
      <button
        type="button"
        aria-label="Plus"
        disabled={current >= max}
        onClick={() => {
          set(current + 1);
        }}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}

export interface Option<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedControlProps<V extends string> {
  label: string;
  options: readonly Option<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
}

export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  defaultValue,
  onChange,
}: SegmentedControlProps<V>) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? options[0]?.value, (v) => {
    if (v !== undefined) onChange?.(v);
  });
  return (
    <div className="fm-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === current}
          onClick={() => {
            setCurrent(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface ChipProps {
  selected?: boolean;
  defaultSelected?: boolean;
  onToggle?: (selected: boolean) => void;
  children: ReactNode;
}

export function Chip({ selected, defaultSelected = false, onToggle, children }: ChipProps) {
  const [on, setOn] = useControllable(selected, defaultSelected, onToggle);
  return (
    <button
      type="button"
      className="fm-chip"
      aria-pressed={on}
      onClick={() => {
        setOn(!on);
      }}
    >
      {on ? <Icon name="check" size={16} /> : null}
      {children}
    </button>
  );
}

export interface RadioOption<V extends string> extends Option<V> {
  hint?: string;
  disabled?: boolean;
  /** Apercu en pastilles de couleur (ambiances, D137). */
  swatches?: readonly string[];
}

export interface RadioGroupProps<V extends string> {
  label: string;
  options: readonly RadioOption<V>[];
  value?: V;
  defaultValue?: V;
  onChange?: (value: V) => void;
}

export function RadioGroup<V extends string>({
  label,
  options,
  value,
  defaultValue,
  onChange,
}: RadioGroupProps<V>) {
  const name = useId();
  const [current, setCurrent] = useControllable<V | undefined>(value, defaultValue, (v) => {
    if (v !== undefined) onChange?.(v);
  });
  return (
    <div className="fm-radios" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const on = option.value === current;
        return (
          <label
            key={option.value}
            className={cx("fm-radio", on && "fm-radio-on", option.disabled && "fm-radio-off")}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={on}
              disabled={option.disabled}
              onChange={() => {
                setCurrent(option.value);
              }}
            />
            <span className="fm-radio-dot" aria-hidden="true" />
            <span className="fm-radio-text">
              <b>{option.label}</b>
              {option.hint ? <small>{option.hint}</small> : null}
            </span>
            {option.swatches?.length ? (
              <span className="fm-radio-swatches" aria-hidden="true">
                {option.swatches.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

const TINT_NAMES = ["Teinte 1", "Teinte 2", "Teinte 3", "Teinte 4", "Teinte 5"] as const;

export interface TintPickerProps {
  label?: string;
  value?: number;
  defaultValue?: number;
  /** Noms des teintes de l'ambiance courante (Braise, Nuit...). */
  names?: readonly string[];
  onChange?: (tint: number) => void;
}

/** Nuancier des 5 teintes d'espace : un groupe radio (fleches pour changer, focus itinerant). */
export function TintPicker({
  label = "Teinte de l'espace",
  value,
  defaultValue = 1,
  names,
  onChange,
}: TintPickerProps) {
  const [current, setCurrent] = useControllable(value, defaultValue, onChange);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (n: number) => {
    setCurrent(n);
    refs.current[n - 1]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    select(((current - 1 + step + 5) % 5) + 1);
  };
  return (
    <div className="fm-tints" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {[1, 2, 3, 4, 5].map((n) => {
        const name = names?.[n - 1] ?? TINT_NAMES[n - 1];
        const on = n === current;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={name}
            title={name}
            tabIndex={on ? 0 : -1}
            className="fm-tint"
            style={{ background: `var(--tint-${n})`, color: `var(--on-tint-${n})` }}
            onClick={() => {
              select(n);
            }}
          >
            {on ? <Icon name="check" /> : null}
          </button>
        );
      })}
    </div>
  );
}
