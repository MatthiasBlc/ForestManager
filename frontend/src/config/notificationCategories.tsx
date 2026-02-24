import {
  FaEnvelope,
  FaUtensils,
  FaTag,
  FaLeaf,
  FaShieldAlt,
} from "react-icons/fa";
import { NotificationCategory } from "../models/notification";

export interface CategoryConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "INVITATION",
  "RECIPE_PROPOSAL",
  "TAG",
  "INGREDIENT",
  "MODERATION",
];

export const CATEGORY_CONFIG: Record<NotificationCategory, CategoryConfig> = {
  INVITATION: { label: "Invitations", icon: FaEnvelope, color: "text-info" },
  RECIPE_PROPOSAL: { label: "Propositions de recettes", icon: FaUtensils, color: "text-warning" },
  TAG: { label: "Tags", icon: FaTag, color: "text-accent" },
  INGREDIENT: { label: "Ingredients", icon: FaLeaf, color: "text-success" },
  MODERATION: { label: "Moderation", icon: FaShieldAlt, color: "text-error" },
};
