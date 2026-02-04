import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { FaArrowLeft, FaSave } from "react-icons/fa";
import APIManager from "../network/api";

interface FormData {
  name: string;
  description: string;
}

const CommunityCreatePage = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      const community = await APIManager.createCommunity({
        name: data.name.trim(),
        description: data.description.trim() || undefined,
      });
      navigate(`/communities/${community.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create community");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <button
          className="btn btn-ghost gap-2"
          onClick={() => navigate("/communities")}
        >
          <FaArrowLeft />
          Back to communities
        </button>
      </div>

      <div className="bg-base-100 rounded-lg shadow-xl p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">Create a Community</h1>

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

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate("/communities")}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary gap-2" disabled={isSubmitting}>
              {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : <FaSave />}
              Create community
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommunityCreatePage;
