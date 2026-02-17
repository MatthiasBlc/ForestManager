import { useState, useEffect } from "react";
import { TagPreference } from "../../models/preferences";
import APIManager from "../../network/api";

const TagPreferencesSection = () => {
  const [preferences, setPreferences] = useState<TagPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await APIManager.getTagPreferences();
        if (!cancelled) setPreferences(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load preferences");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const handleToggle = async (communityId: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistic update
    setPreferences(prev =>
      prev.map(p => p.communityId === communityId ? { ...p, showTags: newValue } : p)
    );

    try {
      await APIManager.updateTagPreference(communityId, newValue);
    } catch {
      // Revert on error
      setPreferences(prev =>
        prev.map(p => p.communityId === communityId ? { ...p, showTags: currentValue } : p)
      );
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

  if (error || preferences.length === 0) return null;

  return (
    <div className="bg-base-100 rounded-lg shadow-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-2">Tag Visibility</h2>
      <p className="text-sm text-base-content/60 mb-4">
        Control which community tags are visible in your personal recipe catalog.
      </p>

      <div className="space-y-3">
        {preferences.map(pref => (
          <div key={pref.communityId} className="flex items-center justify-between">
            <span className="font-medium">{pref.communityName}</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={pref.showTags}
              onChange={() => handleToggle(pref.communityId, pref.showTags)}
              aria-label={`Show tags from ${pref.communityName}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagPreferencesSection;
