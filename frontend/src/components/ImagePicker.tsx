import { useCallback, useRef, useState } from "react";
import { FaCloudUploadAlt, FaTimes } from "react-icons/fa";
import { processImage, ALLOWED_TYPES } from "../utils/imageUtils";

interface ImagePickerProps {
  onImageSelected: (blob: Blob | null) => void;
}

type ProcessStatus = "idle" | "processing";

const ImagePicker = ({ onImageSelected }: ImagePickerProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setPreview(URL.createObjectURL(file));
      setStatus("processing");

      try {
        const blob = await processImage(file);
        setStatus("idle");
        onImageSelected(blob);
      } catch (err) {
        setStatus("idle");
        setError(err instanceof Error ? err.message : "Erreur lors du traitement de l'image");
        setPreview(null);
        onImageSelected(null);
      }
    },
    [onImageSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (status !== "idle") return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, status],
  );

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleClear = () => {
    setPreview(null);
    setError(null);
    onImageSelected(null);
  };

  return (
    <div className="space-y-3">
      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="rounded-lg max-h-64 object-cover"
          />
          {status === "idle" && (
            <button
              type="button"
              className="btn btn-circle btn-sm absolute top-2 right-2"
              onClick={handleClear}
              aria-label="Remove image"
            >
              <FaTimes className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {status === "processing" && (
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <span className="loading loading-spinner loading-sm" />
          Traitement de l'image...
        </div>
      )}

      {error && (
        <div className="alert alert-error alert-sm">
          <span>{error}</span>
        </div>
      )}

      {status === "idle" && !preview && (
        <div
          className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <FaCloudUploadAlt className="w-8 h-8 mx-auto text-base-content/40 mb-2" />
          <p className="text-sm text-base-content/60">
            Cliquez ou glissez une image ici
          </p>
          <p className="text-xs text-base-content/40 mt-1">
            JPEG, PNG ou WebP — max 2 Mo
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={handleSelect}
          />
        </div>
      )}

      {status === "idle" && preview && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => inputRef.current?.click()}
        >
          Changer l'image
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={handleSelect}
          />
        </button>
      )}
    </div>
  );
};

export default ImagePicker;
