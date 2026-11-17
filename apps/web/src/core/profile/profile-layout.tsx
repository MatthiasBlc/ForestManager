// Shell des ecrans du profil : rail des espaces (bureau seulement, D209), en-tete
// avec retour.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { AppShell } from "../../patterns/app-shell.tsx";
import { SpaceRail } from "../../patterns/space-rail.tsx";
import { TopBar } from "../../patterns/top-bar.tsx";
import { meQuery, spacesQuery } from "../session/queries.ts";
import { toVisual } from "../shell/space-visual.ts";

export function ProfileLayout({
  title,
  back = "/",
  children,
}: {
  title: string;
  back?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const me = useQuery(meQuery);
  const spaces = useQuery(spacesQuery);
  const visuals = (spaces.data ?? []).map(toVisual);
  return (
    <AppShell
      rail={
        <SpaceRail
          desktopOnly
          personal={visuals.find((v) => v.id === me.data?.personalSpaceId)}
          spaces={visuals.filter((v) => v.id !== me.data?.personalSpaceId)}
          onSelect={(id) => void navigate(`/s/${id}`)}
          onAdd={() => void navigate(`/s/${me.data?.personalSpaceId ?? ""}?create=1`)}
        />
      }
      top={<TopBar title={title} onBack={() => void navigate(back)} />}
    >
      <div className="fm-stack mx-auto w-full max-w-xl p-4">{children}</div>
    </AppShell>
  );
}
