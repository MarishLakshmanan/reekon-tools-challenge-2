import { fileURLToPath } from "node:url";

import { hashPassword } from "./auth.ts";
import { openDb } from "./db.ts";

const ORG = { id: "org1", name: "Reekon Interiors" };

// Dev logins only. Ids are fixed so the seed can run more than once.
const USERS = [
  { id: "u1", email: "asha@reekon.test", name: "Asha", password: "asha-pass" },
  { id: "u2", email: "ben@reekon.test", name: "Ben", password: "ben-pass" },
  { id: "u3", email: "chen@reekon.test", name: "Chen", password: "chen-pass" },
  { id: "u4", email: "dara@reekon.test", name: "Dara", password: "dara-pass" },
];

const root = fileURLToPath(new URL("..", import.meta.url));
const db = openDb(`${root}data.db`);
const now = Date.now();

db.insertOrg(ORG, now);
for (const { password, ...user } of USERS) {
  db.insertUser({ ...user, orgId: ORG.id, passwordHash: hashPassword(password) }, now);
}
db.close();

console.log(`Seeded "${ORG.name}":`);
for (const u of USERS) console.log(`  ${u.email}  ${u.password}`);
