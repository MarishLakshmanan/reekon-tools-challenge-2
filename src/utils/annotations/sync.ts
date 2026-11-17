import type { AnnotationDoc } from "./types";

export function hasUnsavedChanges(doc: AnnotationDoc): boolean {
  return doc.updatedAt !== doc.savedAt;
}

export type SyncStep =
  /** On the server but not on this phone. */
  | { type: "download"; id: string }
  /** Server is ahead and there are no local edits: replace `doc.json`. */
  | { type: "pull"; id: string }
  /** Server is ahead and there are local edits: keep local, the user resolves it on Save. */
  | { type: "conflict"; id: string }
  /** Was synced, is gone from the server, and has no local edits: deleted on another device. */
  | { type: "deleteLocal"; id: string };

/**
 * Decides what the home screen sync should do, by comparing each server `version`
 * with the local `serverVersion`. Pure, so the rules can be tested without I/O.
 */
export function planSync(local: AnnotationDoc[], remote: { id: string; version: number }[]): SyncStep[] {
  const localById = new Map(local.map((d) => [d.id, d]));
  const remoteIds = new Set(remote.map((r) => r.id));
  const steps: SyncStep[] = [];

  for (const r of remote) {
    const doc = localById.get(r.id);
    if (!doc) steps.push({ type: "download", id: r.id });
    // serverVersion null here means a first upload whose response was lost; the next Save finishes it.
    else if (doc.serverVersion !== null && r.version > doc.serverVersion) {
      steps.push({ type: hasUnsavedChanges(doc) ? "conflict" : "pull", id: r.id });
    }
  }
  for (const doc of local) {
    if (doc.serverVersion !== null && !remoteIds.has(doc.id) && !hasUnsavedChanges(doc)) {
      steps.push({ type: "deleteLocal", id: doc.id });
    }
  }
  return steps;
}
