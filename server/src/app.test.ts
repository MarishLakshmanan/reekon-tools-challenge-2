import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { MockLanguageModelV4 } from "ai/test";

import { createApp } from "./app.ts";
import { hashPassword } from "./auth.ts";
import { openDb } from "./db.ts";

const textAnnotation = { id: "t1", kind: "text", position: { x: 1, y: 2 }, text: "hi", fontSize: 20, color: "#fff" };

const PASSWORD = "pw";
const USERS = [
  { id: "u1", orgId: "org1", email: "a@test", name: "A" },
  { id: "u2", orgId: "org1", email: "b@test", name: "B" },
  { id: "u3", orgId: "org1", email: "c@test", name: "C" },
  { id: "u9", orgId: "org2", email: "z@test", name: "Z" },
];

/** What the mock model answers with, in order. An `Error` makes that call fail. */
const replies: (string | Error)[] = [];
const model = new MockLanguageModelV4({
  doGenerate: async () => {
    const reply = replies.shift();
    if (reply === undefined) throw new Error("no reply queued");
    if (reply instanceof Error) throw reply;
    return {
      content: [{ type: "text", text: reply }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    };
  },
});

let base: string;
let uploadsDir: string;
let close: () => void;
const tokens: Record<string, string> = {};

before(async () => {
  uploadsDir = mkdtempSync(join(tmpdir(), "uploads-"));
  const db = openDb(":memory:");
  db.insertOrg({ id: "org1", name: "Org One" }, 0);
  db.insertOrg({ id: "org2", name: "Org Two" }, 0);
  const passwordHash = hashPassword(PASSWORD);
  for (const u of USERS) db.insertUser({ ...u, passwordHash }, 0);

  const server = createApp({ db, uploadsDir, model }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
  close = () => {
    server.close();
    db.close();
    rmSync(uploadsDir, { recursive: true, force: true });
  };

  for (const u of USERS) {
    const res = await fetch(`${base}/auth/sign-in`, json("POST", { email: u.email, password: PASSWORD }));
    tokens[u.id] = (await res.json()).token;
  }
});

after(() => close());

function json(method: string, body: unknown, token?: string): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  };
}

