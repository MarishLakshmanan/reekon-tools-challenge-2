# Phase 3 — Users, Organization, and Projects

## 1. Goal

Add users and projects. Data is organized as **Organization → Projects → Photos (with annotations)**. Users sign in with an email and password; there is no sign-up. One organization and its users are created by a seed script. A signed-in user can create projects, and the creator becomes the project's owner. Only the owner can add or remove members and delete the project. Every member of a project can view, annotate, save, and delete its photos.

## 2. Dependencies

Server: no new packages.
- **`node:crypto`** — `scrypt` hashes passwords, `randomBytes` makes session tokens.

App (install with `npx expo install`):

| Package | Why |
| --- | --- |
| `expo-secure-store` | Keeps the session token in the device keychain/keystore, not in a plain file. Included in Expo Go (SDK 58). |

Considered, not adding:
- **JWT library** — see Decision Log.
- **Auth service (Clerk, Supabase Auth)** — a fixed, seeded user list doesn't need one.

## 3. Database

```sql
CREATE TABLE organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,      -- scrypt: salt + hash
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,      -- random 32 bytes, hex
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id),
  owner_id   TEXT NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at   INTEGER NOT NULL,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE documents (
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

CREATE INDEX documents_project ON documents(project_id);
CREATE INDEX project_members_user ON project_members(user_id);
```

How they connect:

```
organizations 1──* users
organizations 1──* projects
users         1──* projects          (owner_id)
projects      *──* users             (project_members)
projects      1──* documents
```

Rules:
- `PRAGMA foreign_keys = ON` when the database opens; SQLite ignores `REFERENCES` without it.
- **The owner is also a row in `project_members`.** Creating a project inserts both rows in one transaction, so "can this user open this project?" is one lookup in `project_members`.
- A member being added must have the same `org_id` as the project. Checked in the route.
- `documents` is the Phase 2 table plus `project_id` and `created_by`.

## 4. Auth

- **Sign in:** `POST /auth/sign-in` with email and password. The server checks the scrypt hash and creates a `sessions` row that expires in 30 days.
- **Requests:** the app sends `Authorization: Bearer <token>`. Middleware looks up the token, rejects missing or expired ones with `401`, and puts the user on the request.
- **Sign out:** deletes the session row. The app deletes the token from SecureStore.
- **Seed:** `npm run seed` (`server/src/seed.ts`) creates one organization and a fixed list of users with known dev passwords. It is safe to run twice (`INSERT OR IGNORE`).

## 5. API Endpoints

