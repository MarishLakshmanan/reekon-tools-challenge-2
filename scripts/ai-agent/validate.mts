import { annotationsSchema } from "../../server/src/schema.ts";
import type { Annotation, PenPath } from "../../src/utils/annotations/types.ts";

export type Validation = { ok: true; paths: PenPath[] } | { ok: false; errors: string[] };

type Context = { width: number; height: number; existing: Annotation[] };

// Models sometimes wrap JSON in a code fence even when told not to.
function stripFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

type Issue = { path: PropertyKey[]; message: string; code?: string; errors?: Issue[][] };

// A union failure only says "Invalid input". Report the field errors of the branch
// whose `kind` matched, or else the branch with the fewest errors.
function describe(issue: Issue, base: PropertyKey[]): string[] {
  const path = [...base, ...issue.path];
  if (issue.code === "invalid_union" && issue.errors?.length) {
    const branches = issue.errors.map((b) => b.flatMap((i) => describe(i, path)));
    const sameKind = branches.filter((b) => !b.some((e) => /\.kind: /.test(e)));
    const pool = sameKind.length ? sameKind : branches;
    return pool.reduce((a, b) => (b.length < a.length ? b : a));
  }
  return [`${path.map(String).join(".")}: ${issue.message}`];
}

function existingIds(existing: Annotation[]) {
  const ids = new Set<string>();
  for (const a of existing) {
    ids.add(a.id);
    if (a.kind === "path") for (const anchor of a.anchors) ids.add(anchor.id);
  }
  return ids;
}

/**
 * Deterministic check of the agent's `doc.json`: valid JSON, matches the shared
 * annotations schema, and only adds pen paths that fit the photo and use new ids.
 * @returns the new paths, or every error found, worded so they can be sent back to the agent.
 */
export function validateOutput(text: string, { width, height, existing }: Context): Validation {
  let json: unknown;
  try {
    json = JSON.parse(stripFence(text));
  } catch (e) {
    return { ok: false, errors: [`Output is not valid JSON: ${(e as Error).message}`] };
  }

  if (typeof json !== "object" || json === null || !("annotations" in json)) {
    return { ok: false, errors: ['Output must be an object with an "annotations" array.'] };
  }

  const parsed = annotationsSchema.safeParse(json.annotations);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.flatMap((i) => describe(i, ["annotations"])) };
  }

  const errors: string[] = [];
  const seen = existingIds(existing);
  const claim = (id: string, where: string) => {
    if (seen.has(id)) errors.push(`${where}: id "${id}" is already used.`);
    seen.add(id);
  };

  parsed.data.forEach((a, i) => {
    const where = `annotations.${i}`;
    if (a.kind !== "path") {
      errors.push(`${where}: kind is "${a.kind}", but only "path" may be added.`);
      return;
    }
    claim(a.id, where);
    const min = a.closed ? 3 : 2;
    if (a.anchors.length < min) {
      errors.push(`${where}: a ${a.closed ? "closed" : "open"} path needs at least ${min} anchors, got ${a.anchors.length}.`);
    }
    a.anchors.forEach(({ id, point }, j) => {
      claim(id, `${where}.anchors.${j}`);
      if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) {
        errors.push(`${where}.anchors.${j}: point (${point.x}, ${point.y}) is outside the ${width} x ${height} image.`);
      }
    });
  });

  return errors.length ? { ok: false, errors } : { ok: true, paths: parsed.data as PenPath[] };
}
