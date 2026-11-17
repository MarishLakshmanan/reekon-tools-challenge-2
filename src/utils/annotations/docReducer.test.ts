import { UNDO_LIMIT, docReducer, editorReducer } from "./docReducer";
import type { EditorState } from "./docReducer";
import { doc, measurement, path, unassigned } from "./testFixtures";

const ids = (d: ReturnType<typeof doc>) => d.annotations.map((a) => a.id);

describe("docReducer delete cascade", () => {
  const linked = (d: ReturnType<typeof doc>) =>
    d.annotations.flatMap((a) => (a.kind === "measurement" && a.pathId !== null ? [a.id] : []));

  it("deleting a path keeps its measurements, unassigned", () => {
    const p = path("p", [[0, 0], [10, 0], [10, 10]]);
    const q = path("q", [[50, 50], [60, 60]]);
    const next = docReducer(
      doc([p, q, measurement("m1", "p", 0, 1), measurement("m2", "q", 0, 1), measurement("m3", "p", 1, 2)]),
      { type: "delete", id: "p" },
    );
    expect(ids(next)).toEqual(["q", "m1", "m2", "m3"]);
    expect(linked(next)).toEqual(["m2"]);
  });

  it("deleting an anchor unassigns only measurements touching that anchor", () => {
    const p = path("p", [[0, 0], [10, 0], [10, 10], [0, 10]]);
    const next = docReducer(
      doc([p, measurement("m01", "p", 0, 1), measurement("m12", "p", 1, 2), measurement("m23", "p", 2, 3)]),
      { type: "deleteAnchor", pathId: "p", anchorId: "p-a1" },
    );
    expect(ids(next)).toEqual(["p", "m01", "m12", "m23"]);
    expect(linked(next)).toEqual(["m23"]);
    const remaining = next.annotations[0];
    expect(remaining.kind === "path" && remaining.anchors.map((n) => n.id)).toEqual(["p-a0", "p-a2", "p-a3"]);
  });

  it("deleting an anchor from a 2-anchor path deletes the path and unassigns its measurements", () => {
    const next = docReducer(doc([path("p", [[0, 0], [10, 0]]), measurement("m", "p", 0, 1)]), {
      type: "deleteAnchor",
      pathId: "p",
      anchorId: "p-a1",
    });
    expect(ids(next)).toEqual(["m"]);
    expect(linked(next)).toEqual([]);
  });

  it("deleting a measurement leaves the path alone", () => {
    const next = docReducer(doc([path("p", [[0, 0], [10, 0]]), measurement("m", "p", 0, 1)]), {
      type: "delete",
      id: "m",
    });
    expect(ids(next)).toEqual(["p"]);
  });
});

describe("docReducer linkMeasurement", () => {
  const p = path("p", [[0, 0], [10, 0], [10, 10]]);
  const seg01 = { pathId: "p", startAnchorId: "p-a0", endAnchorId: "p-a1" };

  it("puts an unassigned measurement on a free segment", () => {
    const next = docReducer(doc([p, unassigned("u")]), { type: "linkMeasurement", id: "u", segment: seg01 });
    expect(next.annotations[1]).toMatchObject(seg01);
  });

  it("refuses a segment that already has a measurement, in either direction", () => {
    const start = doc([p, measurement("m", "p", 1, 0), unassigned("u")]);
    expect(docReducer(start, { type: "linkMeasurement", id: "u", segment: seg01 })).toBe(start);
  });

  it("does not move an already linked measurement", () => {
    const start = doc([p, measurement("m", "p", 1, 2)]);
    expect(docReducer(start, { type: "linkMeasurement", id: "m", segment: seg01 }).annotations).toEqual(start.annotations);
  });
});

