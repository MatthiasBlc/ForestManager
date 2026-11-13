// A09 : espaces. Ils sont prives : l'admin voit leurs informations generales,
// pas leur contenu. A09b : ouvrir le contenu demande un motif de moderation,
// enregistre dans le journal d'audit (lecture seule, 30 minutes) [D52, D121, D122].
import {
  ADMIN_SPACE_FILTERS,
  MODERATION_MINUTES,
  MODERATION_NOTE_MAX,
  MODERATION_REASONS,
  adminSpaceListSchema,
  moderationAccessSchema,
  type AdminSpace,
  type AdminSpaceFilter,
  type ModerationReason,
} from "@fm/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { RadioGroup, SegmentedControl } from "../../ui/controls.tsx";
import { Avatar, Badge, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { moduleInfo } from "../modules/module-info.ts";
import { REASON_LABELS } from "./format.ts";
import { TableScroll } from "../../ui/table-scroll.tsx";

const FILTER_LABELS: Record<AdminSpaceFilter, string> = {
  GROUP: "Groupes",
  PERSONAL: "Perso",
  DELETING: "En suppression",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function state(space: AdminSpace): { label: string; tone: "success" | "warning" } {
  if (!space.purgeAfter) return { label: "Actif", tone: "success" };
  const days = Math.max(0, Math.ceil((Date.parse(space.purgeAfter) - Date.now()) / DAY_MS));
  return { label: `Purge dans ${String(days)} j`, tone: "warning" };
}

function ModerationSheet({ space, onClose }: { space: AdminSpace | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [reason, setReason] = useState<ModerationReason>("MEMBER_REPORT");
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const open = useMutation({
    mutationFn: (spaceId: string) =>
      api.post(
        `/admin/spaces/${spaceId}/moderation`,
        { reason, note: note.trim() },
        moderationAccessSchema
      ),
    onSuccess: (access) => {
      setNote("");
      onClose();
      void navigate(`/admin/moderation/${access.spaceId}`);
    },
  });
  const name = space?.name ?? "";
  return (
    <Sheet open={space !== null} onClose={onClose} title={`Ouvrir le contenu de ${name}`}>
      <form
        className="fm-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) {
            setMissing(true);
            return;
          }
          if (space) open.mutate(space.id);
        }}
      >
        <FormAlert message={open.error ? errorMessage(open.error) : undefined} />
        <p className="m-0 text-ink-muted">
          Les espaces sont privés. Tu n&apos;y accèdes que pour une modération, avec un motif.
        </p>
        <RadioGroup
          label="Motif"
          options={MODERATION_REASONS.map((value) => ({ value, label: REASON_LABELS[value] }))}
          value={reason}
          onChange={setReason}
        />
        <Field
          label="Précision"
          multiline
          rows={3}
          maxLength={MODERATION_NOTE_MAX}
          hint="Obligatoire. Enregistrée dans le journal d'audit."
          error={missing && !note.trim() ? "La précision est obligatoire." : undefined}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
        <ul className="m-0 flex flex-col gap-1 pl-5 text-sm text-ink-muted">
          <li>Accès en lecture seule pendant {MODERATION_MINUTES} minutes.</li>
          <li>
            Seules les actions de modération sont possibles : masquer, retirer ou supprimer un
            contenu, avec un motif.
          </li>
          {space?.owner ? (
            <li>
              Cet accès et son motif seront signalés à {space.owner}, OWNER de {name}.
            </li>
          ) : null}
        </ul>
        <SheetFooter>
          <Button type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" icon="lock" disabled={open.isPending}>
            Ouvrir en lecture seule
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}

export function SpacesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AdminSpaceFilter>("GROUP");
  const [search, setSearch] = useState("");
  const [moderating, setModerating] = useState<AdminSpace | null>(null);
  const query = search.trim();
  const spaces = useQuery({
    queryKey: ["admin", "spaces", filter, query],
    queryFn: () => {
      const params = new URLSearchParams({ filter, limit: "100" });
      if (query) params.set("query", query);
      return api.get(`/admin/spaces?${params.toString()}`, adminSpaceListSchema);
    },
    placeholderData: keepPreviousData,
  });
  const restore = useMutation({
    mutationFn: (space: AdminSpace) => api.post(`/admin/spaces/${space.id}/restore`),
    onSuccess: async (_data, space) => {
      toast(`${space.name} restauré`, { tone: "success" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "spaces"] });
    },
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });
  const counts = spaces.data?.counts;
  const filters = ADMIN_SPACE_FILTERS.map((value) => ({
    value,
    label: counts ? `${FILTER_LABELS[value]} (${String(counts[value])})` : FILTER_LABELS[value],
  }));

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-2xl font-bold">Espaces</h1>
        <p className="m-0 text-ink-muted">
          Les espaces sont privés : tu vois leurs informations générales, pas leur contenu. Ouvrir
          le contenu demande un motif de modération, enregistré dans le journal d&apos;audit.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Field
          className="min-w-0 flex-[1_1_16rem]"
          label="Rechercher un espace"
          placeholder="Nom de l'espace ou de son OWNER"
          value={search}
          autoComplete="off"
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        {/* min-w-0 : le filtre defile sur lui-meme au lieu d'elargir la page (mobile). */}
        <div className="max-w-full min-w-0">
          <SegmentedControl
            label="Filtrer les espaces"
            options={filters}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </div>
      {spaces.isPending ? (
        <Skeleton label="Chargement des espaces" />
      ) : spaces.isError ? (
        <FormAlert message={errorMessage(spaces.error)} />
      ) : spaces.data.data.length === 0 ? (
        <p className="m-0 text-ink-muted">Aucun espace ne correspond.</p>
      ) : (
        <TableScroll label="Espaces">
          <table aria-label="Espaces" className="fm-table">
            <thead>
              <tr>
                <th scope="col">Espace</th>
                <th scope="col">OWNER</th>
                <th scope="col">Membres</th>
                <th scope="col">Recettes</th>
                <th scope="col">Modules</th>
                <th scope="col">État</th>
                <th scope="col">
                  <span className="fm-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {spaces.data.data.map((space) => {
                const { label, tone } = state(space);
                return (
                  <tr key={space.id}>
                    <th scope="row">
                      <span className="flex items-center gap-2.5 font-semibold">
                        <Avatar name={space.name} tint={space.tintIndex} size={32} />
                        {space.name}
                      </span>
                    </th>
                    <td>{space.owner ?? "-"}</td>
                    <td className="font-mono">{space.memberCount}</td>
                    <td className="font-mono">{space.recipeCount}</td>
                    <td>{space.modules.map((code) => moduleInfo(code).name).join(", ")}</td>
                    <td>
                      <Badge tone={tone}>{label}</Badge>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {space.purgeAfter ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Restaurer ${space.name}`}
                            disabled={restore.isPending}
                            onClick={() => {
                              restore.mutate(space);
                            }}
                          >
                            Restaurer
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Modérer ${space.name}`}
                            onClick={() => {
                              setModerating(space);
                            }}
                          >
                            Modérer…
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
      <p className="m-0 text-sm text-ink-muted">
        « Restaurer » ne sert que sur demande de l&apos;OWNER pendant les 30 jours ; à la purge, les
        recettes partagées ailleurs reviennent dans l&apos;espace perso de leur auteur.
      </p>
      <ModerationSheet
        space={moderating}
        onClose={() => {
          setModerating(null);
        }}
      />
    </>
  );
}
