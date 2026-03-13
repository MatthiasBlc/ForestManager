import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import APIManager from "../network/api";

type EntityType = "recipe" | "community";

interface UseImageUploadReturn {
  currentImageUrl: string | null;
  setCurrentImageUrl: (url: string | null) => void;
  pendingImage: Blob | null;
  setPendingImage: (blob: Blob | null) => void;
  isUploadingImage: boolean;
  uploadPendingImage: (entityId: string) => Promise<boolean>;
  getUploadUrl: (entityId: string) => Promise<{ uploadUrl: string; imageKey: string }>;
  confirmUpload: (entityId: string) => Promise<{ imageKey: string; imageUrl: string }>;
  deleteImage: (entityId: string) => Promise<void>;
}

const apiMap = {
  recipe: {
    getUploadUrl: APIManager.getRecipeUploadUrl.bind(APIManager),
    confirmUpload: APIManager.confirmRecipeUpload.bind(APIManager),
    deleteImage: APIManager.deleteRecipeImage.bind(APIManager),
  },
  community: {
    getUploadUrl: APIManager.getCommunityUploadUrl.bind(APIManager),
    confirmUpload: APIManager.confirmCommunityUpload.bind(APIManager),
    deleteImage: APIManager.deleteCommunityImage.bind(APIManager),
  },
};

export function useImageUpload(entityType: EntityType): UseImageUploadReturn {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<Blob | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const api = apiMap[entityType];

  const uploadPendingImage = useCallback(
    async (entityId: string): Promise<boolean> => {
      if (!pendingImage) return true;
      try {
        setIsUploadingImage(true);
        const { uploadUrl } = await api.getUploadUrl(entityId);
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: pendingImage,
          headers: { "Content-Type": "image/webp" },
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        await api.confirmUpload(entityId);
        return true;
      } catch {
        toast.error("L'element a ete cree mais l'image n'a pas pu etre ajoutee.");
        return false;
      } finally {
        setIsUploadingImage(false);
      }
    },
    [pendingImage, api]
  );

  return {
    currentImageUrl,
    setCurrentImageUrl,
    pendingImage,
    setPendingImage,
    isUploadingImage,
    uploadPendingImage,
    getUploadUrl: api.getUploadUrl,
    confirmUpload: api.confirmUpload,
    deleteImage: api.deleteImage,
  };
}
