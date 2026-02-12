import { describe, it, expect, vi } from "vitest";
import { communityEvents } from "../../../utils/communityEvents";

describe("communityEvents", () => {
  it("should subscribe and notify listeners", () => {
    const listener = vi.fn();
    const unsub = communityEvents.subscribe(listener);

    communityEvents.notify();
    expect(listener).toHaveBeenCalledOnce();

    unsub();
  });

  it("should unsubscribe correctly", () => {
    const listener = vi.fn();
    const unsub = communityEvents.subscribe(listener);

    unsub();
    communityEvents.notify();
    expect(listener).not.toHaveBeenCalled();
  });
});
