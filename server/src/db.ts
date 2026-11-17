import { DatabaseSync } from "node:sqlite";

import type { Annotation } from "../../src/utils/annotations/types.ts";

export type DocumentRow = {
  id: string;
  imagePath: string;
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  version: number;
  createdAt: number;
  updatedAt: number;
};

type SqlRow = {
  id: string;
  image_path: string;
  image_width: number;
  image_height: number;
  annotations: string;
  version: number;
  created_at: number;
  updated_at: number;
};

function fromSql(row: SqlRow): DocumentRow {
  return {
    id: row.id,
    imagePath: row.image_path,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    annotations: JSON.parse(row.annotations),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Opens (or creates) the database and returns the queries the routes need. */
export function openDb(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id           TEXT PRIMARY KEY,
      image_path   TEXT NOT NULL,
      image_width  INTEGER NOT NULL,
      image_height INTEGER NOT NULL,
      annotations  TEXT NOT NULL,
      version      INTEGER NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    )
  `);

  const selectOne = db.prepare("SELECT * FROM documents WHERE id = ?");
  const selectAll = db.prepare("SELECT * FROM documents ORDER BY updated_at DESC");
  const insert = db.prepare(`
    INSERT INTO documents (id, image_path, image_width, image_height, annotations, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  // The version check is in the WHERE clause, so two saves can't both pass it.
  const update = db.prepare(`
    UPDATE documents SET annotations = ?, version = version + 1, updated_at = ?
    WHERE id = ? AND version = ?
  `);
  const remove = db.prepare("DELETE FROM documents WHERE id = ?");

  return {
    get(id: string): DocumentRow | undefined {
      const row = selectOne.get(id) as SqlRow | undefined;
      return row && fromSql(row);
    },
    list(): DocumentRow[] {
      return (selectAll.all() as SqlRow[]).map(fromSql);
    },
    insert(doc: Omit<DocumentRow, "version" | "createdAt" | "updatedAt">, now: number): void {
      insert.run(doc.id, doc.imagePath, doc.imageWidth, doc.imageHeight, JSON.stringify(doc.annotations), now, now);
    },
    /** @returns false if the row is missing or `version` is stale. */
    update(id: string, annotations: Annotation[], version: number, now: number): boolean {
      return update.run(JSON.stringify(annotations), now, id, version).changes === 1;
    },
    delete(id: string): boolean {
      return remove.run(id).changes === 1;
    },
    close(): void {
      db.close();
    },
  };
}

export type Db = ReturnType<typeof openDb>;
