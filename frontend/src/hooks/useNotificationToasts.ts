import { useCallback } from "react";
import toast from "react-hot-toast";
import { useSocketEvent } from "./useSocketEvent";

interface NotificationEvent {
  type: string;
  userId: string;
  communityId: string | null;
  recipeId?: string;
  metadata?: Record<string, unknown>;
}

const notificationMessages: Record<string, string> = {
  INVITE_SENT: "Nouvelle invitation !",
  VARIANT_PROPOSED: "Proposition de modification sur votre recette",
  PROPOSAL_ACCEPTED: "Votre proposition a ete acceptee",
  PROPOSAL_REJECTED: "Votre proposition a ete refusee",
  USER_PROMOTED: "Vous avez ete promu moderateur",
  USER_KICKED: "Vous avez ete retire de la communaute",
  TAG_PENDING: "Nouveau tag en attente de validation",
  TAG_APPROVED: "Votre tag a ete valide",
  TAG_REJECTED: "Votre tag a ete rejete",
};

export function useNotificationToasts() {
  const handler = useCallback((data: NotificationEvent) => {
    const message = notificationMessages[data.type];
    if (message) {
      toast(message, { icon: "🔔" });
    }
  }, []);

  useSocketEvent<NotificationEvent>("notification", handler);
}
