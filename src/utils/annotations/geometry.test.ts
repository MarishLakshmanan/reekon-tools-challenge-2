import {
  distToSegment,
  findMeasurement,
  fitTransform,
  hitSegment,
  hitTest,
  measurementLayout,
  pickDragTarget,
  toImagePoint,
} from "./geometry";
import { measurement, path, text } from "./testFixtures";

const FONT = 10;

describe("distToSegment", () => {
  it("measures perpendicular distance inside the segment", () => {
    expect(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });
  it("clamps to the nearest endpoint outside the segment", () => {
    expect(distToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
  it("handles a zero-length segment", () => {
    expect(distToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe("hitSegment", () => {
  const p = path("p", [[0, 0], [100, 0], [100, 100]], true);

  it("returns the two anchors of the tapped segment", () => {
    expect(hitSegment({ x: 50, y: 2 }, [p], 5)).toEqual({ pathId: "p", startAnchorId: "p-a0", endAnchorId: "p-a1" });
  });
  it("finds the closing segment of a closed path", () => {
    expect(hitSegment({ x: 50, y: 50 }, [p], 5)).toEqual({ pathId: "p", startAnchorId: "p-a2", endAnchorId: "p-a0" });
  });
  it("misses empty space", () => {
    expect(hitSegment({ x: 50, y: 30 }, [p], 5)).toBeNull();
  });
});

describe("findMeasurement", () => {
  it("matches a segment in either direction", () => {
    const m = measurement("m", "p", 0, 1);
    expect(findMeasurement([m], { pathId: "p", startAnchorId: "p-a1", endAnchorId: "p-a0" })?.id).toBe("m");
    expect(findMeasurement([m], { pathId: "p", startAnchorId: "p-a1", endAnchorId: "p-a2" })).toBeUndefined();
  });
});

describe("measurementLayout", () => {
  it("follows its anchors and returns null once one is gone", () => {
    const p = path("p", [[0, 0], [0, 100]]);
    const m = measurement("m", "p", 0, 1);
    const out = measurementLayout(m, [p, m], FONT);
    expect(out?.p2).toEqual({ x: 0, y: 100 });
    expect(out && out.label.x).not.toBeCloseTo(0, 0); // beside a vertical segment, not on it
    expect(measurementLayout(m, [m], FONT)).toBeNull();
  });
});

describe("hitTest", () => {
  it("prefers the topmost path", () => {
    const low = path("low", [[0, 0], [100, 0]]);
    const high = path("high", [[0, 0], [100, 0]]);
    expect(hitTest({ x: 50, y: 1 }, [low, high], 5, FONT)?.id).toBe("high");
  });

  it("reports the anchor when an anchor is hit", () => {
    expect(hitTest({ x: 2, y: 2 }, [path("p", [[0, 0], [100, 0]])], 5, FONT)).toEqual({ id: "p", anchorId: "p-a0" });
  });

  it("selects a measurement by its label, and the path by its line", () => {
    const p = path("p", [[0, 0], [100, 0]]);
    const m = measurement("m", "p", 0, 1);
    const label = measurementLayout(m, [p, m], FONT)!.label;
    expect(hitTest({ x: label.x + 2, y: label.y - 2 }, [p, m], 3, FONT)?.id).toBe("m");
    expect(hitTest({ x: 50, y: 0 }, [p, m], 3, FONT)?.id).toBe("p");
  });

  it("hits text inside its box", () => {
    const t = text("t", 100, 100, "Hi");
    expect(hitTest({ x: 110, y: 95 }, [t], 2, FONT)?.id).toBe("t");
    expect(hitTest({ x: 200, y: 95 }, [t], 2, FONT)).toBeNull();
  });
});

describe("pickDragTarget", () => {
  const p = path("p", [[0, 0], [100, 0]]);

  it("picks an anchor over the path body", () => {
    expect(pickDragTarget({ x: 1, y: 1 }, [p], 5, FONT)).toMatchObject({ kind: "anchor", anchorId: "p-a0" });
  });
  it("picks the whole path when the body is hit", () => {
    expect(pickDragTarget({ x: 50, y: 1 }, [p], 5, FONT)).toEqual({ kind: "path", id: "p" });
  });
  it("picks text", () => {
    expect(pickDragTarget({ x: 110, y: 95 }, [text("t", 100, 100)], 2, FONT)).toMatchObject({ kind: "text", id: "t" });
  });
  it("does not drag a measurement", () => {
    const m = measurement("m", "p", 0, 1);
    const label = measurementLayout(m, [p, m], FONT)!.label;
    expect(pickDragTarget({ x: label.x + 2, y: label.y - 2 }, [p, m], 3, FONT)).toBeNull();
  });
});

describe("fitTransform", () => {
  it("centres a wide image in a tall canvas", () => {
    const v = fitTransform(400, 800, 1000, 500);
    expect(v).toEqual({ scale: 0.4, tx: 0, ty: 300 });
    expect(toImagePoint(200, 400, v)).toEqual({ x: 500, y: 250 });
  });
});
