import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { extractSessionCookie } from "../setup/testHelpers";
import { testPrisma } from "../setup/globalSetup";
import { cleanupReadNotifications } from "../../jobs/notificationCleanup";

const uniqueSuffix = () =>
  `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

describe("Notification Cleanup Job", () => {
  let user: { id: string };

  beforeEach(async () => {
    const suffix = uniqueSuffix();

    const signup = await request(app).post("/api/auth/signup").send({
      username: `cleanup_${suffix}`,
      email: `cleanup_${suffix}@example.com`,
      password: "Test123!Password",
    });
    extractSessionCookie(signup);
    user = (await testPrisma.user.findFirst({
      where: { email: `cleanup_${suffix}@example.com` },
    }))!;
  });

  it("should delete read notifications older than 30 days", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);

    // Creer une notification lue il y a 35 jours
    await testPrisma.notification.create({
      data: {
        userId: user.id,
        type: "INVITE_SENT",
        category: "INVITATION",
        title: "Old notification",
        message: "Old read notification",
        readAt: oldDate,
        createdAt: oldDate,
      },
    });

    const deleted = await cleanupReadNotifications();
    expect(deleted).toBe(1);

    const remaining = await testPrisma.notification.count({
      where: { userId: user.id },
    });
    expect(remaining).toBe(0);
  });

  it("should NOT delete unread notifications even if old", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 60);

    // Notification non-lue mais vieille
    await testPrisma.notification.create({
      data: {
        userId: user.id,
        type: "INVITE_SENT",
        category: "INVITATION",
        title: "Old unread",
        message: "Old unread notification",
        readAt: null,
        createdAt: oldDate,
      },
    });

    const deleted = await cleanupReadNotifications();
    expect(deleted).toBe(0);

    const remaining = await testPrisma.notification.count({
      where: { userId: user.id },
    });
    expect(remaining).toBe(1);
  });

  it("should NOT delete recently read notifications", async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);

    await testPrisma.notification.create({
      data: {
        userId: user.id,
        type: "INVITE_SENT",
        category: "INVITATION",
        title: "Recent read",
        message: "Recently read notification",
        readAt: recentDate,
        createdAt: recentDate,
      },
    });

    const deleted = await cleanupReadNotifications();
    expect(deleted).toBe(0);

    const remaining = await testPrisma.notification.count({
      where: { userId: user.id },
    });
    expect(remaining).toBe(1);
  });

  it("should handle batch deletion correctly", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);

    // Creer 5 vieilles notifications lues
    const data = Array.from({ length: 5 }, (_, i) => ({
      userId: user.id,
      type: "USER_JOINED",
      category: "MODERATION" as const,
      title: `Batch ${i}`,
      message: `Batch notification ${i}`,
      readAt: oldDate,
      createdAt: oldDate,
    }));

    await testPrisma.notification.createMany({ data });

    const deleted = await cleanupReadNotifications();
    expect(deleted).toBe(5);
  });

  it("should return 0 when nothing to delete", async () => {
    const deleted = await cleanupReadNotifications();
    expect(deleted).toBe(0);
  });

  it("should delete old read but keep old unread and recent read", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35);
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);

    // 1. Vieille lue -> doit etre supprimee
    await testPrisma.notification.create({
      data: {
        userId: user.id,
        type: "INVITE_SENT",
        category: "INVITATION",
        title: "Old read",
        message: "Should be deleted",
        readAt: oldDate,
        createdAt: oldDate,
      },
    });

    // 2. Vieille non-lue -> doit rester
    await testPrisma.notification.create({
      data: {
        userId: user.id,
        type: "INVITE_SENT",
        category: "INVITATION",
        title: "Old unread",
        message: "Should stay",
        readAt: null,
        createdAt: oldDate,
      },
    });

    // 3. Recente lue -> doit rester
    await testPrisma.notification.create({
      data: {
        userId: user.id,
        type: "INVITE_SENT",
        category: "INVITATION",
        title: "Recent read",
        message: "Should stay too",
        readAt: recentDate,
        createdAt: recentDate,
      },
    });

    const deleted = await cleanupReadNotifications();
    expect(deleted).toBe(1);

    const remaining = await testPrisma.notification.count({
      where: { userId: user.id },
    });
    expect(remaining).toBe(2);
  });
});
