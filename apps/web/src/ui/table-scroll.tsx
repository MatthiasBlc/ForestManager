// Tableau large : il defile horizontalement sur petit ecran. La zone de
// defilement est nommee et atteignable au clavier (fleches), sans quoi une
// colonne hors champ serait hors de portee (axe scrollable-region-focusable).
import type { ReactNode } from "react";

type Name = { label: string; labelledBy?: undefined } | { label?: undefined; labelledBy: string };

export function TableScroll({
  label,
  labelledBy,
  className,
  children,
}: Name & { className?: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      aria-labelledby={labelledBy}
      tabIndex={0}
      className={className ? `overflow-x-auto ${className}` : "overflow-x-auto"}
    >
      {children}
    </div>
  );
}
