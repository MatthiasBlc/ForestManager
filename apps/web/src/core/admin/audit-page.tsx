// A11 : journal d'audit [D128]. Toutes les actions des administrateurs, du plus
// recent au plus ancien ; il ne se modifie pas et ne se supprime pas.
import {
  AUDIT_CATEGORIES,
  auditEntrySchema,
  offsetPageSchema,
  type AuditCategory,
} from "@fm/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../i18n/index.ts";
import { api } from "../../lib/api.ts";
import { Button } from "../../ui/button.tsx";
import { Chip } from "../../ui/controls.tsx";
import { Badge, Skeleton } from "../../ui/display.tsx";
import { FormAlert } from "../access/auth-layout.tsx";
import { auditDetail, auditLabel, auditTarget, whenLabel } from "./format.ts";
import { TableScroll } from "../../ui/table-scroll.tsx";

const PAGE = 50;

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  MODERATION: "Modération",
  MODULES: "Modules",
  REFERENTIALS: "Référentiels",
  ACCOUNTS: "Comptes",
  CONNECTIONS: "Connexions",
  RELEASES: "Changelog",
};

export function AuditPage() {
  const [category, setCategory] = useState<AuditCategory | null>(null);
  const audit = useInfiniteQuery({
    queryKey: ["admin", "audit", category ?? "ALL"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ offset: String(pageParam), limit: String(PAGE) });
      if (category) params.set("category", category);
      return api.get(`/admin/audit?${params.toString()}`, offsetPageSchema(auditEntrySchema));
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const entries = audit.data?.pages.flatMap((page) => page.data) ?? [];
  const total = audit.data?.pages[0]?.total ?? 0;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-2xl font-bold">Journal d&apos;audit</h1>
        <p className="m-0 text-ink-muted">
          Toutes les actions des administrateurs, sans exception. Le journal ne se modifie pas et ne
          se supprime pas.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip
          selected={category === null}
          onToggle={() => {
            setCategory(null);
          }}
        >
          Tout
        </Chip>
        {AUDIT_CATEGORIES.map((value) => (
          <Chip
            key={value}
            selected={category === value}
            onToggle={() => {
              setCategory(value);
            }}
          >
            {CATEGORY_LABELS[value]}
          </Chip>
        ))}
      </div>
      {audit.isPending ? (
        <Skeleton label="Chargement du journal" />
      ) : audit.isError ? (
        <FormAlert message={errorMessage(audit.error)} />
      ) : entries.length === 0 ? (
        <p className="m-0 text-ink-muted">Aucune action dans cette catégorie.</p>
      ) : (
        <TableScroll label="Journal d'audit">
          <table aria-label="Journal d'audit" className="fm-table">
            <thead>
              <tr>
                <th scope="col">Quand</th>
                <th scope="col">Admin</th>
                <th scope="col">Action</th>
                <th scope="col">Cible</th>
                <th scope="col">Motif ou détail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const { label, tone } = auditLabel(entry.action);
                return (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap">{whenLabel(entry.createdAt)}</td>
                    <td>{entry.admin}</td>
                    <th scope="row" className="font-normal">
                      <Badge tone={tone}>{label}</Badge>
                    </th>
                    <td>{auditTarget(entry)}</td>
                    <td className="text-ink-muted">{auditDetail(entry)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
      {audit.data ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-muted">
            {entries.length} entrées sur {total}
          </span>
          {audit.hasNextPage ? (
            <Button
              size="sm"
              disabled={audit.isFetchingNextPage}
              onClick={() => {
                void audit.fetchNextPage();
              }}
            >
              Voir les plus anciennes
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
