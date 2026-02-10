import { useState, useCallback, useRef } from "react";
import { FaTimes } from "react-icons/fa";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmClass?: string;
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    setOptions(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    setOptions(null);
  }, []);

  const ConfirmDialog = options ? (
    <div className="modal modal-open">
      <div className="modal-box">
        <button
          className="btn btn-sm btn-circle absolute right-2 top-2"
          onClick={handleCancel}
        >
          <FaTimes />
        </button>
        {options.title && (
          <h3 className="font-bold text-lg">{options.title}</h3>
        )}
        <p className="py-4">{options.message}</p>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className={options.confirmClass || "btn btn-error"}
            onClick={handleConfirm}
          >
            {options.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={handleCancel} />
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
