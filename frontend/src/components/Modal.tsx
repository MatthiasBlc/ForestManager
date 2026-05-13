import { useRef } from "react";
import { useOnClickOutside } from "usehooks-ts";
type Props = {
  children: React.ReactNode;
  disableClickOutside?: boolean;
  className?: string;
  onClose(): void;
};

const Modal = ({ children, disableClickOutside, className, onClose }: Props) => {
  const ref = useRef(null);
  useOnClickOutside(ref, () => {
    if (!disableClickOutside) {
      onClose();
    }
  });

  return (
    <div className="modal modal-bottom sm:modal-middle modal-open">
      <div className={`modal-box${className ? ` ${className}` : ""}`} ref={ref}>
        {children}
      </div>
    </div>
  );
};

export default Modal;
