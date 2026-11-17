import type { AnnotationDoc, Measurement, PenPath, TextLabel } from "./types";

export function path(id: string, pts: [number, number][], closed = false): PenPath {
  return {
    id,
    kind: "path",
    anchors: pts.map(([x, y], i) => ({ id: `${id}-a${i}`, point: { x, y } })),
    closed,
    stroke: "#f00",
    strokeWidth: 2,
  };
}

/** Measurement on the segment between anchors `from` and `to` of `pathId`. */
export function measurement(id: string, pathId: string, from: number, to: number): Measurement {
  return {
    id,
    kind: "measurement",
    pathId,
    startAnchorId: `${pathId}-a${from}`,
    endAnchorId: `${pathId}-a${to}`,
    value: 10,
    unit: "cm",
    labelOffset: 8,
    color: "#00f",
  };
}

export function text(id: string, x: number, y: number, value = "Hello"): TextLabel {
  return { id, kind: "text", position: { x, y }, text: value, fontSize: 20, color: "#ff0" };
}

export function doc(annotations: AnnotationDoc["annotations"]): AnnotationDoc {
  return {
    id: "d",
    image: { uri: "file:///x.jpg", width: 1000, height: 800 },
    annotations,
    createdAt: 0,
    updatedAt: 0,
    serverVersion: null,
    savedAt: null,
  };
}
