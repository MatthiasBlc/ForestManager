// E-REGLAGES-ESPACE : nom, description, couleur (perso : couleur seule), modules,
// propriete et depart (F-TRANSFERER, F-QUITTER), suppression (F-SUPPRIMER-ESPACE, D93).
import {
  imageResponseSchema,
  spaceDetailSchema,
  updateSpaceBodySchema,
  type SpaceDetail,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import type { LeaveSectionProps } from "../../app/registry.ts";
import { errorMessage } from "../../i18n/index.ts";
import { WEB_MODULES } from "../../modules/index.ts";
import { api } from "../../lib/api.ts";
import { applyApiError } from "../../lib/form-errors.ts";
import { ImagePicker } from "../../patterns/image-picker.tsx";
import { SpaceIcon } from "../../patterns/space-icon.tsx";
import { tintNames } from "../../theme/themes.ts";
import { useTheme } from "../../theme/use-theme.ts";
import { Button } from "../../ui/button.tsx";
import { TintPicker } from "../../ui/controls.tsx";
import { Field } from "../../ui/field.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { meQuery } from "../session/queries.ts";
import { canIn } from "./queries.ts";
import { toVisual } from "../shell/space-visual.ts";
import { TransferBanner, TransferSheet } from "./transfer.tsx";
import { ExportSheet } from "../exports/export-sheet.tsx";

function SpaceForm({ space }: { space: SpaceDetail }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const theme = useTheme();
  const personal = space.kind === "PERSONAL";
  const form = useForm({
    defaultValues: {
      name: space.name,
      description: space.description ?? "",
      tintIndex: space.tintIndex,
    },
  });
  const { errors, isSubmitting, dirtyFields } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const changes: Record<string, unknown> = {};
    if (dirtyFields.name) changes.name = values.name;
    if (dirtyFields.description) changes.description = values.description.trim() || null;
    if (dirtyFields.tintIndex) changes.tintIndex = values.tintIndex;
    const parsed = updateSpaceBodySchema.safeParse(changes);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "name" || field === "description")
          form.setError(field, { message: issue.message });
      }
      return;
    }
    try {
      const updated = await api.patch(`/spaces/${space.id}`, parsed.data, spaceDetailSchema);
      queryClient.setQueryData(["spaces", space.id], updated);
      await queryClient.invalidateQueries({ queryKey: ["spaces"], exact: true });
      form.reset({
        name: updated.name,
        description: updated.description ?? "",
        tintIndex: updated.tintIndex,
      });
      toast("Réglages enregistrés", { tone: "success" });
    } catch (error) {
      applyApiError(error, form.setError);
    }
  });

  return (
    <form className="fm-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
      <FormAlert message={errors.root?.message} />
      {personal ? null : (
        <>
          <Field label="Nom de l'espace" error={errors.name?.message} {...form.register("name")} />
          <Field
            label="Description"
            multiline
            error={errors.description?.message}
            {...form.register("description")}
          />
        </>
      )}
      <span className="fm-label">Couleur de l'espace</span>
      <Controller
        control={form.control}
        name="tintIndex"
        render={({ field }) => (
          <TintPicker
            label="Couleur de l'espace"
            value={field.value}
            onChange={field.onChange}
            names={tintNames(theme)}
          />
        )}
      />
      <div>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || Object.keys(dirtyFields).length === 0}
        >
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/** Photo de l'espace (perso compris, D02), changee tout de suite [D146, D167]. */
function SpacePhoto({ space }: { space: SpaceDetail }) {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["spaces"] });
  };
  const path = `/spaces/${space.id}/avatar`;
  return (
    <div className="flex items-center gap-4">
      <SpaceIcon space={toVisual(space)} size="lg" />
      <ImagePicker
        kind="avatar"
        noun="la photo de l'espace"
        hasImage={space.avatarUrl !== null}
        onUploaded={async (uploadId) => {
          await api.put(path, { uploadId }, imageResponseSchema);
          await refresh();
        }}
        onRemove={async () => {
          await api.delete(path, undefined, imageResponseSchema);
          await refresh();
        }}
      />
    </div>
  );
}

