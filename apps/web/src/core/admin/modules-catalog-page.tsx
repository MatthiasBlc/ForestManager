// A04 : catalogue des modules. Le statut est ce que voient les OWNER dans leurs
// reglages ; seuls les modules disponibles ou en beta se demandent [D123].
// Retirer l'acces masque le module ; ses donnees restent et reviennent avec l'acces [D85].
import {
  MODULE_STATUSES,
  type AdminModule,
  type AdminModuleGrant,
  type ModuleStatus,
  spaceLookupItemSchema,
  listSchema,
} from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { api } from "../../lib/api.ts";
import { plural } from "../../lib/plural.ts";
import { errorMessage } from "../../i18n/index.ts";
import { Button } from "../../ui/button.tsx";
import { Badge, Skeleton, type Tone } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { moduleInfo } from "../modules/module-info.ts";
import { whenLabel } from "./format.ts";
import { adminModulesQuery, moduleGrantsQuery, moduleRequestsQuery } from "./module-queries.ts";

const STATUS_LABELS: Record<ModuleStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Disponible", tone: "success" },
  BETA: { label: "Bêta", tone: "warning" },
  COMING_SOON: { label: "Bientôt", tone: "neutral" },
  RETIRED: { label: "Retiré", tone: "danger" },
};

function usage(module: AdminModule): string {
  if (module.isDefault)
    return `Fourni à la création de chaque espace : ${plural(module.grantedCount, "espace", "espaces")}.`;
  return `Accordé à ${plural(module.grantedCount, "espace", "espaces")}, activé dans ${String(
    module.enabledCount
  )}. ${plural(module.pendingCount, "demande", "demandes")} en attente.`;
}

function useRefresh(code: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminModulesQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: moduleGrantsQuery(code).queryKey }),
      queryClient.invalidateQueries({ queryKey: moduleRequestsQuery.queryKey }),
    ]);
}

function ModuleCard({
  module,
  selected,
  onSelect,
}: {
  module: AdminModule;
  selected: boolean;
  onSelect: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const selectId = useId();
  const name = moduleInfo(module.code).name;
  const status = STATUS_LABELS[module.status];
  const change = useMutation({
    mutationFn: (value: ModuleStatus) =>
      api.patch(`/admin/modules/${module.code}`, { status: value }),
    onSuccess: async () => {
      toast(`Statut de ${name} enregistré`, { tone: "success" });
      await queryClient.invalidateQueries({ queryKey: adminModulesQuery.queryKey });
    },
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });
  const titleId = `module-${module.code}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} className="m-0 flex-1 text-base font-semibold">
          {name}
        </h2>
        <code className="text-xs text-ink-muted">{module.code}</code>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="m-0 text-sm text-ink-muted">{usage(module)}</p>
      <div className="flex flex-wrap items-end gap-3">
        {module.isDefault ? null : (
          <div className="fm-field min-w-40">
            <label htmlFor={selectId} className="fm-label">
              Statut
            </label>
            <select
              id={selectId}
              className="fm-input"
              value={module.status}
              disabled={change.isPending}
              onChange={(event) => {
                change.mutate(event.target.value as ModuleStatus);
              }}
            >
              {MODULE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value].label}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button size="sm" aria-pressed={selected} onClick={onSelect} className="ml-auto">
          Voir les espaces
        </Button>
      </div>
    </article>
  );
}

function GrantSheet({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const refresh = useRefresh(code);
  const [query, setQuery] = useState("");
  const name = moduleInfo(code).name;
  const trimmed = query.trim();
  const results = useQuery({
    queryKey: ["admin", "spaces", "lookup", trimmed],
    queryFn: async () =>
      (
        await api.get(
          `/admin/spaces/lookup?query=${encodeURIComponent(trimmed)}`,
          listSchema(spaceLookupItemSchema)
        )
      ).data,
    enabled: open && trimmed.length > 0,
  });
  const grant = useMutation({
    mutationFn: (spaceId: string) => api.post(`/admin/modules/${code}/grants`, { spaceId }),
    onSuccess: async () => {
      toast(`${name} accordé`, { tone: "success" });
      setQuery("");
      onClose();
      await refresh();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Accorder « ${name} »`}>
      <div className="fm-stack">
        <FormAlert message={grant.error ? errorMessage(grant.error) : undefined} />
        <Field
          label="Nom de l'espace"
          hint="Les espaces groupe seulement ; l'OWNER activera le module quand il voudra."
          value={query}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {(results.data ?? []).map((space) => (
            <li key={space.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-surface"
                disabled={grant.isPending}
                onClick={() => {
                  grant.mutate(space.id);
                }}
              >
                <span className="font-semibold">{space.name}</span>
                <span className="text-sm text-ink-muted">OWNER : {space.ownerUsername}</span>
              </button>
            </li>
          ))}
        </ul>
        {trimmed && results.data?.length === 0 ? (
          <p className="m-0 text-ink-muted">Aucun espace groupe ne porte ce nom.</p>
        ) : null}
      </div>
    </Sheet>
  );
}

