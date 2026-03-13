import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import APIManager from "../network/api";
import ImageUpload from "../components/ImageUpload";
import { useAsyncData } from "../hooks/useAsyncData";
import { useImageUpload } from "../hooks/useImageUpload";

interface FormData {
  name: string;
  description: string;
}

const CommunityEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    currentImageUrl: imageUrl,
    setCurrentImageUrl: setImageUrl,
    getUploadUrl,
    confirmUpload,
    deleteImage,
  } = useImageUpload("community");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const {
    data: community,
    isLoading,
    error: loadError,
  } = useAsyncData(
    () => (id ? APIManager.getCommunity(id) : Promise.reject(new Error("Missing community ID"))),
    [id]
  );

  // Populate form when community data loads
  useEffect(() => {
    if (!community) return;
    if (community.currentUserRole !== "MODERATOR") {
      navigate(`/communities/${id}`);
      return;
    }
    reset({
      name: community.name,
      description: community.description || "",
    });
    setImageUrl(community.imageUrl);
  }, [community, id, navigate, reset, setImageUrl]);

  const onSubmit = async (data: FormData) => {
    if (!id) return;

    try {
      setSubmitError(null);
      await APIManager.updateCommunity(id, {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
      });
      navigate(`/communities/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update community");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (loadError && !isSubmitting) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error">
          <span>{loadError}</span>
        </div>
        <button
          className="btn btn-ghost mt-4 gap-2"
          onClick={() => navigate(id ? `/communities/${id}` : "/communities")}
        >
          <FaArrowLeft />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <button
          className="btn btn-ghost gap-2"
          onClick={() => navigate(id ? `/communities/${id}` : "/communities")}
        >
          <FaArrowLeft />
          Back to community
        </button>
      </div>

      <div className="bg-base-100 rounded-lg shadow-xl p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">Edit Community</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Name *</span>
            </label>
            <input
              type="text"
              {...register("name", {
                required: "Name is required",
                minLength: { value: 3, message: "Name must be at least 3 characters" },
                maxLength: { value: 100, message: "Name must be at most 100 characters" },
              })}
              placeholder="Community name"
              className={`input input-bordered w-full ${errors.name ? "input-error" : ""}`}
            />
            {errors.name && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.name.message}</span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Description (optional)</span>
            </label>
            <textarea
              {...register("description", {
                maxLength: { value: 1000, message: "Description must be at most 1000 characters" },
              })}
              placeholder="Describe your community..."
              rows={4}
              className={`textarea textarea-bordered w-full ${errors.description ? "textarea-error" : ""}`}
            />
            {errors.description && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.description.message}</span>
              </label>
            )}
          </div>

          {id && (
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Image</span>
              </label>
              <ImageUpload
                currentImageUrl={imageUrl}
                onUploadComplete={(url) => setImageUrl(url)}
                onDeleteComplete={() => setImageUrl(null)}
                getUploadUrl={() => getUploadUrl(id)}
                confirmUpload={() => confirmUpload(id)}
                deleteImage={() => deleteImage(id)}
              />
            </div>
          )}

          {submitError && (
            <div className="alert alert-error">
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate(id ? `/communities/${id}` : "/communities")}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary gap-2" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : <FaSave />}
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommunityEditPage;
