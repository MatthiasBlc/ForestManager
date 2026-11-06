// A03 : file des demandes d'acces aux modules ; A03b : refus avec motif [D33, D124].
// L'acces est accorde a l'espace, pas a la personne ; l'OWNER active ensuite le module.
import type { AdminModuleRequest } from "@fm/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api.ts";
import { errorMessage } from "../../i18n/index.ts";
import { SpaceIcon } from "../../patterns/space-icon.tsx";
import { Button } from "../../ui/button.tsx";
import { Badge, EmptyState, Skeleton } from "../../ui/display.tsx";
import { Field } from "../../ui/field.tsx";
import { Sheet, SheetFooter } from "../../ui/sheet.tsx";
import { useToast } from "../../ui/use-toast.ts";
import { FormAlert } from "../access/auth-layout.tsx";
import { moduleInfo } from "../modules/module-info.ts";
import { agoLabel, whenLabel } from "./format.ts";
import { adminModulesQuery, moduleRequestsQuery } from "./module-queries.ts";

function useRefreshModules() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: moduleRequestsQuery.queryKey }),
      queryClient.invalidateQueries({ queryKey: adminModulesQuery.queryKey }),
    ]);
}

function RequestCard({ request, onReject }: { request: AdminModuleRequest; onReject: () => void }) {
  const toast = useToast();
  const refresh = useRefreshModules();
  const name = moduleInfo(request.moduleCode).name;
  const approve = useMutation({
    mutationFn: () => api.post(`/admin/module-requests/${request.id}/approve`),
    onSuccess: async () => {
      toast(`${name} accordé à ${request.space.name}`, { tone: "success" });
      await refresh();
    },
    onError: (error) => {
      toast(errorMessage(error), { tone: "danger" });
    },
  });
  const titleId = `request-${request.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4"
    >
      <div className="flex items-start gap-3">
        <SpaceIcon
          space={{ id: request.space.id, name: request.space.name, tint: request.space.tintIndex }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="m-0 text-base font-semibold">
            {request.space.name} demande {name}
          </h2>
          <span className="text-sm text-ink-muted">
            Demandée par {request.requestedBy.username}, {agoLabel(request.createdAt)}
          </span>
        </div>
      </div>
      {request.message ? (
        <blockquote className="m-0 rounded-md bg-surface px-3 py-2 text-ink">
          {request.message}
        </blockquote>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onReject}>Refuser</Button>
        <Button
          variant="primary"
          disabled={approve.isPending}
          onClick={() => {
            approve.mutate();
          }}
        >
          Accorder
        </Button>
      </div>
    </article>
  );
}

function RejectSheet({
  request,
  onClose,
}: {
  request: AdminModuleRequest | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const refresh = useRefreshModules();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const reject = useMutation({
    mutationFn: (value: string) =>
      api.post(`/admin/module-requests/${request?.id ?? ""}/reject`, { note: value }),
    onSuccess: async () => {
      toast("Demande refusée");
      setNote("");
      onClose();
      await refresh();
    },
  });
  const close = () => {
    setNote("");
    setError(undefined);
    reject.reset();
    onClose();
  };
  return (
    <Sheet
      open={request !== null}
      onClose={close}
      title={`Refuser la demande de ${request?.space.name ?? ""}`}
    >
      <form
        className="fm-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) {
            setError("Indique un motif : l'OWNER le lira.");
            return;
          }
          setError(undefined);
          reject.mutate(note.trim());
        }}
      >
        <FormAlert message={reject.error ? errorMessage(reject.error) : undefined} />
        <p className="m-0 text-ink-muted">
          {request?.requestedBy.username} verra ce motif dans les modules de son espace et pourra
          refaire une demande plus tard.
        </p>
        <Field
          multiline
          label="Motif"
          rows={3}
          maxLength={500}
          value={note}
          error={error}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
        <SheetFooter>
          <Button onClick={close}>Annuler</Button>
          <Button type="submit" variant="danger" disabled={reject.isPending}>
            Refuser la demande
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  );
}

export function ModuleRequestsPage() {
  const requests = useQuery(moduleRequestsQuery);
  const [rejecting, setRejecting] = useState<AdminModuleRequest | null>(null);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-2xl font-bold">Demandes d&apos;accès aux modules</h1>
        <p className="m-0 text-ink-muted">
          L&apos;accès est accordé à l&apos;espace, pas à la personne. Une fois accordé,
          l&apos;OWNER active le module quand il veut.
        </p>
      </div>
      {requests.isPending ? (
        <Skeleton label="Chargement des demandes" />
      ) : requests.isError ? (
        <FormAlert message={errorMessage(requests.error)} />
      ) : (
        <>
          <section aria-label="En attente" className="flex flex-col gap-3">
            {requests.data.pending.length === 0 ? (
              <EmptyState icon="check" title="Aucune demande en attente" />
            ) : (
              requests.data.pending.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onReject={() => {
                    setRejecting(request);
                  }}
                />
              ))
            )}
          </section>
          {requests.data.recent.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 id="recent-requests" className="m-0 font-display text-lg font-bold">
                Traitées récemment
              </h2>
              <div className="overflow-x-auto">
                <table aria-labelledby="recent-requests" className="fm-table">
                  <thead>
                    <tr>
                      <th scope="col">Espace</th>
                      <th scope="col">Module</th>
                      <th scope="col">Décision</th>
                      <th scope="col">Motif</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.data.recent.map((request) => (
                      <tr key={request.id}>
                        <td>{request.space.name}</td>
                        <td>{moduleInfo(request.moduleCode).name}</td>
                        <td>
                          {request.status === "APPROVED" ? (
                            <Badge tone="success">Accordée</Badge>
                          ) : (
                            <Badge tone="danger">Refusée</Badge>
                          )}
                        </td>
                        <td>{request.decisionNote ?? ""}</td>
                        <td>{request.decidedAt ? whenLabel(request.decidedAt) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
      <RejectSheet
        request={rejecting}
        onClose={() => {
          setRejecting(null);
        }}
      />
    </>
  );
}
