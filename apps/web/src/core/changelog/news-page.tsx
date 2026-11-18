// Nouveautes : versions publiees de Forest Manager, la plus recente d'abord.
// Ouverte depuis le profil, la page de connexion et la notification "nouvelle
// version" [D127]. Sans connexion : versions publiques seulement, mise en page
// des ecrans d'acces [D226].
import { listSchema, releaseSchema, type Release } from "@fm/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { api } from "../../lib/api.ts";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { AuthLayout } from "../access/auth-layout.tsx";
import { ProfileLayout } from "../profile/profile-layout.tsx";
import { useRealtime } from "../realtime/use-realtime.ts";
import { meQuery } from "../session/queries.ts";
import { useRememberPage } from "../shell/return-to.ts";
import { InlineMarkdown } from "./inline-markdown.tsx";
import { releaseDate, sectionsOf } from "./sections.ts";

const releasesQuery = queryOptions({
  queryKey: ["releases"],
  queryFn: async () => (await api.get("/releases", listSchema(releaseSchema))).data,
});

function ReleaseArticle({ release }: { release: Release }) {
  const titleId = `release-${release.version}`;
  // Titre par defaut ("Version 2.0.0") : la version n'est pas repetee au-dessus.
  const defaultTitle = release.title === `Version ${release.version}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-5"
    >
      <header className="flex flex-col gap-1">
        <span className="text-sm text-ink-muted">
          {defaultTitle ? null : (
            <>
              <b className="font-mono text-ink">Version {release.version}</b> ·{" "}
            </>
          )}
          {releaseDate(release.publishedAt)}
        </span>
        <h2 id={titleId} className="m-0 font-display text-xl font-bold">
          {release.title}
        </h2>
      </header>
      {sectionsOf(release.content)
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <section key={section.key} className="flex flex-col gap-1">
            <h3 className="m-0 text-sm font-semibold">{section.label}</h3>
            <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
              {section.items.map((item, index) => (
                <li key={index}>
                  <InlineMarkdown text={item.text} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </article>
  );
}

function Releases() {
  const releases = useQuery(releasesQuery);
  return (
    <>
      {releases.isPending ? <Skeleton label="Chargement des nouveautés" /> : null}
      {releases.data?.length === 0 ? (
        <EmptyState icon="sparkles" title="Rien de nouveau pour l'instant">
          Les prochaines versions de Forest Manager apparaîtront ici.
        </EmptyState>
      ) : null}
      {releases.data?.map((release) => (
        <ReleaseArticle key={release.version} release={release} />
      ))}
    </>
  );
}

export function NewsPage() {
  const me = useQuery(meQuery);
  // Hors de RequireAuth : memes services pour un utilisateur connecte.
  useRealtime(Boolean(me.data));
  useRememberPage();
  if (me.isPending) return <Skeleton label="Chargement de la session" />;
  if (!me.data) {
    return (
      <AuthLayout title="Nouveautés" wide>
        <Releases />
        <Link to="/login" className="text-accent-text underline">
          Se connecter
        </Link>
      </AuthLayout>
    );
  }
  return (
    <ProfileLayout title="Nouveautés" back="/profile">
      <Releases />
    </ProfileLayout>
  );
}
