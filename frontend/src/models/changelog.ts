export interface ChangelogItem {
  text: string;
}

export interface ChangelogContent {
  features: ChangelogItem[];
  improvements: ChangelogItem[];
  fixes: ChangelogItem[];
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  content: ChangelogContent;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangelogResponse {
  data: ChangelogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
