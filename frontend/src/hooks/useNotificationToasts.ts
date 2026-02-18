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
  TAG_SUGGESTION_CREATED: "Nouvelle suggestion de tag sur votre recette",
  TAG_SUGGESTION_ACCEPTED: "Votre suggestion de tag a ete acceptee",
  TAG_SUGGESTION_REJECTED: "Votre suggestion de tag a ete refusee",
  "tag-suggestion:pending-mod": "Un tag suggere attend votre validation",
};

function buildIngredientMessage(data: NotificationEvent): string | null {
  const meta = data.metadata ?? {};
  const name = meta.ingredientName as string | undefined;
  switch (data.type) {
    case "INGREDIENT_APPROVED":
      return `Votre ingredient '${name}' a ete valide`;
    case "INGREDIENT_MODIFIED":
      return `Votre ingredient a ete valide sous le nom '${meta.newName as string}'`;
    case "INGREDIENT_MERGED":
      return `Votre ingredient '${name}' a ete fusionne avec '${meta.targetName as string}'`;
    case "INGREDIENT_REJECTED":
      return `Votre ingredient '${name}' a ete rejete : ${meta.reason as string}`;
    default:
      return null;
  }
}

export function useNotificationToasts() {
  const handler = useCallback((data: NotificationEvent) => {
    const ingredientMessage = buildIngredientMessage(data);
    if (ingredientMessage) {
      toast(ingredientMessage, { icon: "🔔" });
      return;
    }
    const message = notificationMessages[data.type];
    if (message) {
      toast(message, { icon: "🔔" });
    }
  }, []);

  useSocketEvent<NotificationEvent>("notification", handler);
}
