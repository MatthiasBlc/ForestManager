// Recadrage d'un avatar avant l'envoi [D211] : deplacer au doigt ou a la souris,
// zoomer au pincement, a la molette ou au curseur ; un carre est envoye.
import { IMAGE_MAX_SIDE } from "@fm/shared";
import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import { errorMessage } from "../i18n/index.ts";
import { cropImage } from "../lib/image.ts";
import { Button } from "../ui/button.tsx";
import { Sheet, SheetFooter } from "../ui/sheet.tsx";
import { useToast } from "../ui/use-toast.ts";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function AvatarCropSheet({
  file,
  url,
  shape,
  onCancel,
  onConfirm,
}: {
  file: Blob;
  /** Adresse locale du fichier, creee et revoquee par l'appelant. */
  url: string;
  /** Rond pour un compte, carre arrondi pour un espace. */
  shape: "round" | "square";
  onCancel: () => void;
  /** Recoit le carre prepare (WebP ou JPEG, 512 px au plus). */
  onConfirm: (image: Blob) => Promise<void>;
}) {
  const toast = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const confirm = async () => {
    if (!area) return;
    setBusy(true);
    try {
      await onConfirm(await cropImage(file, area, IMAGE_MAX_SIDE.avatar));
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onCancel}
      title="Recadrer la photo"
      description="Déplace la photo et règle le zoom, puis utilise-la."
    >
      <div className="fm-crop">
        <Cropper
          image={url}
          crop={crop}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          aspect={1}
          cropShape={shape === "round" ? "round" : "rect"}
          showGrid={false}
          disableAutomaticStylesInjection
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <label className="fm-crop-zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => {
            setZoom(Number(event.target.value));
          }}
        />
      </label>
      <SheetFooter>
        <Button onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button
          variant="primary"
          disabled={!area || busy}
          onClick={() => {
            void confirm();
          }}
        >
          {busy ? "Envoi…" : "Utiliser cette photo"}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
