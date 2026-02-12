import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDebouncedEffect } from "../../../hooks/useDebouncedEffect";

describe("useDebouncedEffect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call callback after specified delay", () => {
    const callback = vi.fn();
    renderHook(() => useDebouncedEffect(callback, 300, [1]));

    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("should not call callback before delay expires", () => {
    const callback = vi.fn();
    renderHook(() => useDebouncedEffect(callback, 500, [1]));

    vi.advanceTimersByTime(400);
    expect(callback).not.toHaveBeenCalled();
  });

  it("should cancel previous timer when deps change", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ deps }) => useDebouncedEffect(callback, 300, deps),
      { initialProps: { deps: [1] } }
    );

    vi.advanceTimersByTime(200);
    rerender({ deps: [2] });
    vi.advanceTimersByTime(200);

    // First call was cancelled, second hasn't fired yet
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("should cleanup timer on unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() =>
      useDebouncedEffect(callback, 300, [1])
    );

    vi.advanceTimersByTime(100);
    unmount();
    vi.advanceTimersByTime(300);

    expect(callback).not.toHaveBeenCalled();
  });

  it("should re-trigger when deps change", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ deps }) => useDebouncedEffect(callback, 100, deps),
      { initialProps: { deps: [1] } }
    );

    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledOnce();

    rerender({ deps: [2] });
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
