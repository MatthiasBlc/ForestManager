import { useState, useEffect } from "react";
import { FaMagic, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import toast from "react-hot-toast";
import { toastError } from "../../utils/toastError";
import APIManager from "../../network/api";
import { MealPlan, MealGenerationParamsListItem, GenerationReport } from "../../models/mealPlan";

interface Props {
  communityId: string;
  plan: MealPlan;
  onGenerated: (plan: MealPlan, report: GenerationReport) => void;
  onClose: () => void;
}

const GenerateModal = ({ communityId, plan, onGenerated, onClose }: Props) => {
  const [paramsList, setParamsList] = useState<MealGenerationParamsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParamsId, setSelectedParamsId] = useState("");
  const [fillEmptyOnly, setFillEmptyOnly] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    APIManager.listMealGenerationParams(communityId)
      .then((res) => {
        setParamsList(res.data);
        const defaultParams = res.data.find((p) => p.isDefault);
        if (defaultParams) {
          setSelectedParamsId(defaultParams.id);
        } else if (res.data.length > 0) {
          setSelectedParamsId(res.data[0].id);
        }
      })
      .catch((err) => toastError(err, "Failed to load params"))
      .finally(() => setLoading(false));
  }, [communityId]);

  const nonLockedNonEmptySlots = plan.slots.filter(
    (s) => !s.locked && !s.disabled && s.type !== "EMPTY"
  );

  const handleGenerate = () => {
    if (!fillEmptyOnly && nonLockedNonEmptySlots.length > 0 && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    doGenerate();
  };

  const doGenerate = async () => {
    if (!selectedParamsId) return;
    setGenerating(true);
    try {
      const result = await APIManager.generateMealPlan(
        communityId,
        selectedParamsId,
        fillEmptyOnly
      );
      toast.success(`${result.report.slotsGenerated} slots generated`);
      onGenerated(result.plan, result.report);
    } catch (err) {
      toastError(err, "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
          <FaMagic className="text-primary" />
          Generate Meal Plan
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : paramsList.length === 0 ? (
          <div className="alert alert-warning mb-4">
            <FaExclamationTriangle />
            <span>No generation params found. Create one in the Generation tab first.</span>
          </div>
        ) : showConfirm ? (
          <div>
            <div className="alert alert-warning mb-4">
              <FaExclamationTriangle />
              <div>
                <p className="font-medium">Overwrite existing slots?</p>
                <p className="text-sm">
                  {nonLockedNonEmptySlots.length} non-locked slot(s) with content will be
                  regenerated. Locked slots are preserved.
                </p>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>
                Back
              </button>
              <button className="btn btn-warning" onClick={doGenerate} disabled={generating}>
                {generating ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Confirm & Generate"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Params selector */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-medium">Generation params</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={selectedParamsId}
                onChange={(e) => setSelectedParamsId(e.target.value)}
              >
                {paramsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* fillEmptyOnly toggle */}
            <div className="form-control mb-4">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={fillEmptyOnly}
                  onChange={(e) => setFillEmptyOnly(e.target.checked)}
                />
                <div>
                  <span className="label-text font-medium">Fill empty slots only</span>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    Keep existing recipes, only generate for empty slots
                  </p>
                </div>
              </label>
            </div>

            {!fillEmptyOnly && nonLockedNonEmptySlots.length > 0 && (
              <div className="alert alert-info mb-4 py-2">
                <FaInfoCircle className="w-4 h-4" />
                <span className="text-sm">
                  {nonLockedNonEmptySlots.length} non-locked slot(s) will be regenerated
                </span>
              </div>
            )}

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!selectedParamsId || generating}
              >
                {generating ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    <FaMagic className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Close for no-params state */}
        {!loading && paramsList.length === 0 && (
          <div className="modal-action">
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
};

export default GenerateModal;