function LeaveSheet({
  space,
  alone,
  open,
  onClose,
}: {
  space: SpaceDetail;
  alone: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useQuery(meQuery);
  // Sections des modules actifs (D84) : chacune peut preparer le depart (retraits).
  const sections = WEB_MODULES.filter(
    (module) => module.LeaveSection && space.modules.some((m) => m.code === module.code)
  );
  // Retraits a faire avant le depart, et un rappel stable par module (deps des effets).
  const [prepares] = useState(() => new Map<string, () => Promise<void>>());
  const [callbacks] = useState(() => new Map<string, LeaveSectionProps["onPrepare"]>());
  const onPrepareFor = (code: string) => {
    let callback = callbacks.get(code);
    if (!callback) {
      callback = (prepare) => {
        if (prepare) prepares.set(code, prepare);
        else prepares.delete(code);
      };
      callbacks.set(code, callback);
    }
    return callback;
  };
  const leave = useMutation({
    mutationFn: async () => {
      if (!alone) for (const prepare of prepares.values()) await prepare();
      await api.post(`/spaces/${space.id}/leave`, { confirmDeletion: alone });
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["spaces", space.id] });
      await queryClient.invalidateQueries({ queryKey: ["spaces"], exact: true });
      toast(`Tu as quitté ${space.name}`);
      void navigate(`/s/${me.data?.personalSpaceId ?? ""}`, { replace: true });
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Quitter ${space.name}`}>
      <div className="fm-stack">
        {alone ? (
          <p>
            Tu es le dernier membre : quitter supprime l'espace. Tu pourras le restaurer pendant 30
            jours.
          </p>
        ) : (
          <>
            <p>Tu ne verras plus les recettes ni l'activité de {space.name}.</p>
            <Suspense fallback={null}>
              {open
                ? sections.map(({ code, LeaveSection }) =>
                    LeaveSection ? (
                      <LeaveSection
                        key={code}
                        spaceId={space.id}
                        spaceName={space.name}
                        onPrepare={onPrepareFor(code)}
                      />
                    ) : null
                  )
                : null}
            </Suspense>
            <p className="text-ink-muted">Tu pourras revenir avec une nouvelle invitation.</p>
          </>
        )}
        <FormAlert message={leave.isError ? errorMessage(leave.error) : undefined} />
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="danger" disabled={leave.isPending} onClick={() => leave.mutate()}>
            {`Quitter ${space.name}`}
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

function DeleteSheet({
  space,
  open,
  onClose,
  onExport,
}: {
  space: SpaceDetail;
  open: boolean;
  onClose: () => void;
  onExport: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const me = useQuery(meQuery);
  const [typed, setTyped] = useState("");
  const remove = useMutation({
    mutationFn: () => api.delete(`/spaces/${space.id}`),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["spaces", space.id] });
      await queryClient.invalidateQueries({ queryKey: ["spaces"], exact: true });
      toast(`${space.name} supprimé, restaurable 30 jours`);
      void navigate(`/s/${me.data?.personalSpaceId ?? ""}`, { replace: true });
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Supprimer ${space.name}`}>
      <div className="fm-stack">
        <p>
          {space.memberCount > 1
            ? `${space.name} disparaît pour ses ${String(space.memberCount)} membres.`
            : `${space.name} disparaît.`}
        </p>
        <p className="text-ink-muted">
          Tu peux le restaurer pendant 30 jours. Ensuite, tout est effacé.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">Garder une copie des recettes ?</span>
          <Button size="sm" icon="arrow-down" onClick={onExport}>
            Exporter d'abord
          </Button>
        </div>
        <Field
          label={`Pour confirmer, tape ${space.name}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <FormAlert message={remove.isError ? errorMessage(remove.error) : undefined} />
        <SheetFooter>
          <Button
            variant="danger"
            block
            disabled={typed !== space.name || remove.isPending}
            onClick={() => remove.mutate()}
          >
            {`Supprimer ${space.name}`}
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

export function SettingsPage({ space }: { space: SpaceDetail }) {
  const [sheet, setSheet] = useState<"leave" | "delete" | "transfer" | "export" | null>(null);
  const group = space.kind === "GROUP";
  const owner = space.myRole === "OWNER";
  const alone = space.memberCount <= 1;
  const close = () => setSheet(null);
  return (
    <div className="fm-stack mx-auto w-full max-w-2xl p-4">
      <h1 className="font-display text-2xl font-bold">Réglages de {space.name}</h1>
      {canIn(space, "space.update") ? (
        <>
          <SpacePhoto space={space} />
          <SpaceForm space={space} />
        </>
      ) : null}

      <section aria-labelledby="settings-modules" className="fm-stack border-t border-line pt-4">
        <h2 id="settings-modules" className="font-display text-lg font-bold">
          Modules
        </h2>
        <Link to={`/s/${space.id}/modules`} className="fm-option">
          <span className="fm-option-icon">
            <Icon name="puzzle" />
          </span>
          <span className="fm-option-text">
            <b>Modules de l'espace</b>
            <small>
              {space.modules.length} actif{space.modules.length > 1 ? "s" : ""}
            </small>
          </span>
          <Icon name="chevron-right" className="fm-option-go" />
        </Link>
      </section>

      {group && canIn(space, "space.export") ? (
        <section aria-labelledby="settings-export" className="fm-stack border-t border-line pt-4">
          <h2 id="settings-export" className="font-display text-lg font-bold">
            Export
          </h2>
          <p className="m-0 text-ink-muted">
            Toutes les recettes de l'espace dans une archive, une fois par jour.
          </p>
          <div>
            <Button icon="arrow-down" onClick={() => setSheet("export")}>
              Exporter l'espace
            </Button>
          </div>
          <ExportSheet space={space} scope="SPACE" open={sheet === "export"} onClose={close} />
        </section>
      ) : null}

      {group ? (
        <section aria-labelledby="settings-leave" className="fm-stack border-t border-line pt-4">
          <h2 id="settings-leave" className="font-display text-lg font-bold">
            Propriété et départ
          </h2>
          <TransferBanner space={space} />
          {owner ? (
            <div>
              <Button icon="crown" disabled={alone} onClick={() => setSheet("transfer")}>
                Transférer la propriété
              </Button>
            </div>
          ) : null}
          {owner && !alone ? (
            <p className="text-ink-muted">
              Pour quitter l'espace, transfère d'abord la propriété à un membre.
            </p>
          ) : (
            <div>
              <Button icon="log-out" onClick={() => setSheet("leave")}>
                {`Quitter ${space.name}`}
              </Button>
            </div>
          )}
          {canIn(space, "space.delete") ? (
            <div>
              <Button variant="danger" icon="trash" onClick={() => setSheet("delete")}>
                {`Supprimer ${space.name}`}
              </Button>
            </div>
          ) : null}
          <LeaveSheet space={space} alone={alone} open={sheet === "leave"} onClose={close} />
          <DeleteSheet
            space={space}
            open={sheet === "delete"}
            onClose={close}
            onExport={() => setSheet("export")}
          />
          {owner ? (
            <TransferSheet space={space} open={sheet === "transfer"} onClose={close} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
