// Ranger les espaces du rail et du selecteur [D218] : glisser (souris, ou appui long
// au doigt [D204]) un espace sur un autre lui fait prendre sa place ; au clavier,
// Alt+Haut / Alt+Bas le deplace d'un cran, annonce lue par le lecteur d'ecran.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { usePointerDrag } from "../ui/use-pointer-drag.ts";

/** `source` prend la place de `target` ; les autres glissent d'un cran. */
export function moveTo(ids: readonly string[], source: string, target: string): string[] {
  const from = ids.indexOf(source);
  const to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = ids.filter((id) => id !== source);
  next.splice(to, 0, source);
  return next;
}

/** `id` monte (-1) ou descend (+1) d'un cran ; null en bout de liste. */
export function shift(ids: readonly string[], id: string, by: -1 | 1): string[] | null {
  const target = ids[ids.indexOf(id) + by];
  return target === undefined || !ids.includes(id) ? null : moveTo(ids, id, target);
}

export function useSpaceReorder(
  spaces: readonly { id: string; name: string }[],
  onReorder: ((ids: string[]) => void) | undefined
) {
  const ids = spaces.map((space) => space.id);
  const [message, setMessage] = useState("");
  // Element deplace au clavier : il garde le focus apres le nouveau rendu.
  const moved = useRef<HTMLElement | null>(null);
  const drag = usePointerDrag({
    onDrop: (source, target) => {
      onReorder?.(moveTo(ids, source, target));
    },
  });
  useEffect(() => {
    const el = moved.current;
    moved.current = null;
    el?.focus();
  });

  const item = (id: string) =>
    onReorder
      ? {
          ...drag.source(id),
          ...drag.target(id),
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
            event.preventDefault();
            const next = shift(ids, id, event.key === "ArrowUp" ? -1 : 1);
            if (!next) return;
            const name = spaces.find((space) => space.id === id)?.name ?? "";
            moved.current = event.currentTarget;
            setMessage(
              `${name} : position ${String(next.indexOf(id) + 1)} sur ${String(next.length)}`
            );
            onReorder(next);
          },
        }
      : {};
  return { item, message };
}
