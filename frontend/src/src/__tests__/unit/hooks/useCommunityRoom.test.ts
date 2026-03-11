import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

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

import { useCommunityRoom } from "../../../hooks/useCommunityRoom";
import { useSocket } from "../../../contexts/SocketContext";

describe("useCommunityRoom", () => {
  beforeEach(() => {
    mockSocket.emit.mockClear();
  });

  it("should emit join:community on mount", () => {
    renderHook(() => useCommunityRoom("com-1"));
    expect(mockSocket.emit).toHaveBeenCalledWith("join:community", "com-1");
  });

  it("should emit leave:community on unmount", () => {
    const { unmount } = renderHook(() => useCommunityRoom("com-1"));
    unmount();
    expect(mockSocket.emit).toHaveBeenCalledWith("leave:community", "com-1");
  });

  it("should skip when socket is null", () => {
    vi.mocked(useSocket).mockReturnValueOnce({ socket: null, isConnected: false });
    mockSocket.emit.mockClear();

    renderHook(() => useCommunityRoom("com-1"));
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("should skip when communityId is undefined", () => {
    mockSocket.emit.mockClear();
    renderHook(() => useCommunityRoom(undefined));
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });
});
