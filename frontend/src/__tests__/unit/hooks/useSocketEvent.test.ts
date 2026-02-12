import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock useSocket before importing the hook
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock("../../../contexts/SocketContext", () => ({
  useSocket: vi.fn(() => ({ socket: mockSocket, isConnected: false })),
}));

import { useSocketEvent } from "../../../hooks/useSocketEvent";
import { useSocket } from "../../../contexts/SocketContext";

describe("useSocketEvent", () => {
  it("should subscribe to event when socket exists", () => {
    const handler = vi.fn();
    renderHook(() => useSocketEvent("test-event", handler));

    expect(mockSocket.on).toHaveBeenCalledWith("test-event", handler);
  });

  it("should skip subscription when socket is null", () => {
    vi.mocked(useSocket).mockReturnValueOnce({ socket: null, isConnected: false });
    mockSocket.on.mockClear();

    const handler = vi.fn();
    renderHook(() => useSocketEvent("test-event", handler));

    expect(mockSocket.on).not.toHaveBeenCalled();
  });

  it("should unsubscribe on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useSocketEvent("test-event", handler));

    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith("test-event", handler);
  });

  it("should resubscribe when event name changes", () => {
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();

    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ event }) => useSocketEvent(event, handler),
      { initialProps: { event: "event-a" } }
    );

    expect(mockSocket.on).toHaveBeenCalledWith("event-a", handler);

    rerender({ event: "event-b" });
    expect(mockSocket.off).toHaveBeenCalledWith("event-a", handler);
    expect(mockSocket.on).toHaveBeenCalledWith("event-b", handler);
  });

  it("should handle different data types via generic", () => {
    const handler = vi.fn<(data: { type: string }) => void>();
    renderHook(() => useSocketEvent<{ type: string }>("typed-event", handler));

    expect(mockSocket.on).toHaveBeenCalled();
  });
});
