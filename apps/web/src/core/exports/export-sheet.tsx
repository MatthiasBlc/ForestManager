// F-EXPORT (P12) [D37, D192] : portee (si OWNER de l'espace courant), format,
// photos, puis "Preparer l'export" ; l'ecran relit le statut jusqu'a l'archive
// prete et propose "Telecharger" (24 h). Limite d'un export d'espace par jour.
import {
  API_PREFIX,
  dataExportSchema,
  exportLimitDetailsSchema,
  type DataExport,
  type ExportFormat,
  type ExportScope,
  type SpaceDetail,
} from "@fm/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api, ApiRequestError } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup, Switch } from "../../ui/controls.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { canIn } from "../spaces/queries.ts";

/** Relecture du statut pendant la preparation. */
const POLL_MS = 1000;

const FORMATS = [
  { value: "JSON", label: "JSON", hint: "Se réimportera dans Forest Manager" },
  { value: "MARKDOWN", label: "Markdown", hint: "Se lit partout, un fichier par recette" },
] as const;

const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "aujourd'hui a 14:02", "demain a 14:02", sinon "lundi 3 novembre a 14:02". */
function whenText(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round(
    (new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000
  );
  const day = days === 0 ? "aujourd'hui" : days === 1 ? "demain" : longDate.format(date);
  return `${day} à ${time.format(date)}`;
}

function refusal(error: unknown): string {
  if (error instanceof ApiRequestError && error.code === "EXPORT_001") {
    const details = exportLimitDetailsSchema.safeParse(error.details);
    return details.success
      ? `Un export par jour. Prochain export possible ${whenText(details.data.nextAt)}.`
      : "Un export par jour.";
  }
  return errorMessage(error);
}

export interface ExportSheetProps {
  open: boolean;
  onClose: () => void;
  /** Espace courant : sa portee est proposee a son OWNER (espace groupe). */
  space?: SpaceDetail;
  /** Portee choisie a l'ouverture. */
  scope?: ExportScope;
}

export function ExportSheet({ open, onClose, space, scope = "MY_RECIPES" }: ExportSheetProps) {
  const spaceScope = space && space.kind === "GROUP" && canIn(space, "space.export") ? space : null;
  const [chosen, setChosen] = useState<ExportScope>(spaceScope ? scope : "MY_RECIPES");
  const [format, setFormat] = useState<ExportFormat>("JSON");
  const [photos, setPhotos] = useState(false);
  const [created, setCreated] = useState<DataExport | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.post(
        "/me/exports",
        chosen === "SPACE" && spaceScope
          ? { scope: "SPACE", spaceId: spaceScope.id, format, photos }
          : { scope: "MY_RECIPES", format, photos },
        dataExportSchema
      ),
    onSuccess: setCreated,
  });
  const status = useQuery({
    queryKey: ["me", "exports", created?.id],
    queryFn: () => api.get(`/me/exports/${created?.id ?? ""}`, dataExportSchema),
    enabled: created !== null,
    refetchInterval: (query) => (query.state.data?.status === "READY" ? false : POLL_MS),
    staleTime: 0,
  });
  const current = status.data ?? created;

  const close = () => {
    onClose();
    // Une nouvelle ouverture repart du formulaire.
    setCreated(null);
    create.reset();
  };
  const spaceExport = chosen === "SPACE" && spaceScope !== null;
  const title = spaceScope ? "Exporter des recettes" : "Exporter mes recettes";

  let body;
  if (current?.status === "READY") {
    body = (
      <div className="fm-stack">
        <p className="m-0 flex items-center gap-2 font-semibold">
          <Icon name="check" /> Ton export est prêt.
        </p>
        <p className="m-0 text-ink-muted">
          Disponible pendant 24 heures, archive zip à ouvrir sur ton appareil.
        </p>
      </div>
    );
  } else if (current?.status === "FAILED" || current?.status === "EXPIRED") {
    body = (
      <p className="m-0" role="alert">
        {current.status === "FAILED"
          ? "La préparation a échoué. Réessaie dans un moment."
          : "Cet export a expiré. Prépares-en un nouveau."}
      </p>
    );
  } else if (current) {
    body = (
      <p className="m-0 text-ink-muted" role="status">
        Préparation de l'archive… quelques secondes.
      </p>
    );
  } else {
    body = (
      <div className="fm-stack">
        {spaceScope ? (
          <RadioGroup
            label="Recettes à exporter"
            value={chosen}
            onChange={setChosen}
            options={[
              {
                value: "MY_RECIPES",
                label: "Mes recettes",
                hint: "Celles dont tu es l'auteur, tous espaces",
              },
              {
                value: "SPACE",
                label: `Tout l'espace ${spaceScope.name}`,
                hint: "Toutes les recettes visibles dans l'espace",
              },
            ]}
          />
        ) : null}
        <RadioGroup label="Format" value={format} onChange={setFormat} options={FORMATS} />
        <Switch label="Inclure les photos" checked={photos} onChange={setPhotos} />
        {spaceExport ? (
          <p className="m-0 flex gap-2 text-sm text-ink-muted">
            <Icon name="users" size={18} />
            Un export d'espace par jour. Les membres verront dans l'activité que tu as exporté
            l'espace.
          </p>
        ) : null}
        {create.isError ? (
          <p className="m-0 text-danger-text" role="alert">
            {refusal(create.error)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={title}>
      {body}
      <SheetFooter>
        {current?.status === "READY" ? (
          <a
            className="fm-btn fm-btn-primary fm-btn-block"
            href={`${API_PREFIX}/me/exports/${current.id}/download`}
            download
          >
            Télécharger
          </a>
        ) : current?.status === "FAILED" || current?.status === "EXPIRED" ? (
          <Button
            variant="primary"
            block
            onClick={() => {
              setCreated(null);
              create.reset();
            }}
          >
            Recommencer
          </Button>
        ) : (
          <Button
            variant="primary"
            block
            disabled={create.isPending || current !== null}
            onClick={() => {
              create.mutate();
            }}
          >
            Préparer l'export
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
