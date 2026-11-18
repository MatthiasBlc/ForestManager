// Tags d'origine repris au partage [D216] : une case par tag, toutes cochees ;
// decocher pour ne pas le reprendre. Un tag de meme nom de l'espace cible est
// pose, sinon il y est cree (l'API s'en charge).
import type { Tag } from "@fm/shared";

export function CarriedTags({
  tags,
  skipped,
  onSkipped,
  target,
}: {
  tags: readonly Tag[];
  /** Tags decoches. */
  skipped: ReadonlySet<string>;
  onSkipped: (skipped: Set<string>) => void;
  /** Nom du ou des espaces cibles. */
  target: string;
}) {
  if (tags.length === 0) return null;
  const label = `Tags à reprendre dans ${target}`;
  return (
    <section className="fm-stack" role="group" aria-label={label}>
      <h3 className="m-0 text-sm font-semibold text-ink-muted" aria-hidden="true">
        {label}
      </h3>
      <ul className="fm-pick-list">
        {tags.map((tag) => (
          <li key={tag.id}>
            <label className="fm-pick">
              <input
                type="checkbox"
                checked={!skipped.has(tag.id)}
                onChange={(event) => {
                  const next = new Set(skipped);
                  if (event.target.checked) next.delete(tag.id);
                  else next.add(tag.id);
                  onSkipped(next);
                }}
              />
              <span className="fm-pick-text">
                <b>{tag.name}</b>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <small className="text-ink-muted">Un tag du même nom y est posé, sinon il y est créé.</small>
    </section>
  );
}
