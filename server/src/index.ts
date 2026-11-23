import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { openrouterModel } from "./ai/agent.ts";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const uploadsDir = `${root}uploads`;
mkdirSync(uploadsDir, { recursive: true });

const db = openDb(`${root}data.db`);
const port = Number(process.env.PORT ?? 3000);

const model = process.env.OPENROUTER_API_KEY ? openrouterModel() : undefined;
if (!model) console.warn("OPENROUTER_API_KEY is not set: the AI route is off.");

createApp({ db, uploadsDir, model }).listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
