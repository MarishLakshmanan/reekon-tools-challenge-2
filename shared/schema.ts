import { z } from "zod";

// Typed against the app's own types, so a change on either side fails typecheck.
import type { Annotation } from "../src/utils/annotations/types.ts";

const point = z.object({ x: z.number(), y: z.number() });

export const penPathSchema = z.object({
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

export const textLabelSchema = z.object({
  id: z.string(),
  kind: z.literal("text"),
  position: point,
  text: z.string(),
  fontSize: z.number(),
  color: z.string(),
});

export const annotationsSchema: z.ZodType<Annotation[]> = z.array(
  z.union([penPathSchema, measurement, textLabelSchema]),
);
