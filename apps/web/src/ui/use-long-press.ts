import { useRef, useState, type PointerEvent } from "react";

/** Appui long (500 ms sans bouger) : ouvre le menu ; le clic qui suit est annule. */
export function useLongPress(callback: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const origin = useRef<[number, number] | null>(null);
  const [pressing, setPressing] = useState(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPressing(false);
  };

  return {
    pressing,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        fired.current = false;
        origin.current = [e.clientX, e.clientY];
        setPressing(true);
        timer.current = setTimeout(() => {
          fired.current = true;
          setPressing(false);
          callback();
        }, ms);
      },
      onPointerMove: (e: PointerEvent) => {
        const [x, y] = origin.current ?? [e.clientX, e.clientY];
        if (Math.abs(e.clientX - x) > 8 || Math.abs(e.clientY - y) > 8) clear();
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: { preventDefault: () => void }) => {
        e.preventDefault();
      },
      onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => {
        if (fired.current) {
          e.stopPropagation();
          e.preventDefault();
          fired.current = false;
        }
      },
    },
  };
}