const as = (user: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${tokens[user]}` },
});

const get = (path: string, user = "u1") => fetch(`${base}${path}`, as(user));

/** u1 creates a project; u2 is added as a member, u3 is not. */
async function makeProject(id: string, members: string[] = []) {
  const res = await fetch(`${base}/projects`, as("u1", json("POST", { id, name: `Project ${id}` })));
  assert.equal(res.status, 201);
  for (const userId of members) {
    const added = await fetch(`${base}/projects/${id}/members`, as("u1", json("POST", { userId })));
    assert.equal(added.status, 201);
  }
}

function upload(projectId: string, id: string, annotations: unknown = [], user = "u1") {
  const form = new FormData();
  form.append("id", id);
  form.append("width", "400");
  form.append("height", "300");
  form.append("annotations", JSON.stringify(annotations));
  form.append("image", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "image.jpg");
  return fetch(`${base}/projects/${projectId}/documents`, as(user, { method: "POST", body: form }));
}

const put = (id: string, body: unknown, user = "u1") => fetch(`${base}/documents/${id}`, as(user, json("PUT", body)));

describe("auth", () => {
  test("a wrong password or unknown email gets the same 401", async () => {
    const wrongPassword = await fetch(`${base}/auth/sign-in`, json("POST", { email: "a@test", password: "nope" }));
    const unknownEmail = await fetch(`${base}/auth/sign-in`, json("POST", { email: "x@test", password: PASSWORD }));
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(await wrongPassword.json(), await unknownEmail.json());
  });

  test("CORS: preflights pass without a token, and responses allow any origin", async () => {
    const preflight = await fetch(`${base}/projects`, {
      method: "OPTIONS",
      headers: { Origin: "http://web.test", "Access-Control-Request-Method": "GET" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /Authorization/);

    const res = await fetch(`${base}/projects`, as("u1"));
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  });

  test("routes need a valid token", async () => {
    assert.equal((await fetch(`${base}/projects`)).status, 401);
    assert.equal((await fetch(`${base}/projects`, { headers: { Authorization: "Bearer bad" } })).status, 401);
  });

  test("/me returns the user and the organization; sign-out ends the session", async () => {
    const signIn = await fetch(`${base}/auth/sign-in`, json("POST", { email: " A@test ", password: PASSWORD }));
    const { token } = await signIn.json();
    const headers = { Authorization: `Bearer ${token}` };

    const me = await (await fetch(`${base}/me`, { headers })).json();
    assert.deepEqual(me, { user: { id: "u1", name: "A", email: "a@test" }, org: { id: "org1", name: "Org One" } });

    assert.equal((await fetch(`${base}/auth/sign-out`, { method: "POST", headers })).status, 204);
    assert.equal((await fetch(`${base}/me`, { headers })).status, 401);
  });
});

describe("projects", () => {
  test("creator is owner and member; a retried create returns the same project", async () => {
    await makeProject("proj1");
    const retry = await fetch(`${base}/projects`, as("u1", json("POST", { id: "proj1", name: "Project proj1" })));
    assert.equal(retry.status, 200);

    const list = await (await get("/projects")).json();
    const item = list.find((p: { id: string }) => p.id === "proj1");
    assert.equal(item.ownerId, "u1");
    assert.equal(item.memberCount, 1);
    assert.equal(item.documentCount, 0);

    const hijack = await fetch(`${base}/projects`, as("u2", json("POST", { id: "proj1", name: "mine" })));
    assert.equal(hijack.status, 409);
  });

  test("a blank name is rejected", async () => {
    const res = await fetch(`${base}/projects`, as("u1", json("POST", { id: "blank1", name: "   " })));
    assert.equal(res.status, 400);
  });

  test("non-members get 404 on the project, its documents and its images", async () => {
    await makeProject("priv1");
    assert.equal((await upload("priv1", "privdoc1")).status, 201);

    assert.equal((await get("/projects/priv1", "u3")).status, 404);
    assert.equal((await get("/projects/priv1/documents", "u3")).status, 404);
    assert.equal((await upload("priv1", "privdoc2", [], "u3")).status, 404);
    assert.equal((await get("/documents/privdoc1", "u3")).status, 404);
    assert.equal((await put("privdoc1", { annotations: [], version: 1 }, "u3")).status, 404);
    assert.equal((await fetch(`${base}/documents/privdoc1`, as("u3", { method: "DELETE" }))).status, 404);
    assert.equal((await get("/images/privdoc1.jpg", "u3")).status, 404);

    const list = await (await get("/projects", "u3")).json();
    assert.ok(!list.some((p: { id: string }) => p.id === "priv1"));
  });

  test("only the owner adds members, and only from the same organization", async () => {
    await makeProject("team1", ["u2"]);

    const byMember = await fetch(`${base}/projects/team1/members`, as("u2", json("POST", { userId: "u3" })));
    assert.equal(byMember.status, 403);

    const otherOrg = await fetch(`${base}/projects/team1/members`, as("u1", json("POST", { userId: "u9" })));
    assert.equal(otherOrg.status, 400);
    const unknown = await fetch(`${base}/projects/team1/members`, as("u1", json("POST", { userId: "nobody" })));
    assert.equal(unknown.status, 400);

    const again = await fetch(`${base}/projects/team1/members`, as("u1", json("POST", { userId: "u2" })));
    assert.equal(again.status, 200);

    const project = await (await get("/projects/team1", "u2")).json();
    assert.deepEqual(project.members.map((m: { id: string }) => m.id), ["u1", "u2"]);
  });

  test("the owner deletes a project with its documents and images", async () => {
    await makeProject("gone1", ["u2"]);
    assert.equal((await upload("gone1", "gonedoc1")).status, 201);
    const del = (user: string) => fetch(`${base}/projects/gone1`, as(user, { method: "DELETE" }));

    assert.equal((await del("u2")).status, 403);
    assert.equal((await del("u1")).status, 204);
    assert.equal((await get("/projects/gone1", "u2")).status, 404);
    assert.equal((await get("/documents/gonedoc1")).status, 404);
    assert.ok(!existsSync(join(uploadsDir, "gonedoc1.jpg")));
    const list = await (await get("/projects", "u2")).json();
    assert.ok(!list.some((p: { id: string }) => p.id === "gone1"));
  });

  test("only the owner removes members, and the owner can't be removed", async () => {
    await makeProject("rm1", ["u2", "u3"]);
    assert.equal((await upload("rm1", "rmdoc1")).status, 201);
    const remove = (user: string, target: string) =>
      fetch(`${base}/projects/rm1/members/${target}`, as(user, { method: "DELETE" }));

    assert.equal((await remove("u2", "u3")).status, 403);
    assert.equal((await remove("u1", "u1")).status, 400);
    assert.equal((await remove("u1", "u2")).status, 204);
    assert.equal((await remove("u1", "u2")).status, 404);

    assert.equal((await get("/projects/rm1", "u2")).status, 404);
    assert.equal((await get("/documents/rmdoc1", "u2")).status, 404);
    assert.equal((await get("/images/rmdoc1.jpg", "u2")).status, 404);
    const list = await (await get("/projects", "u2")).json();
    assert.ok(!list.some((p: { id: string }) => p.id === "rm1"));
    assert.equal((await get("/projects/rm1", "u3")).status, 200);
  });

  test("GET /org/users lists only the caller's organization", async () => {
    const users = await (await get("/org/users")).json();
    assert.deepEqual(users.map((u: { id: string }) => u.id), ["u1", "u2", "u3"]);
  });
});

describe("project chat", () => {
  const send = (projectId: string, body: unknown, user: string) =>
    fetch(`${base}/projects/${projectId}/messages`, as(user, json("POST", { body })));
  const read = async (projectId: string, user: string, after = 0) =>
    (await get(`/projects/${projectId}/messages?after=${after}`, user)).json();

  test("the owner and members send and read messages in order, with sender names", async () => {
    await makeProject("chat1", ["u2"]);
    const first = await send("chat1", "  hello  ", "u1");
    assert.equal(first.status, 201);
    const sent = await first.json();
    assert.equal(sent.body, "hello");
    assert.equal(sent.userName, "A");
    assert.equal((await send("chat1", "hi", "u2")).status, 201);

    const list = await read("chat1", "u2");
    assert.deepEqual(
      list.map((m: { userId: string; userName: string; body: string }) => [m.userId, m.userName, m.body]),
      [["u1", "A", "hello"], ["u2", "B", "hi"]],
    );
  });

  test("each project has its own chat", async () => {
    await makeProject("chat2a");
    await makeProject("chat2b");
    await send("chat2a", "about a", "u1");
    await send("chat2b", "about b", "u1");
    assert.deepEqual((await read("chat2a", "u1")).map((m: { body: string }) => m.body), ["about a"]);
    assert.deepEqual((await read("chat2b", "u1")).map((m: { body: string }) => m.body), ["about b"]);
  });

  test("after returns only newer messages", async () => {
    await makeProject("chat3");
    const first = await (await send("chat3", "one", "u1")).json();
    await send("chat3", "two", "u1");
    const newer = await read("chat3", "u1", first.id);
    assert.deepEqual(newer.map((m: { body: string }) => m.body), ["two"]);
    assert.equal((await get("/projects/chat3/messages?after=-1")).status, 400);
  });

  test("a blank or too long body gets 400", async () => {
    await makeProject("chat4");
    assert.equal((await send("chat4", "   ", "u1")).status, 400);
    assert.equal((await send("chat4", "x".repeat(2001), "u1")).status, 400);
  });

  test("non-members and removed members get 404", async () => {
    await makeProject("chat5", ["u2"]);
    assert.equal((await get("/projects/chat5/messages", "u3")).status, 404);
    assert.equal((await send("chat5", "hi", "u3")).status, 404);

    await fetch(`${base}/projects/chat5/members/u2`, as("u1", { method: "DELETE" }));
    assert.equal((await get("/projects/chat5/messages", "u2")).status, 404);
    assert.equal((await send("chat5", "hi", "u2")).status, 404);
  });

  test("deleting the project deletes its messages", async () => {
    await makeProject("chat6");
    await send("chat6", "bye", "u1");
    await fetch(`${base}/projects/chat6`, as("u1", { method: "DELETE" }));
    await makeProject("chat6");
    assert.deepEqual(await read("chat6", "u1"), []);
  });
});

describe("documents API", () => {
  test("POST creates a document, and a retry returns it instead of a duplicate", async () => {
    await makeProject("docs1");
    const first = await upload("docs1", "abc1", [textAnnotation]);
    assert.equal(first.status, 201);
    const doc = await first.json();
    assert.equal(doc.version, 1);
    assert.equal(doc.projectId, "docs1");
    assert.deepEqual(doc.annotations, [textAnnotation]);
    assert.equal(doc.image.uri, "/images/abc1.jpg");
    assert.ok(existsSync(join(uploadsDir, "abc1.jpg")));

    const retry = await upload("docs1", "abc1");
    assert.equal(retry.status, 200);
    assert.deepEqual((await retry.json()).annotations, [textAnnotation]);

    const list = await (await get("/projects/docs1/documents")).json();
    assert.equal(list.filter((d: { id: string }) => d.id === "abc1").length, 1);
  });

  test("an id already used in another project is a 409, not that project's document", async () => {
    await makeProject("docs2");
    await makeProject("docs3");
    assert.equal((await upload("docs2", "shared1")).status, 201);
    assert.equal((await upload("docs3", "shared1")).status, 409);
  });

  test("GET list omits annotations; GET by id and the image are served", async () => {
    await makeProject("docs4");
    await upload("docs4", "list1");
    const list = await (await get("/projects/docs4/documents")).json();
    const item = list.find((d: { id: string }) => d.id === "list1");
    assert.deepEqual(Object.keys(item).sort(), ["id", "image", "projectId", "updatedAt", "version"]);

    const doc = await (await get("/documents/list1")).json();
    assert.deepEqual(doc.annotations, []);
    assert.deepEqual(doc.image, { uri: "/images/list1.jpg", width: 400, height: 300 });

    assert.equal((await fetch(`${base}${doc.image.uri}`)).status, 401);
    assert.equal((await get(doc.image.uri)).status, 200);
  });

  test("an added member can read and save a document", async () => {
    await makeProject("docs5");
    await upload("docs5", "shared2");
    assert.equal((await put("shared2", { annotations: [], version: 1 }, "u2")).status, 404);

    await fetch(`${base}/projects/docs5/members`, as("u1", json("POST", { userId: "u2" })));
    const ok = await put("shared2", { annotations: [textAnnotation], version: 1 }, "u2");
    assert.equal(ok.status, 200);
    const doc = await (await get("/documents/shared2", "u1")).json();
    assert.deepEqual(doc.annotations, [textAnnotation]);
  });

  test("PUT bumps the version, and a stale version gets 409", async () => {
    await makeProject("docs6");
    await upload("docs6", "put1");
    const ok = await put("put1", { annotations: [textAnnotation], version: 1 });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).version, 2);

    const stale = await put("put1", { annotations: [], version: 1 });
    assert.equal(stale.status, 409);
    const doc = await (await get("/documents/put1")).json();
    assert.deepEqual(doc.annotations, [textAnnotation]);
  });

  test("invalid annotations get 400", async () => {
    await makeProject("docs7");
    await upload("docs7", "bad1");
    assert.equal((await put("bad1", { annotations: [{ kind: "circle" }], version: 1 })).status, 400);
    assert.equal((await upload("docs7", "bad2", [{ id: "x", kind: "text" }])).status, 400);
    assert.equal((await get("/documents/bad2")).status, 404);
  });

  test("measurements are accepted on a segment or unassigned, but not half-assigned", async () => {
    await makeProject("docs9");
    await upload("docs9", "meas1");
    const fields = { id: "m1", kind: "measurement", value: 12, unit: "cm", labelOffset: 4, color: "#00f" };
    const unassigned = { ...fields, pathId: null, startAnchorId: null, endAnchorId: null };
    const linked = { ...fields, pathId: "p", startAnchorId: "a0", endAnchorId: "a1" };
    const half = { ...fields, pathId: "p", startAnchorId: null, endAnchorId: null };
    assert.equal((await put("meas1", { annotations: [unassigned], version: 1 })).status, 200);
    assert.equal((await put("meas1", { annotations: [linked], version: 2 })).status, 200);
    assert.equal((await put("meas1", { annotations: [half], version: 3 })).status, 400);
  });

  test("DELETE removes the row and the image file", async () => {
    await makeProject("docs8");
    await upload("docs8", "del1");
    const res = await fetch(`${base}/documents/del1`, as("u1", { method: "DELETE" }));
    assert.equal(res.status, 204);
    assert.equal((await get("/documents/del1")).status, 404);
    assert.ok(!existsSync(join(uploadsDir, "del1.jpg")));
  });

  test("unknown ids get 404", async () => {
    assert.equal((await get("/documents/nope")).status, 404);
    assert.equal((await put("nope", { annotations: [], version: 1 })).status, 404);
    assert.equal((await fetch(`${base}/documents/nope`, as("u1", { method: "DELETE" }))).status, 404);
  });
});

describe("AI drawing", () => {
  const line = (id: string, x2 = 100) => ({
    id,
    kind: "path",
    anchors: [
      { id: `${id}a1`, point: { x: 10, y: 10 } },
      { id: `${id}a2`, point: { x: x2, y: 90 } },
    ],
    closed: false,
    stroke: "#ff3b30",
    strokeWidth: 5,
  });
  const reply = (...paths: unknown[]) => JSON.stringify({ annotations: paths });
  const ask = (id: string, body: unknown = {}, user = "u1") =>
    fetch(
      `${base}/documents/${id}/ai`,
      as(user, json("POST", { request: "mark the lines", annotations: [], style: { stroke: "#ff3b30", strokeWidth: 5 }, textStyle: { fontSize: 20, color: "#ffffff" }, ...(body as object) })),
    );

  function reset(...next: (string | Error)[]) {
    replies.splice(0, replies.length, ...next);
    model.doGenerateCalls.length = 0;
  }

  test("returns the paths the model drew", async () => {
    await makeProject("ai1");
    await upload("ai1", "aid1");
    reset(reply(line("aip1")));
    const res = await ask("aid1");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { annotations: [line("aip1")] });
  });

  test("sends the errors back and uses the corrected answer", async () => {
    await makeProject("ai2");
    await upload("ai2", "aid2");
    // The first answer has a point outside the 400 x 300 photo.
    reset(reply(line("aip1", 999)), reply(line("aip1")));
    const res = await ask("aid2");
    assert.equal(res.status, 200);
    assert.equal(model.doGenerateCalls.length, 2);
    assert.deepEqual(await res.json(), { annotations: [line("aip1")] });
  });

  test("gives up with 422 after four retries", async () => {
    await makeProject("ai3");
    await upload("ai3", "aid3");
    reset(...Array.from({ length: 5 }, () => "not json"));
    const res = await ask("aid3");
    assert.equal(res.status, 422);
    assert.equal(model.doGenerateCalls.length, 5);
  });

  const label = (id: string, x = 50, y = 40) => ({
    id,
    kind: "text",
    position: { x, y },
    text: "Living room",
    fontSize: 20,
    color: "#ffffff",
  });

  test("returns text labels along with paths", async () => {
    await makeProject("ai6");
    await upload("ai6", "aid6");
    reset(reply(line("aip1"), label("ait1")));
    const res = await ask("aid6", { request: "mark it and label it" });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { annotations: [line("aip1"), label("ait1")] });
  });

  test("a label outside the photo is sent back for correction", async () => {
    await makeProject("ai7");
    await upload("ai7", "aid7");
    reset(reply(label("ait1", 999, 40)), reply(label("ait1")));
    const res = await ask("aid7", { request: "label it" });
    assert.equal(res.status, 200);
    assert.equal(model.doGenerateCalls.length, 2);
    assert.deepEqual(await res.json(), { annotations: [label("ait1")] });
  });

  test("a failing provider gives 502", async () => {
    await makeProject("ai4");
    await upload("ai4", "aid4");
    reset(new Error("provider down"));
    assert.equal((await ask("aid4")).status, 502);
  });

  test("only members can ask, and the body is checked first", async () => {
    await makeProject("ai5");
    await upload("ai5", "aid5");
    reset(reply(line("aip1")));
    assert.equal((await ask("aid5", {}, "u2")).status, 404);
    assert.equal((await ask("aid5", { request: "  " })).status, 400);
    assert.equal(model.doGenerateCalls.length, 0);
  });
});
