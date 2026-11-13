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
  | "sparkles"
  | "arrow-left"
  | "wifi-off"
  | "tag"
  | "ruler"
  | "shield"
  | "chevrons-up-down";
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
  /** Espace en suppression (D66) : icone grisee et compte a rebours "J-n". */
  deleting?: { daysLeft: number };
  /** Precision affichee dans le SpaceSwitcher (ex. "6 membres"). */
  hint?: string;
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
  /** Modules de l'espace dans l'ordre de l'OWNER ; seuls les 4 premiers s'affichent (D131). */
  items: NavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Ouvre la feuille "Plus" (membres, reglages, modules au-dela du 4e). */
  onMore?: () => void;
  /** La page courante est dans "Plus". */
  moreActive?: boolean;
  noMore?: boolean;
}
export interface TopBarProps {
  title: string;
  /** Mobile (D130) : espace courant en bouton d'en-tete, qui ouvre le SpaceSwitcher. */
  space?: Space;
  onSpace?: () => void;
  /** Affiche une fleche de retour a gauche. */
  onBack?: () => void;
  /** Mode edition (D136) : "Annuler" a gauche, titre, action principale a droite. */
  onCancel?: () => void;
  cancelLabel?: string;
  action?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  unread?: number;
  user?: string;
  onSearch?: () => void;
  onNotifications?: () => void;
}
export interface AppShellProps {
  tint?: "1" | "2" | "3" | "4" | "5" | 1 | 2 | 3 | 4 | 5;
  /** Zones en props, ou bien omises : les enfants directs (SpaceRail, ModuleNav, TopBar,
   *  ShellMain, TabBar) se placent alors seuls dans la grille. */
  rail?: ReactNode;
  nav?: ReactNode;
  top?: ReactNode;
  tabbar?: ReactNode;
  children: ReactNode;
}
export interface ShellMainProps {
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
export interface SheetFooterProps {
  /** Boutons du pied de feuille, passes en enfant de Sheet (equivalent de la prop footer). */
  children: ReactNode;
}
export interface RadioGroupProps {
  label: string;
  options: { value: string; label: string; hint?: string; disabled?: boolean; swatches?: string[] }[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
}
export interface TintPickerProps {
  label?: string;
  value?: 1 | 2 | 3 | 4 | 5;
  defaultValue?: 1 | 2 | 3 | 4 | 5;
  /** Noms des teintes de l'ambiance (ex. Braise, Nuit, Tison, Flamme, Cendre). */
  names?: string[];
  onChange?: (n: number) => void;
}
export interface OptionItem {
  value: string;
  label: string;
  hint?: string;
  icon?: IconName;
  avatar?: string;
  tint?: 1 | 2 | 3 | 4 | 5;
  space?: Space;
  badge?: string;
  badgeTone?: Tone;
  disabled?: boolean;
}
export interface OptionListProps {
  label: string;
  options: OptionItem[];
  multiple?: boolean;
  /** false : lignes de navigation (chevron), sans etat selectionne. */
  selectable?: boolean;
  value?: string | string[] | null;
  defaultValue?: string | string[] | null;
  onChange?: (v: string | string[]) => void;
}
export interface QuantityInputProps {
  label?: string;
  units: string[];
  suggestions: string[];
  defaultQuantity?: number | string;
  defaultUnit?: string;
  defaultIngredient?: string;
  defaultOpen?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  onChange?: (v: { quantity: string; unit: string; ingredient: string; isNew?: boolean }) => void;
  onRemove?: () => void;
}
export interface SpaceSwitcherProps {
  open: boolean;
  spaces: Space[];
  personal?: Space;
  activeId?: string;
  contained?: boolean;
  onSelect?: (id: string) => void;
  onAdd?: () => void;
  onClose: () => void;
}
export interface SkeletonProps {
  kind?: "lines" | "row" | "card";
  count?: number;
  label?: string;
}
