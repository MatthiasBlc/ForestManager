export interface CommunityListItem {
  id: string;
  name: string;
  description: string | null;
  role: "MEMBER" | "MODERATOR";
  membersCount: number;
  recipesCount: number;
  joinedAt: string;
}

export interface CommunityDetail {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  createdAt: string;
  membersCount: number;
  recipesCount: number;
  currentUserRole: "MEMBER" | "MODERATOR";
}

export interface CommunityMember {
  id: string;
  username: string;
  role: "MEMBER" | "MODERATOR";
  joinedAt: string;
}

export interface CommunityInvite {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  respondedAt: string | null;
  invitee: {
    id: string;
    username: string;
    email: string;
  };
  inviter: {
    id: string;
    username: string;
  };
}

export interface ReceivedInvite {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  respondedAt: string | null;
  community: {
    id: string;
    name: string;
    description: string | null;
  };
  inviter: {
    id: string;
    username: string;
  };
}
