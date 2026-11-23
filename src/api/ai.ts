import { z } from "zod";

import { jsonInit, request } from "@/api/client";
import { penPathSchema, textLabelSchema } from "../../shared/schema";
import { makeId } from "@/utils/annotations/makeId";
import type { Annotation, PenPath, TextLabel } from "@/utils/annotations/types";

const responseSchema = z.object({ annotations: z.array(z.union([penPathSchema, textLabelSchema])) });

/**
 * Asks the server's drawing agent for pen paths and text labels. `annotations` is what is on the photo now,
 * including unsaved edits, so the agent doesn't draw over or reuse what is there.
 * @returns the new annotations, checked with the same schema the server uses, with fresh ids so they
 * can't clash with anything added while the agent worked. Empty when nothing was found.
 * @throws ApiError 422 when the agent could not produce valid output, 503 when AI is off on the server.
 */
export async function askAgent(
  docId: string,
  body: {
    request: string;
    annotations: Annotation[];
    style: { stroke: string; strokeWidth: number };
    textStyle: { fontSize: number; color: string };
  },
  signal: AbortSignal,
): Promise<(PenPath | TextLabel)[]> {
  const res = await request(`/documents/${docId}/ai`, { ...jsonInit("POST", body), signal });
  const { annotations } = responseSchema.parse(await res.json());
  return annotations.map((a) =>
    a.kind === "path" ? { ...a, id: makeId(), anchors: a.anchors.map((n) => ({ ...n, id: makeId() })) } : { ...a, id: makeId() },
  );
}
