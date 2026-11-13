// E-MODULES (F-SPC-6) : catalogue pour tous les membres [D54] ; l'OWNER demande
// l'acces [D33, D123, D124], active ou desactive [D85, D91] et ordonne [D131].
import { catalogModuleSchema, listSchema, type CatalogModule, type SpaceDetail } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button, IconButton } from "../../ui/button.tsx";
import { Switch } from "../../ui/controls.tsx";
import { Badge, Skeleton, type Tone } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { canIn } from "../spaces/queries.ts";
import { moduleInfo } from "./module-info.ts";

const catalogSchema = listSchema(catalogModuleSchema);

function catalogQuery(spaceId: string) {
  return {
    queryKey: ["spaces", spaceId, "modules"],
    queryFn: async () => (await api.get(`/spaces/${spaceId}/modules`, catalogSchema)).data,
  };
}

function statusOf(module: CatalogModule): { label: string; tone: Tone } {
  if (module.granted)
    return module.isDefault
      ? { label: "Inclus", tone: "success" }
      : { label: "Accordé", tone: "accent" };
  if (module.lastRequest?.status === "PENDING")
    return { label: "Demande envoyée", tone: "warning" };
  if (module.lastRequest?.status === "REJECTED") return { label: "Refusée", tone: "danger" };
  if (module.status === "COMING_SOON") return { label: "Bientôt", tone: "neutral" };
  return module.status === "BETA"
    ? { label: "Bêta", tone: "second" }
    : { label: "Disponible", tone: "neutral" };
}