function RevokeSheet({
  code,
  grant,
  onClose,
}: {
  code: string;
  grant: AdminModuleGrant | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const refresh = useRefresh(code);
  const name = moduleInfo(code).name;
  const revoke = useMutation({
    mutationFn: (spaceId: string) => api.delete(`/admin/modules/${code}/grants/${spaceId}`),
    onSuccess: async () => {
      toast("Accès retiré");
      onClose();
      await refresh();
    },
  });
  return (
    <Sheet
      open={grant !== null}
      onClose={onClose}
      title={`Retirer « ${name} » à ${grant?.space.name ?? ""} ?`}
    >
      <div className="fm-stack">
        <FormAlert message={revoke.error ? errorMessage(revoke.error) : undefined} />
        <p className="m-0 text-ink-muted">
          Le module disparaît pour tous les membres. Ses données sont conservées et reviennent si
          l&apos;accès est rendu.
        </p>
        <SheetFooter>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            disabled={revoke.isPending}
            onClick={() => {
              if (grant) revoke.mutate(grant.space.id);
            }}
          >
            Retirer l&apos;accès
          </Button>
        </SheetFooter>
      </div>
    </Sheet>
  );
}

function ModuleGrants({ module }: { module: AdminModule }) {
  const grants = useQuery(moduleGrantsQuery(module.code));
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<AdminModuleGrant | null>(null);
  const name = moduleInfo(module.code).name;
  const captionId = `grants-${module.code}`;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={captionId} className="m-0 flex-1 font-display text-lg font-bold">
          Espaces ayant accès à « {name} »
        </h2>
        {module.isDefault ? null : (
          <Button
            size="sm"
            icon="plus"
            onClick={() => {
              setGranting(true);
            }}
          >
            Accorder à un espace
          </Button>
        )}
      </div>
      {grants.isPending ? (
        <Skeleton label="Chargement des espaces" />
      ) : grants.isError ? (
        <FormAlert message={errorMessage(grants.error)} />
      ) : grants.data.data.length === 0 ? (
        <p className="m-0 text-ink-muted">Aucun espace n&apos;a accès à ce module.</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-labelledby={captionId} className="fm-table">
            <thead>
              <tr>
                <th scope="col">Espace</th>
                <th scope="col">Accordé</th>
                <th scope="col">État chez l&apos;OWNER</th>
                {module.isDefault ? null : <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {grants.data.data.map((grant) => (
                <tr key={grant.space.id}>
                  <th scope="row" className="font-semibold">
                    {grant.space.name}
                  </th>
                  <td>
                    {whenLabel(grant.grantedAt)}
                    {grant.byAdmin ? "" : ", par défaut"}
                  </td>
                  <td>
                    {grant.enabled ? (
                      <Badge tone="success">Activé</Badge>
                    ) : (
                      <Badge>Pas encore activé</Badge>
                    )}
                  </td>
                  {module.isDefault ? null : (
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRevoking(grant);
                        }}
                      >
                        Retirer l&apos;accès
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {grants.data && grants.data.total > grants.data.data.length ? (
        <p className="m-0 text-sm text-ink-muted">
          {grants.data.data.length} espaces sur {grants.data.total}, les plus récents d&apos;abord.
        </p>
      ) : null}
      <GrantSheet
        code={module.code}
        open={granting}
        onClose={() => {
          setGranting(false);
        }}
      />
      <RevokeSheet
        code={module.code}
        grant={revoking}
        onClose={() => {
          setRevoking(null);
        }}
      />
    </section>
  );
}

export function ModulesCatalogPage() {
  const modules = useQuery(adminModulesQuery);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  // Par defaut : le premier module qui se demande (le Planning), sinon le premier.
  const selected =
    modules.data?.find((m) => m.code === selectedCode) ??
    modules.data?.find((m) => !m.isDefault) ??
    modules.data?.[0];
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-2xl font-bold">Catalogue des modules</h1>
        <p className="m-0 text-ink-muted">
          Le statut est ce que voient les OWNER dans leurs réglages. Seuls les modules disponibles
          ou en bêta peuvent être demandés.
        </p>
      </div>
      {modules.isPending ? (
        <Skeleton label="Chargement du catalogue" />
      ) : modules.isError ? (
        <FormAlert message={errorMessage(modules.error)} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {modules.data.map((module) => (
              <ModuleCard
                key={module.code}
                module={module}
                selected={module.code === selected?.code}
                onSelect={() => {
                  setSelectedCode(module.code);
                }}
              />
            ))}
          </div>
          {selected ? <ModuleGrants key={selected.code} module={selected} /> : null}
        </>
      )}
    </>
  );
}
