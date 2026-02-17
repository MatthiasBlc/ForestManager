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

  it("should subscribe to notification event", () => {
    renderHook(() => useNotificationToasts());
    expect(mockSocket.on).toHaveBeenCalledWith("notification", expect.any(Function));
  });

  it("should show toast for INVITE_SENT", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification"
    )?.[1];

    handler({ type: "INVITE_SENT", userId: "u1", communityId: "c1" });
    expect(mockToast).toHaveBeenCalledWith("Nouvelle invitation !", expect.any(Object));
  });

  it("should show toast for PROPOSAL_ACCEPTED", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification"
    )?.[1];

    handler({ type: "PROPOSAL_ACCEPTED", userId: "u1", communityId: "c1" });
    expect(mockToast).toHaveBeenCalledWith(
      "Votre proposition a ete acceptee",
      expect.any(Object)
    );
  });

  it("should show toast for USER_KICKED", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification"
    )?.[1];

    handler({ type: "USER_KICKED", userId: "u1", communityId: "c1" });
    expect(mockToast).toHaveBeenCalledWith(
      "Vous avez ete retire de la communaute",
      expect.any(Object)
    );
  });

  it("should show toast for TAG_PENDING", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification"
    )?.[1];

    handler({ type: "TAG_PENDING", userId: "u1", communityId: "c1" });
    expect(mockToast).toHaveBeenCalledWith(
      "Nouveau tag en attente de validation",
      expect.any(Object)
    );
  });

  it("should show toast for TAG_APPROVED", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification"
    )?.[1];

    handler({ type: "TAG_APPROVED", userId: "u1", communityId: "c1" });
    expect(mockToast).toHaveBeenCalledWith(
      "Votre tag a ete valide",
      expect.any(Object)
    );
  });

  it("should show toast for TAG_REJECTED", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification"
    )?.[1];

    handler({ type: "TAG_REJECTED", userId: "u1", communityId: "c1" });
    expect(mockToast).toHaveBeenCalledWith(
      "Votre tag a ete rejete",
      expect.any(Object)
    );
  });

  it("should skip unknown notification type", () => {
    renderHook(() => useNotificationToasts());
    const handler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "notification"
    )?.[1];

    handler({ type: "UNKNOWN_TYPE", userId: "u1", communityId: "c1" });
    expect(mockToast).not.toHaveBeenCalled();
  });
});
