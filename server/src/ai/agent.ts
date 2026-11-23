import { readFileSync } from "node:fs";

import { openrouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent } from "ai";
import type { LanguageModel, ModelMessage } from "ai";

import type { Annotation } from "../../../src/utils/annotations/types.ts";
import { validateOutput } from "./validate.ts";
import type { AgentAnnotation } from "./validate.ts";

export type { AgentAnnotation };

export const MAX_RETRIES = 4;

const instructions = readFileSync(new URL("./prompt.md", import.meta.url), "utf8");

export type AgentInput = {
  request: string;
  /** The photo. The app re-encodes every photo to JPEG before upload, so that is the default type. */
  image: Buffer;
  mediaType?: "image/jpeg" | "image/png";
  width: number;
  height: number;
  style: { stroke: string; strokeWidth: number };
  textStyle: { fontSize: number; color: string };
  /** What is on the photo now, including unsaved edits. New ids must not clash with these. */
  annotations: Annotation[];
};

export type Attempt = { attempt: number; ok: boolean; errors: string[]; ms: number; tokens: number | undefined };

/** Every attempt, the first and the retries, produced output that failed validation. */
export class AgentFailedError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`The agent gave up after ${MAX_RETRIES} retries`);
    this.errors = errors;
  }
}

/** The model used when none is passed. Needs `OPENROUTER_API_KEY`. */
export function openrouterModel(): LanguageModel {
  return openrouter(process.env.AGENT_MODEL || "google/gemini-4-argon");
}

/**
 * Asks the model for new pen paths and text labels, checking each answer and sending the errors back
 * for up to {@link MAX_RETRIES} retries.
 * @returns annotations that passed validation; empty when the model found nothing to mark.
 * @throws AgentFailedError when no attempt passed. Provider errors are thrown as they are.
 */
export async function drawAnnotations(
  input: AgentInput,
  { model, abortSignal, onAttempt }: { model: LanguageModel; abortSignal?: AbortSignal; onAttempt?: (a: Attempt) => void },
): Promise<AgentAnnotation[]> {
  const agent = new ToolLoopAgent({ model, instructions, tools: {} });
  const { width, height, style, textStyle, annotations } = input;
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            `Request: ${JSON.stringify(input.request)}`,
            `Image size: ${width} x ${height}`,
            `Line style: stroke "${style.stroke}", strokeWidth ${style.strokeWidth}`,
            `Text style: color "${textStyle.color}", fontSize ${textStyle.fontSize}`,
            `Existing annotations: ${JSON.stringify(annotations)}`,
          ].join("\n"),
        },
        { type: "file", mediaType: input.mediaType ?? "image/jpeg", data: input.image },
      ],
    },
  ];

  let errors: string[] = [];
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const started = Date.now();
    const result = await agent.generate({ messages, abortSignal });
    const check = validateOutput(result.text, { width, height, existing: annotations });
    errors = check.ok ? [] : check.errors;
    onAttempt?.({ attempt, ok: check.ok, errors, ms: Date.now() - started, tokens: result.usage.totalTokens });
    if (check.ok) return check.annotations;
    messages.push(...result.responseMessages, {
      role: "user",
      content: `Your output failed validation:\n${errors.map((e) => `- ${e}`).join("\n")}\nReturn the corrected JSON only.`,
    });
  }
  throw new AgentFailedError(errors);
}
