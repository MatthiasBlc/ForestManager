// Barres propres a une page (D100, D136) : une page de detail ou un editeur
// remplace l'en-tete du shell (retour, mode edition) et la barre d'onglets (action
// principale fixee en bas, ou rien). Le shell expose deux emplacements ; la page y
// rend ses barres par portail, ce qui garde leur etat dans la page.
import { useContext, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ChromeContext, type ChromeSlots } from "./page-chrome-context.ts";

export function ChromeProvider({ value, children }: { value: ChromeSlots; children: ReactNode }) {
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

/** Remplace l'en-tete (et la barre d'onglets) du shell tant que la page est montee. */
export function PageChrome({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  const slots = useContext(ChromeContext);
  const claim = slots?.claim;
  useLayoutEffect(() => {
    claim?.(true);
    return () => claim?.(false);
  }, [claim]);
  if (!slots) {
    return (
      <>
        {top}
        {bottom}
      </>
    );
  }
  return (
    <>
      {slots.top ? createPortal(top, slots.top) : null}
      {slots.bottom && bottom ? createPortal(bottom, slots.bottom) : null}
    </>
  );
}
