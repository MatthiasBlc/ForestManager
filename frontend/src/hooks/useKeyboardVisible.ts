import { useState, useEffect } from "react";

const KEYBOARD_THRESHOLD = 150;

export function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      setIsKeyboardVisible(vv.height < window.innerHeight - KEYBOARD_THRESHOLD);
    };

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  return isKeyboardVisible;
}
