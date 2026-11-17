// Fil d'activite d'un espace groupe (F-SPC-7). Pas de maquette : meme liste
// groupee par jour que E-NOTIFICATIONS [D190].
import { activityEventSchema, pageSchema, type ActivityEvent, type SpaceDetail } from "@fm/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { Avatar, EmptyState, Skeleton } from "../../ui/display.tsx";
import { ageLabel, dayGroup } from "../notifications/format.ts";
import { renderActivity } from "./messages.ts";

function activityQuery(spaceId: string) {
  return {
    queryKey: ["spaces", spaceId, "activity"],
    queryFn: ({ pageParam }: { pageParam: string }) =>
      api.get(
        `/spaces/${spaceId}/activity?limit=30${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        pageSchema(activityEventSchema)
      ),
    initialPageParam: "",
    getNextPageParam: (page: { nextCursor: string | null }) => page.nextCursor ?? undefined,
  };
}

function groups(events: ActivityEvent[]) {
  const result: { title: string; items: ActivityEvent[] }[] = [];
  for (const event of events) {
    const title = dayGroup(event.createdAt);
    const last = result.at(-1);
    if (last?.title === title) last.items.push(event);
    else result.push({ title, items: [event] });
  }
  return result;
}

/** Ligne du fil ; `spaceName` la situe hors de la page de l'espace (accueil). */
export function ActivityRow({
  event,
  spaceId,
  spaceName,
}: {
  event: ActivityEvent;
  spaceId: string;
  spaceName?: string;
}) {
  const view = renderActivity(event, spaceId);
  const name = event.actor?.username ?? "Un ancien membre";
  const body = (
    <>
      <Avatar name={name} src={event.actor?.avatarUrl} size={40} />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[15px] leading-[22px]">
          <b>{name}</b> {view.text}
        </span>
        <span className="text-[13px] leading-[18px] text-ink-muted">
          {ageLabel(event.createdAt)}
          {spaceName ? ` · ${spaceName}` : null}
        </span>
      </span>
    </>
  );
  const className = "flex gap-3 border-b border-line px-4 py-3 text-ink no-underline";
  return view.to ? (
    <Link to={view.to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function ActivityPage({ space }: { space: SpaceDetail }) {
  const list = useInfiniteQuery(activityQuery(space.id));
  const events = list.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <h1 className="px-4 pt-4 font-display text-2xl font-bold">Activité de {space.name}</h1>
      {list.isPending ? (
        <div className="p-4">
          <Skeleton kind="row" count={4} />
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon="history" title="Rien ne s'est encore passé ici." />
      ) : (
        groups(events).map((group, index) => (
          <section key={group.title} aria-labelledby={`activity-${String(index)}`}>
            <h2
              id={`activity-${String(index)}`}
              className="px-4 pt-4 pb-1.5 text-xs font-semibold tracking-[0.04em] text-ink-muted uppercase"
            >
              {group.title}
            </h2>
            {group.items.map((event) => (
              <ActivityRow key={event.id} event={event} spaceId={space.id} />
            ))}
          </section>
        ))
      )}
      {list.hasNextPage ? (
        <div className="flex justify-center p-4">
          <Button
            variant="secondary"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Voir plus
          </Button>
        </div>
      ) : null}
    </div>
  );
}
