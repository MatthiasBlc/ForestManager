// RecipeCard du design system : photo (ou fond teinte), titre, portions et temps,
// badges d'etat. Toucher ou Entree ouvre la recette (menu d'actions en C3.5).
import { Badge, type Tone } from "../../../ui/display.tsx";
import type { IconName } from "../../../ui/icon.tsx";

export interface CardBadge {
  label: string;
  tone?: Tone;
  icon?: IconName;
}

export function RecipeCard({
  title,
  meta,
  image,
  badges = [],
  onOpen,
}: {
  title: string;
  meta?: string;
  image?: string | null;
  badges?: readonly CardBadge[];
  onOpen: () => void;
}) {
  return (
    <article
      className="fm-rcard"
      tabIndex={0}
      aria-label={title}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
    >
      <div
        className="fm-rcard-img"
        style={
          image
            ? undefined
            : { background: "linear-gradient(140deg, var(--accent-soft), var(--surface))" }
        }
      >
        {image ? <img src={image} alt="" /> : null}
        {badges.length > 0 ? (
          <div className="fm-badges">
            {badges.map((badge) => (
              <Badge key={badge.label} tone={badge.tone} icon={badge.icon}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="fm-rcard-body">
        <b>{title}</b>
        {meta ? <small>{meta}</small> : null}
      </div>
    </article>
  );
}
