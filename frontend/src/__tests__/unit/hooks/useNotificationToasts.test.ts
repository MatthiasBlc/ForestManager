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

const mockToast = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: Object.assign(
    (msg: string, opts?: unknown) => mockToast(msg, opts),
    { success: vi.fn(), error: vi.fn() }
  ),
}));

import { useNotificationToasts } from "../../../hooks/useNotificationToasts";

describe("useNotificationToasts", () => {
  beforeEach(() => {
    mockSocket.on.mockClear();
    mockToast.mockClear();
  });

  it("should subscribe to notification:new event", () => {
    renderHook(() => useNotificationToasts());
    expect(mockSocket.on).toHaveBeenCalledWith("notification:new", expect.any(Function));
  });

  it("should show toast with notification message", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification:new"
    )?.[1];

    handler({ notification: { message: "Nouvelle invitation !", type: "INVITE_SENT" } });
    expect(mockToast).toHaveBeenCalledWith("Nouvelle invitation !", expect.any(Object));
  });

  it("should show toast for any notification with a message", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification:new"
    )?.[1];

    handler({ notification: { message: "Votre proposition a ete acceptee", type: "PROPOSAL_ACCEPTED" } });
    expect(mockToast).toHaveBeenCalledWith(
      "Votre proposition a ete acceptee",
      expect.any(Object)
    );
  });

  it("should not show toast when notification has no message", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification:new"
    )?.[1];

    handler({ notification: { type: "UNKNOWN_TYPE" } });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("should not show toast when notification is null", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification:new"
    )?.[1];

    handler({ notification: null });
    expect(mockToast).not.toHaveBeenCalled();
  });
});
