import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zodResolver } from "./form.ts";

const schema = z.object({
  name: z.string().trim().min(3),
  link: z.object({ days: z.number().int() }),
});

const options = { fields: {}, shouldUseNativeValidation: false } as const;

describe("zodResolver", () => {
  it("renvoie les valeurs transformees quand tout est valide", async () => {
    const result = await zodResolver(schema)(
      { name: "  Famille ", link: { days: 7 } },
      undefined,
      options
    );
    expect(result).toEqual({ values: { name: "Famille", link: { days: 7 } }, errors: {} });
  });

  it("place chaque erreur sur son champ, imbrique compris, en francais", async () => {
    const result = await zodResolver(schema)(
      { name: "a", link: { days: 1.5 } },
      undefined,
      options
    );
    expect(result.values).toEqual({});
    expect(result.errors).toMatchObject({
      name: { type: "too_small" },
      link: { days: { type: "invalid_type" } },
    });
    expect(result.errors.name?.message).toMatch(/caract/i);
  });
});
