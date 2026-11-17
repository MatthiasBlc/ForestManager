// Tirer pour rafraichir (composant PullToRefresh du design system, D186). Au toucher
// seulement, et seulement quand rien n'est defile au-dessus : le contenu garde son
// defilement vertical natif (evenements tactiles, pas `touch-action: pan-x` comme
// l'apercu du design system, qui bloquerait le defilement de la page).
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cx } from "./cx.ts";
import { Icon } from "./icon.tsx";

/** Distance a tirer (px, apres amortissement) pour declencher la relecture. */
const THRESHOLD = 64;
const MAX_PULL = 110;
const DAMPING = 0.6;
const BUSY_PULL = 56;

/** Vrai si l'element ou un de ses parents (ou la page) est defile vers le bas. */
function scrolledAbove(element: HTMLElement): boolean {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
  }
  return window.scrollY > 0;
}

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const refresh = useRef(onRefresh);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    refresh.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const state = { start: null as number | null, pull: 0, busy: false };
    const set = (value: number) => {
      state.pull = value;
      setPull(value);
    };
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (state.busy || event.touches.length !== 1 || !touch || scrolledAbove(element)) return;
      state.start = touch.clientY;
      setDragging(true);
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (state.start === null || !touch) return;
      // Un repas souleve se glisse : le geste n'est pas un rafraichissement [D204].
      if (
        event.target instanceof Element &&
        event.target.closest("[data-drag-lifted], [data-drag-source]")
      ) {
        set(0);
        return;
      }
      const distance = touch.clientY - state.start;
      if (distance <= 0) {
        set(0);
        return;
      }
      // Le geste est a nous : pas de rebond ni de rafraichissement natif du navigateur.
      if (event.cancelable) event.preventDefault();
      set(Math.min(MAX_PULL, distance * DAMPING));
    };
    const onEnd = () => {
      if (state.start === null) return;
      state.start = null;
      setDragging(false);
      if (state.pull <= THRESHOLD) {
        set(0);
        return;
      }
      state.busy = true;
      setBusy(true);
      set(BUSY_PULL);
      void refresh.current().finally(() => {
        state.busy = false;
        setBusy(false);
        set(0);
      });
    };
    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd);
    element.addEventListener("touchcancel", onEnd);
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div ref={box} className="fm-ptr fm-ptr-native">
      <div
        className={cx("fm-ptr-ind", busy && "fm-ptr-spin")}
        style={{
          transform: `translate(-50%, ${String(pull - 48)}px) rotate(${String(pull * 3)}deg)`,
        }}
        aria-hidden="true"
      >
        <Icon name="refresh" />
      </div>
      <div
        style={{
          transform: pull > 0 ? `translateY(${String(pull)}px)` : undefined,
          transition: dragging ? "none" : "transform 0.2s",
        }}
      >
        {children}
      </div>
      {busy ? (
        <span className="sr-only" role="status">
          Actualisation
        </span>
      ) : null}
    </div>
  );
}
