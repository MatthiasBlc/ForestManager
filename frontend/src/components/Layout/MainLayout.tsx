import { ReactNode, useState } from "react";
import { FaBars } from "react-icons/fa";
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
        {/* Menu button bar */}
        <div className="p-2 border-b border-base-300 flex items-center">
          {/* Mobile: opens drawer overlay */}
          <label
            htmlFor="main-drawer"
            className="btn btn-ghost btn-sm drawer-button lg:hidden"
          >
            <FaBars className="w-4 h-4" />
            <span className="ml-2">Menu</span>
          </label>
          {/* Desktop: toggles compact/expanded sidebar */}
          <button
            onClick={toggleCompact}
            className="btn btn-ghost btn-sm hidden lg:flex"
            aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FaBars className="w-4 h-4" />
          </button>
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
        </aside>
      </div>
    </div>
  );
};

export default MainLayout;
