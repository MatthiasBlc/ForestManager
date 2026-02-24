import { useState, useEffect } from "react";
import { NotificationPreferencesResponse } from "../../models/notification";
import { NOTIFICATION_CATEGORIES, CATEGORY_CONFIG } from "../../config/notificationCategories";
import APIManager from "../../network/api";

const NotificationPreferencesSection = () => {
  const [prefs, setPrefs] = useState<NotificationPreferencesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await APIManager.getNotificationPreferences();
        if (!cancelled) {
          setPrefs(res);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const toggleExpanded = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleGlobalToggle = async (category: string) => {
    if (!prefs) return;
    const currentValue = prefs.global[category] ?? true;
    const newValue = !currentValue;

    // Optimistic update
    setPrefs({
      ...prefs,
      global: { ...prefs.global, [category]: newValue },
    });

    try {
      await APIManager.updateNotificationPreference(category, newValue);
    } catch {
      // Revert on error
      setPrefs(prev => prev ? {
        ...prev,
        global: { ...prev.global, [category]: currentValue },
      } : prev);
    }
  };

  const handleCommunityToggle = async (category: string, communityId: string) => {
    if (!prefs) return;
    const community = prefs.communities.find(c => c.communityId === communityId);
    if (!community) return;

    const currentValue = community.preferences[category] ?? prefs.global[category] ?? true;
    const newValue = !currentValue;

    // Optimistic update
    setPrefs({
      ...prefs,
      communities: prefs.communities.map(c =>
        c.communityId === communityId
          ? { ...c, preferences: { ...c.preferences, [category]: newValue } }
          : c
      ),
    });

    try {
      await APIManager.updateNotificationPreference(category, newValue, communityId);
    } catch {
      // Revert on error
      setPrefs(prev => prev ? {
        ...prev,
        communities: prev.communities.map(c =>
          c.communityId === communityId
            ? { ...c, preferences: { ...c.preferences, [category]: currentValue } }
            : c
        ),
      } : prev);
    }
  };

  if (loading) {
    return (
      <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
        <div className="flex justify-center">
          <span className="loading loading-spinner loading-md" />
        </div>
      </div>
    );
  }

  if (error || !prefs) return null;

  const hasCommunities = prefs.communities.length > 0;

  return (
    <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-2">Preferences de notifications</h2>
      <p className="text-sm text-base-content/60 mb-4">
        Gerez vos notifications par categorie. Vous pouvez personnaliser les
        preferences pour chaque communaute individuellement.
      </p>

      <div className="space-y-4">
        {NOTIFICATION_CATEGORIES.map((key) => {
          const label = CATEGORY_CONFIG[key].label;
          const globalEnabled = prefs.global[key] ?? true;
          const isExpanded = expandedCategories.has(key);
          const hasOverride = hasCommunities && prefs.communities.some(c => {
            const communityValue = c.preferences[key];
            return communityValue !== undefined && communityValue !== globalEnabled;
          });

          return (
            <div key={key} className="border border-base-300 rounded-lg">
              {/* Global toggle row */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{label}</span>
                  {hasOverride && (
                    <span
                      className="w-2 h-2 rounded-full bg-warning inline-block"
                      title="Une ou plusieurs communautes ont une preference differente"
                    />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {hasCommunities && (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => toggleExpanded(key)}
                      aria-label={`${isExpanded ? "Masquer" : "Afficher"} les preferences par communaute pour ${label}`}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={globalEnabled}
                    onChange={() => handleGlobalToggle(key)}
                    aria-label={`${label} (global)`}
                  />
                </div>
              </div>

              {/* Per-community overrides */}
              {isExpanded && hasCommunities && (
                <div className="border-t border-base-300 bg-base-200/50 px-3 py-2 space-y-2">
                  <p className="text-xs text-base-content/50 mb-1">Par communaute :</p>
                  {prefs.communities.map(comm => {
                    const communityValue = comm.preferences[key] ?? globalEnabled;
                    const differs = communityValue !== globalEnabled;

                    return (
                      <div
                        key={comm.communityId}
                        className="flex items-center justify-between py-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{comm.communityName}</span>
                          {differs && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-warning inline-block"
                              title="Differe de la preference globale"
                            />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          className={`toggle toggle-sm ${differs ? "toggle-warning" : "toggle-primary"}`}
                          checked={communityValue}
                          onChange={() => handleCommunityToggle(key, comm.communityId)}
                          aria-label={`${label} pour ${comm.communityName}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationPreferencesSection;
