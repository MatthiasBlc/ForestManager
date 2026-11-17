// Accueil public (avant connexion).
import { Link } from "react-router";

export function PublicHome() {
  return (
    <div className="fm-root flex min-h-full flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6 text-center">
        <h1 className="font-display text-4xl font-bold">Forest Manager</h1>
        <p className="text-ink-muted">
          Tes recettes, tes repas et tes courses, partagés avec tes proches dans des espaces privés.
        </p>
        <div className="flex flex-col gap-3">
          <Link to="/register" className="fm-btn fm-btn-primary fm-btn-block">
            Créer un compte
          </Link>
          <Link to="/login" className="fm-btn fm-btn-secondary fm-btn-block">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
