import { useRef } from "react";
import cn from "classnames";
import { useOnClickOutside } from "usehooks-ts";
type Props = {
  children: React.ReactNode;
  disableClickOutside?: boolean;
  onClose(): void;
};

const Modal = ({ children, disableClickOutside, onClose }: Props) => {
  const ref = useRef(null);
  useOnClickOutside(ref, () => {
    if (!disableClickOutside) {
      onClose();
    }
  });

  const modalClass = cn({
    "modal modal-bottom sm:modal-middle": true,
    "modal-open": true,
  });
  return (
    <div className={modalClass}>
      <div className="modal-box" ref={ref}>
        {children}
      </div>
    </div>
  );
};

export default Modal;
