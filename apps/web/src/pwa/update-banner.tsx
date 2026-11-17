// "Nouvelle version disponible" : le service worker a une coquille plus recente.
import { Button } from "../ui/button.tsx";

export function UpdateBanner({
  needRefresh,
  onReload,
  onDismiss,
}: {
  needRefresh: boolean;
  onReload: () => void;
  onDismiss: () => void;
}) {
  if (!needRefresh) return null;
  return (
    <div role="status" className="fm-root fm-toasts">
      <div className="fm-toast">
        <i className="fm-toast-dot" aria-hidden="true" />
        <span>Nouvelle version disponible</span>
        <Button variant="ghost" size="sm" onClick={onReload}>
          Recharger
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Plus tard
        </Button>
      </div>
    </div>
  );
}
