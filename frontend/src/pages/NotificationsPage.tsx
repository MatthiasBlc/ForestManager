import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaEnvelope,
  FaUtensils,
  FaTag,
  FaLeaf,
  FaShieldAlt,
  FaCheckDouble,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import { useNotifications } from "../hooks/useNotifications";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { Notification, NotificationCategory } from "../models/notification";

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { label: string; icon: React.ReactNode }
> = {
  INVITATION: { label: "Invitations", icon: <FaEnvelope /> },
  RECIPE_PROPOSAL: { label: "Recettes", icon: <FaUtensils /> },
  TAG: { label: "Tags", icon: <FaTag /> },
  INGREDIENT: { label: "Ingredients", icon: <FaLeaf /> },
  MODERATION: { label: "Moderation", icon: <FaShieldAlt /> },
};

const ALL_CATEGORIES: NotificationCategory[] = [
  "INVITATION",
  "RECIPE_PROPOSAL",
  "TAG",
  "INGREDIENT",
  "MODERATION",
];

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) return "il y a quelques secondes";
  if (diffMinutes < 60) return `il y a ${diffMinutes}min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays < 7) return `il y a ${diffDays}j`;
  if (diffWeeks < 5) return `il y a ${diffWeeks}sem`;
  return new Date(dateString).toLocaleDateString("fr-FR");
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<
    NotificationCategory | undefined
  >(undefined);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const {
    notifications,
    loading,
    error,
    hasMore,
    loadMore,
    markAsRead,
    markAllAsRead,
    total,
  } = useNotifications({
    category: selectedCategory,
    unreadOnly,
    limit: 20,
  });

  const { byCategory, refresh: refreshCount } = useUnreadCount();

  const handleCategoryChange = (cat: NotificationCategory | undefined) => {
    setSelectedCategory(cat);
    setExpandedGroups(new Set());
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead(selectedCategory);
    refreshCount();
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.readAt) {
      await markAsRead(notif.id);
      refreshCount();
    }
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    return CATEGORY_CONFIG[category]?.icon ?? <FaBell />;
  };

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaBell className="w-5 h-5" />
          Notifications
          {total > 0 && (
            <span className="badge badge-neutral text-sm">{total}</span>
          )}
        </h1>
        {hasUnread && (
          <button
            className="btn btn-sm btn-outline gap-2"
            onClick={handleMarkAllAsRead}
          >
            <FaCheckDouble />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          <button
            className={`btn btn-sm ${
              selectedCategory === undefined ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => handleCategoryChange(undefined)}
          >
            Toutes
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const unreadForCat = byCategory[cat] || 0;
            return (
              <button
                key={cat}
                className={`btn btn-sm gap-1 ${
                  selectedCategory === cat ? "btn-primary" : "btn-outline"
                }`}
                onClick={() => handleCategoryChange(cat)}
              >
                {config.icon}
                {config.label}
                {unreadForCat > 0 && (
                  <span className="badge badge-sm badge-secondary">
                    {unreadForCat}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Unread toggle */}
        <label className="label cursor-pointer gap-2 ml-auto">
          <span className="label-text text-sm">Non lues uniquement</span>
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Loading (initial) */}
      {loading && notifications.length === 0 && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && notifications.length === 0 && (
        <div className="text-center py-12">
          <FaBell className="w-12 h-12 mx-auto mb-4 text-base-content/30" />
          <p className="text-lg text-base-content/60">Aucune notification</p>
        </div>
      )}

      {/* Notification list */}
      {notifications.length > 0 && (
        <div className="flex flex-col gap-2">
          {notifications.map((notif) => {
            const isGroup = notif.group && notif.group.count > 1;
            const isExpanded = expandedGroups.has(notif.id);

            return (
              <div key={notif.id}>
                {/* Main notification card */}
                <div
                  className={`card card-compact bg-base-100 shadow-sm border cursor-pointer transition-colors hover:bg-base-200 ${
                    !notif.readAt
                      ? "border-l-4 border-l-primary"
                      : "border-base-300"
                  }`}
                  onClick={() => {
                    if (isGroup) {
                      toggleGroup(notif.id);
                    } else {
                      handleNotificationClick(notif);
                    }
                  }}
                >
                  <div className="card-body flex-row items-center gap-3">
                    {/* Category icon */}
                    <div
                      className={`text-lg ${
                        !notif.readAt
                          ? "text-primary"
                          : "text-base-content/40"
                      }`}
                    >
                      {getCategoryIcon(notif.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-medium truncate ${
                            !notif.readAt ? "font-bold" : ""
                          }`}
                        >
                          {notif.title}
                        </p>
                        {isGroup && (
                          <span className="badge badge-sm badge-ghost">
                            {notif.group!.count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-base-content/60 truncate">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {notif.community && (
                          <span className="text-xs text-base-content/50">
                            {notif.community.name}
                          </span>
                        )}
                        <span className="text-xs text-base-content/40">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!notif.readAt && !isGroup && (
                        <button
                          className="btn btn-ghost btn-xs"
                          title="Marquer comme lu"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif.id);
                            refreshCount();
                          }}
                        >
                          <FaCheckDouble className="w-3 h-3" />
                        </button>
                      )}
                      {isGroup && (
                        <span className="text-base-content/40">
                          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded group items */}
                {isGroup && isExpanded && (
                  <div className="ml-8 mt-1 flex flex-col gap-1">
                    {notif.group!.items.map((item) => (
                      <div
                        key={item.id}
                        className={`card card-compact bg-base-100 shadow-xs border cursor-pointer transition-colors hover:bg-base-200 ${
                          !item.readAt
                            ? "border-l-4 border-l-primary/60"
                            : "border-base-300"
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="card-body flex-row items-center gap-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-base-content/70 truncate">
                              {item.message}
                            </p>
                          </div>
                          <span className="text-xs text-base-content/40 whitespace-nowrap">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {/* Mark group as read */}
                    {notif.group!.items.some((i) => !i.readAt) && (
                      <button
                        className="btn btn-ghost btn-xs self-end mt-1 gap-1"
                        onClick={() => {
                          markAsRead(notif.id);
                          refreshCount();
                        }}
                      >
                        <FaCheckDouble className="w-3 h-3" />
                        Marquer le groupe comme lu
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                className={`btn btn-outline btn-sm ${
                  loading ? "loading" : ""
                }`}
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? "Chargement..." : "Charger plus"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
