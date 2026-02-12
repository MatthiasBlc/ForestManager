import { EventEmitter } from "events";

export interface AppEvent {
  type: string;
  userId: string;
  communityId: string | null;
  recipeId?: string;
  metadata?: Record<string, unknown>;
  targetUserIds?: string[];
}

class AppEventEmitter extends EventEmitter {
  emitActivity(event: AppEvent) {
    this.emit("activity", event);
  }
}

const appEvents = new AppEventEmitter();

export default appEvents;
