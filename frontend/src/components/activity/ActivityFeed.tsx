import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  FaUtensils,
  FaEdit,
  FaTrash,
  FaShare,
  FaCodeBranch,
  FaCheck,
  FaTimes,
  FaUserPlus,
  FaSignOutAlt,
  FaUserMinus,
  FaStar,
  FaEnvelope,
  FaEnvelopeOpen,
} from "react-icons/fa";
import { ActivityItem, ActivityType } from "../../models/activity";
import APIManager from "../../network/api";

interface ActivityFeedProps {
  communityId?: string;
  personal?: boolean;
  limit?: number;
}

const activityConfig: Record<
  ActivityType,
  { icon: React.ElementType; color: string; label: string }
> = {
  RECIPE_CREATED: { icon: FaUtensils, color: "text-success", label: "created a recipe" },
  RECIPE_UPDATED: { icon: FaEdit, color: "text-info", label: "updated a recipe" },
  RECIPE_DELETED: { icon: FaTrash, color: "text-error", label: "deleted a recipe" },
  RECIPE_SHARED: { icon: FaShare, color: "text-primary", label: "shared a recipe" },
  VARIANT_PROPOSED: { icon: FaCodeBranch, color: "text-warning", label: "proposed changes to" },
  VARIANT_CREATED: { icon: FaCodeBranch, color: "text-secondary", label: "created a variant of" },
  PROPOSAL_ACCEPTED: { icon: FaCheck, color: "text-success", label: "accepted changes to" },
  PROPOSAL_REJECTED: { icon: FaTimes, color: "text-error", label: "rejected changes to" },
  USER_JOINED: { icon: FaUserPlus, color: "text-success", label: "joined the community" },
  USER_LEFT: { icon: FaSignOutAlt, color: "text-warning", label: "left the community" },
  USER_KICKED: { icon: FaUserMinus, color: "text-error", label: "was removed from the community" },
  USER_PROMOTED: { icon: FaStar, color: "text-primary", label: "was promoted to moderator" },
  INVITE_SENT: { icon: FaEnvelope, color: "text-info", label: "sent an invitation" },
  INVITE_ACCEPTED: { icon: FaEnvelopeOpen, color: "text-success", label: "accepted an invitation" },
  INVITE_REJECTED: { icon: FaEnvelopeOpen, color: "text-error", label: "declined an invitation" },
  INVITE_CANCELLED: { icon: FaTimes, color: "text-warning", label: "cancelled an invitation" },
};

const ActivityFeed = ({ communityId, personal = false, limit = 20 }: ActivityFeedProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const loadActivities = useCallback(
    async (loadMore = false) => {
      try {
        if (!loadMore) {
          setIsLoading(true);
        }
        setError(null);

        const currentOffset = loadMore ? offset : 0;
        const response = personal
          ? await APIManager.getMyActivity({ limit, offset: currentOffset })
          : communityId
          ? await APIManager.getCommunityActivity(communityId, { limit, offset: currentOffset })
          : null;

        if (!response) {
          throw new Error("Invalid feed configuration");
        }

        if (loadMore) {
          setActivities((prev) => [...prev, ...response.data]);
        } else {
          setActivities(response.data);
        }

        setHasMore(response.pagination.hasMore);
        setOffset(currentOffset + response.data.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      } finally {
        setIsLoading(false);
      }
    },
    [communityId, personal, limit, offset]
  );

  useEffect(() => {
    loadActivities();
    // Reset offset when props change
    setOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId, personal]);

  const handleLoadMore = () => {
    loadActivities(true);
  };

  const renderActivityContent = (activity: ActivityItem) => {
    const config = activityConfig[activity.type];
    const Icon = config.icon;

    return (
      <div className="flex items-start gap-3">
        <div className={`mt-1 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">{activity.user.username}</span>{" "}
            <span className="text-base-content/70">{config.label}</span>
            {activity.recipe && (
              <>
                {" "}
                {activity.recipe.isDeleted ? (
                  <span className="text-base-content/50 italic">{activity.recipe.title} (deleted)</span>
                ) : (
                  <Link
                    to={`/recipes/${activity.recipe.id}`}
                    className="font-medium hover:underline"
                  >
                    {activity.recipe.title}
                  </Link>
                )}
              </>
            )}
            {personal && activity.community && (
              <>
                {" "}
                <span className="text-base-content/70">in</span>{" "}
                {activity.community.isDeleted ? (
                  <span className="text-base-content/50 italic">{activity.community.name} (deleted)</span>
                ) : (
                  <Link
                    to={`/communities/${activity.community.id}`}
                    className="font-medium hover:underline"
                  >
                    {activity.community.name}
                  </Link>
                )}
              </>
            )}
          </p>
          <p className="text-xs text-base-content/50 mt-1">
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    );
  };

  if (isLoading && activities.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md" />
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

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/50">
        <p>No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-base-200">
        {activities.map((activity) => (
          <div key={activity.id} className="py-3 first:pt-0 last:pb-0">
            {renderActivityContent(activity)}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="text-center pt-4">
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLoadMore}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
