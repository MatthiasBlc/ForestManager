import { useState, useEffect } from "react";
import { NotificationPreferences } from "../../models/preferences";
import APIManager from "../../network/api";

const NotificationPreferencesSection = () => {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await APIManager.getNotificationPreferences();
        if (!cancelled) {
          // Hide section if no communities (not a moderator)
          if (res.communities.length === 0) {
            setVisible(false);
          } else {
            setPrefs(res);
          }
        }
      } catch {
        // 403 or any error → hide section
        if (!cancelled) setVisible(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const handleGlobalToggle = async () => {
    if (!prefs) return;
    const newValue = !prefs.global.tagNotifications;

    // Optimistic update
    setPrefs({ ...prefs, global: { tagNotifications: newValue } });

    try {
      await APIManager.updateGlobalNotificationPreference(newValue);
    } catch {
      setPrefs(prev => prev ? { ...prev, global: { tagNotifications: !newValue } } : prev);
    }
  };

  const handleCommunityToggle = async (communityId: string, currentValue: boolean) => {
    if (!prefs) return;
    const newValue = !currentValue;

    // Optimistic update
    setPrefs({
      ...prefs,
      communities: prefs.communities.map(c =>
        c.communityId === communityId ? { ...c, tagNotifications: newValue } : c
      ),
    });

    try {
      await APIManager.updateCommunityNotificationPreference(communityId, newValue);
    } catch {
      setPrefs(prev => prev ? {
        ...prev,
        communities: prev.communities.map(c =>
          c.communityId === communityId ? { ...c, tagNotifications: currentValue } : c
        ),
      } : prev);
    }
  };

  if (!visible || loading) {
    if (loading && visible) {
      return (
        <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
          <div className="flex justify-center">
            <span className="loading loading-spinner loading-md" />
          </div>
        </div>
      );
    }
    return null;
  }

  if (!prefs || prefs.communities.length === 0) return null;

  return (
    <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-2">Tag Notifications</h2>
      <p className="text-sm text-base-content/60 mb-4">
        Manage notifications for pending tag approvals in communities you moderate.
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-base-300 pb-3">
          <span className="font-medium">Receive tag notifications (global)</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={prefs.global.tagNotifications}
            onChange={handleGlobalToggle}
            aria-label="Global tag notifications"
          />
        </div>

        {prefs.communities.map(comm => (
          <div key={comm.communityId} className="flex items-center justify-between">
            <span className="font-medium">{comm.communityName}</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={comm.tagNotifications}
              onChange={() => handleCommunityToggle(comm.communityId, comm.tagNotifications)}
              aria-label={`Tag notifications for ${comm.communityName}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationPreferencesSection;
