// Page d'attente des ecrans du socle pas encore livres (remplacee etape par etape en C2).
import { EmptyState } from "../../ui/display.tsx";

export function PendingPage({ title }: { title: string }) {
  return (
    <div className="p-4">
      <EmptyState icon="sparkles" title={title}>
        Cet écran arrive dans une prochaine étape.
      </EmptyState>
    </div>
  );
}
