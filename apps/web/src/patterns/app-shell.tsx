// AppShell : grille du shell ; chaque zone se place par sa classe (rail, barre du
// module, en-tete, contenu, onglets). Mobile d'abord, requetes de conteneur.
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router";

export function AppShell({
  rail,
  nav,
  top,
  tabbar,
  children,
}: {
  rail?: ReactNode;
  nav?: ReactNode;
  top?: ReactNode;
  tabbar?: ReactNode;
  children: ReactNode;
}) {
  // Le contenu defile dans <main> : un nouvel ecran repart du haut. Un simple
  // changement de recherche (?day=, filtres) garde la position.
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="fm-shell fm-root">
      <div className="fm-shell-grid">
        {rail}
        {nav}
        {top}
        <main ref={main} className="fm-shell-main">
          {children}
        </main>
        {tabbar}
      </div>
    </div>
  );
}
