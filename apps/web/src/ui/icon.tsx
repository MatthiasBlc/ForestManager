// Icones Lucide [D16] : memes noms que l'apercu du design system, importees une a une.
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChefHat,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Copy,
  Crown,
  Ellipsis,
  GitBranch,
  House,
  Inbox,
  Info,
  KeyRound,
  Link,
  Lock,
  LogOut,
  Mail,
  Minus,
  Palette,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  Ruler,
  Search,
  Settings,
  Share,
  Shield,
  ShoppingBasket,
  Sparkles,
  Tag,
  Trash,
  TriangleAlert,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  "arrow-down": ArrowDown,
  "arrow-left": ArrowLeft,
  "arrow-up": ArrowUp,
  bell: Bell,
  "book-open": BookOpen,
  calendar: Calendar,
  check: Check,
  "chef-hat": ChefHat,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevrons-up-down": ChevronsUpDown,
  clock: Clock,
  copy: Copy,
  crown: Crown,
  more: Ellipsis,
  "git-branch": GitBranch,
  home: House,
  inbox: Inbox,
  info: Info,
  key: KeyRound,
  link: Link,
  lock: Lock,
  "log-out": LogOut,
  mail: Mail,
  minus: Minus,
  palette: Palette,
  pencil: Pencil,
  plus: Plus,
  puzzle: Puzzle,
  refresh: RefreshCw,
  ruler: Ruler,
  search: Search,
  settings: Settings,
  share: Share,
  shield: Shield,
  "shopping-basket": ShoppingBasket,
  sparkles: Sparkles,
  tag: Tag,
  trash: Trash,
  "triangle-alert": TriangleAlert,
  undo: Undo2,
  "user-minus": UserMinus,
  "user-plus": UserPlus,
  users: Users,
  "wifi-off": WifiOff,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  /** Sans label, l'icone est decorative (aria-hidden). */
  label?: string;
  className?: string;
}

export function Icon({ name, size, label, className }: IconProps) {
  const Svg = ICONS[name];
  return (
    <Svg
      className={className ? `fm-icon ${className}` : "fm-icon"}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      style={size ? { width: size, height: size } : undefined}
    />
  );
}
