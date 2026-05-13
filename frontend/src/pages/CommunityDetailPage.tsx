import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FaArrowLeft,
  FaEdit,
  FaUsers,
  FaHistory,
  FaEnvelope,
  FaTags,
  FaCalendarAlt,
} from "react-icons/fa";
import { CommunityDetail, CommunityMember } from "../models/community";
import APIManager from "../network/api";
import MembersList from "../components/communities/MembersList";
import CommunityRecipesList from "../components/communities/CommunityRecipesList";
import CommunityEditForm from "../components/communities/CommunityEditForm";
import SentInvitesList from "../components/invitations/SentInvitesList";
import CommunityTagsList from "../components/communities/CommunityTagsList";
import { ActivityFeed } from "../components/activity";
import SidePanel from "../components/communities/SidePanel";
import BottomSheet from "../components/mobile/BottomSheet";
import { communityEvents } from "../utils/communityEvents";
import { useAsyncData } from "../hooks/useAsyncData";
import { useIsMobile } from "../hooks/useIsMobile";

type PanelContent = "members" | "activity" | "invitations" | "edit" | "tags";

const PANEL_WIDTH_KEY = "communityPanelWidth";
const DEFAULT_PANEL_WIDTH = 350;

const CommunityDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const VALID_PANELS: PanelContent[] = ["members", "activity", "invitations", "edit", "tags"];
  const panelParam = searchParams.get("panel");
  const initialPanel =
    panelParam && VALID_PANELS.includes(panelParam as PanelContent)
      ? (panelParam as PanelContent)
      : null;

  const [panelContent, setPanelContent] = useState<PanelContent | null>(initialPanel);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_PANEL_WIDTH;
  });

  const {
    data: communityData,
    isLoading,
    error,
    refetch: loadCommunity,
  } = useAsyncData(
    () =>
      id
        ? Promise.all([APIManager.getCommunity(id), APIManager.getCommunityMembers(id)]).then(
            ([c, m]) => ({ community: c, members: m.data })
          )
        : Promise.reject(new Error("Missing community ID")),
    [id]
  );

  const community: CommunityDetail | null = communityData?.community ?? null;
  const members: CommunityMember[] = communityData?.members ?? [];

  // Synchroniser le panel avec le query param (navigation depuis notification)
  useEffect(() => {
    const p = searchParams.get("panel");
    if (p && VALID_PANELS.includes(p as PanelContent)) {
      setPanelContent(p as PanelContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Lire les filtres tags depuis les query params
  const initialTags = searchParams.get("tags");

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
    setPanelContent((prev) => (prev === content ? null : content));
  };

  const handleEditSaved = async () => {
    await loadCommunity();
    communityEvents.notify();
    toast.success("Community updated");
    setPanelContent(null);
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
        <button className="btn btn-ghost mt-4 gap-2" onClick={() => navigate("/communities")}>
          <FaArrowLeft />
          Back to communities
        </button>
      </div>
    );
  }

  const isModerator = community.currentUserRole === "MODERATOR";

  const panelTitle =
    panelContent === "members"
      ? "Members"
      : panelContent === "activity"
        ? "Activity"
        : panelContent === "invitations"
          ? "Invitations"
          : panelContent === "edit"
            ? "Edit Community"
            : panelContent === "tags"
              ? "Tags"
              : "";

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-start gap-4">
            {community.imageUrl && (
              <img
                src={community.imageUrl}
                alt={community.name}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            )}
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
                {community.membersCount} {community.membersCount === 1 ? "member" : "members"}{" "}
                &middot; {community.recipesCount}{" "}
                {community.recipesCount === 1 ? "recipe" : "recipes"}
              </p>
            </div>
          </div>
          <div className={`flex items-center ${isMobile ? "flex-wrap gap-2" : "gap-1"}`}>
            {/* Meal Plan button */}
            {isMobile ? (
              <Link
                to={`/communities/${community.id}/meal-plan`}
                className="btn btn-ghost btn-sm gap-1 min-h-[44px]"
                aria-label="Meal Plan"
              >
                <FaCalendarAlt className="w-4 h-4" />
                Meals
              </Link>
            ) : (
              <div className="tooltip tooltip-bottom" data-tip="Meal Plan">
                <Link
                  to={`/communities/${community.id}/meal-plan`}
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Meal Plan"
                >
                  <FaCalendarAlt className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Members button */}
            {isMobile ? (
              <button
                className={`btn btn-ghost btn-sm gap-1 min-h-[44px] ${panelContent === "members" ? "btn-active" : ""}`}
                onClick={() => togglePanel("members")}
                aria-label="Members"
              >
                <FaUsers className="w-4 h-4" />
                Members
              </button>
            ) : (
              <div className="tooltip tooltip-bottom" data-tip="Members">
                <button
                  className={`btn btn-ghost btn-sm btn-circle ${panelContent === "members" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("members")}
                  aria-label="Members"
                >
                  <FaUsers className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Activity button (moderators only) */}
            {isModerator &&
              (isMobile ? (
                <button
                  className={`btn btn-ghost btn-sm gap-1 min-h-[44px] ${panelContent === "activity" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("activity")}
                  aria-label="Activity"
                >
                  <FaHistory className="w-4 h-4" />
                  Activity
                </button>
              ) : (
                <div className="tooltip tooltip-bottom" data-tip="Activity">
                  <button
                    className={`btn btn-ghost btn-sm btn-circle ${panelContent === "activity" ? "btn-active" : ""}`}
                    onClick={() => togglePanel("activity")}
                    aria-label="Activity"
                  >
                    <FaHistory className="w-4 h-4" />
                  </button>
                </div>
              ))}

            {/* Invitations button (moderators only) */}
            {isModerator &&
              (isMobile ? (
                <button
                  className={`btn btn-ghost btn-sm gap-1 min-h-[44px] ${panelContent === "invitations" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("invitations")}
                  aria-label="Invitations"
                >
                  <FaEnvelope className="w-4 h-4" />
                  Invites
                </button>
              ) : (
                <div className="tooltip tooltip-bottom" data-tip="Invitations">
                  <button
                    className={`btn btn-ghost btn-sm btn-circle ${panelContent === "invitations" ? "btn-active" : ""}`}
                    onClick={() => togglePanel("invitations")}
                    aria-label="Invitations"
                  >
                    <FaEnvelope className="w-4 h-4" />
                  </button>
                </div>
              ))}

            {/* Tags button (moderators only) */}
            {isModerator &&
              (isMobile ? (
                <button
                  className={`btn btn-ghost btn-sm gap-1 min-h-[44px] ${panelContent === "tags" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("tags")}
                  aria-label="Tags"
                >
                  <FaTags className="w-4 h-4" />
                  Tags
                </button>
              ) : (
                <div className="tooltip tooltip-bottom" data-tip="Tags">
                  <button
                    className={`btn btn-ghost btn-sm btn-circle ${panelContent === "tags" ? "btn-active" : ""}`}
                    onClick={() => togglePanel("tags")}
                    aria-label="Tags"
                  >
                    <FaTags className="w-4 h-4" />
                  </button>
                </div>
              ))}

            {/* Edit button (moderators only) */}
            {isModerator &&
              (isMobile ? (
                <button
                  className={`btn btn-ghost btn-sm gap-1 min-h-[44px] ${panelContent === "edit" ? "btn-active" : ""}`}
                  onClick={() => togglePanel("edit")}
                  aria-label="Edit"
                >
                  <FaEdit className="w-4 h-4" />
                  Edit
                </button>
              ) : (
                <div className="tooltip tooltip-bottom" data-tip="Edit community">
                  <button
                    className={`btn btn-ghost btn-sm btn-circle ${panelContent === "edit" ? "btn-active" : ""}`}
                    onClick={() => togglePanel("edit")}
                    aria-label="Edit"
                  >
                    <FaEdit className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Content area with optional side panel */}
      <div className="flex gap-6">
        {/* Recipes - always visible */}
        <div className="flex-1 min-w-0 bg-base-100 rounded-lg shadow-xl p-6">
          <CommunityRecipesList communityId={community.id} initialTags={initialTags} />
        </div>

        {/* Side Panel - desktop only */}
        {!isMobile && (
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
            {panelContent === "tags" && isModerator && (
              <CommunityTagsList communityId={community.id} />
            )}
            {panelContent === "edit" && isModerator && (
              <CommunityEditForm
                communityId={community.id}
                initialName={community.name}
                initialDescription={community.description || ""}
                initialImageUrl={community.imageUrl}
                onSaved={handleEditSaved}
                onCancel={() => setPanelContent(null)}
              />
            )}
          </SidePanel>
        )}
      </div>

      {/* Bottom Sheet - mobile only */}
      {isMobile && (
        <BottomSheet
          isOpen={panelContent !== null}
          onClose={() => setPanelContent(null)}
          title={panelTitle}
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
          {panelContent === "tags" && isModerator && (
            <CommunityTagsList communityId={community.id} />
          )}
          {panelContent === "edit" && isModerator && (
            <CommunityEditForm
              communityId={community.id}
              initialName={community.name}
              initialDescription={community.description || ""}
              initialImageUrl={community.imageUrl}
              onSaved={handleEditSaved}
              onCancel={() => setPanelContent(null)}
            />
          )}
        </BottomSheet>
      )}
    </div>
  );
};

export default CommunityDetailPage;
