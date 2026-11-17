// Validation des entrees (params, query, body) par les schemas Zod partages,
// et des sorties en dev et en test. Remplace validateBody et validateUUID de la V1.
//
//   router.post("/spaces", handle({ body: createSpaceBodySchema }, async ({ body }, req, res) => {
//     reply(res, spaceSummarySchema, await createSpace(body), 201);
//   }));

import type { Request, RequestHandler, Response } from "express";
import type { z } from "zod";

import { AppError } from "./errors.ts";

interface Schemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type Parsed<S extends Schemas, K extends keyof Schemas> = S[K] extends z.ZodType
  ? z.output<S[K]>
  : undefined;

export interface Input<S extends Schemas> {
  params: Parsed<S, "params">;
  query: Parsed<S, "query">;
  body: Parsed<S, "body">;
}

function toDetails(error: z.ZodError, location: string) {
  return error.issues.map((issue) => ({
    location,
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

function parse(schema: z.ZodType | undefined, value: unknown, location: string): unknown {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("VALIDATION_001", toDetails(result.error, location));
  return result.data;
}

/** Valide les entrees declarees puis appelle le handler avec les valeurs typees. */
export function handle<S extends Schemas>(
  schemas: S,
  fn: (input: Input<S>, req: Request, res: Response) => unknown
): RequestHandler {
  return async (req, res) => {
    const input = {
      params: parse(schemas.params, req.params, "params"),
      query: parse(schemas.query, req.query, "query"),
      body: parse(schemas.body, req.body ?? {}, "body"),
    } as Input<S>;
    await fn(input, req, res);
  };
}

/** Repond avec des donnees typees ; en dev et en test, elles sont validees contre le schema. */
export function reply<T extends z.ZodType>(
  res: Response,
  schema: T,
  data: z.input<T>,
  status = 200
): void {
  if (res.app.locals.validateResponses === true) {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`response does not match its schema: ${result.error.message}`);
    }
    res.status(status).json(result.data);
    return;
  }
  res.status(status).json(data);
}
