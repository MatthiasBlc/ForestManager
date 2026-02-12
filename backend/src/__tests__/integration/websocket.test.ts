import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import http from "http";
import request from "supertest";
import { io as ioc, Socket } from "socket.io-client";
import app, { userSession } from "../../app";
import { initSocketServer } from "../../services/socketServer";
import appEvents from "../../services/eventEmitter";
import { createTestUser, extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";

let httpServer: http.Server;
let port: number;

async function getSessionCookie(username: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  const cookie = extractSessionCookie(res);
  if (!cookie) throw new Error("Failed to get session cookie");
  return cookie;
}

function createClient(cookie?: string): Socket {
  return ioc(`http://localhost:${port}`, {
    transports: ["websocket"],
    extraHeaders: cookie ? { cookie } : undefined,
    autoConnect: false,
  });
}

describe("WebSocket", () => {
  beforeAll(async () => {
    httpServer = http.createServer(app);
    initSocketServer(httpServer, userSession);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  const clients: Socket[] = [];
  afterEach(() => {
    for (const c of clients) {
      if (c.connected) c.disconnect();
    }
    clients.length = 0;
  });

  it("should reject unauthenticated connections", async () => {
    const client = createClient();
    clients.push(client);

    const error = await new Promise<Error>((resolve) => {
      client.on("connect_error", (err) => resolve(err));
      client.connect();
    });

    expect(error.message).toContain("Authentication required");
  });

  it("should accept authenticated connections", async () => {
    const user = await createTestUser({ username: "ws-user-1", email: "ws1@test.com" });
    const cookie = await getSessionCookie(user.username, user.password);

    const client = createClient(cookie);
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", (err) => reject(err));
      client.connect();
    });

    expect(client.connected).toBe(true);
  });

  it("should receive activity events in community room", async () => {
    const user = await createTestUser({ username: "ws-user-2", email: "ws2@test.com" });
    const community = await testPrisma.community.create({
      data: { name: "WS Test Community" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: user.id, communityId: community.id, role: "MODERATOR" },
    });

    const cookie = await getSessionCookie(user.username, user.password);
    const client = createClient(cookie);
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", (err) => reject(err));
      client.connect();
    });

    // Wait for room joins to complete
    await new Promise((r) => setTimeout(r, 200));

    const activityPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("activity", (data: Record<string, unknown>) => resolve(data));
    });

    appEvents.emitActivity({
      type: "RECIPE_CREATED",
      userId: user.id,
      communityId: community.id,
      recipeId: "test-recipe-id",
    });

    const received = await activityPromise;
    expect(received.type).toBe("RECIPE_CREATED");
    expect(received.communityId).toBe(community.id);
  });

  it("should receive personal notification events", async () => {
    const user = await createTestUser({ username: "ws-user-3", email: "ws3@test.com" });
    const cookie = await getSessionCookie(user.username, user.password);
    const client = createClient(cookie);
    clients.push(client);

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", (err) => reject(err));
      client.connect();
    });

    await new Promise((r) => setTimeout(r, 200));

    const notifPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("notification", (data: Record<string, unknown>) => resolve(data));
    });

    appEvents.emitActivity({
      type: "INVITE_SENT",
      userId: "someone-else",
      communityId: "some-community",
      targetUserIds: [user.id],
    });

    const received = await notifPromise;
    expect(received.type).toBe("INVITE_SENT");
  });
});
