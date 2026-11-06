// IngredientRow du design system : case a cocher (suivre ce qui est sorti),
// quantite deja mise a l'echelle, nom. Rien n'est enregistre sur la recette.
import { useState } from "react";

import { Icon } from "../../../ui/icon.tsx";

export function IngredientRow({
  amount,
  name,
  note,
  checked: controlled,
  onCheckedChange,
}: {
  amount: string;
  name: string;
  note?: string | null;
  /** Pilote de l'exterieur (mode cuisine : la feuille et l'etape partagent les cases). */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const checked = controlled ?? own;
  const toggle = () => {
    if (onCheckedChange) onCheckedChange(!checked);
    else setOwn(!checked);
  };
  return (
    <div
      className="fm-ing"
      role="checkbox"
      aria-checked={checked}
      aria-label={[amount, name, note].filter(Boolean).join(" ")}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggle();
        }
      }}
    >
      <span className="fm-ing-box" aria-hidden="true">
        {checked ? <Icon name="check" size={14} /> : null}
      </span>
      <span className="fm-ing-qty">{amount}</span>
      <span className="fm-ing-name">
        {name}
        {note ? <span className="text-ink-muted">, {note}</span> : null}
      </span>
    </div>
  );
}
