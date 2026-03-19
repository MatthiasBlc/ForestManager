import { useState } from "react";
import { FaPlus, FaEdit, FaTrash, FaStar, FaCog, FaArrowLeft } from "react-icons/fa";
import toast from "react-hot-toast";
import APIManager from "../../network/api";
import { useAsyncData } from "../../hooks/useAsyncData";
import { MealGenerationParamsListItem, MealGenerationParams } from "../../models/mealPlan";
import ParamsFormModal from "./ParamsFormModal";
import ExclusionPinGrid from "./ExclusionPinGrid";

interface Props {
  communityId: string;
  isModerator: boolean;
}

const GenerationParamsPanel = ({ communityId, isModerator }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [editingParams, setEditingParams] = useState<MealGenerationParamsListItem | null>(null);
  const [selectedParamsId, setSelectedParamsId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<MealGenerationParams | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: paramsList,
    setData: setParamsList,
    isLoading,
    error,
  } = useAsyncData(
    () => APIManager.listMealGenerationParams(communityId).then((r) => r.data),
    [communityId]
  );

  const loadDetail = async (paramsId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await APIManager.getMealGenerationParams(communityId, paramsId);
      setSelectedDetail(detail);
      setSelectedParamsId(paramsId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async (data: {
    name: string;
    description: string | null;
    cooldownDays: number;
    useIdeas: boolean;
    isDefault: boolean;
  }) => {
    try {
      const created = await APIManager.createMealGenerationParams(communityId, data);
      // Si isDefault, mettre a jour la liste
      if (created.isDefault && paramsList) {
        setParamsList(
          paramsList
            .map((p) => (p.isDefault ? { ...p, isDefault: false } : p))
            .concat({
              id: created.id,
              name: created.name,
              description: created.description,
              cooldownDays: created.cooldownDays,
              useIdeas: created.useIdeas,
              isDefault: created.isDefault,
              createdAt: created.createdAt,
              updatedAt: created.updatedAt,
            })
        );
      } else {
        setParamsList([
          ...(paramsList || []),
          {
            id: created.id,
            name: created.name,
            description: created.description,
            cooldownDays: created.cooldownDays,
            useIdeas: created.useIdeas,
            isDefault: created.isDefault,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          },
        ]);
      }
      setShowForm(false);
      toast.success("Parameters created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    }
  };

  const handleUpdate = async (data: {
    name: string;
    description: string | null;
    cooldownDays: number;
    useIdeas: boolean;
    isDefault: boolean;
  }) => {
    if (!editingParams) return;
    try {
      const updated = await APIManager.updateMealGenerationParams(
        communityId,
        editingParams.id,
        data
      );
      setParamsList(
        (paramsList || []).map((p) => {
          if (p.id === updated.id) {
            return {
              ...p,
              name: updated.name,
              description: updated.description,
              cooldownDays: updated.cooldownDays,
              useIdeas: updated.useIdeas,
              isDefault: updated.isDefault,
              updatedAt: updated.updatedAt,
            };
          }
          // Si le updated est devenu default, enlever isDefault aux autres
          if (updated.isDefault && p.isDefault) {
            return { ...p, isDefault: false };
          }
          return p;
        })
      );
      // Refresh detail si c'est le meme
      if (selectedParamsId === editingParams.id) {
        setSelectedDetail(updated);
      }
      setEditingParams(null);
      toast.success("Parameters updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleDelete = async (paramsId: string) => {
    if (!confirm("Delete this parameter set? This cannot be undone.")) return;
    setDeletingId(paramsId);
    try {
      await APIManager.deleteMealGenerationParams(communityId, paramsId);
      setParamsList((paramsList || []).filter((p) => p.id !== paramsId));
      if (selectedParamsId === paramsId) {
        setSelectedParamsId(null);
        setSelectedDetail(null);
      }
      toast.success("Parameters deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExclusionsUpdated = (exclusions: MealGenerationParams["exclusions"]) => {
    if (selectedDetail) {
      setSelectedDetail({ ...selectedDetail, exclusions });
    }
  };

  const handlePinsUpdated = (slotPins: MealGenerationParams["slotPins"]) => {
    if (selectedDetail) {
      setSelectedDetail({ ...selectedDetail, slotPins });
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
    return <div className="alert alert-error">{error}</div>;
  }

  // Detail view
  if (selectedParamsId && selectedDetail) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => {
              setSelectedParamsId(null);
              setSelectedDetail(null);
            }}
            aria-label="Back"
          >
            <FaArrowLeft />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{selectedDetail.name}</h3>
              {selectedDetail.isDefault && (
                <span className="badge badge-warning badge-sm gap-1">
                  <FaStar className="w-2.5 h-2.5" />
                  Default
                </span>
              )}
            </div>
            {selectedDetail.description && (
              <p className="text-sm text-base-content/60">{selectedDetail.description}</p>
            )}
          </div>
          {isModerator && (
            <button
              className="btn btn-ghost btn-sm gap-1"
              onClick={() => {
                setEditingParams({
                  id: selectedDetail.id,
                  name: selectedDetail.name,
                  description: selectedDetail.description,
                  cooldownDays: selectedDetail.cooldownDays,
                  useIdeas: selectedDetail.useIdeas,
                  isDefault: selectedDetail.isDefault,
                  createdAt: selectedDetail.createdAt,
                  updatedAt: selectedDetail.updatedAt,
                });
              }}
            >
              <FaEdit className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        {/* Settings summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Cooldown</div>
            <div className="stat-value text-lg">{selectedDetail.cooldownDays}d</div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Use Ideas</div>
            <div className="stat-value text-lg">{selectedDetail.useIdeas ? "Yes" : "No"}</div>
          </div>
          <div className="stat bg-base-200 rounded-lg p-3">
            <div className="stat-title text-xs">Rules</div>
            <div className="stat-value text-lg">{selectedDetail.rules.length}</div>
          </div>
        </div>

        {/* Exclusion & Pin grids */}
        <ExclusionPinGrid
          communityId={communityId}
          paramsId={selectedDetail.id}
          exclusions={selectedDetail.exclusions}
          slotPins={selectedDetail.slotPins}
          isModerator={isModerator}
          onExclusionsUpdated={handleExclusionsUpdated}
          onPinsUpdated={handlePinsUpdated}
        />
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <FaCog className="w-4 h-4" />
          Generation Parameters
        </h3>
        {isModerator && (
          <button className="btn btn-primary btn-sm gap-1" onClick={() => setShowForm(true)}>
            <FaPlus className="w-3 h-3" />
            New Set
          </button>
        )}
      </div>

      {!paramsList || paramsList.length === 0 ? (
        <div className="text-center py-8 text-base-content/60">
          <FaCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No generation parameters yet.</p>
          {isModerator && (
            <p className="text-sm mt-1">Create a set to configure automatic generation.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {paramsList.map((params) => (
            <div
              key={params.id}
              className="card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
              onClick={() => loadDetail(params.id)}
            >
              <div className="card-body p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{params.name}</h4>
                    {params.isDefault && (
                      <span className="badge badge-warning badge-sm gap-1">
                        <FaStar className="w-2.5 h-2.5" />
                        Default
                      </span>
                    )}
                  </div>
                  {isModerator && (
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingParams(params);
                        }}
                        aria-label="Edit"
                      >
                        <FaEdit className="w-3 h-3" />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(params.id);
                        }}
                        disabled={deletingId === params.id}
                        aria-label="Delete"
                      >
                        {deletingId === params.id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <FaTrash className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {params.description && (
                  <p className="text-sm text-base-content/60 mt-1">{params.description}</p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-base-content/50">
                  <span>Cooldown: {params.cooldownDays}d</span>
                  <span>Ideas: {params.useIdeas ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {loadingDetail && (
        <div className="flex justify-center py-4">
          <span className="loading loading-spinner loading-md" />
        </div>
      )}

      {/* Create/Edit modal */}
      {(showForm || editingParams) && (
        <ParamsFormModal
          params={editingParams}
          onSubmit={editingParams ? handleUpdate : handleCreate}
          onClose={() => {
            setShowForm(false);
            setEditingParams(null);
          }}
        />
      )}
    </div>
  );
};

export default GenerationParamsPanel;
