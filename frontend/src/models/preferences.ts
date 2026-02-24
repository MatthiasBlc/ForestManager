export interface TagPreference {
  communityId: string;
  communityName: string;
  showTags: boolean;
}

// Legacy type kept for backward compatibility - use NotificationPreferencesResponse from notification.ts instead
export interface NotificationPreferences {
  global: Record<string, boolean>;
  communities: {
    communityId: string;
    communityName: string;
    preferences: Record<string, boolean>;
  }[];
}
