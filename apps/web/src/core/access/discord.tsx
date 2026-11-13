// Connexion avec Discord [D202, D210] : le navigateur part vers l'API, qui
// renvoie vers Discord puis revient sur le front (redirections, pas de fetch).
import { cx } from "../../ui/cx.ts";

/** Logo de Discord (marque blanche sur le violet de Discord). */
export function DiscordLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx("fm-discord-logo", className)}>
      <path d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1.1a15.6 15.6 0 0 0-5.8 0L8.6 4a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17.1a17.2 17.2 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.4 0l.4.3a11 11 0 0 1-1.7.8l1.1 1.8a17.1 17.1 0 0 0 5.2-2.6c.4-4.5-.7-8.4-3.1-11.8ZM8.5 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm7 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z" />
    </svg>
  );
}

/** "Continuer avec Discord", sous un separateur "ou". */
export function DiscordButton({ href }: { href: string }) {
  return (
    <>
      <div className="fm-or">ou</div>
      <a href={href} className="fm-btn fm-btn-discord fm-btn-block">
        <DiscordLogo />
        Continuer avec Discord
      </a>
    </>
  );
}
