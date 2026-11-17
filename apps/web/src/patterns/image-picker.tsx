// Choix d'une photo [D167] : ouvre le selecteur de fichiers (ou l'appareil photo
// sur mobile), convertit et envoie l'image, puis la confie a `onUploaded`
// (rattachement). Masque si l'envoi de photos n'est pas configure.
import { useId, useRef, useState } from "react";

import { errorMessage } from "../i18n/index.ts";
import { uploadImage, uploadPrepared, type ImageKind } from "../lib/upload.ts";
import { Button } from "../ui/button.tsx";
import { useToast } from "../ui/use-toast.ts";
import { AvatarCropSheet } from "./avatar-crop-sheet.tsx";
import { useUploadsEnabled } from "./use-uploads.ts";

export interface ImagePickerProps {
  kind: ImageKind;
  hasImage: boolean;
  /** Rattache l'envoi (PUT .../avatar ou .../photo) ; une erreur s'affiche en toast. */
  onUploaded: (uploadId: string, file: Blob) => Promise<void>;
  onRemove?: () => Promise<void>;
  /** Nom de ce qu'on change, pour les libelles ("la photo", "la photo de l'espace"). */
  noun?: string;
  /** Avatar recadre en carre avant l'envoi [D211] : rond (compte) ou carre (espace). */
  crop?: "round" | "square";
}

export function ImagePicker({
  kind,
  hasImage,
  onUploaded,
  onRemove,
  noun = "la photo",
  crop,
}: ImagePickerProps) {
  const enabled = useUploadsEnabled();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  // Fichier a recadrer et son adresse locale, revoquee a la fermeture de la feuille.
  const [cropping, setCropping] = useState<{ file: File; url: string } | null>(null);
  const closeCrop = () => {
    if (cropping) URL.revokeObjectURL(cropping.url);
    setCropping(null);
  };
  if (!enabled) return null;

  const run = async (step: "upload" | "remove", action: () => Promise<void>) => {
    setBusy(step);
    try {
      await action();
    } catch (error) {
      toast(errorMessage(error), { tone: "danger" });
    } finally {
      setBusy(null);
    }
  };

  const onFile = (file: File | undefined) => {
    if (input.current) input.current.value = ""; // reprendre le meme fichier
    if (!file) return;
    if (crop) {
      setCropping({ file, url: URL.createObjectURL(file) });
      return;
    }
    void run("upload", async () => {
      await onUploaded(await uploadImage(file, kind), file);
    });
  };

  const addLabel = hasImage ? `Changer ${noun}` : `Ajouter ${noun}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={addLabel}
        tabIndex={-1}
        onChange={(event) => {
          onFile(event.target.files?.[0]);
        }}
      />
      <Button
        icon="camera"
        size="sm"
        disabled={busy !== null}
        onClick={() => input.current?.click()}
      >
        {busy === "upload" ? "Envoi…" : addLabel}
      </Button>
      {cropping && crop ? (
        <AvatarCropSheet
          file={cropping.file}
          url={cropping.url}
          shape={crop}
          onCancel={closeCrop}
          onConfirm={async (image) => {
            await run("upload", async () => {
              await onUploaded(await uploadPrepared(image), image);
            });
            closeCrop();
          }}
        />
      ) : null}
      {hasImage && onRemove ? (
        <Button
          icon="trash"
          size="sm"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => void run("remove", onRemove)}
        >
          {`Retirer ${noun}`}
        </Button>
      ) : null}
    </div>
  );
}
