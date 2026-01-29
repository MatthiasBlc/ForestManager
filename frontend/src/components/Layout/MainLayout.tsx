import { ReactNode, useState, useEffect, useCallback } from "react";
import { FaBars } from "react-icons/fa";
import Sidebar from "./Sidebar";

const COMPACT_BREAKPOINT = 768;

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [userPreference, setUserPreference] = useState<boolean | null>(null);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const toggleCompact = useCallback(() => {
    const newValue = !isCompact;
    setIsCompact(newValue);
    setUserPreference(newValue);
  }, [isCompact]);

  // Auto-compact when window is too small
  useEffect(() => {
    const handleResize = () => {
      const isSmallWindow = window.innerWidth < COMPACT_BREAKPOINT;

      if (isSmallWindow) {
        // Force compact on small windows
        setIsCompact(true);
      } else if (userPreference !== null) {
        // Restore user preference when window is large enough
        setIsCompact(userPreference);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [userPreference]);

  return (
    <div className="drawer pointer-fine:drawer-open h-full">
      {/* Drawer toggle (hidden checkbox for DaisyUI) */}
      <input
        id="main-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={sidebarOpen}
        onChange={toggleSidebar}
      />

      {/* Main content */}
      <div className="drawer-content flex flex-col z-0">
        {/* Mobile menu button - only shows on touch devices */}
        <div className="p-2 border-b border-base-300 pointer-fine:hidden">
          <label
            htmlFor="main-drawer"
            className="btn btn-ghost btn-sm drawer-button"
          >
            <FaBars className="w-4 h-4" />
            <span className="ml-2">Menu</span>
          </label>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 pointer-fine:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Sidebar drawer */}
      <div className="drawer-side z-40 pointer-fine:z-20">
        <label
          htmlFor="main-drawer"
          aria-label="close sidebar"
          className="drawer-overlay"
        />
        <aside
          className={`bg-base-200 min-h-full border-r border-base-300 transition-all duration-300 relative z-50 ${
            isCompact ? "w-16" : "w-64"
          }`}
        >
          <Sidebar onNavigate={closeSidebar} isCompact={isCompact} onToggleCompact={toggleCompact} />
        </aside>
      </div>
    </div>
  );
};

export default MainLayout;
