import { getRemote, listRemote, toLocalDoc } from "@/api/documents";
import { deleteLocalDoc, downloadImage, listDocs, localImage, saveDoc } from "@/utils/annotations/storage";
import { planSync } from "@/utils/annotations/sync";

// One sync per project at a time.
const running = new Map<string, Promise<Set<string>>>();

/**
 * Pulls server changes into local storage (see `planSync` for the rules).
 * Calls made while a sync of the same project is running share it, so a document is never downloaded twice at once.
 * @returns ids in conflict: changed on the server and edited here.
 * @throws when the server can't be reached; local data is left as it was.
 */
export function syncWithServer(projectId: string): Promise<Set<string>> {
  let current = running.get(projectId);
  if (!current) {
    current = run(projectId).finally(() => running.delete(projectId));
    running.set(projectId, current);
  }
  return current;
}

async function run(projectId: string): Promise<Set<string>> {
  const remote = await listRemote(projectId);
  const conflicts = new Set<string>();

  for (const step of planSync(listDocs(projectId), remote)) {
    try {
      if (step.type === "download" || step.type === "pull") {
        // Images never change after upload, so a pull only replaces doc.json.
        await saveDoc(toLocalDoc(await getRemote(step.id)));
      } else if (step.type === "deleteLocal") {
        deleteLocalDoc(projectId, step.id);
      } else {
        conflicts.add(step.id);
      }
    } catch (e) {
      console.warn(`Sync ${step.type} failed for ${step.id}`, e);
    }
  }

  // Covers new downloads and earlier image downloads that were cut off.
  const remoteIds = new Set(remote.map((r) => r.id));
  for (const doc of listDocs(projectId)) {
    if (!remoteIds.has(doc.id) || localImage(projectId, doc.id).exists) continue;
    try {
      await downloadImage(projectId, doc.id, doc.image.uri);
    } catch (e) {
      console.warn(`Image download failed for ${doc.id}`, e);
    }
  }
  return conflicts;
}
