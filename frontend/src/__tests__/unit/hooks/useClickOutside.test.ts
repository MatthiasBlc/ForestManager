import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { createRef } from "react";

describe("useClickOutside", () => {
  it("should call callback when clicking outside the ref element", () => {
    const callback = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const div = document.createElement("div");
    document.body.appendChild(div);
    Object.defineProperty(ref, "current", { value: div, writable: true });

    renderHook(() => useClickOutside(ref, callback));

    // Click outside (on body, not on div)
    const event = new MouseEvent("mousedown", { bubbles: true });
    document.body.dispatchEvent(event);

    expect(callback).toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it("should not call callback when clicking inside the ref element", () => {
    const callback = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const div = document.createElement("div");
    document.body.appendChild(div);
    Object.defineProperty(ref, "current", { value: div, writable: true });

    renderHook(() => useClickOutside(ref, callback));

    // Click inside
    const event = new MouseEvent("mousedown", { bubbles: true });
    div.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it("should cleanup event listener on unmount", () => {
    const callback = vi.fn();
    const ref = createRef<HTMLDivElement>();
    const div = document.createElement("div");
    document.body.appendChild(div);
    Object.defineProperty(ref, "current", { value: div, writable: true });

    const { unmount } = renderHook(() => useClickOutside(ref, callback));
    unmount();

    const event = new MouseEvent("mousedown", { bubbles: true });
    document.body.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it("should handle null ref without errors", () => {
    const callback = vi.fn();
    const ref = createRef<HTMLDivElement>();
    // ref.current is null by default

    renderHook(() => useClickOutside(ref, callback));

    const event = new MouseEvent("mousedown", { bubbles: true });
    document.body.dispatchEvent(event);

    // Should not crash but also should not call callback (ref.current is null)
    expect(callback).not.toHaveBeenCalled();
  });
});
