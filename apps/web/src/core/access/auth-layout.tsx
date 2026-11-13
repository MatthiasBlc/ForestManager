// Mise en page des ecrans d'acces : une colonne centree, le nom en tete.
import type { ReactNode } from "react";
import { Link } from "react-router";

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fm-root flex min-h-full flex-col items-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/" className="font-display text-lg font-bold text-ink no-underline">
          Forest Manager
        </Link>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** Erreur generale d'un formulaire, annoncee aux lecteurs d'ecran. */
export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger-text">
      {message}
    </p>
  );
}
