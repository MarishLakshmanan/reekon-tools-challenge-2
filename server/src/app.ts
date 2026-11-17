import { rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import express from "express";
import type { ErrorRequestHandler, Request, Response } from "express";
import multer from "multer";

import { currentUser, newToken, requireUser, SESSION_MS, verifyPassword } from "./auth.ts";
import type { Db, DocumentRow, ProjectRow, UserRow } from "./db.ts";
import { addMemberSchema, createProjectSchema, createSchema, signInSchema, updateSchema } from "./schema.ts";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// A path, not a full URL: the app adds the server address it is configured with. The request's
// Host header can't be trusted for this, since a tunnel or proxy rewrites it.
function imagePath(row: DocumentRow) {
  return `/images/${basename(row.imagePath)}`;
}

function toSummary(row: DocumentRow) {
  return {
    id: row.id,
    projectId: row.projectId,
    image: { uri: imagePath(row), width: row.imageWidth, height: row.imageHeight },
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function toDocument(row: DocumentRow) {
  return { ...toSummary(row), annotations: row.annotations, createdAt: row.createdAt };
}

const toPublicUser = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email });

const toProject = (p: ProjectRow) => ({ id: p.id, name: p.name, ownerId: p.ownerId, createdAt: p.createdAt });

const notFound = (res: Response) => res.status(404).json({ error: "not found" });

/** Builds the API without listening, so tests can run it on a random port. */
export function createApp({ db, uploadsDir }: { db: Db; uploadsDir: string }) {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } });
  const filePath = (row: DocumentRow) => join(uploadsDir, basename(row.imagePath));

  /**
   * The project, if it exists and the caller is a member. Non-members get the same 404 as a
   * missing project, so ids don't reveal projects they can't see.
   */
  function memberProject(req: Request, res: Response): ProjectRow | undefined {
    const user = currentUser(res);
    const project = db.getProject(String(req.params.id));
    if (!project || !db.isMember(project.id, user.id)) {
      notFound(res);
      return undefined;
    }
    return project;
  }

  /** The document, if it exists and the caller is a member of its project. */
  function memberDocument(req: Request, res: Response): DocumentRow | undefined {
    const row = db.getDocument(String(req.params.id));
    if (!row || !db.isMember(row.projectId, currentUser(res).id)) {
      notFound(res);
      return undefined;
    }
    return row;
  }

  app.post("/auth/sign-in", express.json(), (req, res) => {
    const body = signInSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.issues });
    const user = db.getUserByEmail(body.data.email);
    // One message for both failures, so the response doesn't reveal which emails exist.
    if (!user || !verifyPassword(body.data.password, user.passwordHash)) {
      return res.status(401).json({ error: "wrong email or password" });
    }
    const token = newToken();
    db.createSession(token, user.id, Date.now() + SESSION_MS);
    res.json({ token, user: toPublicUser(user) });
  });

  app.use(requireUser(db));

  app.post("/auth/sign-out", (_req, res) => {
    db.deleteSession(res.locals.token);
    res.status(204).end();
  });

  app.get("/me", (_req, res) => {
    const user = currentUser(res);
    res.json({ user: toPublicUser(user), org: db.getOrg(user.orgId) });
  });

  app.get("/org/users", (_req, res) => {
    res.json(db.listOrgUsers(currentUser(res).orgId).map(toPublicUser));
  });

  app.get("/projects", (_req, res) => {
    res.json(
      db.listProjectsForUser(currentUser(res).id).map((p) => ({
        ...toProject(p),
        memberCount: p.memberCount,
        documentCount: p.documentCount,
      })),
    );
  });

  app.post("/projects", express.json(), (req, res) => {
    const body = createProjectSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.issues });
    const user = currentUser(res);
    // A retried create returns the project the first attempt made.
    const existing = db.getProject(body.data.id);
    if (existing) {
      if (existing.ownerId !== user.id) return res.status(409).json({ error: "id already in use" });
      return res.status(200).json(toProject(existing));
    }
    db.createProject({ id: body.data.id, orgId: user.orgId, ownerId: user.id, name: body.data.name }, Date.now());
    res.status(201).json(toProject(db.getProject(body.data.id)!));
  });

  app.get("/projects/:id", (req, res) => {
    const project = memberProject(req, res);
    if (!project) return;
    res.json({ ...toProject(project), members: db.listMembers(project.id).map(toPublicUser) });
  });

  app.post("/projects/:id/members", express.json(), (req, res) => {
    const project = memberProject(req, res);
    if (!project) return;
    if (project.ownerId !== currentUser(res).id) return res.status(403).json({ error: "only the owner can add members" });
    const body = addMemberSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.issues });
    const target = db.getUser(body.data.userId);
    if (!target || target.orgId !== project.orgId) return res.status(400).json({ error: "not a user in this organization" });
    const added = db.addMember(project.id, target.id, Date.now());
    res.status(added ? 201 : 200).json(toPublicUser(target));
  });

  app.delete("/projects/:id", async (req, res) => {
    const project = memberProject(req, res);
    if (!project) return;
    if (project.ownerId !== currentUser(res).id) return res.status(403).json({ error: "only the owner can delete the project" });
    // Read the files first: the cascade removes the rows that point to them.
    const docs = db.listDocuments(project.id);
    db.deleteProject(project.id);
    await Promise.all(docs.map((row) => rm(filePath(row), { force: true })));
    res.status(204).end();
  });

  app.delete("/projects/:id/members/:userId", (req, res) => {
    const project = memberProject(req, res);
    if (!project) return;
    if (project.ownerId !== currentUser(res).id) return res.status(403).json({ error: "only the owner can remove members" });
    if (req.params.userId === project.ownerId) return res.status(400).json({ error: "the owner can't be removed" });
    if (!db.removeMember(project.id, String(req.params.userId))) return notFound(res);
    res.status(204).end();
  });

  app.get("/projects/:id/documents", (req, res) => {
    const project = memberProject(req, res);
    if (!project) return;
    res.json(db.listDocuments(project.id).map((row) => toSummary(row)));
  });

  app.post("/projects/:id/documents", upload.single("image"), async (req, res) => {
    const project = memberProject(req, res);
    if (!project) return;
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.issues });
    if (!req.file) return res.status(400).json({ error: "image is required" });

    // A retried upload returns the copy the first attempt created. Checked again after
    // the file write, with no await before the insert, so overlapping retries can't both insert.
    // Another project's document with this id is treated as taken, never returned.
    const taken = (existing: DocumentRow | undefined) =>
      existing && (existing.projectId === project.id ? res.status(200).json(toDocument(existing)) : res.status(409).json({ error: "id already in use" }));
    if (taken(db.getDocument(body.data.id))) return;

    const imagePath = `uploads/${body.data.id}.jpg`;
    await writeFile(join(uploadsDir, basename(imagePath)), req.file.buffer);
    if (taken(db.getDocument(body.data.id))) return;
    db.insertDocument(
      {
        id: body.data.id,
        projectId: project.id,
        createdBy: currentUser(res).id,
        imagePath,
        imageWidth: body.data.width,
        imageHeight: body.data.height,
        annotations: body.data.annotations,
      },
      Date.now(),
    );
    res.status(201).json(toDocument(db.getDocument(body.data.id)!));
  });

  app.get("/documents/:id", (req, res) => {
    const row = memberDocument(req, res);
    if (row) res.json(toDocument(row));
  });

  app.put("/documents/:id", express.json({ limit: "5mb" }), (req, res) => {
    const body = updateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: body.error.issues });
    const row = memberDocument(req, res);
    if (!row) return;

    const now = Date.now();
    if (!db.updateDocument(row.id, body.data.annotations, body.data.version, now)) {
      return res.status(409).json({ error: "version is stale", version: row.version });
    }
    res.json({ version: body.data.version + 1, updatedAt: now });
  });

  app.delete("/documents/:id", async (req, res) => {
    const row = memberDocument(req, res);
    if (!row) return;
    db.deleteDocument(row.id);
    await rm(filePath(row), { force: true });
    res.status(204).end();
  });

  app.get("/images/:file", (req, res) => {
    const row = db.getDocumentByImage(`uploads/${basename(String(req.params.file))}`);
    if (!row || !db.isMember(row.projectId, currentUser(res).id)) return notFound(res);
    res.sendFile(filePath(row));
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = err instanceof multer.MulterError ? 400 : (err.status ?? 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "internal error" : err.message });
  };
  app.use(onError);

  return app;
}
