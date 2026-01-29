import { ReactNode, useState } from "react";
import { FaBars, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import Sidebar from "./Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleCompact = () => setIsCompact(!isCompact);

  return (
    <div className="drawer lg:drawer-open h-full">
      {/* Drawer toggle (hidden checkbox for DaisyUI) */}
      <input
        id="main-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={sidebarOpen}
        onChange={toggleSidebar}
      />

      {/* Main content */}
      <div className="drawer-content flex flex-col">
        {/* Mobile menu button - only shows on small screens */}
        <div className="lg:hidden p-2 border-b border-base-300">
          <label
            htmlFor="main-drawer"
            className="btn btn-ghost btn-sm drawer-button"
          >
            <FaBars className="w-4 h-4" />
            <span className="ml-2">Menu</span>
          </label>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Sidebar drawer */}
      <div className="drawer-side z-40 lg:z-auto">
        <label
          htmlFor="main-drawer"
          aria-label="close sidebar"
          className="drawer-overlay"
        />
        <aside
          className={`bg-base-200 min-h-full border-r border-base-300 transition-all duration-300 ${
            isCompact ? "w-16" : "w-64"
          }`}
        >
          <Sidebar onNavigate={closeSidebar} isCompact={isCompact} />
          {/* Toggle button for desktop - positioned at sidebar edge */}
          <button
            onClick={toggleCompact}
            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-base-300 hover:bg-base-content/20 rounded-full items-center justify-center shadow-md transition-colors"
            aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCompact ? (
              <FaChevronRight className="w-3 h-3" />
            ) : (
              <FaChevronLeft className="w-3 h-3" />
            )}
          </button>
        </aside>
      </div>
    </div>
  );
};

export default MainLayout;
