import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaEdit, FaUsers, FaHistory, FaEnvelope, FaSave } from "react-icons/fa";
import { CommunityDetail, CommunityMember } from "../models/community";
import APIManager from "../network/api";
import MembersList from "../components/communities/MembersList";
import CommunityRecipesList from "../components/communities/CommunityRecipesList";
import SentInvitesList from "../components/invitations/SentInvitesList";
import { ActivityFeed } from "../components/activity";
import SidePanel from "../components/communities/SidePanel";

type PanelContent = "members" | "activity" | "invitations" | "edit";

const PANEL_WIDTH_KEY = "communityPanelWidth";
const DEFAULT_PANEL_WIDTH = 350;

const CommunityDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelContent, setPanelContent] = useState<PanelContent | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_PANEL_WIDTH;
  });

  // Lire les filtres tags depuis les query params
  const initialTags = searchParams.get("tags");

  const loadCommunity = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);
      const [communityData, membersData] = await Promise.all([
        APIManager.getCommunity(id),
        APIManager.getCommunityMembers(id),
      ]);
      setCommunity(communityData);
      setMembers(membersData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  const handleMembersChange = () => {
    loadCommunity();
  };

  const handleLeave = () => {
    navigate("/dashboard");
  };

  const handlePanelWidthChange = useCallback((width: number) => {
    setPanelWidth(width);
    localStorage.setItem(PANEL_WIDTH_KEY, String(width));
  }, []);

  const togglePanel = (content: PanelContent) => {
    setPanelContent((prev) => {
      if (prev === content) return null;
      // Initialiser le formulaire quand on ouvre "edit"
      if (content === "edit" && community) {
        setEditName(community.name);
        setEditDescription(community.description || "");
        setEditError(null);
      }
      return content;
    });
  };

  const handleEditSave = async () => {
    if (!id || !editName.trim()) return;

    try {
      setIsSaving(true);
      setEditError(null);
      await APIManager.updateCommunity(id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      await loadCommunity();
      window.dispatchEvent(new Event("community-updated"));
      setPanelContent(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update community");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert alert-error">
          <span>{error || "Community not found"}</span>
        </div>
        <button
          className="btn btn-ghost mt-4 gap-2"
          onClick={() => navigate("/communities")}
        >
          <FaArrowLeft />
          Back to communities
        </button>
      </div>
    );
  }

  const isModerator = community.currentUserRole === "MODERATOR";

  const panelTitle =
    panelContent === "members" ? "Members" :
    panelContent === "activity" ? "Activity" :
    panelContent === "invitations" ? "Invitations" :
    panelContent === "edit" ? "Edit Community" : "";

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{community.name}</h1>
              <span className={`badge ${isModerator ? "badge-primary" : "badge-ghost"}`}>
                {community.currentUserRole}
              </span>
            </div>
            {community.description && (
              <p className="text-base-content/70 mb-2">{community.description}</p>
            )}
            <p className="text-sm text-base-content/50">
              {community.membersCount} {community.membersCount === 1 ? "member" : "members"}
              {" "}&middot;{" "}
              {community.recipesCount} {community.recipesCount === 1 ? "recipe" : "recipes"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/* Members button */}
            <div className="tooltip tooltip-bottom" data-tip="Members">
              <button
                className={`btn btn-ghost btn-sm btn-circle ${panelContent === "members" ? "btn-active" : ""}`}
                onClick={() => togglePanel("members")}
                aria-label="Members"
              >
                <FaUsers className="w-4 h-4" />
              </button>
            </div>

            {/* Activity button (moderators only) */}
            {isModerator && (
              <div className="tooltip tooltip-bottom" data-tip="Activity">
                <button
                  className={`btn btn-ghost btn-sm btn-circle ${panelContent === "activity" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("activity")}
                  aria-label="Activity"
                >
                  <FaHistory className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Invitations button (moderators only) */}
            {isModerator && (
              <div className="tooltip tooltip-bottom" data-tip="Invitations">
                <button
                  className={`btn btn-ghost btn-sm btn-circle ${panelContent === "invitations" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("invitations")}
                  aria-label="Invitations"
                >
                  <FaEnvelope className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Edit button (moderators only) */}
            {isModerator && (
              <div className="tooltip tooltip-bottom" data-tip="Edit community">
                <button
                  className={`btn btn-ghost btn-sm btn-circle ${panelContent === "edit" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("edit")}
                  aria-label="Edit"
                >
                  <FaEdit className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content area with optional side panel */}
      <div className="flex gap-6">
        {/* Recipes - always visible */}
        <div className="flex-1 min-w-0 bg-base-100 rounded-lg shadow-xl p-6">
          <CommunityRecipesList communityId={community.id} initialTags={initialTags} />
        </div>

        {/* Side Panel */}
        <SidePanel
          isOpen={panelContent !== null}
          title={panelTitle}
          width={panelWidth}
          onWidthChange={handlePanelWidthChange}
          onClose={() => setPanelContent(null)}
        >
          {panelContent === "members" && (
            <MembersList
              communityId={community.id}
              members={members}
              currentUserRole={community.currentUserRole}
              onMembersChange={handleMembersChange}
              onLeave={handleLeave}
            />
          )}
          {panelContent === "activity" && isModerator && (
            <ActivityFeed communityId={community.id} />
          )}
          {panelContent === "invitations" && isModerator && (
            <SentInvitesList communityId={community.id} />
          )}
          {panelContent === "edit" && isModerator && (
            <div className="space-y-4">
              {editError && (
                <div className="alert alert-error text-sm">
                  <span>{editError}</span>
                </div>
              )}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Name *</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Community name"
                  className="input input-bordered input-sm w-full"
                  disabled={isSaving}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Description</span>
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe your community..."
                  rows={4}
                  className="textarea textarea-bordered textarea-sm w-full"
                  disabled={isSaving}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPanelContent(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm gap-2"
                  onClick={handleEditSave}
                  disabled={isSaving || !editName.trim()}
                >
                  {isSaving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <FaSave className="w-3 h-3" />
                  )}
                  Save
                </button>
              </div>
            </div>
          )}
        </SidePanel>
      </div>
    </div>
  );
};

export default CommunityDetailPage;
