import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardVisible } from "../../../hooks/useKeyboardVisible";

describe("useKeyboardVisible", () => {
  let resizeHandler: (() => void) | null = null;

  beforeEach(() => {
    resizeHandler = null;
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true });
  });

  function mockVisualViewport(height: number) {
    Object.defineProperty(window, "visualViewport", {
      value: {
        height,
        addEventListener: (_event: string, handler: () => void) => {
          resizeHandler = handler;
        },
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  }

  it("should return false when keyboard is not visible", () => {
    mockVisualViewport(800);
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it("should return true when keyboard opens (viewport shrinks significantly)", () => {
    mockVisualViewport(800);
    const { result } = renderHook(() => useKeyboardVisible());

    // Simuler ouverture du clavier (viewport reduit de 400px)
    Object.defineProperty(window.visualViewport, "height", { value: 400, configurable: true });
    act(() => {
      resizeHandler?.();
    });

    expect(result.current).toBe(true);
  });

  it("should return false when viewport shrinks slightly (not keyboard)", () => {
    mockVisualViewport(800);
    const { result } = renderHook(() => useKeyboardVisible());

    // Reduction legere (< 150px de difference) = pas un clavier
    Object.defineProperty(window.visualViewport, "height", { value: 700, configurable: true });
    act(() => {
      resizeHandler?.();
    });

    expect(result.current).toBe(false);
  });

  it("should handle missing visualViewport gracefully", () => {
    Object.defineProperty(window, "visualViewport", {
      value: null,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });

  it("should cleanup listener on unmount", () => {
    const removeEventListener = vi.fn();
    Object.defineProperty(window, "visualViewport", {
      value: {
        height: 800,
        addEventListener: vi.fn(),
        removeEventListener,
      },
      writable: true,
      configurable: true,
    });

    const { unmount } = renderHook(() => useKeyboardVisible());
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
