import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { makeId } from "./makeId";
import type { AnnotationDoc } from "./types";

/** Longest side of a stored photo, in pixels. */
const MAX_IMAGE_SIDE = 2048;
const JPEG_QUALITY = 0.8;

// `project` is a fixed folder name until projects exist.
const docsRoot = () => new Directory(Paths.document, "docs", "project");
const docDir = (id: string) => new Directory(docsRoot(), id);

export const localImage = (id: string) => new File(docDir(id), "image.jpg");

/** The local photo if it has been downloaded or taken here, otherwise the server URL in `doc.json`. */
export function imageUriFor(doc: AnnotationDoc): string {
  const file = localImage(doc.id);
  return file.exists ? file.uri : doc.image.uri;
}

/**
 * Compresses the photo into app storage and writes an empty document for it.
 * Runs before any annotation exists, so annotation coordinates are always in the stored image's pixels.
 */
export async function createDoc(sourceUri: string): Promise<AnnotationDoc> {
  const context = ImageManipulator.manipulate(sourceUri, { maxWidth: MAX_IMAGE_SIDE, maxHeight: MAX_IMAGE_SIDE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  rendered.release();
  context.release();

  const id = makeId();
  docDir(id).create({ intermediates: true });
  const image = localImage(id);
  await new File(result.uri).move(image);
  const now = Date.now();
  const doc: AnnotationDoc = {
    id,
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
  docDir(doc.id).create({ intermediates: true, idempotent: true });
  const file = new File(docDir(doc.id), "doc.json");
  if (!file.exists) file.create();
  await file.write(JSON.stringify(doc));
}

export function loadDoc(id: string): AnnotationDoc {
  return JSON.parse(new File(docDir(id), "doc.json").textSync());
}

/**
 * Downloads the photo into the document folder. It is written under a temporary
 * name first, so a cut-off download never looks like a valid `image.jpg`.
 */
export async function downloadImage(id: string, url: string): Promise<void> {
  const temp = new File(docDir(id), "image.tmp.jpg");
  await File.downloadFileAsync(url, temp, { idempotent: true });
  temp.rename("image.jpg");
}

export function deleteLocalDoc(id: string): void {
  const dir = docDir(id);
  if (dir.exists) dir.delete();
}

/** Saved documents, most recently edited first. */
export function listDocs(): AnnotationDoc[] {
  const root = docsRoot();
  if (!root.exists) return [];
  return root
    .list()
    .filter((entry): entry is Directory => entry instanceof Directory)
    .flatMap((dir) => {
      try {
        return [loadDoc(dir.name)];
      } catch {
        return []; // half-written folder; skip it
      }
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
