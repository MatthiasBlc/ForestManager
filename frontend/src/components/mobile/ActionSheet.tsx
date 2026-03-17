import BottomSheet from "./BottomSheet";

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: ActionItem[];
}

const ActionSheet = ({ isOpen, onClose, items }: ActionSheetProps) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="flex flex-col">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`flex items-center gap-3 h-14 px-2 text-left transition-colors active:bg-base-200 ${
              item.destructive ? "text-error" : "text-base-content"
            } ${index < items.length - 1 ? "border-b border-base-200" : ""}`}
          >
            {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
            <span className="text-base">{item.label}</span>
          </button>
        ))}

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="h-14 mt-2 text-base font-medium text-base-content/70 active:bg-base-200 rounded-lg"
        >
          Annuler
        </button>
      </div>
    </BottomSheet>
  );
};

export default ActionSheet;
