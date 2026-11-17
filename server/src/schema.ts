import { z } from "zod";

// Typed against the app's own types, so a change on either side fails typecheck.
import type { Annotation } from "../../src/utils/annotations/types.ts";

const id = z.string().regex(/^[a-z0-9]+$/);

const point = z.object({ x: z.number(), y: z.number() });

const penPath = z.object({
  id: z.string(),
  kind: z.literal("path"),
  anchors: z.array(z.object({ id: z.string(), point })),
  closed: z.boolean(),
  stroke: z.string(),
  strokeWidth: z.number(),
});

const measurementFields = {
  id: z.string(),
  kind: z.literal("measurement"),
  value: z.number(),
  unit: z.enum(["mm", "cm", "m", "in", "ft"]),
  labelOffset: z.number(),
  color: z.string(),
};

// On a segment, or unassigned with all three segment fields null.
const measurement = z.union([
  z.object({ ...measurementFields, pathId: z.string(), startAnchorId: z.string(), endAnchorId: z.string() }),
  z.object({ ...measurementFields, pathId: z.null(), startAnchorId: z.null(), endAnchorId: z.null() }),
]);

const textLabel = z.object({
  id: z.string(),
  kind: z.literal("text"),
  position: point,
  text: z.string(),
  fontSize: z.number(),
  color: z.string(),
});

const annotationsSchema: z.ZodType<Annotation[]> = z.array(
  z.union([penPath, measurement, textLabel]),
);

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
