import { useState } from "react";
import { FaTrash, FaEye, FaTimes } from "react-icons/fa";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";
import APIManager from "../../network/api";
import { useAsyncData } from "../../hooks/useAsyncData";
import { MealPlanArchiveItem, MealPlan } from "../../models/mealPlan";
import MealPlanGrid from "./MealPlanGrid";

interface Props {
  communityId: string;
  isModerator: boolean;
}

const MealPlanArchives = ({ communityId, isModerator }: Props) => {
  const [viewingArchive, setViewingArchive] = useState<MealPlan | null>(null);
  const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);
  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null);

  const {
    data: archives,
    setData: setArchives,
    isLoading,
    error,
  } = useAsyncData(
    () => APIManager.getMealPlanArchives(communityId).then((r) => r.data),
    [communityId]
  );

  const handleViewArchive = async (archive: MealPlanArchiveItem) => {
    setLoadingArchiveId(archive.id);
    try {
      const response = await APIManager.getMealPlanArchive(communityId, archive.id);
      setViewingArchive(response.plan);
    } catch (err) {
      toastError(err, "Failed to load archive");
    } finally {
      setLoadingArchiveId(null);
    }
  };

  const handleDeleteArchive = async (archiveId: string) => {
    if (!confirm("Delete this archived plan? This action cannot be undone.")) return;

    setDeletingArchiveId(archiveId);
    try {
      await APIManager.deleteMealPlanArchive(communityId, archiveId);
      setArchives(archives?.filter((a) => a.id !== archiveId) ?? null);
      toast.success("Archive deleted");
    } catch (err) {
      toastError(err, "Failed to delete");
    } finally {
      setDeletingArchiveId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  if (!archives || archives.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/60">
        <p>No archived plans yet.</p>
        <p className="text-sm mt-1">
          When you create a new plan, the current one will be archived here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Archive list */}
      <div className="space-y-2">
        {archives.map((archive) => (
          <div
            key={archive.id}
            className="flex items-center justify-between p-4 bg-base-200 rounded-lg"
          >
            <div>
              <p className="font-medium">
                {new Date(archive.startDate).toLocaleDateString()} -{" "}
                {new Date(archive.endDate).toLocaleDateString()}
              </p>
              <p className="text-sm text-base-content/60">
                {archive.filledSlots}/{archive.totalSlots} slots filled &middot;{" "}
                {archive.defaultServings} servings default
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleViewArchive(archive)}
                disabled={loadingArchiveId === archive.id}
              >
                {loadingArchiveId === archive.id ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <FaEye className="w-4 h-4" />
                )}
              </button>
              {isModerator && (
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={() => handleDeleteArchive(archive.id)}
                  disabled={deletingArchiveId === archive.id}
                >
                  {deletingArchiveId === archive.id ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <FaTrash className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Archive viewer modal */}
      {viewingArchive && (
        <div className="modal modal-open">
          <div className="modal-box max-w-6xl h-[80vh]">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => setViewingArchive(null)}
              aria-label="Close"
            >
              <FaTimes />
            </button>

            <h3 className="font-bold text-lg mb-4">
              Archive: {new Date(viewingArchive.startDate).toLocaleDateString()} -{" "}
              {new Date(viewingArchive.endDate).toLocaleDateString()}
            </h3>

            <div className="overflow-auto h-[calc(100%-4rem)]">
              <MealPlanGrid
                communityId={communityId}
                plan={viewingArchive}
                isModerator={false}
                onSlotUpdated={() => {}}
                onSlotsSwapped={() => {}}
              />
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => setViewingArchive(null)} />
        </div>
      )}
    </div>
  );
};

export default MealPlanArchives;
