import { useCallback, useRef, useState } from "react";
import { FaCloudUploadAlt, FaTrash, FaTimes } from "react-icons/fa";
import { processImage, ALLOWED_TYPES } from "../utils/imageUtils";
import { useIsMobile } from "../hooks/useIsMobile";

interface ImageUploadProps {
  currentImageUrl: string | null;
  onUploadComplete: (imageUrl: string) => void;
  onDeleteComplete: () => void;
  getUploadUrl: () => Promise<{ uploadUrl: string; imageKey: string }>;
  confirmUpload: () => Promise<{ imageKey: string; imageUrl: string }>;
  deleteImage: () => Promise<void>;
}

type UploadStatus = "idle" | "processing" | "uploading" | "confirming";

function toUserMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("File not found"))
    return "Le fichier n'a pas ete recu par le serveur. Veuillez reessayer.";
  if (msg.includes("Invalid file type")) return "Format non supporte. Utilisez JPEG, PNG ou WebP.";
  if (msg.includes("File too large")) return "Image trop volumineuse. Maximum : 2 Mo.";
  if (msg.includes("Network error")) return "Erreur reseau. Verifiez votre connexion.";
  if (msg.includes("RECIPE_005") || msg.includes("COMMUNITY_006"))
    return "L'image n'est pas valide. Verifiez le format et la taille (max 2 Mo).";
  if (msg.includes("RECIPE_002")) return "Vous n'avez pas la permission de modifier cette image.";
  if (msg.includes("COMMUNITY_002")) return "Communaute introuvable.";
  if (msg.includes("RECIPE_001")) return "Recette introuvable.";
  return msg || "Une erreur est survenue.";
}

const statusLabels: Record<UploadStatus, string> = {
  idle: "",
  processing: "Conversion en cours...",
  uploading: "Envoi en cours...",
  confirming: "Finalisation...",
};

const ImageUpload = ({
  currentImageUrl,
  onUploadComplete,
  onDeleteComplete,
  getUploadUrl,
  confirmUpload,
  deleteImage,
}: ImageUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMobile = useIsMobile();
  const busy = status !== "idle" || isDeleting;

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPreview(URL.createObjectURL(file));

      try {
        // 1. Process (validate + convert + resize)
        setStatus("processing");
        const blob = await processImage(file);

        // 2. Get presigned URL
        setStatus("uploading");
        const { uploadUrl } = await getUploadUrl();

        // 3. Upload directly to MinIO
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": "image/webp" },
        });
        if (!uploadRes.ok) throw new Error("L'envoi de l'image a echoue. Veuillez reessayer.");

        // 4. Confirm upload
        setStatus("confirming");
        const { imageUrl } = await confirmUpload();

        setPreview(null);
        setStatus("idle");
        onUploadComplete(imageUrl);
      } catch (err) {
        setStatus("idle");
        setError(toUserMessage(err));
      }
    },
    [getUploadUrl, confirmUpload, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (busy) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, busy]
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteImage();
      onDeleteComplete();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    setError(null);
  };

  // Display image: preview during upload, or current image
  const displayUrl = preview || currentImageUrl;

  return (
    <div className="space-y-3">
      {/* Current / preview image */}
      {displayUrl && (
        <div className="relative inline-block">
          <img src={displayUrl} alt="Recipe" className="rounded-lg max-h-64 object-cover" />
          {/* Delete button (only for persisted image, not during upload) */}
          {currentImageUrl && !preview && status === "idle" && (
            <button
              type="button"
              className="btn btn-circle btn-error min-h-[44px] min-w-[44px] absolute top-2 right-2"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="Delete image"
            >
              {isDeleting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <FaTrash className="w-3 h-3" />
              )}
            </button>
          )}
          {/* Cancel preview if error during upload */}
          {preview && status === "idle" && (
            <button
              type="button"
              className="btn btn-circle min-h-[44px] min-w-[44px] absolute top-2 right-2"
              onClick={cancelPreview}
              aria-label="Cancel"
            >
              <FaTimes className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Status indicator */}
      {status !== "idle" && (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-sm" />
          {statusLabels[status]}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error alert-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Drop zone / file picker */}
      {!busy && (
        <div
          className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <FaCloudUploadAlt className="w-8 h-8 mx-auto text-base-content/40 mb-2" />
          <p className="text-sm text-base-content/60">
            {isMobile ? "Appuyez pour ajouter une image" : "Cliquez ou glissez une image ici"}
          </p>
          <p className="text-xs text-base-content/40 mt-1">JPEG, PNG ou WebP — max 2 Mo</p>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={handleSelect}
          />
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
