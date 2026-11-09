// E-NOTIFICATIONS (P17, F-NOT-1) : groupees par jour, toucher = ouvrir la cible et
// marquer lu, "Tout marquer comme lu", tirer pour rafraichir, "Voir plus".
// Ecart a la maquette : pas de boutons Accepter / Refuser dans la notification,
// elle ouvre l'ecran qui porte ces actions (un seul endroit pour decider).
import type { Notification } from "@fm/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";

import { api } from "../../lib/api.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Avatar, EmptyState, Skeleton } from "../../ui/display.tsx";
import { PullToRefresh } from "../../ui/pull-to-refresh.tsx";
import { cx } from "../../ui/cx.ts";
import { ProfileLayout } from "../profile/profile-layout.tsx";
import { meQuery } from "../session/queries.ts";
import { ageLabel, dayGroup } from "./format.ts";
import { renderNotification } from "./messages.ts";
import { notificationsQuery, unreadCountQuery } from "./queries.ts";

function groups(notifications: Notification[]) {
  const result: { title: string; items: Notification[] }[] = [];
  for (const notification of notifications) {
    const title = dayGroup(notification.createdAt);
    const last = result.at(-1);
    if (last?.title === title) last.items.push(notification);
    else result.push({ title, items: [notification] });
  }
  return result;
}

function Item({
  notification,
  personalSpaceId,
  onOpen,
}: {
  notification: Notification;
  personalSpaceId: string;
  onOpen: (notification: Notification, to: string | null) => void;
}) {
  const view = renderNotification(notification, { personalSpaceId });
  const name = view.actor && notification.actor ? notification.actor.username : "Forest Manager";
  const content = (
    <>
      <Avatar
        name={name}
        src={view.actor ? notification.actor?.avatarUrl : null}
        tint={notification.space?.tintIndex ?? 1}
        size={40}
      />
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-[15px] leading-[22px]">
          {view.actor ? <b>{name}</b> : null}
          {view.actor ? " " : null}
          {view.text}
        </span>
        <span className="text-[13px] leading-[18px] text-ink-muted">
          {ageLabel(notification.createdAt)}
        </span>
      </span>
      {notification.readAt ? null : (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-label="Non lue" />
      )}
    </>
  );
  const className = cx(
    "flex gap-3 border-b border-line px-4 py-3 text-ink no-underline",
    !notification.readAt && "bg-accent-soft"
  );
  const to = view.to;
  return to ? (
    <Link
      to={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onOpen(notification, to);
      }}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      className={cx(className, "w-full text-left")}
      onClick={() => {
        onOpen(notification, null);
      }}
    >
      {content}
    </button>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);
  const list = useInfiniteQuery(notificationsQuery);
  const unread = useQuery(unreadCountQuery);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/me/notifications/${id}/read`),
    onSettled: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => api.post("/me/notifications/read-all"),
    onSettled: refresh,
  });

  const open = (notification: Notification, to: string | null) => {
    if (!notification.readAt) readOne.mutate(notification.id);
    if (to) void navigate(to);
  };

  const notifications = list.data?.pages.flatMap((page) => page.data) ?? [];
  const personalSpaceId = me.data?.personalSpaceId ?? "";

  return (
    <ProfileLayout title="Notifications" back="/">
      <PullToRefresh onRefresh={refresh}>
        <div className="-mx-4 flex flex-col">
          <div className="flex items-center justify-end gap-1 px-4 pb-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={(unread.data ?? 0) === 0 || readAll.isPending}
              onClick={() => {
                readAll.mutate();
              }}
            >
              Tout marquer comme lu
            </Button>
            <IconButton
              icon="settings"
              label="Préférences de notifications"
              onClick={() => void navigate("/profile/notifications")}
            />
          </div>
          {list.isPending ? (
            <div className="px-4">
              <Skeleton kind="row" count={3} />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState icon="bell" title="Aucune notification pour l'instant." />
          ) : (
            groups(notifications).map((group) => (
              <section key={group.title} aria-labelledby={`notif-${group.title}`}>
                <h2
                  id={`notif-${group.title}`}
                  className="px-4 pt-4 pb-1.5 text-xs font-semibold tracking-[0.04em] text-ink-muted uppercase"
                >
                  {group.title}
                </h2>
                {group.items.map((notification) => (
                  <Item
                    key={notification.id}
                    notification={notification}
                    personalSpaceId={personalSpaceId}
                    onOpen={open}
                  />
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
      </PullToRefresh>
    </ProfileLayout>
  );
}
