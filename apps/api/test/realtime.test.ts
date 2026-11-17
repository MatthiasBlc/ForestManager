// Temps reel en SSE (C6.2) [D188] : hub en memoire, publication apres chaque
// ecriture d'un espace, flux GET /events.
import type { RealtimeEvent } from "@fm/shared";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";

import { createContext } from "../src/core/http/app.ts";
import { notify } from "../src/core/notifications/service.ts";
import { createRealtime } from "../src/core/realtime/hub.ts";
import { MODULES } from "../src/modules/index.ts";
import { createTestApp, loginAs } from "./helpers/app.ts";
import { db, testEnv } from "./helpers/db.ts";
import { addMember, createSpace, createUser } from "./helpers/factories.ts";

function listener() {
  const events: RealtimeEvent[] = [];
  let ended = false;
  return {
    events,
    ended: () => ended,
    send: (event: RealtimeEvent) => {
      events.push(event);
    },
    end: () => {
      ended = true;
    },
  };
}

describe("hub temps reel", () => {
  it("envoie aux connexions d'un utilisateur seulement, puis les oublie a la fermeture", () => {
    const realtime = createRealtime();
    const a1 = listener();
    const a2 = listener();
    const b = listener();
    const closeA1 = realtime.connect("a", a1);
    realtime.connect("a", a2);
    realtime.connect("b", b);
    realtime.toUsers(["a"], { type: "notification" });
    expect(a1.events).toEqual([{ type: "notification" }]);
    expect(a2.events).toHaveLength(1);
    expect(b.events).toEqual([]);
    closeA1();
    realtime.toUsers(["a", "b"], { type: "notification" });
    expect(a1.events).toHaveLength(1);
    expect(a2.events).toHaveLength(2);
    expect(b.events).toHaveLength(1);
  });

  it("garde au plus 10 connexions par utilisateur (la plus ancienne est fermee)", () => {
    const realtime = createRealtime();
    const all = Array.from({ length: 11 }, () => listener());
    for (const one of all) realtime.connect("a", one);
    expect(all[0]?.ended()).toBe(true);
    expect(all.slice(1).every((one) => !one.ended())).toBe(true);
    realtime.closeAll();
    expect(all.every((one) => one.ended())).toBe(true);
  });
});

describe("publication des changements d'un espace", () => {
  it("previent les membres actifs apres une ecriture reussie, avec le module concerne", async () => {
    const realtime = createRealtime();
    const app = createTestApp({ realtime });
    const owner = await createUser();
    const member = await createUser();
    const outsider = await createUser();
    const space = await createSpace(owner.id, { name: "Famille" });
    await addMember(space.id, member.id);
    const seen = { owner: listener(), member: listener(), outsider: listener() };
    realtime.connect(owner.id, seen.owner);
    realtime.connect(member.id, seen.member);
    realtime.connect(outsider.id, seen.outsider);

    const client = await loginAs(owner, app);
    expect((await client.patch(`/spaces/${space.id}`, { name: "Famille B" })).status).toBe(200);
    await vi.waitFor(() => {
      expect(seen.member.events).toEqual([{ type: "invalidate", spaceId: space.id, module: null }]);
    });
    expect(seen.owner.events).toHaveLength(1);

    const tag = await client.post(`/spaces/${space.id}/recipes/tags`, { name: "Rapide" });
    expect(tag.status).toBe(201);
    await vi.waitFor(() => {
      expect(seen.member.events.at(-1)).toEqual({
        type: "invalidate",
        spaceId: space.id,
        module: "recipes",
      });
    });

    // Lecture ou echec : rien n'est publie.
    await client.get(`/spaces/${space.id}`);
    await client.patch(`/spaces/${space.id}`, { name: "" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seen.member.events).toHaveLength(2);
    expect(seen.outsider.events).toEqual([]);
  });

  it("notify() previent le destinataire", async () => {
    const realtime = createRealtime();
    const ctx = createContext({
      env: testEnv,
      db,
      logger: pino({ level: "silent" }),
      modules: MODULES,
      realtime,
    });
    const owner = await createUser();
    const seen = listener();
    realtime.connect(owner.id, seen);
    await notify(ctx, { type: "core.release.published", recipients: [owner.id] });
    expect(seen.events).toEqual([{ type: "notification" }]);
  });
});

describe("GET /events", () => {
  /** Lit le flux jusqu'a voir `until`, puis coupe la connexion. */
  function readStream(
    client: Awaited<ReturnType<typeof loginAs>>,
    until: string,
    onOpen?: () => void
  ) {
    return new Promise<string>((resolve, reject) => {
      client.agent
        .get("/api/v1/events")
        .buffer(false)
        .parse((res, callback) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            if (!text) onOpen?.();
            text += chunk;
            if (text.includes(until)) {
              callback(null, text);
              resolve(text);
              (res as unknown as { destroy: () => void }).destroy();
            }
          });
          res.on("end", () => {
            callback(null, text);
            resolve(text);
          });
        })
        .end((error: Error | null) => {
          // La coupure volontaire du flux remonte comme "aborted".
          if (error && !error.message.includes("aborted")) reject(error);
        });
    });
  }

  it("demande une session", async () => {
    const app = createTestApp();
    const owner = await createUser();
    const client = await loginAs(owner, app);
    await client.post("/auth/logout");
    expect((await client.get("/events")).status).toBe(401);
  });

  it("ouvre un flux text/event-stream et y pousse les notifications", async () => {
    const realtime = createRealtime();
    const app = createTestApp({ realtime });
    const ctx = createContext({
      env: testEnv,
      db,
      logger: pino({ level: "silent" }),
      modules: MODULES,
      realtime,
    });
    const owner = await createUser();
    const client = await loginAs(owner, app);
    const text = await readStream(client, "event: notification", () => {
      void notify(ctx, { type: "core.release.published", recipients: [owner.id] });
    });
    expect(text).toContain("retry: 5000");
    expect(text).toContain('event: notification\ndata: {"type":"notification"}\n\n');
  });

  it("ferme le flux au battement suivant si la session n'existe plus", async () => {
    const realtime = createRealtime({ heartbeatMs: 30 });
    const app = createTestApp({ realtime });
    const owner = await createUser();
    const client = await loginAs(owner, app);
    const text = await readStream(client, "never", () => {
      // Une requete Prisma ne part qu'a son premier then.
      void db.userSession.deleteMany({ where: { userId: owner.id } }).then(() => undefined);
    });
    expect(text).toContain("retry: 5000");
  });
});
