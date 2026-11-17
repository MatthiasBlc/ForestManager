// Glisser au pointeur [D204] : un seul code pour la souris et le doigt, a la place du
// drag natif (qui ne marche pas au toucher). Souris : le glisser part des que le pointeur
// bouge de quelques pixels. Doigt : appui long, la case se souleve ; si le doigt bouge,
// glisser ; sinon `onMenu` au relachement. Echap, relacher hors d'une cible ou sur la case
// d'origine : rien. Rendu impératif (fantome clone, attributs `data-*`) : pas de rendu
// React a chaque mouvement.
import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Souris : distance avant de soulever la case. */
const MOUSE_START = 5;
/** Doigt : au-dela, c'est un defilement (avant l'appui long) ou un glisser (apres). */
const TOUCH_SLOP = 8;
const LONG_PRESS_MS = 500;
/** Bande au bord du conteneur ou la page defile pendant le glisser. */
const EDGE = 56;

type Phase = "pending" | "pressing" | "lifted" | "dragging";

interface Session {
  id: string;
  el: HTMLElement;
  touch: boolean;
  pointerId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  phase: Phase;
  onMenu: (() => void) | undefined;
  timer?: ReturnType<typeof setTimeout>;
  ghost?: HTMLElement;
  over?: HTMLElement | null;
  raf?: number;
  scroller?: Element;
  detach: () => void;
}

export interface PointerDragOptions {
  /** Case lachee sur une autre (identifiants `source` et `target`). */
  onDrop: (source: string, target: string) => void;
}

export interface SourceOptions {
  /** Appui long sans bouger, clic droit, touche Menu. */
  onMenu?: (() => void) | undefined;
}

const far = (s: Session, limit: number) =>
  Math.abs(s.x - s.x0) > limit || Math.abs(s.y - s.y0) > limit;

/** Cible sous le pointeur ; au doigt, l'evenement vise toujours la case de depart. */
function dropTarget(event: { clientX: number; clientY: number; target: EventTarget | null }) {
  const atPoint =
    typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(event.clientX, event.clientY)
      : null;
  const hit = atPoint ?? (event.target instanceof Element ? event.target : null);
  return hit?.closest<HTMLElement>("[data-drop-id]") ?? null;
}

/** Premier ancetre qui defile, sinon la page. */
function scrollParent(el: Element): Element {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight)
      return node;
  }
  return document.scrollingElement ?? document.documentElement;
}

function makeGhost(el: HTMLElement): HTMLElement {
  const rect = el.getBoundingClientRect();
  const ghost = el.cloneNode(true) as HTMLElement;
  for (const node of [ghost, ...ghost.querySelectorAll("[id]")]) node.removeAttribute("id");
  for (const name of [
    "data-drag-id",
    "data-drop-id",
    "data-drag-lifted",
    "data-drag-source",
    "aria-describedby",
    "href",
  ])
    ghost.removeAttribute(name);
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("tabindex", "-1");
  ghost.classList.add("fm-drag-ghost");
  Object.assign(ghost.style, {
    left: `${String(rect.left)}px`,
    top: `${String(rect.top)}px`,
    width: `${String(rect.width)}px`,
    height: `${String(rect.height)}px`,
  });
  document.body.appendChild(ghost);
  return ghost;
}

const preventScroll = (event: TouchEvent) => {
  if (event.cancelable) event.preventDefault();
};

