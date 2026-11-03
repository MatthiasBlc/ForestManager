// Forest Manager UI - types documentaires (window.ForestUI)
import type { ReactNode } from "react";
export type Tone = "neutral" | "accent" | "second" | "success" | "warning" | "danger";
export type IconName =
  | "book-open"
  | "calendar"
  | "shopping-basket"
  | "users"
  | "settings"
  | "search"
  | "bell"
  | "plus"
  | "minus"
  | "x"
  | "check"
  | "more"
  | "pencil"
  | "share"
  | "git-branch"
  | "trash"
  | "link"
  | "chevron-down"
  | "chevron-right"
  | "lock"
  | "clock"
  | "refresh"
  | "chef-hat"
  | "home"
  | "sparkles";
export interface IconProps {
  name: IconName;
  size?: number;
  label?: string;
  className?: string;
}
export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  icon?: IconName;
  block?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}
export interface IconButtonProps {
  icon: IconName;
  label: string;
  count?: number;
  outline?: boolean;
  onClick?: () => void;
}
export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
  id?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (e: unknown) => void;
  inputMode?: string;
  type?: string;
}
export interface SwitchProps {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
}
export interface StepperProps {
  label: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  unit?: string;
  format?: (v: number) => string;
  onChange?: (v: number) => void;
}
export interface SegmentedControlProps {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
}
export interface BadgeProps {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
}
export interface ChipProps {
  selected?: boolean;
  defaultSelected?: boolean;
  onToggle?: (on: boolean) => void;
  children: ReactNode;
}
export interface AvatarProps {
  name: string;
  src?: string;
  tint?: 1 | 2 | 3 | 4 | 5;
  size?: number;
}
export interface EmptyStateProps {
  title: string;
  icon?: IconName;
  action?: ReactNode;
  children?: ReactNode;
}
export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  contained?: boolean;
  children: ReactNode;
}
export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
}
export interface ActionMenuProps {
  label: string;
  items: (ActionMenuItem | "-")[];
  onSelect?: (id: string) => void;
}
export interface ToastProps {
  tone?: "success" | "warning" | "danger";
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}
export interface CommandPaletteProps {
  groups: {
    label: string;
    items: { id: string; label: string; icon?: IconName; hint?: string }[];
  }[];
  onSelect?: (id: string) => void;
  placeholder?: string;
  defaultQuery?: string;
}
export interface Space {
  id: string;
  name: string;
  tint?: 1 | 2 | 3 | 4 | 5;
  image?: string;
  unread?: boolean;
}
export interface SpaceRailProps {
  spaces: Space[];
  personal?: Space;
  activeId?: string;
  onSelect?: (id: string) => void;
  onAdd?: () => void;
}
export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href?: string;
  badge?: string;
  badgeTone?: Tone;
}
export interface ModuleNavProps {
  spaceName: string;
  subtitle?: string;
  items: NavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
}
export interface TabBarProps {
  items: NavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
}
export interface TopBarProps {
  title: string;
  unread?: number;
  user?: string;
  onSearch?: () => void;
  onNotifications?: () => void;
}
export interface AppShellProps {
  tint?: "1" | "2" | "3" | "4" | "5";
  rail: ReactNode;
  nav?: ReactNode;
  top: ReactNode;
  tabbar?: ReactNode;
  children: ReactNode;
}
export interface RecipeCardProps {
  title: string;
  meta?: string;
  image?: string;
  badges?: { label: string; tone?: Tone; icon?: IconName }[];
  onOpen?: () => void;
  onActions?: () => void;
}
export interface IngredientRowProps {
  name: string;
  quantity?: number | null;
  unit?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onToggle?: (on: boolean) => void;
}
export interface RecipeBlockProps {
  kind: "local" | "linked";
  title?: string;
  quantity?: string;
  factor?: number;
  ingredients?: { quantity?: number | null; unit?: string; name: string }[];
  steps?: string[];
  defaultOpen?: boolean;
}
export interface MealSlotProps {
  kind?: "recipe" | "text" | "empty";
  title?: string;
  servings?: number;
  locked?: boolean;
  disabled?: boolean;
  when?: string;
  placeholder?: string;
  onOpen?: () => void;
  onActions?: () => void;
}
export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  height?: number;
  children: ReactNode;
}
