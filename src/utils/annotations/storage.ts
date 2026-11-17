import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { authHeaders } from "@/api/client";

import { makeId } from "./makeId";
import { hasUnsavedChanges } from "./sync";
import type { AnnotationDoc } from "./types";

/** Longest side of a stored photo, in pixels. */
const MAX_IMAGE_SIDE = 2048;
const JPEG_QUALITY = 0.8;

const docsRoot = () => new Directory(Paths.document, "docs");
const projectDir = (projectId: string) => new Directory(docsRoot(), projectId);
const docDir = (projectId: string, id: string) => new Directory(projectDir(projectId), id);

export const localImage = (projectId: string, id: string) => new File(docDir(projectId, id), "image.jpg");

/** The local photo if it has been downloaded or taken here, otherwise the server URL in `doc.json`. */
export function imageUriFor(doc: AnnotationDoc): string {
  const file = localImage(doc.projectId, doc.id);
  return file.exists ? file.uri : doc.image.uri;
}

/**
 * Compresses the photo into app storage and writes an empty document for it.
 * Runs before any annotation exists, so annotation coordinates are always in the stored image's pixels.
 */
export async function createDoc(projectId: string, sourceUri: string): Promise<AnnotationDoc> {
  const context = ImageManipulator.manipulate(sourceUri, { maxWidth: MAX_IMAGE_SIDE, maxHeight: MAX_IMAGE_SIDE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  rendered.release();
  context.release();

  const id = makeId();
  docDir(projectId, id).create({ intermediates: true });
  const image = localImage(projectId, id);
  await new File(result.uri).move(image);
  const now = Date.now();
  const doc: AnnotationDoc = {
    id,
    projectId,
    image: { uri: image.uri, width: result.width, height: result.height },
    annotations: [],
    createdAt: now,
    updatedAt: now,
    serverVersion: null,
    savedAt: null,
  };
  await saveDoc(doc);
  return doc;
}

/** Writes `doc.json`, creating the folder when the document came from the server. */
export async function saveDoc(doc: AnnotationDoc): Promise<void> {
  docDir(doc.projectId, doc.id).create({ intermediates: true, idempotent: true });
  const file = new File(docDir(doc.projectId, doc.id), "doc.json");
  if (!file.exists) file.create();
  await file.write(JSON.stringify(doc));
}

export function loadDoc(projectId: string, id: string): AnnotationDoc {
  return JSON.parse(new File(docDir(projectId, id), "doc.json").textSync());
}

/**
 * Downloads the photo into the document folder. It is written under a temporary
 * name first, so a cut-off download never looks like a valid `image.jpg`.
 */
export async function downloadImage(projectId: string, id: string, url: string): Promise<void> {
  const temp = new File(docDir(projectId, id), "image.tmp.jpg");
  await File.downloadFileAsync(url, temp, { idempotent: true, headers: authHeaders() });
  temp.rename("image.jpg");
}

export function deleteLocalDoc(projectId: string, id: string): void {
  const dir = docDir(projectId, id);
  if (dir.exists) dir.delete();
}

export function deleteLocalProject(projectId: string): void {
  const dir = projectDir(projectId);
  if (dir.exists) dir.delete();
}

/** Deletes the local folder of every project not in `keepIds`: the user lost access to it. */
export function pruneLocalProjects(keepIds: string[]): void {
  const root = docsRoot();
  if (!root.exists) return;
  for (const entry of root.list()) {
    if (entry instanceof Directory && !keepIds.includes(entry.name)) entry.delete();
  }
}

/** Removes every stored photo. Used on sign out, since local files aren't kept per user. */
export function deleteAllLocal(): void {
  const root = docsRoot();
  if (root.exists) root.delete();
}

/** Saved documents of one project, most recently edited first. */
export function listDocs(projectId: string): AnnotationDoc[] {
  const root = projectDir(projectId);
  if (!root.exists) return [];
  return root
    .list()
    .filter((entry): entry is Directory => entry instanceof Directory)
    .flatMap((dir) => {
      try {
        return [loadDoc(projectId, dir.name)];
      } catch {
        return []; // half-written folder; skip it
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** True if any photo on this phone, in any project, was edited after its last Save. */
export function hasUnsavedDocs(): boolean {
  const root = docsRoot();
  if (!root.exists) return false;
  return root.list().some((e) => e instanceof Directory && listDocs(e.name).some(hasUnsavedChanges));
}
