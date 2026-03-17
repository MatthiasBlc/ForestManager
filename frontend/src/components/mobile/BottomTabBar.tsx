import { useLocation, useNavigate } from "react-router-dom";
import { FaHome, FaUtensils, FaBell, FaUser } from "react-icons/fa";
import { useKeyboardVisible } from "../../hooks/useKeyboardVisible";
import { useUnreadCount } from "../../hooks/useUnreadCount";

interface Tab {
  path: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
}

const tabs: Tab[] = [
  {
    path: "/dashboard",
    label: "Accueil",
    icon: <FaHome className="w-5 h-5" />,
    match: (p) => p === "/dashboard",
  },
  {
    path: "/recipes",
    label: "Recettes",
    icon: <FaUtensils className="w-5 h-5" />,
    match: (p) => p.startsWith("/recipes"),
  },
  {
    path: "/notifications",
    label: "Notifs",
    icon: <FaBell className="w-5 h-5" />,
    match: (p) => p === "/notifications",
  },
  {
    path: "/profile",
    label: "Profil",
    icon: <FaUser className="w-5 h-5" />,
    match: (p) => p === "/profile",
  },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isKeyboardVisible = useKeyboardVisible();
  const { count: unreadCount } = useUnreadCount();

  if (isKeyboardVisible) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-base-100 border-t border-base-300 md:hidden"
      style={{ paddingBottom: "var(--safe-area-bottom, 0px)" }}
    >
      <div className="flex h-14">
        {tabs.map((tab) => {
          const isActive = tab.match(location.pathname);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? "text-primary" : "text-base-content/60"
              }`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative">
                {tab.icon}
                {tab.path === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 badge badge-primary badge-xs min-w-[18px] text-[10px]">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomTabBar;
