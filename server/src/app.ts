import { rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import express from "express";
import type { ErrorRequestHandler, Request } from "express";
import multer from "multer";

import type { Db, DocumentRow } from "./db.ts";
import { createSchema, updateSchema } from "./schema.ts";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// The host differs between the emulator, a phone and a changed LAN IP, so the URL is built per request.
function imageUrl(req: Request, row: DocumentRow) {
  return `${req.protocol}://${req.get("host")}/images/${basename(row.imagePath)}`;
}

function toSummary(req: Request, row: DocumentRow) {
  return {
    id: row.id,
    image: { uri: imageUrl(req, row), width: row.imageWidth, height: row.imageHeight },
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function toDocument(req: Request, row: DocumentRow) {
  return { ...toSummary(req, row), annotations: row.annotations, createdAt: row.createdAt };
}

/** Builds the API without listening, so tests can run it on a random port. */
export function createApp({ db, uploadsDir }: { db: Db; uploadsDir: string }) {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } });
  const filePath = (row: DocumentRow) => join(uploadsDir, basename(row.imagePath));

  app.use("/images", express.static(uploadsDir));

  app.post("/documents", upload.single("image"), async (req, res) => {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.issues });
    if (!req.file) return res.status(400).json({ error: "image is required" });

    // A retried upload returns the copy the first attempt created. Checked again after
    // the file write, with no await before the insert, so overlapping retries can't both insert.
    const existing = db.get(body.data.id);
    if (existing) return res.status(200).json(toDocument(req, existing));

    const imagePath = `uploads/${body.data.id}.jpg`;
    await writeFile(join(uploadsDir, basename(imagePath)), req.file.buffer);
    const raced = db.get(body.data.id);
    if (raced) return res.status(200).json(toDocument(req, raced));
    db.insert(
      {
        id: body.data.id,
        imagePath,
        imageWidth: body.data.width,
        imageHeight: body.data.height,
        annotations: body.data.annotations,
      },
      Date.now(),
    );
    res.status(201).json(toDocument(req, db.get(body.data.id)!));
  });

  app.get("/documents", (req, res) => {
    res.json(db.list().map((row) => toSummary(req, row)));
  });

  app.get("/documents/:id", (req, res) => {
    const row = db.get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(toDocument(req, row));
  });

  app.put("/documents/:id", express.json({ limit: "5mb" }), (req, res) => {
    const body = updateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.issues });
    const row = db.get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });

    const now = Date.now();
    if (!db.update(row.id, body.data.annotations, body.data.version, now)) {
      return res.status(409).json({ error: "version is stale", version: row.version });
    }
    res.json({ version: body.data.version + 1, updatedAt: now });
  });

  app.delete("/documents/:id", async (req, res) => {
    const row = db.get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });
    db.delete(row.id);
    await rm(filePath(row), { force: true });
    res.status(204).end();
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = err instanceof multer.MulterError ? 400 : (err.status ?? 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "internal error" : err.message });
  };
  app.use(onError);

  return app;
}