export function usePointerDrag({ onDrop }: PointerDragOptions) {
  const session = useRef<Session | null>(null);
  /** Case dont le prochain clic est annule (apres un glisser ou un appui long). */
  const swallow = useRef<string | null>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  }, [onDrop]);

  const setOver = (s: Session, over: HTMLElement | null) => {
    const next = over?.dataset.dropId === s.id ? null : over;
    if (next === s.over) return;
    s.over?.removeAttribute("data-drop-over");
    next?.setAttribute("data-drop-over", "");
    s.over = next;
  };

  const end = (s: Session) => {
    if (s.timer) clearTimeout(s.timer);
    if (s.raf !== undefined) cancelAnimationFrame(s.raf);
    s.ghost?.remove();
    s.over?.removeAttribute("data-drop-over");
    s.el.removeAttribute("data-drag-source");
    s.el.removeAttribute("data-drag-lifted");
    s.detach();
    if (session.current === s) session.current = null;
  };

  // Defilement au bord du conteneur tant que le pointeur y reste.
  const autoScroll = (s: Session) => {
    if (typeof requestAnimationFrame !== "function") return;
    const tick = () => {
      if (session.current !== s || s.phase !== "dragging") return;
      const scroller = s.scroller ?? document.documentElement;
      const page = scroller === document.scrollingElement || scroller === document.documentElement;
      const top = page ? 0 : scroller.getBoundingClientRect().top;
      const bottom = page ? window.innerHeight : scroller.getBoundingClientRect().bottom;
      let dy = 0;
      if (s.y < top + EDGE) dy = -Math.ceil((top + EDGE - s.y) / 4);
      else if (s.y > bottom - EDGE) dy = Math.ceil((s.y - bottom + EDGE) / 4);
      if (dy !== 0) {
        scroller.scrollBy(0, dy);
        setOver(s, dropTarget({ clientX: s.x, clientY: s.y, target: null }));
      }
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  };

  const startDrag = (s: Session) => {
    s.phase = "dragging";
    s.el.setAttribute("data-drag-source", "");
    s.el.removeAttribute("data-drag-lifted");
    s.ghost = makeGhost(s.el);
    s.scroller = scrollParent(s.el);
    autoScroll(s);
  };

  const lift = (s: Session) => {
    s.phase = "lifted";
    s.el.setAttribute("data-drag-lifted", "");
    // Le geste ne defile plus la page : touch-action ne change pas en cours de geste.
    window.addEventListener("touchmove", preventScroll, { passive: false });
    if (typeof navigator.vibrate === "function") navigator.vibrate(10);
  };

  const begin = (event: ReactPointerEvent<HTMLElement>, id: string, onMenu?: () => void) => {
    if (event.button !== 0 || session.current) return;
    swallow.current = null;
    const el = event.currentTarget;
    const touch = event.pointerType !== "mouse";

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== s.pointerId) return;
      s.x = e.clientX;
      s.y = e.clientY;
      if (s.phase === "pending" && far(s, MOUSE_START)) startDrag(s);
      else if (s.phase === "pressing" && far(s, TOUCH_SLOP)) end(s);
      else if (s.phase === "lifted" && far(s, TOUCH_SLOP)) startDrag(s);
      if (s.phase !== "dragging") return;
      if (e.cancelable) e.preventDefault();
      s.ghost?.style.setProperty("--fm-drag-x", `${String(s.x - s.x0)}px`);
      s.ghost?.style.setProperty("--fm-drag-y", `${String(s.y - s.y0)}px`);
      setOver(s, dropTarget(e));
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== s.pointerId) return;
      const { phase, over } = s;
      end(s);
      if (phase === "lifted") {
        swallow.current = id;
        s.onMenu?.();
      } else if (phase === "dragging") {
        swallow.current = id;
        const target = over?.dataset.dropId;
        if (target && target !== id) dropRef.current(id, target);
      }
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId === s.pointerId) end(s);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (s.phase === "lifted" || s.phase === "dragging") swallow.current = id;
      end(s);
    };

    const s: Session = {
      id,
      el,
      touch,
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      x: event.clientX,
      y: event.clientY,
      phase: touch ? "pressing" : "pending",
      onMenu,
      detach: () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("touchmove", preventScroll);
      },
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    if (touch) {
      s.timer = setTimeout(() => {
        if (session.current === s && s.phase === "pressing") lift(s);
      }, LONG_PRESS_MS);
    }
    session.current = s;
  };

  // Demontage pendant un geste : fantome et ecouteurs retires.
  useEffect(
    () => () => {
      if (session.current) end(session.current);
    },
    []
  );

  return {
    /** A poser sur une case qu'on peut prendre. */
    source: (id: string, { onMenu }: SourceOptions = {}) => ({
      "data-drag-id": id,
      draggable: false,
      onDragStart: (event: { preventDefault: () => void }) => {
        event.preventDefault();
      },
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        begin(event, id, onMenu);
      },
      onClickCapture: (event: ReactMouseEvent) => {
        if (swallow.current !== id) return;
        swallow.current = null;
        event.preventDefault();
        event.stopPropagation();
      },
      // Clic droit, touche Menu, Maj+F10 ; l'appui long au doigt passe par `onMenu` au
      // relachement, son menu contextuel natif est ignore.
      onContextMenu: (event: ReactMouseEvent) => {
        event.preventDefault();
        if (session.current?.touch) return;
        onMenu?.();
      },
    }),
    /** A poser sur une case ou l'on peut lacher. */
    target: (id: string) => ({ "data-drop-id": id }),
  };
}
