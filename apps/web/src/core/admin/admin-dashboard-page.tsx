// Tableau de bord admin (A02, A02m) [D129]. En C4.1 il est vide : chaque sous-etape
// y ajoute sa ligne "A traiter" ; C4.6 complete les chiffres et l'etat des services.
import { EmptyState } from "../../ui/display.tsx";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function AdminDashboardPage() {
  const today = dateFormat.format(new Date());
  return (
    <>
      <div className="flex flex-col gap-0.5">
        <h1 className="m-0 font-display text-2xl font-bold">Tableau de bord</h1>
        <span className="text-sm text-ink-muted first-letter:uppercase">{today}</span>
      </div>
      <section aria-labelledby="admin-todo" className="flex flex-col gap-3">
        <h2 id="admin-todo" className="m-0 font-display text-lg font-bold">
          À traiter
        </h2>
        <EmptyState icon="check" title="Rien à traiter">
          Les demandes d&apos;accès aux modules et les nouveaux ingrédients apparaîtront ici.
        </EmptyState>
      </section>
    </>
  );
}
