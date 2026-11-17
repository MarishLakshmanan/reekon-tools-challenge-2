import { DatabaseSync } from "node:sqlite";

import type { Annotation } from "../../src/utils/annotations/types.ts";

export type DocumentRow = {
  id: string;
  projectId: string;
  createdBy: string;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  version: number;
  createdAt: number;
  updatedAt: number;
};

export type UserRow = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  passwordHash: string;
};

type OrgRow = { id: string; name: string };

export type ProjectRow = {
  id: string;
  orgId: string;
  ownerId: string;
  name: string;
  createdAt: number;
};

type ProjectSummary = ProjectRow & { memberCount: number; documentCount: number };

type SqlDocument = {
  id: string;
  project_id: string;
  created_by: string;
  image_path: string;
  image_width: number;
  image_height: number;
  annotations: string;
  version: number;
  created_at: number;
  updated_at: number;
};

type SqlUser = { id: string; org_id: string; email: string; name: string; password_hash: string };
type SqlProject = { id: string; org_id: string; owner_id: string; name: string; created_at: number };
type SqlProjectSummary = SqlProject & { member_count: number; document_count: number };

function documentFromSql(row: SqlDocument): DocumentRow {
  return {
    id: row.id,
    projectId: row.project_id,
    createdBy: row.created_by,
    imagePath: row.image_path,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    annotations: JSON.parse(row.annotations),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userFromSql(row: SqlUser): UserRow {
  return { id: row.id, orgId: row.org_id, email: row.email, name: row.name, passwordHash: row.password_hash };
}

function projectFromSql(row: SqlProject): ProjectRow {
  return { id: row.id, orgId: row.org_id, ownerId: row.owner_id, name: row.name, createdAt: row.created_at };
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS organizations (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    org_id        TEXT NOT NULL REFERENCES organizations(id),
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id         TEXT PRIMARY KEY,
    org_id     TEXT NOT NULL REFERENCES organizations(id),
    owner_id   TEXT NOT NULL REFERENCES users(id),
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at   INTEGER NOT NULL,
    PRIMARY KEY (project_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS documents (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by   TEXT NOT NULL REFERENCES users(id),
    image_path   TEXT NOT NULL,
    image_width  INTEGER NOT NULL,
    image_height INTEGER NOT NULL,
    annotations  TEXT NOT NULL,
    version      INTEGER NOT NULL,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS documents_project ON documents(project_id);
  CREATE INDEX IF NOT EXISTS project_members_user ON project_members(user_id);
`;

/** Opens (or creates) the database and returns the queries the routes need. */
export function openDb(path: string) {
  const db = new DatabaseSync(path);
  // SQLite ignores REFERENCES (and ON DELETE CASCADE) unless this is on, per connection.
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);

  const q = {
    insertOrg: db.prepare("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)"),
    selectOrg: db.prepare("SELECT id, name FROM organizations WHERE id = ?"),
    insertUser: db.prepare(
      "INSERT OR IGNORE INTO users (id, org_id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ),
    userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    usersInOrg: db.prepare("SELECT * FROM users WHERE org_id = ? ORDER BY name"),

    insertSession: db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"),
    sessionUser: db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?
    `),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),

    insertProject: db.prepare(
      "INSERT INTO projects (id, org_id, owner_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
    ),
    insertMember: db.prepare(
      "INSERT OR IGNORE INTO project_members (project_id, user_id, added_at) VALUES (?, ?, ?)",
    ),
    projectById: db.prepare("SELECT * FROM projects WHERE id = ?"),
    projectsForUser: db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count,
        (SELECT COUNT(*) FROM documents WHERE project_id = p.id) AS document_count
      FROM projects p JOIN project_members m ON m.project_id = p.id
      WHERE m.user_id = ?
      ORDER BY p.created_at DESC
    `),
    membersOf: db.prepare(`
      SELECT u.* FROM project_members m JOIN users u ON u.id = m.user_id
      WHERE m.project_id = ? ORDER BY u.name
    `),
    deleteProject: db.prepare("DELETE FROM projects WHERE id = ?"),
    removeMember: db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?"),
    isMember: db.prepare("SELECT 1 AS found FROM project_members WHERE project_id = ? AND user_id = ?"),

    docOne: db.prepare("SELECT * FROM documents WHERE id = ?"),
    docByImage: db.prepare("SELECT * FROM documents WHERE image_path = ?"),
    docsInProject: db.prepare("SELECT * FROM documents WHERE project_id = ? ORDER BY updated_at DESC"),
    insertDoc: db.prepare(`
      INSERT INTO documents (id, project_id, created_by, image_path, image_width, image_height, annotations, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `),
    // The version check is in the WHERE clause, so two saves can't both pass it.
    updateDoc: db.prepare(`
      UPDATE documents SET annotations = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `),
    deleteDoc: db.prepare("DELETE FROM documents WHERE id = ?"),
  };

  return {
    // Organizations and users (the seed script is the only writer).
    insertOrg(org: OrgRow, now: number): void {
      q.insertOrg.run(org.id, org.name, now);
    },
    getOrg(id: string): OrgRow | undefined {
      return q.selectOrg.get(id) as OrgRow | undefined;
    },
    insertUser(user: UserRow, now: number): void {
      q.insertUser.run(user.id, user.orgId, user.email, user.name, user.passwordHash, now);
    },
    getUserByEmail(email: string): UserRow | undefined {
      const row = q.userByEmail.get(email) as SqlUser | undefined;
      return row && userFromSql(row);
    },
    getUser(id: string): UserRow | undefined {
      const row = q.userById.get(id) as SqlUser | undefined;
      return row && userFromSql(row);
    },
    listOrgUsers(orgId: string): UserRow[] {
      return (q.usersInOrg.all(orgId) as SqlUser[]).map(userFromSql);
    },

    // Sessions.
    createSession(token: string, userId: string, expiresAt: number): void {
      q.insertSession.run(token, userId, expiresAt);
    },
    /** The signed-in user, or undefined for an unknown or expired token. */
    getSessionUser(token: string, now: number): UserRow | undefined {
      const row = q.sessionUser.get(token, now) as SqlUser | undefined;
      return row && userFromSql(row);
    },
    deleteSession(token: string): void {
      q.deleteSession.run(token);
    },

    // Projects.
    /** Inserts the project and its owner's member row together. */
    createProject(project: Omit<ProjectRow, "createdAt">, now: number): void {
      db.exec("BEGIN");
      try {
        q.insertProject.run(project.id, project.orgId, project.ownerId, project.name, now);
        q.insertMember.run(project.id, project.ownerId, now);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    /** Also removes its members and documents (ON DELETE CASCADE). Image files are the caller's job. */
    deleteProject(id: string): void {
      q.deleteProject.run(id);
    },
    getProject(id: string): ProjectRow | undefined {
      const row = q.projectById.get(id) as SqlProject | undefined;
      return row && projectFromSql(row);
    },
    listProjectsForUser(userId: string): ProjectSummary[] {
      return (q.projectsForUser.all(userId) as SqlProjectSummary[]).map((row) => ({
        ...projectFromSql(row),
        memberCount: row.member_count,
        documentCount: row.document_count,
      }));
    },
    listMembers(projectId: string): UserRow[] {
      return (q.membersOf.all(projectId) as SqlUser[]).map(userFromSql);
    },
    isMember(projectId: string, userId: string): boolean {
      return q.isMember.get(projectId, userId) !== undefined;
    },
    /** @returns false if the user was not a member. */
    removeMember(projectId: string, userId: string): boolean {
      return q.removeMember.run(projectId, userId).changes === 1;
    },
    /** @returns false if the user was already a member. */
    addMember(projectId: string, userId: string, now: number): boolean {
      return q.insertMember.run(projectId, userId, now).changes === 1;
    },

    // Documents.
    getDocument(id: string): DocumentRow | undefined {
      const row = q.docOne.get(id) as SqlDocument | undefined;
      return row && documentFromSql(row);
    },
    getDocumentByImage(imagePath: string): DocumentRow | undefined {
      const row = q.docByImage.get(imagePath) as SqlDocument | undefined;
      return row && documentFromSql(row);
    },
    listDocuments(projectId: string): DocumentRow[] {
      return (q.docsInProject.all(projectId) as SqlDocument[]).map(documentFromSql);
    },
    insertDocument(doc: Omit<DocumentRow, "version" | "createdAt" | "updatedAt">, now: number): void {
      q.insertDoc.run(
        doc.id,
        doc.projectId,
        doc.createdBy,
        doc.imagePath,
        doc.imageWidth,
        doc.imageHeight,
        JSON.stringify(doc.annotations),
        now,
        now,
      );
    },
    /** @returns false if the row is missing or `version` is stale. */
    updateDocument(id: string, annotations: Annotation[], version: number, now: number): boolean {
      return q.updateDoc.run(JSON.stringify(annotations), now, id, version).changes === 1;
    },
    deleteDocument(id: string): void {
      q.deleteDoc.run(id);
    },
    close(): void {
      db.close();
    },
  };
}

export type Db = ReturnType<typeof openDb>;
