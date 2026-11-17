import { ApiError, apiUrl, request } from "@/api/client";
import { localImage } from "@/utils/annotations/storage";
import type { Annotation, AnnotationDoc } from "@/utils/annotations/types";

export { ApiError };

/** A document as the server returns it. `image.uri` is a server path such as `/images/<file>`. */
export type RemoteDoc = Omit<AnnotationDoc, "serverVersion" | "savedAt"> & { version: number };
export type RemoteSummary = Omit<RemoteDoc, "annotations" | "createdAt">;

/** The server sends image paths (`/images/<file>`); this adds the server address the app is configured with. */
function imageUrl(path: string): string {
  return apiUrl(path);
}

/** A downloaded document, marked as saved at the server's version. */
export function toLocalDoc(remote: RemoteDoc): AnnotationDoc {
  const { version, ...doc } = remote;
  return {
    ...doc,
    image: { ...doc.image, uri: imageUrl(doc.image.uri) },
    serverVersion: version,
    savedAt: doc.updatedAt,
  };
}

/**
 * First Save: uploads the photo and its annotations.
 * @returns `created: false` when the id already existed (a retried upload); the server copy is returned unchanged.
 */
export async function uploadDoc(doc: AnnotationDoc): Promise<{ created: boolean; remote: RemoteDoc }> {
  const form = new FormData();
  form.append("id", doc.id);
  form.append("width", String(doc.image.width));
  form.append("height", String(doc.image.height));
  form.append("annotations", JSON.stringify(doc.annotations));
  form.append("image", localImage(doc.projectId, doc.id));
  const res = await request(`/projects/${doc.projectId}/documents`, { method: "POST", body: form });
  return { created: res.status === 201, remote: await res.json() };
}

/** @throws ApiError 409 when `version` is not the server's current one. */
export async function updateDoc(
  id: string,
  annotations: Annotation[],
  version: number,
): Promise<{ version: number; updatedAt: number }> {
  const res = await request(`/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ annotations, version }),
  });
  return res.json();
}

export async function listRemote(projectId: string): Promise<RemoteSummary[]> {
  return (await request(`/projects/${projectId}/documents`)).json();
}

export async function getRemote(id: string): Promise<RemoteDoc> {
  return (await request(`/documents/${id}`)).json();
}

/**
 * Save: `POST` the first time, `PUT` after that.
 * @returns the new server version, and the server image URL after an upload.
 * @throws ApiError 409 when another device saved first.
 */
export async function saveToServer(doc: AnnotationDoc): Promise<{ version: number; imageUri?: string }> {
  if (doc.serverVersion !== null) {
    try {
      return { version: (await updateDoc(doc.id, doc.annotations, doc.serverVersion)).version };
    } catch (e) {
      // Deleted on another device while this one had unsaved edits: upload it again.
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  const { created, remote } = await uploadDoc(doc);
  if (created) return { version: remote.version, imageUri: imageUrl(remote.image.uri) };
  // An earlier upload went through but its response was lost. That created version 1;
  // send the current annotations on top, so edits made since then aren't dropped.
  const updated = await updateDoc(doc.id, doc.annotations, 1);
  return { version: updated.version, imageUri: imageUrl(remote.image.uri) };
}

/** Deletes on the server. A 404 counts as success, since the document is gone either way. */
export async function deleteRemote(id: string): Promise<void> {
  try {
    await request(`/documents/${id}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
}
