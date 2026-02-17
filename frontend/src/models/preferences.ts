export interface TagPreference {
  communityId: string;
  communityName: string;
  showTags: boolean;
}

export interface NotificationPreferences {
  global: { tagNotifications: boolean };
  communities: {
    communityId: string;
    communityName: string;
    tagNotifications: boolean;
  }[];
}
