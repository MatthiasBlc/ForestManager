// Remplace react-easy-crop dans les tests (jsdom ne charge ni ne mesure les
// images) : annonce tout de suite une zone de recadrage, comme apres le
// chargement de l'image.
import { useEffect } from "react";
import type { Area } from "react-easy-crop";

export default function FakeCropper({
  onCropComplete,
}: {
  onCropComplete?: (area: Area, pixels: Area) => void;
}) {
  useEffect(() => {
    onCropComplete?.(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 10, y: 0, width: 300, height: 300 }
    );
  }, [onCropComplete]);
  return <div data-testid="cropper" />;
}