describe("docReducer edits", () => {
  it("moveAnchor changes only that anchor", () => {
    const next = docReducer(doc([path("p", [[0, 0], [10, 0]])]), {
      type: "moveAnchor",
      pathId: "p",
      anchorId: "p-a1",
      point: { x: 5, y: 5 },
    });
    const moved = next.annotations[0];
    expect(moved.kind === "path" && moved.anchors.map((n) => n.point)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ]);
  });

  it("movePath shifts every anchor", () => {
    const next = docReducer(doc([path("p", [[0, 0], [10, 0]])]), { type: "movePath", id: "p", dx: 3, dy: -2 });
    const moved = next.annotations[0];
    expect(moved.kind === "path" && moved.anchors.map((n) => n.point)).toEqual([
      { x: 3, y: -2 },
      { x: 13, y: -2 },
    ]);
  });

  it("updateMeasurement changes value and unit", () => {
    const next = docReducer(doc([path("p", [[0, 0], [10, 0]]), measurement("m", "p", 0, 1)]), {
      type: "updateMeasurement",
      id: "m",
      value: 2.5,
      unit: "m",
    });
    expect(next.annotations[1]).toMatchObject({ value: 2.5, unit: "m" });
  });

  it("returns the same doc when nothing changes", () => {
    const d = doc([path("p", [[0, 0], [10, 0]])]);
    expect(docReducer(d, { type: "deleteAnchor", pathId: "missing", anchorId: "x" })).toBe(d);
  });
});

describe("docReducer markSaved", () => {
  it("records the server version and the sent updatedAt without touching annotations", () => {
    const d = { ...doc([path("p", [[0, 0], [10, 0]])]), updatedAt: 50 };
    const next = docReducer(d, { type: "markSaved", serverVersion: 2, savedAt: 40, imageUri: "http://h/images/d.jpg" });
    expect(next).toEqual({
      ...d,
      image: { ...d.image, uri: "http://h/images/d.jpg" },
      serverVersion: 2,
      savedAt: 40,
    });
  });
});

describe("editorReducer undo", () => {
  const start = (): EditorState => ({ doc: doc([path("p", [[0, 0], [10, 0]])]), past: [] });
  const add = (id: string) => ({ type: "add" as const, annotation: unassigned(id) });

  it("undo restores the previous annotations and marks the doc changed", () => {
    const s0 = start();
    const s1 = editorReducer(s0, add("u1"));
    const undone = editorReducer(s1, { type: "undo" });
    expect(undone.doc.annotations).toBe(s0.doc.annotations);
    expect(undone.past).toEqual([]);
    expect(undone.doc.updatedAt).toBeGreaterThan(s1.doc.updatedAt - 1);
  });

  it("keeps only the last UNDO_LIMIT steps", () => {
    let s = start();
    for (let i = 0; i < UNDO_LIMIT + 3; i++) s = editorReducer(s, add(`u${i}`));
    expect(s.past).toHaveLength(UNDO_LIMIT);
    for (let i = 0; i < UNDO_LIMIT; i++) s = editorReducer(s, { type: "undo" });
    expect(s.doc.annotations.map((a) => a.id)).toEqual(["p", "u0", "u1", "u2"]);
    expect(editorReducer(s, { type: "undo" })).toBe(s);
  });

  it("does not record edits that change nothing", () => {
    const s0 = start();
    expect(editorReducer(s0, { type: "delete", id: "missing" })).toBe(s0);
  });

  it("markSaved neither records a step nor clears history", () => {
    const s1 = editorReducer(start(), add("u1"));
    const saved = editorReducer(s1, { type: "markSaved", serverVersion: 3, savedAt: 1 });
    expect(saved.past).toBe(s1.past);
    expect(saved.doc.serverVersion).toBe(3);
  });

  it("undoing a path delete brings back its linked measurements", () => {
    const s0: EditorState = { doc: doc([path("p", [[0, 0], [10, 0]]), measurement("m", "p", 0, 1)]), past: [] };
    const deleted = editorReducer(s0, { type: "delete", id: "p" });
    const undone = editorReducer(deleted, { type: "undo" });
    expect(undone.doc.annotations[1]).toMatchObject({ pathId: "p" });
  });
});
