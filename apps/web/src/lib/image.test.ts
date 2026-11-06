// Conversion des images avant l'envoi [D167] : canvas simule (jsdom ne dessine pas).
import { UPLOAD_MAX_BYTES, uploadTicketSchema } from "@fm/shared";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "../test/server.ts";
import { ApiRequestError } from "./api.ts";
import { convertImage } from "./image.ts";
import { uploadImage } from "./upload.ts";

/** Taille du bitmap decode, types que le canvas sait produire, tailles des fichiers rendus. */
function fakeCanvas({
  width = 4000,
  height = 3000,
  encodes = ["image/webp", "image/jpeg"],
  sizes = [1000],
}: { width?: number; height?: number; encodes?: string[]; sizes?: number[] } = {}) {
  const drawn: number[][] = [];
  const asked: [string, number | undefined][] = [];
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(() => Promise.resolve({ width, height, close: () => undefined }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    return {
      drawImage: (_image: unknown, _x: number, _y: number, w: number, h: number) => {
        drawn.push([w, h, this.width, this.height]);
      },
    } as unknown as CanvasRenderingContext2D;
  });
  let call = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done, type, quality) => {
    asked.push([type ?? "", quality]);
    // Comme Safari : un type non pris en charge rend du PNG.
    const produced = type && encodes.includes(type) ? type : "image/png";
    const size = sizes[Math.min(call, sizes.length - 1)] ?? 1000;
    call += 1;
    done(new Blob([new Uint8Array(size)], { type: produced }));
  });
  return { drawn, asked };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("convertImage", () => {
  it("reduit le plus grand cote et encode en WebP", async () => {
    const canvas = fakeCanvas();
    const blob = await convertImage(new Blob(["x"], { type: "image/jpeg" }), 2048);
    expect(blob.type).toBe("image/webp");
    expect(canvas.drawn).toEqual([[2048, 1536, 2048, 1536]]);
  });

  it("ne grandit pas une petite image", async () => {
    const canvas = fakeCanvas({ width: 300, height: 200 });
    await convertImage(new Blob(["x"]), 512);
    expect(canvas.drawn).toEqual([[300, 200, 300, 200]]);
  });

  it("passe en JPEG quand le navigateur n'encode pas le WebP (Safari)", async () => {
    fakeCanvas({ encodes: ["image/jpeg"] });
    const blob = await convertImage(new Blob(["x"]), 512);
    expect(blob.type).toBe("image/jpeg");
  });

  it("baisse la qualite jusqu'a passer sous la limite, sinon refuse", async () => {
    const canvas = fakeCanvas({ sizes: [UPLOAD_MAX_BYTES + 1, UPLOAD_MAX_BYTES - 1] });
    const blob = await convertImage(new Blob(["x"]), 2048);
    expect(blob.size).toBe(UPLOAD_MAX_BYTES - 1);
    expect(canvas.asked.map(([, quality]) => quality)).toEqual([0.85, 0.7]);

    vi.restoreAllMocks();
    fakeCanvas({ sizes: [UPLOAD_MAX_BYTES + 1] });
    await expect(convertImage(new Blob(["x"]), 2048)).rejects.toMatchObject({
      code: "IMAGE_TOO_LARGE",
    });
  });

  it("refuse un fichier que le navigateur ne sait pas lire", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.reject(new Error("decode")))
    );
    const error = await convertImage(new Blob(["x"]), 512).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: "IMAGE_UNREADABLE" });
  });
});

describe("uploadImage", () => {
  const ticket = uploadTicketSchema.parse({
    uploadId: "11111111-1111-4111-8111-111111111111",
    url: "http://storage.test/bucket",
    fields: { key: "uploads/u/1", Policy: "p" },
    maxBytes: UPLOAD_MAX_BYTES,
    expiresAt: new Date().toISOString(),
  });
  let sent: FormData | null = null;

  beforeEach(() => {
    sent = null;
    server.use(
      http.get("/api/v1/config", () =>
        HttpResponse.json(
          { features: { email: false, uploads: true } },
          { headers: { "set-cookie": "XSRF-TOKEN=test" } }
        )
      ),
      http.post("/api/v1/uploads", () => HttpResponse.json(ticket, { status: 201 })),
      http.post("http://storage.test/bucket", async ({ request }) => {
        sent = await request.formData();
        return new HttpResponse(null, { status: 204 });
      })
    );
  });

  it("envoie les champs signes, le type puis le fichier, et renvoie l'identifiant", async () => {
    fakeCanvas();
    await expect(uploadImage(new Blob(["x"]), "photo")).resolves.toBe(ticket.uploadId);
    const form = sent;
    expect(form ? [...form.keys()] : []).toEqual(["key", "Policy", "Content-Type", "file"]);
    expect(form?.get("Content-Type")).toBe("image/webp");
  });

  it("signale un refus du stockage", async () => {
    fakeCanvas();
    server.use(
      http.post("http://storage.test/bucket", () => new HttpResponse("<Error/>", { status: 400 }))
    );
    await expect(uploadImage(new Blob(["x"]), "avatar")).rejects.toMatchObject({
      code: "STORAGE_003",
    });
  });
});
