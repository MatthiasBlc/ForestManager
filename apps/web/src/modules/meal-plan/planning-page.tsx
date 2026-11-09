// E-PLANNING [P10, D180] : calendrier continu de l'espace. C5.1 pose l'ecran et
// ses reglages ; la grille des repas arrive en C5.2.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";

import { spaceQuery } from "../../core/session/queries.ts";
import { errorMessage } from "../../i18n/index.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { EmptyState, Skeleton } from "../../ui/display.tsx";
import { settingsQuery } from "./queries.ts";
import { SettingsSheet } from "./settings-sheet.tsx";

export function PlanningPage() {
  const { spaceId = "" } = useParams();
  const space = useQuery(spaceQuery(spaceId));
  const settings = useQuery(settingsQuery(spaceId));
  const [settingsOpen, setSettingsOpen] = useState(false);

  let content;
  if (settings.isError) {
    content = (
      <EmptyState
        icon="triangle-alert"
        title="Impossible de charger le planning"
        action={<Button onClick={() => void settings.refetch()}>Réessayer</Button>}
      >
        {errorMessage(settings.error)}
      </EmptyState>
    );
  } else if (!settings.data) {
    content = <Skeleton kind="card" count={2} label="Chargement du planning…" />;
  } else {
    content = (
      <EmptyState icon="calendar" title="Le calendrier des repas arrive bientôt">
        Les repas se rempliront ici, semaine par semaine.
      </EmptyState>
    );
  }

  return (
    <div className="fm-stack mx-auto w-full max-w-6xl p-4">
      <div className="flex items-center gap-2">
        <h1 className="m-0 flex-1 font-display text-2xl font-bold">Planning</h1>
        {settings.data?.can.manage ? (
          <IconButton
            icon="settings"
            label="Réglages du planning"
            onClick={() => {
              setSettingsOpen(true);
            }}
          />
        ) : null}
      </div>
      {content}
      {settings.data ? (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
          }}
          spaceId={spaceId}
          settings={settings.data}
          personal={space.data?.kind === "PERSONAL"}
        />
      ) : null}
    </div>
  );
}
