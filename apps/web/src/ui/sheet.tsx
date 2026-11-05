// Sheet : feuille du bas sur mobile (glisser vers le bas pour fermer), dialogue
// centre a partir de 768px (CSS). Radix Dialog porte le role, le titre, le
// piege a focus, Echap et le retour du focus au declencheur.
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import { IconButton } from "./button.tsx";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Description lue par les lecteurs d'ecran (facultative). */
  description?: string;
  children: ReactNode;
}

/** Distance de glissement (px) au-dela de laquelle la feuille se ferme. */
const CLOSE_DISTANCE = 110;

export function Sheet({ open, onClose, title, description, children }: SheetProps) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  // Element actif a l'ouverture : il reprend le focus a la fermeture (feuille pilotee, sans Dialog.Trigger).
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement)
      opener.current = document.activeElement;
  }, [open]);

  const drag = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      start.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (start.current === null) return;
      setDy(Math.max(0, e.clientY - start.current));
    },
    onPointerUp: () => {
      if (start.current === null) return;
      start.current = null;
      if (dy > CLOSE_DISTANCE) onClose();
      setDy(0);
    },
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <div className="fm-layer fm-root">
          <Dialog.Overlay className="fm-overlay" />
          <Dialog.Content
            className="fm-sheet"
            onCloseAutoFocus={(event) => {
              if (opener.current?.isConnected) {
                event.preventDefault();
                opener.current.focus();
              }
            }}
            style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}
          >
            <div
              className="fm-sheet-grip"
              aria-hidden="true"
              {...drag}
              onPointerCancel={drag.onPointerUp}
            />
            <div className="fm-sheet-head" {...drag} onPointerCancel={drag.onPointerUp}>
              <Dialog.Title asChild>
                <h2>{title}</h2>
              </Dialog.Title>
              <Dialog.Close asChild>
                <IconButton icon="x" label="Fermer" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="fm-sr">{description ?? title}</Dialog.Description>
            <div className="fm-sheet-body">{children}</div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Pied de feuille passe en enfant, colle en bas du corps. */
export function SheetFooter({ children }: { children: ReactNode }) {
  return <div className="fm-sheet-foot fm-sheet-foot-slot">{children}</div>;
}
