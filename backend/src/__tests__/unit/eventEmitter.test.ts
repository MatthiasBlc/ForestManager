import { describe, it, expect, vi } from "vitest";
import appEvents, { AppEvent } from "../../services/eventEmitter";

describe("AppEventEmitter", () => {
  it("should emit and receive activity events", () => {
    const handler = vi.fn();
    appEvents.on("activity", handler);

    const event: AppEvent = {
      type: "RECIPE_CREATED",
      userId: "user-1",
      communityId: "community-1",
      recipeId: "recipe-1",
    };

    appEvents.emitActivity(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);

    appEvents.removeListener("activity", handler);
  });

  it("should support multiple listeners", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    appEvents.on("activity", handler1);
    appEvents.on("activity", handler2);

    const event: AppEvent = {
      type: "INVITE_SENT",
      userId: "user-1",
      communityId: "community-1",
      targetUserIds: ["user-2"],
    };

    appEvents.emitActivity(event);

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();

    appEvents.removeListener("activity", handler1);
    appEvents.removeListener("activity", handler2);
  });

  it("should include optional fields in events", () => {
    const handler = vi.fn();
    appEvents.on("activity", handler);

    const event: AppEvent = {
      type: "VARIANT_PROPOSED",
      userId: "user-1",
      communityId: "community-1",
      recipeId: "recipe-1",
      metadata: { proposalId: "prop-1" },
      targetUserIds: ["user-2"],
    };

    appEvents.emitActivity(event);

    const received = handler.mock.calls[0][0] as AppEvent;
    expect(received.metadata).toEqual({ proposalId: "prop-1" });
    expect(received.targetUserIds).toEqual(["user-2"]);

    appEvents.removeListener("activity", handler);
  });
});
