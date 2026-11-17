import { Skia } from "@shopify/react-native-skia";
import { Directory, File, Paths } from "expo-file-system";

import { makeId } from "./makeId";
import type { AnnotationDoc } from "./types";

const docsRoot = () => new Directory(Paths.document, "docs");
const docDir = (id: string) => new Directory(docsRoot(), id);

async function readImageSize(uri: string) {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error(`Could not decode image at ${uri}`);
  return { width: image.width(), height: image.height() };
}

/**
 * Copies the photo into app storage and writes an empty document for it.
 * Camera and picker URIs are temporary, so the copy is what the document keeps.
 * Size is read from the decoded image so it matches what Skia draws.
 */
export async function createDoc(sourceUri: string): Promise<AnnotationDoc> {
  const id = makeId();
  const dir = docDir(id);
  dir.create({ intermediates: true });
  const image = new File(dir, "image.jpg");
  await new File(sourceUri).copy(image);
  const { width, height } = await readImageSize(image.uri);
  const now = Date.now();
  const doc: AnnotationDoc = {
    id,
    image: { uri: image.uri, width, height },
    annotations: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveDoc(doc);
  return doc;
}

export async function saveDoc(doc: AnnotationDoc): Promise<void> {
  const file = new File(docDir(doc.id), "doc.json");
  if (!file.exists) file.create();
  await file.write(JSON.stringify(doc));
}

/**
 * The image URI is rebuilt from the document folder instead of trusting the
 * saved one, because the app's storage path can change between launches.
 */
export function loadDoc(id: string): AnnotationDoc {
  const dir = docDir(id);
  const doc: AnnotationDoc = JSON.parse(new File(dir, "doc.json").textSync());
  return { ...doc, image: { ...doc.image, uri: new File(dir, "image.jpg").uri } };
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
