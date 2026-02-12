import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SocketProvider, useSocket } from "../../../contexts/SocketContext";
import { AuthProvider } from "../../../contexts/AuthContext";
import { BrowserRouter } from "react-router-dom";

// Mock socket.io-client
vi.mock("socket.io-client", () => {
  const onHandlers = new Map<string, (...args: unknown[]) => void>();
  const mockSocket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      onHandlers.set(event, handler);
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  };

  return {
    io: vi.fn(() => mockSocket),
    __mockSocket: mockSocket,
    __onHandlers: onHandlers,
  };
});

function TestComponent() {
  const { isConnected } = useSocket();
  return <span data-testid="connected">{String(isConnected)}</span>;
}

describe("SocketContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should provide socket context values", () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <TestComponent />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    );

    expect(screen.getByTestId("connected")).toHaveTextContent("false");
  });

  it("should throw when useSocket is used outside SocketProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      render(
        <BrowserRouter>
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        </BrowserRouter>
      )
    ).toThrow("useSocket must be used within a SocketProvider");

    consoleSpy.mockRestore();
  });
});
