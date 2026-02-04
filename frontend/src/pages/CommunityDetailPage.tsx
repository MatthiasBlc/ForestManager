import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaEdit } from "react-icons/fa";
import { CommunityDetail, CommunityMember } from "../models/community";
import APIManager from "../network/api";
import MembersList from "../components/communities/MembersList";
import SentInvitesList from "../components/invitations/SentInvitesList";

type Tab = "members" | "invitations" | "recipes";

const CommunityDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("members");

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          className="btn btn-ghost gap-2"
          onClick={() => navigate("/communities")}
        >
          <FaArrowLeft />
          Back to communities
        </button>
      </div>

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
          {isModerator && (
            <button
              className="btn btn-ghost btn-sm gap-2"
              onClick={() => navigate(`/communities/${community.id}/edit`)}
            >
              <FaEdit />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-bordered mb-6">
        <button
          role="tab"
          className={`tab ${activeTab === "members" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          Members ({community.membersCount})
        </button>
        {isModerator && (
          <button
            role="tab"
            className={`tab ${activeTab === "invitations" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("invitations")}
          >
            Invitations
          </button>
        )}
        <button
          role="tab"
          className={`tab ${activeTab === "recipes" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("recipes")}
        >
          Recipes
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-base-100 rounded-lg shadow-xl p-6">
        {activeTab === "members" && (
          <MembersList
            communityId={community.id}
            members={members}
            currentUserRole={community.currentUserRole}
            onMembersChange={handleMembersChange}
            onLeave={handleLeave}
          />
        )}

        {activeTab === "invitations" && isModerator && (
          <SentInvitesList communityId={community.id} />
        )}

        {activeTab === "recipes" && (
          <div className="text-center py-12">
            <p className="text-base-content/60">Community recipes coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityDetailPage;
