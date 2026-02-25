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

  it("should emit notification:count on connection", async () => {
    const user = await createTestUser({ username: "ws-user-count", email: "wscount@test.com" });
    const cookie = await getSessionCookie(user.username, user.password);

    const client = createClient(cookie);
    clients.push(client);

    const countPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.on("notification:count", (data: Record<string, unknown>) => resolve(data));
    });

    client.connect();

    const received = await countPromise;
    expect(received).toHaveProperty("count");
    expect(received).toHaveProperty("byCategory");
    expect(received.count).toBe(0);
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

  it("should persist broadcast notification and emit notification:new", async () => {
    // Creer 2 users dans une communaute
    const actor = await createTestUser({ username: "ws-actor-bc", email: "wsactorbc@test.com" });
    const member = await createTestUser({ username: "ws-member-bc", email: "wsmemberbc@test.com" });
    const community = await testPrisma.community.create({
      data: { name: "WS Broadcast Community" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: actor.id, communityId: community.id, role: "MODERATOR" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: member.id, communityId: community.id, role: "MEMBER" },
    });

    // Creer une recette pour le template
    const recipe = await testPrisma.recipe.create({
      data: { title: "WS Test Recipe", servings: 4, creator: { connect: { id: actor.id } }, steps: { create: [{ order: 0, instruction: "content" }] } },
    });

    const memberCookie = await getSessionCookie(member.username, member.password);
    const memberClient = createClient(memberCookie);
    clients.push(memberClient);

    await new Promise<void>((resolve, reject) => {
      memberClient.on("connect", () => resolve());
      memberClient.on("connect_error", (err) => reject(err));
      memberClient.connect();
    });

    await new Promise((r) => setTimeout(r, 200));

    const notifPromise = new Promise<Record<string, unknown>>((resolve) => {
      memberClient.on("notification:new", (data: Record<string, unknown>) => resolve(data));
    });

    const countPromises: Record<string, unknown>[] = [];
    memberClient.on("notification:count", (data: Record<string, unknown>) => {
      countPromises.push(data);
    });

    // Emettre un evenement broadcast
    appEvents.emitActivity({
      type: "RECIPE_CREATED",
      userId: actor.id,
      communityId: community.id,
      recipeId: recipe.id,
    });

    const received = await notifPromise;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notification = (received as any).notification;
    expect(notification).toBeDefined();
    expect(notification.type).toBe("RECIPE_CREATED");
    expect(notification.userId).toBe(member.id);
    expect(notification.communityId).toBe(community.id);
    expect(notification.title).toBe("Nouvelle recette");

    // Verifier que la notification est persistee en DB
    const dbNotif = await testPrisma.notification.findFirst({
      where: { userId: member.id, type: "RECIPE_CREATED", communityId: community.id },
    });
    expect(dbNotif).toBeTruthy();
    expect(dbNotif!.readAt).toBeNull();

    // Attendre un peu pour notification:count
    await new Promise((r) => setTimeout(r, 500));
    expect(countPromises.length).toBeGreaterThanOrEqual(1);
  });

  it("should persist personal notification and emit notification:new", async () => {
    const actor = await createTestUser({ username: "ws-actor-pn", email: "wsactorpn@test.com" });
    const target = await createTestUser({ username: "ws-target-pn", email: "wstargetpn@test.com" });
    const community = await testPrisma.community.create({
      data: { name: "WS Personal Notif Community" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: actor.id, communityId: community.id, role: "MODERATOR" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: target.id, communityId: community.id, role: "MEMBER" },
    });

    const targetCookie = await getSessionCookie(target.username, target.password);
    const targetClient = createClient(targetCookie);
    clients.push(targetClient);

    await new Promise<void>((resolve, reject) => {
      targetClient.on("connect", () => resolve());
      targetClient.on("connect_error", (err) => reject(err));
      targetClient.connect();
    });

    await new Promise((r) => setTimeout(r, 200));

    const notifPromise = new Promise<Record<string, unknown>>((resolve) => {
      targetClient.on("notification:new", (data: Record<string, unknown>) => resolve(data));
    });

    // Emettre une invitation (notification personnelle)
    appEvents.emitActivity({
      type: "INVITE_SENT",
      userId: actor.id,
      communityId: community.id,
      targetUserIds: [target.id],
    });

    const received = await notifPromise;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notification = (received as any).notification;
    expect(notification).toBeDefined();
    expect(notification.type).toBe("INVITE_SENT");
    expect(notification.userId).toBe(target.id);
    expect(notification.title).toBe("Nouvelle invitation");

    // Verifier la persistance en DB
    const dbNotif = await testPrisma.notification.findFirst({
      where: { userId: target.id, type: "INVITE_SENT" },
    });
    expect(dbNotif).toBeTruthy();
  });

  it("should not create notification when preference is disabled", async () => {
    const actor = await createTestUser({ username: "ws-actor-np", email: "wsactornp@test.com" });
    const target = await createTestUser({ username: "ws-target-np", email: "wstargetnp@test.com" });
    const community = await testPrisma.community.create({
      data: { name: "WS NoPref Community" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: actor.id, communityId: community.id, role: "MODERATOR" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: target.id, communityId: community.id, role: "MEMBER" },
    });

    // Desactiver les notifications TAG pour le target
    await testPrisma.notificationPreference.create({
      data: { userId: target.id, communityId: null, category: "TAG", enabled: false },
    });

    const targetCookie = await getSessionCookie(target.username, target.password);
    const targetClient = createClient(targetCookie);
    clients.push(targetClient);

    await new Promise<void>((resolve, reject) => {
      targetClient.on("connect", () => resolve());
      targetClient.on("connect_error", (err) => reject(err));
      targetClient.connect();
    });

    await new Promise((r) => setTimeout(r, 200));

    let notifReceived = false;
    targetClient.on("notification:new", () => {
      notifReceived = true;
    });

    // Emettre un evenement TAG
    appEvents.emitActivity({
      type: "TAG_SUGGESTION_CREATED",
      userId: actor.id,
      communityId: community.id,
      targetUserIds: [target.id],
      metadata: { tagName: "test-tag" },
    });

    // Attendre un peu pour laisser le temps au handler
    await new Promise((r) => setTimeout(r, 1000));

    expect(notifReceived).toBe(false);

    // Verifier qu'aucune notification n'est en DB
    const dbNotif = await testPrisma.notification.findFirst({
      where: { userId: target.id, type: "TAG_SUGGESTION_CREATED" },
    });
    expect(dbNotif).toBeNull();
  });

  it("should always create notification for non-disableable types (INVITE_SENT)", async () => {
    const actor = await createTestUser({ username: "ws-actor-nd", email: "wsactornd@test.com" });
    const target = await createTestUser({ username: "ws-target-nd", email: "wstargetnd@test.com" });
    const community = await testPrisma.community.create({
      data: { name: "WS NonDisable Community" },
    });
    await testPrisma.userCommunity.create({
      data: { userId: actor.id, communityId: community.id, role: "MODERATOR" },
    });

    // Desactiver les notifications INVITATION pour le target
    await testPrisma.notificationPreference.create({
      data: { userId: target.id, communityId: null, category: "INVITATION", enabled: false },
    });

    const targetCookie = await getSessionCookie(target.username, target.password);
    const targetClient = createClient(targetCookie);
    clients.push(targetClient);

    await new Promise<void>((resolve, reject) => {
      targetClient.on("connect", () => resolve());
      targetClient.on("connect_error", (err) => reject(err));
      targetClient.connect();
    });

    await new Promise((r) => setTimeout(r, 200));

    const notifPromise = new Promise<Record<string, unknown>>((resolve) => {
      targetClient.on("notification:new", (data: Record<string, unknown>) => resolve(data));
    });

    // INVITE_SENT est non-desactivable
    appEvents.emitActivity({
      type: "INVITE_SENT",
      userId: actor.id,
      communityId: community.id,
      targetUserIds: [target.id],
    });

    const received = await notifPromise;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notification = (received as any).notification;
    expect(notification).toBeDefined();
    expect(notification.type).toBe("INVITE_SENT");
  });
});
