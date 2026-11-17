import { fetch } from "expo/fetch";

import { localImage } from "@/utils/annotations/storage";
import type { Annotation, AnnotationDoc } from "@/utils/annotations/types";

/** A document as the server returns it. `image.uri` is the server URL. */
export type RemoteDoc = Omit<AnnotationDoc, "serverVersion" | "savedAt"> & { version: number };
export type RemoteSummary = Omit<RemoteDoc, "annotations" | "createdAt">;

/** The server answered with a non-2xx status. Network failures throw the fetch error instead. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function url(path: string) {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) throw new Error("EXPO_PUBLIC_API_URL is not set");
  return `${base}${path}`;
}

async function request(path: string, init?: Parameters<typeof fetch>[1]) {
  const res = await fetch(url(path), init);
  if (!res.ok) throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} failed with ${res.status}`);
  return res;
}

/** A downloaded document, marked as saved at the server's version. */
export function toLocalDoc(remote: RemoteDoc): AnnotationDoc {
  const { version, ...doc } = remote;
  return { ...doc, serverVersion: version, savedAt: doc.updatedAt };
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
  form.append("image", localImage(doc.id));
  const res = await request("/documents", { method: "POST", body: form });
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

export async function listRemote(): Promise<RemoteSummary[]> {
  return (await request("/documents")).json();
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
  if (created) return { version: remote.version, imageUri: remote.image.uri };
  // An earlier upload went through but its response was lost. That created version 1;
  // send the current annotations on top, so edits made since then aren't dropped.
  const updated = await updateDoc(doc.id, doc.annotations, 1);
  return { version: updated.version, imageUri: remote.image.uri };
}

/** Deletes on the server. A 404 counts as success, since the document is gone either way. */
export async function deleteRemote(id: string): Promise<void> {
  try {
    await request(`/documents/${id}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
}
