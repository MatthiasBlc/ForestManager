import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { toastError } from "../utils/toastError";
import {
  FaArrowLeft,
  FaCalendarPlus,
  FaTrash,
  FaCog,
  FaArchive,
  FaLightbulb,
  FaSlidersH,
  FaMagic,
} from "react-icons/fa";
import APIManager from "../network/api";
import { useAsyncData } from "../hooks/useAsyncData";
import { useIsMobile } from "../hooks/useIsMobile";
import { MealPlan, MealPlanResponse, MealSlot, GenerationReport } from "../models/mealPlan";
import { CommunityDetail } from "../models/community";
import CreatePlanModal from "../components/mealPlan/CreatePlanModal";
import MealPlanGrid from "../components/mealPlan/MealPlanGrid";
import MealPlanSettings from "../components/mealPlan/MealPlanSettings";
import MealPlanArchives from "../components/mealPlan/MealPlanArchives";
import MealIdeasPanel from "../components/mealPlan/MealIdeasPanel";
import GenerationParamsPanel from "../components/mealPlan/GenerationParamsPanel";
import GenerateModal from "../components/mealPlan/GenerateModal";
import GenerationReportPanel from "../components/mealPlan/GenerationReportPanel";

type TabContent = "planning" | "archives" | "ideas" | "generation";