function RequestSheet({
  space,
  module,
  onClose,
}: {
  space: SpaceDetail;
  module: CatalogModule | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [message, setMessage] = useState("");
  const name = module ? moduleInfo(module.code).name : "";
  const send = useMutation({
    mutationFn: (code: string) =>
      api.post(
        `/spaces/${space.id}/modules/${code}/requests`,
        message.trim() ? { message: message.trim() } : {}
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: catalogQuery(space.id).queryKey });
      toast("Demande envoyée", { tone: "success" });
      setMessage("");
      onClose();
    },
  });
  return (
    <Sheet open={module !== null} onClose={onClose} title={`Demander ${name}`}>
      <div className="fm-stack">
        <Field
          label="Message (facultatif)"
          multiline
          placeholder="Ex : on veut organiser les dîners de la semaine."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-ink-muted">
          L'équipe Forest Manager étudie ta demande pour {space.name}. Tu pourras ensuite activer le
          module.
        </p>
        <FormAlert message={send.isError ? errorMessage(send.error) : undefined} />
        <SheetFooter>
          <Button
            variant="primary"
            block
            disabled={send.isPending}
            onClick={() => module && send.mutate(module.code)}
          >
            Envoyer la demande
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

export function ModulesPage({ space }: { space: SpaceDetail }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const manage = canIn(space, "space.modules.manage");
  const catalog = useQuery(catalogQuery(space.id));
  const [requesting, setRequesting] = useState<CatalogModule | null>(null);

  const apply = async (data: CatalogModule[]) => {
    queryClient.setQueryData(catalogQuery(space.id).queryKey, data);
    await queryClient.invalidateQueries({ queryKey: ["spaces", space.id], exact: true });
  };
  const onError = (error: Error) => toast(errorMessage(error), { tone: "danger" });
  const toggle = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      api.patch(`/spaces/${space.id}/modules/${code}`, { enabled }, catalogSchema),
    onSuccess: async ({ data }, { enabled, code }) => {
      await apply(data);
      toast(`${moduleInfo(code).name} ${enabled ? "activé" : "désactivé"}`, { tone: "success" });
    },
    onError,
  });
  const reorder = useMutation({
    mutationFn: (codes: string[]) =>
      api.put(`/spaces/${space.id}/modules/order`, { codes }, catalogSchema),
    onSuccess: ({ data }) => apply(data),
    onError,
  });
  const cancel = useMutation({
    mutationFn: (code: string) => api.post(`/spaces/${space.id}/modules/${code}/requests/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: catalogQuery(space.id).queryKey }),
    onError,
  });

  const granted = (catalog.data ?? []).filter((m) => m.granted);
  const move = (code: string, delta: number) => {
    const codes = granted.map((m) => m.code);
    const index = codes.indexOf(code);
    const target = index + delta;
    const other = codes[target];
    if (index < 0 || other === undefined) return;
    codes[target] = code;
    codes[index] = other;
    reorder.mutate(codes);
  };

  return (
    <div className="fm-stack mx-auto w-full max-w-3xl p-4">
      <h1 className="font-display text-2xl font-bold">Modules de {space.name}</h1>
      <p className="text-ink-muted">
        {manage
          ? `Les modules ajoutent des outils à ${space.name}. Désactiver un module le cache pour tous ; ses données sont gardées.`
          : `Les modules actifs de ${space.name}. Seul le propriétaire les gère.`}
      </p>
      {manage && granted.length > 1 ? (
        <p
          role="note"
          aria-label="Ordre des modules"
          className="m-0 flex items-start gap-2 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-text"
        >
          <Icon name="arrow-up" />
          <span>
            Les flèches rangent les modules dans le menu de l'espace : le premier s'ouvre en entrant
            dans l'espace. Sur téléphone, les 4 premiers ont un onglet en bas, les autres sont dans
            « Plus ».
          </span>
        </p>
      ) : null}
      {catalog.isPending ? <Skeleton kind="row" /> : null}
      <ul className="fm-stack">
        {catalog.data?.map((module) => {
          const info = moduleInfo(module.code);
          const status = statusOf(module);
          const index = granted.findIndex((m) => m.code === module.code);
          const requestable =
            !module.granted &&
            (module.status === "AVAILABLE" || module.status === "BETA") &&
            module.lastRequest?.status !== "PENDING";
          return (
            <li
              key={module.code}
              aria-label={info.name}
              className="fm-stack rounded-lg border border-line bg-surface-raised p-4"
            >
              <div className="flex items-center gap-3">
                <b className="flex-1">{info.name}</b>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              {info.description ? <p className="text-ink-muted">{info.description}</p> : null}
              {module.lastRequest?.status === "REJECTED" && module.lastRequest.decisionNote ? (
                <p className="text-danger-text">
                  Motif du refus : {module.lastRequest.decisionNote}
                </p>
              ) : null}
              {manage ? (
                <div className="fm-row">
                  {module.granted && !module.isDefault ? (
                    <Switch
                      label="Actif pour les membres"
                      checked={module.enabled}
                      disabled={toggle.isPending}
                      onChange={(enabled) => toggle.mutate({ code: module.code, enabled })}
                    />
                  ) : null}
                  {module.granted && granted.length > 1 ? (
                    <span className="ml-auto flex gap-1">
                      <IconButton
                        icon="arrow-up"
                        label={`Monter ${info.name}`}
                        disabled={index === 0 || reorder.isPending}
                        onClick={() => move(module.code, -1)}
                      />
                      <IconButton
                        icon="arrow-down"
                        label={`Descendre ${info.name}`}
                        disabled={index === granted.length - 1 || reorder.isPending}
                        onClick={() => move(module.code, 1)}
                      />
                    </span>
                  ) : null}
                  {requestable ? (
                    <Button onClick={() => setRequesting(module)}>
                      {module.lastRequest?.status === "REJECTED"
                        ? "Redemander"
                        : "Demander l'accès"}
                    </Button>
                  ) : null}
                  {module.lastRequest?.status === "PENDING" && !module.granted ? (
                    <Button
                      variant="ghost"
                      disabled={cancel.isPending}
                      onClick={() => cancel.mutate(module.code)}
                    >
                      Annuler la demande
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {manage ? (
        <RequestSheet space={space} module={requesting} onClose={() => setRequesting(null)} />
      ) : null}
    </div>
  );
}
