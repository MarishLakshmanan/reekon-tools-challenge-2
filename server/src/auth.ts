import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";

import type { Db, UserRow } from "./db.ts";

export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const KEY_LENGTH = 64;

/** @returns `salt:hash`, both hex. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, KEY_LENGTH).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

/** The user set by `requireUser`. */
export function currentUser(res: { locals: Record<string, unknown> }): UserRow {
  return res.locals.user as UserRow;
}

/** Rejects requests without a valid, unexpired `Authorization: Bearer <token>`. */
export function requireUser(db: Db): RequestHandler {
  return (req, res, next) => {
    const token = req.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    const user = token && db.getSessionUser(token, Date.now());
    if (!user) return res.status(401).json({ error: "not signed in" });
    res.locals.user = user;
    res.locals.token = token;
    next();
  };
}
