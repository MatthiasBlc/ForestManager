import { useRef, useCallback, useEffect, ReactNode } from "react";
import { FaTimes } from "react-icons/fa";

interface SidePanelProps {
  isOpen: boolean;
  title: string;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  children: ReactNode;
}

const MIN_WIDTH = 250;
const MAX_WIDTH_RATIO = 0.5;

const SidePanel = ({ isOpen, title, width, onWidthChange, onClose, children }: SidePanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const diff = startX.current - e.clientX;
      const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
      const newWidth = Math.min(Math.max(startWidth.current + diff, MIN_WIDTH), maxWidth);
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onWidthChange]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="relative flex-shrink-0 bg-base-100 rounded-lg shadow-xl overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-base-300">
        <h3 className="font-bold text-lg">{title}</h3>
        <button
          className="btn btn-ghost btn-sm btn-circle"
          onClick={onClose}
          aria-label="Close panel"
        >
          <FaTimes />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto scrollbar-hide" style={{ height: "calc(100% - 65px)" }}>
        {children}
      </div>
    </div>
  );
};

export default SidePanel;