All routes except sign-in need a valid token.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/auth/sign-in` | JSON `{ email, password }` | `200 { token, user }`. `401` on a wrong email or password (same message for both). |
| `POST` | `/auth/sign-out` | — | `204`. |
| `GET` | `/me` | — | The user and their organization `{ id, name }`. |
| `GET` | `/org/users` | — | Users in the caller's organization (`id`, `name`, `email`), for the add-member picker. |
| `GET` | `/projects` | — | Projects the caller is a member of, with `ownerId` and photo count. |
| `POST` | `/projects` | JSON `{ id, name }` | `201` project. The caller becomes owner and member. |
| `GET` | `/projects/:id` | — | Project with its members. |
| `POST` | `/projects/:id/members` | JSON `{ userId }` | `201`. Owner only (`403` otherwise). `400` if the user is in another organization; `200` if already a member. |
| `DELETE` | `/projects/:id/members/:userId` | — | `204`. Owner only (`403` otherwise). `400` if `userId` is the owner; `404` if not a member. The removed user's photos stay in the project. |
| `DELETE` | `/projects/:id` | — | `204`. Owner only (`403` otherwise). Deletes the project, its members, its photos, and their image files. |
| `GET` | `/projects/:id/documents` | — | Same list as Phase 2 `GET /documents`, for one project. |
| `POST` | `/projects/:id/documents` | Same multipart as Phase 2 | Same as Phase 2. |
| `GET` `PUT` `DELETE` | `/documents/:id` | Same as Phase 2 | Same as Phase 2. |
| `GET` | `/images/:file` | — | The image file. |

Documents return `image.uri` as a path (`/images/<file>`); the app adds `EXPO_PUBLIC_API_URL` in front.

Access: for project and document routes, the caller must be in `project_members` for that project, otherwise `404` (a non-member can't tell whether the project exists). Document routes find the project through `documents.project_id`. `/images/:file` checks the same way through the document that owns the file.

## 6. App Changes

Routes (in `src/app/`):

| Route | Screen |
| --- | --- |
| `sign-in.tsx` | Email and password form. |
| `index.tsx` | Home: organization name at the top, the signed-in user's name and email, their projects below, a "New project" button, and Sign out. |
| `projects/[projectId]/index.tsx` | The project's photos (the Phase 2 home list), a camera button, the member list, and, for the owner, "Add member". |
| `projects/[projectId]/camera.tsx`, `projects/[projectId]/editor/[id].tsx` | As before, now under the project. |

- **Auth gate:** the root `_layout.tsx` reads the token from SecureStore on start and guards the routes with `Stack.Protected`. No session → `sign-in`. Any `401` from the API clears the token, which sends the user back to `sign-in`.
- **API client:** one fetch helper in `src/api/` adds the `Authorization` header. Thumbnails (`expo-image` source headers) and image downloads send the same header. The editor opens only a local file, because Skia's `useImage` can't send headers, so it downloads the photo first if it isn't on the phone yet.
- **Sync:** the Phase 2 sync runs when a project screen opens, against `GET /projects/:id/documents`, and only for that project's folder.
- **Members:** the owner's "Members" button lists the members, each with Remove (except the owner), and the organization users who can be added (`GET /org/users`, minus current members).
- **Delete project:** the owner's Delete button confirms, calls `DELETE /projects/:id`, deletes the local folder, and goes back.
- **Lost access:** when the home list no longer includes a project, its local folder is deleted. Opening a project that returns `404` does the same, shows an alert, and goes back.
- **Sign out:** if any local photo has unsaved changes, confirm first. Then delete the token and all local files.

## 7. Local Files

```
<app documents>/docs/<projectId>/<docId>/
  image.jpg
  doc.json
```

The fixed `project` folder from Phase 2 becomes the real project id. Everything else in Phase 2 Local Files is unchanged.

## 8. Decision Log

| # | Decision | Why |
| --- | --- | --- |
| 1 | No sign-up; users and the organization come from a seed script. | The user list is fixed for now. Sign-up adds email checks, password reset, and invites, none of which we need yet. |
| 2 | One organization only, but the schema has `organizations` and `org_id`. | Only one org exists today, but keeping the table means adding a second org later is data, not a migration. |
| 3 | A user belongs to exactly one organization (`users.org_id`, no join table). | Simplest model that fits. Change to an `org_members` table only if a user ever needs several orgs. |
| 4 | No per-member permissions; every project member can read, write, and delete. | Fine-grained roles (read-only, can-measure, etc.) are possible later as a `role` column on `project_members`. Only member management and project deletion are restricted, and that is answered by `projects.owner_id`. |
| 5 | Opaque session tokens in a `sessions` table, not JWTs. | One server and one database, so a lookup per request is cheap. Sign-out and revoking are a row delete; a JWT stays valid until it expires. |
| 6 | Hash passwords with `scrypt` from `node:crypto`. | Built into Node, no native build step (unlike `bcrypt`). |
| 7 | Store the token in `expo-secure-store`. | It is a credential; a plain file or AsyncStorage can be read off a rooted or backed-up device. |
| 8 | Phase 2 data is not migrated; the database is recreated and seeded. | Phase 2 photos were test data with no owner or project to assign them to. |
| 9 | Sign out deletes all local files. | Local files aren't separated by user, so the next user on the same phone would otherwise see them. Confirming when there are unsaved changes prevents losing work. |
| 10 | The API returns image paths (`/images/<file>`), not full URLs; the app adds its own base URL. Replaces Phase 2 decision 10's per-request URL. | The server built the URL from the request's Host header, which the dev tunnel rewrites to `localhost`, so other users' photo downloads failed. The app already knows the server's address. |
| 11 | Losing access to a project deletes its local folder, unsaved edits included. | The user can no longer save to it, and its photos shouldn't stay readable on the phone. |
