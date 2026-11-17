import { docReducer } from "./docReducer";
import { doc, measurement, path } from "./testFixtures";

const ids = (d: ReturnType<typeof doc>) => d.annotations.map((a) => a.id);

describe("docReducer delete cascade", () => {
  it("deleting a path removes its measurements only", () => {
    const p = path("p", [[0, 0], [10, 0], [10, 10]]);
    const q = path("q", [[50, 50], [60, 60]]);
    const next = docReducer(
      doc([p, q, measurement("m1", "p", 0, 1), measurement("m2", "q", 0, 1), measurement("m3", "p", 1, 2)]),
      { type: "delete", id: "p" },
    );
    expect(ids(next)).toEqual(["q", "m2"]);
  });

  it("deleting an anchor removes only measurements touching that anchor", () => {
    const p = path("p", [[0, 0], [10, 0], [10, 10], [0, 10]]);
    const next = docReducer(
      doc([p, measurement("m01", "p", 0, 1), measurement("m12", "p", 1, 2), measurement("m23", "p", 2, 3)]),
      { type: "deleteAnchor", pathId: "p", anchorId: "p-a1" },
    );
    expect(ids(next)).toEqual(["p", "m23"]);
    const remaining = next.annotations[0];
    expect(remaining.kind === "path" && remaining.anchors.map((n) => n.id)).toEqual(["p-a0", "p-a2", "p-a3"]);
  });

  it("deleting an anchor from a 2-anchor path deletes the path and its measurements", () => {
    const next = docReducer(doc([path("p", [[0, 0], [10, 0]]), measurement("m", "p", 0, 1)]), {
      type: "deleteAnchor",
      pathId: "p",
      anchorId: "p-a1",
    });
    expect(next.annotations).toEqual([]);
  });

  it("deleting a measurement leaves the path alone", () => {
    const next = docReducer(doc([path("p", [[0, 0], [10, 0]]), measurement("m", "p", 0, 1)]), {
      type: "delete",
      id: "m",
    });
    expect(ids(next)).toEqual(["p"]);
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