const MealPlanPage = () => {
  const { id: communityId } = useParams<{ id: string }>();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<TabContent>("planning");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generationReport, setGenerationReport] = useState<GenerationReport | null>(null);

  // Fetch community details (to check feature + role)
  const {
    data: community,
    isLoading: loadingCommunity,
    error: communityError,
  } = useAsyncData<CommunityDetail | null>(
    () => (communityId ? APIManager.getCommunity(communityId) : Promise.resolve(null)),
    [communityId]
  );

  // Fetch meal plan
  const {
    data: mealPlanData,
    setData: setMealPlanData,
    isLoading: loadingPlan,
    error: planError,
  } = useAsyncData<MealPlanResponse | null>(
    () => (communityId ? APIManager.getMealPlan(communityId) : Promise.resolve(null)),
    [communityId]
  );

  const plan = mealPlanData?.plan ?? null;
  const isModerator = community?.currentUserRole === "MODERATOR";

  const handlePlanCreated = (newPlan: MealPlan) => {
    setMealPlanData({ plan: newPlan, hasDefaultGenerationParams: false });
    setShowCreateModal(false);
    toast.success("Planning created");
  };

  const handleDeletePlan = async () => {
    if (!communityId || !plan) return;
    if (!confirm("Delete this meal plan? This action cannot be undone.")) return;

    setIsDeleting(true);
    try {
      await APIManager.deleteMealPlan(communityId);
      setMealPlanData({ plan: null, hasDefaultGenerationParams: false });
      toast.success("Planning deleted");
    } catch (err) {
      toastError(err, "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePlanUpdated = (updatedPlan: MealPlan) => {
    setMealPlanData({ ...mealPlanData!, plan: updatedPlan });
  };

  const handleGenerated = (updatedPlan: MealPlan, report: GenerationReport) => {
    setMealPlanData({ ...mealPlanData!, plan: updatedPlan });
    setGenerationReport(report);
    setShowGenerateModal(false);
  };

  const handleSlotUpdated = (slotId: string, updates: Partial<MealSlot>) => {
    if (!plan) return;
    setMealPlanData({
      ...mealPlanData!,
      plan: {
        ...plan,
        slots: plan.slots.map((s) => (s.id === slotId ? { ...s, ...updates } : s)),
      },
    });
  };

  const handleSlotsSwapped = (
    slotAId: string,
    slotBId: string,
    slotAData: MealSlot,
    slotBData: MealSlot
  ) => {
    if (!plan) return;
    setMealPlanData({
      ...mealPlanData!,
      plan: {
        ...plan,
        slots: plan.slots.map((s) => {
          if (s.id === slotAId) return { ...s, ...slotAData };
          if (s.id === slotBId) return { ...s, ...slotBData };
          return s;
        }),
      },
    });
  };

  // Loading state
  if (loadingCommunity || loadingPlan) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  // Error or feature not enabled
  if (communityError || planError) {
    const errorMsg = communityError || planError;
    const isFeatureDisabled = errorMsg?.includes("MEAL_005");

    return (
      <div className="container mx-auto px-4 py-8">
        <div className={`alert ${isFeatureDisabled ? "alert-warning" : "alert-error"}`}>
          <span>
            {isFeatureDisabled
              ? "Meal planning is not enabled for this community."
              : errorMsg || "Error loading meal plan"}
          </span>
        </div>
        <Link to={`/communities/${communityId}`} className="btn btn-ghost mt-4 gap-2">
          <FaArrowLeft />
          Back to community
        </Link>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error">
          <span>Community not found</span>
        </div>
        <Link to="/communities" className="btn btn-ghost mt-4 gap-2">
          <FaArrowLeft />
          Back to communities
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                to={`/communities/${communityId}`}
                className="btn btn-ghost btn-sm btn-circle"
                aria-label="Back"
              >
                <FaArrowLeft />
              </Link>
              <h1 className="text-2xl font-bold">Meal Plan</h1>
              {plan && (
                <span className="badge badge-primary">
                  {new Date(plan.startDate).toLocaleDateString()} -{" "}
                  {new Date(plan.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="text-sm text-base-content/60">{community.name}</p>
          </div>

          {/* Actions (moderator only) */}
          {isModerator && (
            <div className="flex items-center gap-2 flex-wrap">
              {plan ? (
                <>
                  <button
                    className="btn btn-ghost btn-sm gap-1"
                    onClick={() => setShowSettings(true)}
                    aria-label="Settings"
                  >
                    <FaCog className="w-4 h-4" />
                    {!isMobile && "Settings"}
                  </button>
                  <button
                    className="btn btn-primary btn-sm gap-1"
                    onClick={() => setShowGenerateModal(true)}
                    aria-label="Generate"
                  >
                    <FaMagic className="w-4 h-4" />
                    {!isMobile && "Generate"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm gap-1"
                    onClick={() => setShowCreateModal(true)}
                    aria-label="New plan"
                  >
                    <FaCalendarPlus className="w-4 h-4" />
                    {!isMobile && "New Plan"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm text-error gap-1"
                    onClick={handleDeletePlan}
                    disabled={isDeleting}
                    aria-label="Delete plan"
                  >
                    {isDeleting ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <FaTrash className="w-4 h-4" />
                    )}
                    {!isMobile && "Delete"}
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary btn-sm gap-1"
                  onClick={() => setShowCreateModal(true)}
                >
                  <FaCalendarPlus className="w-4 h-4" />
                  Create Plan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed mt-4 bg-base-200">
          <button
            className={`tab ${activeTab === "planning" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("planning")}
          >
            Planning
          </button>
          <button
            className={`tab ${activeTab === "archives" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("archives")}
          >
            <FaArchive className="w-3 h-3 mr-1" />
            Archives
          </button>
          <button
            className={`tab ${activeTab === "ideas" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("ideas")}
          >
            <FaLightbulb className="w-3 h-3 mr-1" />
            Ideas
          </button>
          <button
            className={`tab ${activeTab === "generation" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("generation")}
          >
            <FaSlidersH className="w-3 h-3 mr-1" />
            Generation
          </button>
        </div>
      </div>

      {/* Generation Report */}
      {generationReport && (
        <GenerationReportPanel
          report={generationReport}
          onDismiss={() => setGenerationReport(null)}
        />
      )}

      {/* Content */}
      <div className="bg-base-100 rounded-lg shadow-xl p-6">
        {activeTab === "planning" && (
          <>
            {plan ? (
              <MealPlanGrid
                communityId={communityId!}
                plan={plan}
                isModerator={isModerator}
                onSlotUpdated={handleSlotUpdated}
                onSlotsSwapped={handleSlotsSwapped}
              />
            ) : (
              <div className="text-center py-12">
                <FaCalendarPlus className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">No active meal plan</h3>
                <p className="text-base-content/60 mb-4">
                  {isModerator
                    ? "Create a meal plan to start organizing your community's meals."
                    : "A moderator needs to create a meal plan first."}
                </p>
                {isModerator && (
                  <button
                    className="btn btn-primary gap-2"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <FaCalendarPlus />
                    Create Plan
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "archives" && (
          <MealPlanArchives communityId={communityId!} isModerator={isModerator} />
        )}

        {activeTab === "ideas" && <MealIdeasPanel communityId={communityId!} />}

        {activeTab === "generation" && (
          <GenerationParamsPanel communityId={communityId!} isModerator={isModerator} />
        )}
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <CreatePlanModal
          communityId={communityId!}
          existingPlan={plan}
          onCreated={handlePlanCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Generate Modal */}
      {showGenerateModal && plan && (
        <GenerateModal
          communityId={communityId!}
          plan={plan}
          onGenerated={handleGenerated}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && plan && (
        <MealPlanSettings
          communityId={communityId!}
          plan={plan}
          onUpdated={handlePlanUpdated}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default MealPlanPage;
