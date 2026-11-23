import { z } from "zod";

import { annotationsSchema } from "../../shared/schema.ts";

const id = z.string().regex(/^[a-z0-9]+$/);

export const aiRequestSchema = z.object({
  request: z.string().trim().min(1).max(500),
  annotations: annotationsSchema,
  style: z.object({ stroke: z.string(), strokeWidth: z.number().positive() }),
  textStyle: z.object({ fontSize: z.number().positive(), color: z.string() }),
});

export const updateSchema = z.object({
  annotations: annotationsSchema,
  version: z.number().int(),
});

export const createSchema = z.object({
  id,
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
  annotations: z.string().transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "annotations is not valid JSON" });
      return z.NEVER;
    }
  }).pipe(annotationsSchema),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

export const createProjectSchema = z.object({
  id,
  name: z.string().trim().min(1).max(100),
});

export const addMemberSchema = z.object({ userId: z.string().min(1) });
