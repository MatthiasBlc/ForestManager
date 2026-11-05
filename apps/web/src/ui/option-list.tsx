// OptionList : lignes selectionnables (espace, profil, export...). Un ou plusieurs choix.
import { SpaceIcon } from "../patterns/space-icon.tsx";
import type { SpaceVisual } from "../patterns/space-label.ts";
import { cx } from "./cx.ts";
import { Avatar, Badge, type Tone } from "./display.tsx";
import { Icon, type IconName } from "./icon.tsx";
import { useControllable } from "./use-controllable.ts";

export interface OptionItem<V extends string> {
  value: V;
  label: string;
  hint?: string;
  icon?: IconName;
  avatar?: string;
  tint?: number;
  space?: SpaceVisual;
  badge?: string;
  badgeTone?: Tone;
  disabled?: boolean;
}

interface CommonProps<V extends string> {
  label: string;
  options: readonly OptionItem<V>[];
  /** false : lignes de navigation (chevron), sans coche. */
  selectable?: boolean;
}

type SingleProps<V extends string> = CommonProps<V> & {
  multiple?: false;
  value?: V | null;
  defaultValue?: V | null;
  onChange?: (value: V) => void;
};

type MultipleProps<V extends string> = CommonProps<V> & {
  multiple: true;
  value?: V[];
  defaultValue?: V[];
  onChange?: (value: V[]) => void;
};

export function OptionList<V extends string>(props: SingleProps<V> | MultipleProps<V>) {
  const { label, options, selectable = true } = props;
  const [current, setCurrent] = useControllable<V | V[] | null>(
    props.value,
    props.defaultValue ?? (props.multiple ? [] : null),
    (next) => {
      if (props.multiple) props.onChange?.(next as V[]);
      else if (next !== null) props.onChange?.(next as V);
    }
  );
  const isOn = (value: V) => (Array.isArray(current) ? current.includes(value) : current === value);
  const pick = (value: V) => {
    if (Array.isArray(current)) {
      setCurrent(isOn(value) ? current.filter((v) => v !== value) : [...current, value]);
    } else {
      setCurrent(value);
    }
  };

  return (
    <div
      className="fm-options"
      role="listbox"
      aria-label={label}
      aria-multiselectable={props.multiple ? true : undefined}
    >
      {options.map((option) => {
        const on = isOn(option.value);
        const lead = option.space ? (
          <SpaceIcon space={option.space} />
        ) : option.avatar ? (
          <Avatar name={option.avatar} tint={option.tint} size={36} />
        ) : option.icon ? (
          <span className="fm-option-icon">
            <Icon name={option.icon} />
          </span>
        ) : null;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={on}
            disabled={option.disabled}
            className={cx("fm-option", on && "fm-option-on")}
            onClick={() => {
              pick(option.value);
            }}
          >
            {lead}
            <span className="fm-option-text">
              <b>{option.label}</b>
              {option.hint ? <small>{option.hint}</small> : null}
            </span>
            {option.badge ? <Badge tone={option.badgeTone}>{option.badge}</Badge> : null}
            {selectable ? (
              <span
                className={cx("fm-option-check", props.multiple && "fm-option-box")}
                aria-hidden="true"
              >
                {on ? <Icon name="check" size={16} /> : null}
              </span>
            ) : (
              <Icon name="chevron-right" className="fm-option-go" />
            )}
          </button>
        );
      })}
    </div>
  );
}
