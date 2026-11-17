import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const uploadsDir = `${root}uploads`;
mkdirSync(uploadsDir, { recursive: true });

const db = openDb(`${root}data.db`);
const port = Number(process.env.PORT ?? 3000);

createApp({ db, uploadsDir }).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
