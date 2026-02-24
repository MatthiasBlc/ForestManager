import { useState, useEffect, useRef, useCallback } from "react";
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
import { Notification, NotificationCategory } from "../../models/notification";
import { useUnreadCount } from "../../hooks/useUnreadCount";
import { useNotifications } from "../../hooks/useNotifications";
import { useClickOutside } from "../../hooks/useClickOutside";

// --- Helpers ---

const CATEGORY_ICONS: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  INVITATION: FaEnvelope,
  RECIPE_PROPOSAL: FaUtensils,
  TAG: FaTag,
  INGREDIENT: FaLeaf,
  MODERATION: FaShieldAlt,
};

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  INVITATION: "text-info",
  RECIPE_PROPOSAL: "text-warning",
  TAG: "text-accent",
  INGREDIENT: "text-success",
  MODERATION: "text-error",
};

/**
 * Formatte une date en temps relatif en francais (sans accents).
 * Ex: "il y a 2h", "il y a 3j", "a l'instant"
 */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "a l'instant";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin}min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `il y a ${diffDays}j`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `il y a ${diffMonths}mo`;

  const diffYears = Math.floor(diffMonths / 12);
  return `il y a ${diffYears}a`;
}

function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

// --- Sub-components ---

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

const NotificationItem = ({ notification, onClick }: NotificationItemProps) => {
  const isUnread = notification.readAt === null;
  const Icon = CATEGORY_ICONS[notification.category] ?? FaBell;
  const iconColor = CATEGORY_COLORS[notification.category] ?? "text-base-content";

  return (
    <li>
      <button
        className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-base-200 transition-colors cursor-pointer ${
          isUnread ? "bg-base-200/50" : ""
        }`}
        onClick={() => onClick(notification)}
      >
        {/* Category icon */}
        <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{notification.title}</p>
          <p className="text-xs text-base-content/70 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-base-content/50 mt-1">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>

        {/* Unread dot */}
        {isUnread && (
          <div className="flex-shrink-0 mt-1.5">
            <span className="block w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
        )}
      </button>
    </li>
  );
};

interface GroupedNotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

const GroupedNotificationItem = ({ notification, onClick }: GroupedNotificationItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const isUnread = notification.readAt === null;
  const Icon = CATEGORY_ICONS[notification.category] ?? FaBell;
  const iconColor = CATEGORY_COLORS[notification.category] ?? "text-base-content";
  const groupCount = notification.group?.count ?? 0;

  return (
    <li>
      {/* Group header */}
      <div
        className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-base-200 transition-colors ${
          isUnread ? "bg-base-200/50" : ""
        }`}
      >
        <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>

        <button
          className="flex-1 min-w-0 text-left cursor-pointer"
          onClick={() => onClick(notification)}
        >
          <p className="text-sm font-medium truncate">{notification.title}</p>
          <p className="text-xs text-base-content/70 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-base-content/50 mt-1">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {isUnread && (
            <span className="block w-2.5 h-2.5 rounded-full bg-primary" />
          )}
          <button
            className="btn btn-ghost btn-xs btn-circle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            aria-label={expanded ? "Replier" : "Deplier"}
          >
            {expanded ? (
              <FaChevronUp className="w-2.5 h-2.5" />
            ) : (
              <FaChevronDown className="w-2.5 h-2.5" />
            )}
          </button>
          <span className="badge badge-sm badge-neutral">{groupCount}</span>
        </div>
      </div>

      {/* Expanded group items */}
      {expanded && notification.group && (
        <ul className="border-l-2 border-base-300 ml-8">
          {notification.group.items.map((item) => (
            <li
              key={item.id}
              className="px-4 py-2 text-xs text-base-content/70 flex justify-between items-center"
            >
              <span className="line-clamp-1 flex-1">{item.message}</span>
              <span className="text-base-content/50 ml-2 flex-shrink-0">
                {formatRelativeTime(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

// --- Main component ---

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const autoMarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { count: unreadCount, refresh: refreshCount } = useUnreadCount();
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: refreshNotifications,
  } = useNotifications({ limit: 10 });

  useClickOutside(menuRef, useCallback(() => setIsOpen(false), []));

  // Auto-mark visible notifications as read after 3s of dropdown being open
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      autoMarkTimerRef.current = setTimeout(async () => {
        const unreadIds = notifications
          .slice(0, 10)
          .filter((n) => n.readAt === null)
          .map((n) => n.id);

        if (unreadIds.length > 0) {
          for (const id of unreadIds) {
            await markAsRead(id);
          }
          refreshCount();
        }
      }, 3000);
    }

    return () => {
      if (autoMarkTimerRef.current) {
        clearTimeout(autoMarkTimerRef.current);
        autoMarkTimerRef.current = null;
      }
    };
  }, [isOpen, unreadCount, notifications, markAsRead, refreshCount]);

  const handleToggle = () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) {
      refreshNotifications();
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (notification.readAt === null) {
      await markAsRead(notification.id);
      refreshCount();
    }

    // Close dropdown
    setIsOpen(false);

    // Navigate to actionUrl if present
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    refreshCount();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate("/notifications");
  };

  const displayedNotifications = notifications.slice(0, 10);

  return (
    <div className="relative" ref={menuRef}>
      {/* Bell button with badge */}
      <button
        className="btn btn-ghost btn-circle"
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <div className="indicator">
          <FaBell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="indicator-item badge badge-primary badge-xs">
              {formatBadgeCount(unreadCount)}
            </span>
          )}
        </div>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between">
            <p className="font-medium">Notifications</p>
            {unreadCount > 0 && (
              <button
                className="btn btn-ghost btn-xs gap-1 text-primary"
                onClick={handleMarkAllAsRead}
              >
                <FaCheckDouble className="w-3 h-3" />
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : displayedNotifications.length > 0 ? (
              <ul className="divide-y divide-base-300">
                {displayedNotifications.map((notification) =>
                  notification.group ? (
                    <GroupedNotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={handleNotificationClick}
                    />
                  ) : (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={handleNotificationClick}
                    />
                  )
                )}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-base-content/60">
                Aucune notification
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-base-300 p-2">
            <button
              className="btn btn-ghost btn-sm w-full"
              onClick={handleViewAll}
            >
              Voir tout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
