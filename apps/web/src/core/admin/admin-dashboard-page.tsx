// Tableau de bord admin (A02, A02m) [D129] : "A traiter" se remplit au fil de C4
// (demandes de modules en C4.2) ; C4.6 complete les chiffres et l'etat des services.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { EmptyState } from "../../ui/display.tsx";
import { Icon } from "../../ui/icon.tsx";
import { moduleInfo } from "../modules/module-info.ts";
import { moduleRequestsQuery } from "./module-queries.ts";

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

export function AdminDashboardPage() {
  const today = dateFormat.format(new Date());
  const requests = useQuery(moduleRequestsQuery);
  const pending = requests.data?.pending ?? [];
  const todo: TodoItem[] = [];
  if (pending.length > 0) {
    todo.push({
      to: "/admin/requests",
      count: pending.length,
      title: pending.length > 1 ? "Demandes d'accès aux modules" : "Demande d'accès aux modules",
      detail: pending
        .slice(0, 3)
        .map((r) => `${r.space.name} : ${moduleInfo(r.moduleCode).name}`)
        .join(", "),
    });
  }
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <h1 className="m-0 font-display text-2xl font-bold">Tableau de bord</h1>
        <span className="text-sm text-ink-muted first-letter:uppercase">{today}</span>
      </div>
      <section aria-labelledby="admin-todo" className="flex flex-col gap-2.5">
        <h2 id="admin-todo" className="m-0 font-display text-lg font-bold">
          À traiter
        </h2>
        {todo.length === 0 && !requests.isPending ? (
          <EmptyState icon="check" title="Rien à traiter">
            Les demandes d&apos;accès aux modules et les nouveaux ingrédients apparaîtront ici.
          </EmptyState>
        ) : (
          todo.map((item) => <TodoLink key={item.to} item={item} />)
        )}
      </section>
    </>
  );
}
