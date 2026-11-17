// Tableau de bord admin (A02 bureau, A02m mobile : meme ecran) [D129] : "A traiter"
// (demandes de modules, nouveaux ingredients et doublons, espaces en suppression),
// chiffres de la plateforme, etat des services, dernieres actions admin.
import { adminDashboardSchema, type AdminDashboard } from "@fm/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { api } from "../../lib/api.ts";
import { plural } from "../../lib/plural.ts";
import { Badge, EmptyState } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { moduleInfo } from "../modules/module-info.ts";
import { auditLabel, auditTarget, whenLabel } from "./format.ts";
import { moduleRequestsQuery } from "./module-queries.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

const dashboardQuery = {
  queryKey: ["admin", "dashboard"],
  queryFn: () => api.get("/admin/dashboard", adminDashboardSchema),
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

interface TodoItem {
  to: string;
  count: number;
  title: string;
  detail: string;
}

function TodoLink({ item }: { item: TodoItem }) {
  return (
    <Link
      to={item.to}
      className="flex min-h-16 items-center gap-3.5 rounded-lg border border-line bg-surface-raised px-3.5 py-3 text-ink no-underline hover:border-line-strong"
    >
      <span className="min-w-6 font-display text-[26px] leading-[30px] font-bold text-accent-text">
        {item.count}
      </span>{" "}
      <span className="flex flex-1 flex-col">
        <b className="text-[15px] leading-5">{item.title}</b>{" "}
        <span className="text-[13px] leading-[18px] text-ink-muted">{item.detail}</span>
      </span>
      <Icon name="chevron-right" />
    </Link>
  );
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <h2 id={id} className="m-0 flex-1 font-display text-lg font-bold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function todoItems(pendingNames: string[], pending: number, data: AdminDashboard | undefined) {
  const todo: TodoItem[] = [];
  if (pending > 0) {
    todo.push({
      to: "/admin/requests",
      count: pending,
      title: pending > 1 ? "Demandes d'accès aux modules" : "Demande d'accès aux modules",
      detail: pendingNames.join(", "),
    });
  }
  if (data && data.newIngredients.count > 0) {
    const { count, duplicates } = data.newIngredients;
    const dup =
      duplicates.length > 0
        ? ` ${plural(duplicates.length, "doublon probable", "doublons probables")} : ${duplicates.map((d) => `« ${d} »`).join(", ")}.`
        : "";
    todo.push({
      to: "/admin/ingredients",
      count,
      title: count > 1 ? "Nouveaux ingrédients à revoir" : "Nouvel ingrédient à revoir",
      detail: `Déjà utilisables dans les recettes.${dup}`,
    });
  }
  if (data && data.deletingSpaces.length > 0) {
    const first = data.deletingSpaces[0];
    const days = first
      ? Math.max(0, Math.ceil((Date.parse(first.purgeAfter) - Date.now()) / DAY_MS))
      : 0;
    todo.push({
      to: "/admin/spaces",
      count: data.deletingSpaces.length,
      title: data.deletingSpaces.length > 1 ? "Espaces en suppression" : "Espace en suppression",
      detail: first
        ? `« ${first.name} » sera purgé dans ${plural(days, "jour", "jours")}, sauf restauration par son OWNER.`
        : "",
    });
  }
  return todo;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-surface-raised px-4 py-3">
      <b className="font-display text-2xl">{value}</b>
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}

export function AdminDashboardPage() {
  const today = dateFormat.format(new Date());
  const requests = useQuery(moduleRequestsQuery);
  const dashboard = useQuery(dashboardQuery);
  const pending = requests.data?.pending ?? [];
  const data = dashboard.data;
  const todo = todoItems(
    pending.slice(0, 3).map((r) => `${r.space.name} : ${moduleInfo(r.moduleCode).name}`),
    pending.length,
    data
  );
  const loading = requests.isPending || dashboard.isPending;
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <h1 className="m-0 font-display text-2xl font-bold">Tableau de bord</h1>
        <span className="text-sm text-ink-muted first-letter:uppercase">{today}</span>
      </div>
      <Section id="admin-todo" title="À traiter">
        {todo.length === 0 && !loading ? (
          <EmptyState icon="check" title="Rien à traiter">
            Les demandes d&apos;accès aux modules, les nouveaux ingrédients et les espaces en
            suppression apparaîtront ici.
          </EmptyState>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-3">
            {todo.map((item) => (
              <TodoLink key={item.to} item={item} />
            ))}
          </div>
        )}
      </Section>
      {data ? (
        <>
          <Section id="admin-platform" title="La plateforme">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Stat value={data.platform.users} label="utilisateurs" />
              <Stat
                value={data.platform.groupSpaces}
                label={`espaces groupe (et ${String(data.platform.personalSpaces)} perso)`}
              />
              <Stat value={data.platform.recipes} label="recettes" />
              {data.platform.modules.map((m) => (
                <Stat
                  key={m.code}
                  value={m.grantedCount}
                  label={`espaces avec ${moduleInfo(m.code).name}`}
                />
              ))}
            </div>
          </Section>
          <div className="grid gap-5 lg:grid-cols-2">
            <Section id="admin-services" title="État des services">
              <ul className="m-0 flex list-none flex-col gap-2 rounded-lg border border-line bg-surface-raised p-4">
                <li className="flex items-center gap-3">
                  <span className="flex-1">Envoi d&apos;e-mails</span>
                  {data.services.email ? (
                    <Badge tone="success">En ligne</Badge>
                  ) : (
                    <Badge tone="warning">Non configuré</Badge>
                  )}
                </li>
                {data.services.email ? null : (
                  <li className="text-sm text-ink-muted">
                    Sans SMTP, « mot de passe oublié » est masqué : les mots de passe se
                    réinitialisent depuis <Link to="/admin/users">Utilisateurs</Link>.{" "}
                    <Link to="/admin/settings">Voir les réglages</Link>
                  </li>
                )}
                <li className="flex items-center gap-3">
                  <span className="flex-1">Suivi des erreurs (Bugsink)</span>
                  {data.services.errorTracking ? (
                    <Badge tone="success">En ligne</Badge>
                  ) : (
                    <Badge tone="warning">Non configuré</Badge>
                  )}
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex-1">Stockage des photos</span>
                  {data.services.storage ? (
                    <Badge tone="success">En ligne</Badge>
                  ) : (
                    <Badge tone="warning">Non configuré</Badge>
                  )}
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex-1">Version en production</span>
                  <span className="font-mono">{data.version}</span>
                </li>
              </ul>
            </Section>
            <Section
              id="admin-recent"
              title="Dernières actions admin"
              action={<Link to="/admin/audit">Tout le journal</Link>}
            >
              {data.recent.length === 0 ? (
                <p className="m-0 text-ink-muted">Aucune action pour l&apos;instant.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 rounded-lg border border-line bg-surface-raised p-4">
                  {data.recent.map((entry) => (
                    <li key={entry.id} className="flex gap-3 text-sm">
                      <span className="shrink-0 whitespace-nowrap text-ink-muted">
                        {whenLabel(entry.createdAt)}
                      </span>
                      <span>
                        {auditLabel(entry.action).label} : {auditTarget(entry)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      ) : null}
    </>
  );
}
