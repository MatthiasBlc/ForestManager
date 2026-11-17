// Enregistrement du service worker (production seulement) et bandeau de mise a jour.
import { useRegisterSW } from "virtual:pwa-register/react";

import { UpdateBanner } from "./update-banner.tsx";

export default function PwaUpdater() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <UpdateBanner
      needRefresh={needRefresh}
      onReload={() => void updateServiceWorker(true)}
      onDismiss={() => setNeedRefresh(false)}
    />
  );
}
