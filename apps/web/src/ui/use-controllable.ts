import { useState } from "react";

/** Valeur controlee (`value` fourni) ou interne (`defaultValue`), avec rappel de changement. */
export function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void
): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const current = value === undefined ? inner : value;
  const set = (next: T) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };
  return [current, set];
}
