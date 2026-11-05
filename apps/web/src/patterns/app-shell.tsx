// AppShell : grille du shell ; chaque zone se place par sa classe (rail, barre du
// module, en-tete, contenu, onglets). Mobile d'abord, requetes de conteneur.
import type { ReactNode } from "react";

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
  return (
    <div className="fm-shell fm-root">
      <div className="fm-shell-grid">
        {rail}
        {nav}
        {top}
        <main className="fm-shell-main">{children}</main>
        {tabbar}
      </div>
    </div>
  );
}
