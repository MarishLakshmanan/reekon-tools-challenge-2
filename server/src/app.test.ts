import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { createApp } from "./app.ts";
import { openDb } from "./db.ts";

const textAnnotation = { id: "t1", kind: "text", position: { x: 1, y: 2 }, text: "hi", fontSize: 20, color: "#fff" };

let base: string;
let uploadsDir: string;
let close: () => void;

before(async () => {
  uploadsDir = mkdtempSync(join(tmpdir(), "uploads-"));
  const db = openDb(":memory:");
  const server = createApp({ db, uploadsDir }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
  close = () => {
    server.close();
    db.close();
    rmSync(uploadsDir, { recursive: true, force: true });
  };
});

after(() => close());

function upload(id: string, annotations: unknown = []) {
  const form = new FormData();
  form.append("id", id);
  form.append("width", "400");
  form.append("height", "300");
  form.append("annotations", JSON.stringify(annotations));
  form.append("image", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "image.jpg");
  return fetch(`${base}/documents`, { method: "POST", body: form });
}

function put(id: string, body: unknown) {
  return fetch(`${base}/documents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("documents API", () => {
  test("POST creates a document, and a retry returns it instead of a duplicate", async () => {
    const first = await upload("abc1", [textAnnotation]);
    assert.equal(first.status, 201);
    const doc = await first.json();
    assert.equal(doc.version, 1);
    assert.deepEqual(doc.annotations, [textAnnotation]);
    assert.equal(doc.image.uri, `${base}/images/abc1.jpg`);
    assert.ok(existsSync(join(uploadsDir, "abc1.jpg")));

    const retry = await upload("abc1");
    assert.equal(retry.status, 200);
    assert.deepEqual((await retry.json()).annotations, [textAnnotation]);

    const list = await (await fetch(`${base}/documents`)).json();
    assert.equal(list.filter((d: { id: string }) => d.id === "abc1").length, 1);
  });

  test("GET list omits annotations; GET by id and the image are served", async () => {
    await upload("list1");
    const list = await (await fetch(`${base}/documents`)).json();
    const item = list.find((d: { id: string }) => d.id === "list1");
    assert.deepEqual(Object.keys(item).sort(), ["id", "image", "updatedAt", "version"]);

    const doc = await (await fetch(`${base}/documents/list1`)).json();
    assert.deepEqual(doc.annotations, []);
    assert.deepEqual(doc.image, { uri: `${base}/images/list1.jpg`, width: 400, height: 300 });

    const image = await fetch(doc.image.uri);
    assert.equal(image.status, 200);
  });

  test("PUT bumps the version, and a stale version gets 409", async () => {
    await upload("put1");
    const ok = await put("put1", { annotations: [textAnnotation], version: 1 });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).version, 2);

    const stale = await put("put1", { annotations: [], version: 1 });
    assert.equal(stale.status, 409);
    const doc = await (await fetch(`${base}/documents/put1`)).json();
    assert.deepEqual(doc.annotations, [textAnnotation]);
  });

  test("invalid annotations get 400", async () => {
    await upload("bad1");
    assert.equal((await put("bad1", { annotations: [{ kind: "circle" }], version: 1 })).status, 400);
    assert.equal((await upload("bad2", [{ id: "x", kind: "text" }])).status, 400);
    assert.equal((await fetch(`${base}/documents/bad2`)).status, 404);
  });

  test("DELETE removes the row and the image file", async () => {
    await upload("del1");
    const res = await fetch(`${base}/documents/del1`, { method: "DELETE" });
    assert.equal(res.status, 204);
    assert.equal((await fetch(`${base}/documents/del1`)).status, 404);
    assert.ok(!existsSync(join(uploadsDir, "del1.jpg")));
  });

  test("unknown ids get 404", async () => {
    assert.equal((await fetch(`${base}/documents/nope`)).status, 404);
    assert.equal((await put("nope", { annotations: [], version: 1 })).status, 404);
    assert.equal((await fetch(`${base}/documents/nope`, { method: "DELETE" })).status, 404);
  });
});
