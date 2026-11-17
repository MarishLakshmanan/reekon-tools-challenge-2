import type { DocAction } from "./docReducer";
import { formatMeasurement } from "./measurements";
import type { Annotation, Measurement, PenPath, Point, Segment } from "./types";

// Every function here is a worklet so gesture callbacks can call it on the UI
// thread. A worklet captures the functions it calls when it is created, so a
// helper must be defined above any worklet that uses it.

/** What a tap or drag landed on. `anchorId` is set when an anchor was hit. */
export type Hit = { id: string; anchorId?: string };

/** One straight piece of a path, between two adjacent anchors. */
export type { Segment } from "./types";

/**
 * Lookup helpers for worklets in components. React Compiler hoists inline
 * callbacks out of components into plain functions, which then can't run on
 * the UI thread, so component worklets call these instead of `.find(...)`.
 */
export function findAnnotation(list: Annotation[], id: string): Annotation | undefined {
  "worklet";
  return list.find((a) => a.id === id);
}

export function findAnchorPoint(list: Annotation[], pathId: string, anchorId: string): Point | undefined {
  "worklet";
  const p = findAnnotation(list, pathId);
  return p?.kind === "path" ? p.anchors.find((n) => n.id === anchorId)?.point : undefined;
}

export function pathPoints(path: PenPath): Point[] {
  "worklet";
  return path.anchors.map((n) => n.point);
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  "worklet";
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t =
    lenSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Rough text width in image pixels; real metrics only exist inside Skia. */
export function textWidth(text: string, fontSize: number): number {
  "worklet";
  return text.length * fontSize * 0.6;
}

function pathSegments(path: PenPath): Segment[] {
  "worklet";
  const n = path.anchors;
  const segs: Segment[] = [];
  for (let i = 0; i < n.length - 1; i++) {
    segs.push({ pathId: path.id, startAnchorId: n[i].id, endAnchorId: n[i + 1].id });
  }
  if (path.closed && n.length > 2) {
    segs.push({ pathId: path.id, startAnchorId: n[n.length - 1].id, endAnchorId: n[0].id });
  }
  return segs;
}

/** Topmost path segment within `tolerance` of `p`. */
export function hitSegment(p: Point, annotations: Annotation[], tolerance: number): Segment | null {
  "worklet";
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.kind !== "path") continue;
    for (const seg of pathSegments(a)) {
      const s = findAnchorPoint(annotations, a.id, seg.startAnchorId);
      const e = findAnchorPoint(annotations, a.id, seg.endAnchorId);
      if (s && e && distToSegment(p, s, e) <= tolerance) return seg;
    }
  }
  return null;
}

/** The measurement on a segment, in either direction. */
export function findMeasurement(annotations: Annotation[], seg: Segment): Measurement | undefined {
  "worklet";
  for (const a of annotations) {
    if (a.kind !== "measurement" || a.pathId !== seg.pathId) continue;
    const same = a.startAnchorId === seg.startAnchorId && a.endAnchorId === seg.endAnchorId;
    const flipped = a.startAnchorId === seg.endAnchorId && a.endAnchorId === seg.startAnchorId;
    if (same || flipped) return a;
  }
  return undefined;
}

export function measurementLabel(m: Measurement): string {
  "worklet";
  return formatMeasurement(m.value, m.unit);
}

/**
 * Where to draw a measurement: its segment's ends plus the label's baseline
 * origin. The label sits beside the segment's midpoint with a gap of
 * `labelOffset` between the line and the label's nearest edge. Null if an
 * anchor is gone.
 */
export function measurementLayout(
  m: Measurement,
  annotations: Annotation[],
  fontSize: number,
): { p1: Point; p2: Point; label: Point } | null {
  "worklet";
  if (m.pathId === null) return null;
  const p1 = findAnchorPoint(annotations, m.pathId, m.startAnchorId);
  const p2 = findAnchorPoint(annotations, m.pathId, m.endAnchorId);
  if (!p1 || !p2) return null;
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
  const nx = (p2.y - p1.y) / len;
  const ny = -(p2.x - p1.x) / len;
  const width = textWidth(measurementLabel(m), fontSize);
  const dist = m.labelOffset + Math.abs(nx) * (width / 2) + Math.abs(ny) * (fontSize / 2);
  const cx = (p1.x + p2.x) / 2 + nx * dist;
  const cy = (p1.y + p2.y) / 2 + ny * dist;
  return { p1, p2, label: { x: cx - width / 2, y: cy + fontSize / 2 } };
}

function inTextBox(p: Point, origin: Point, text: string, fontSize: number, tolerance: number): boolean {
  "worklet";
  return (
    p.x >= origin.x - tolerance &&
    p.x <= origin.x + textWidth(text, fontSize) + tolerance &&
    p.y >= origin.y - fontSize - tolerance &&
    p.y <= origin.y + tolerance
  );
}

/**
 * What is under `p`, in priority order: anchors, then measurement labels,
 * then path lines and text (topmost first). Anchors come first so they stay
 * reachable under anything drawn on top. `fontSize` is the measurement label
 * size, which isn't stored per measurement.
 */
export function hitTest(
  p: Point,
  annotations: Annotation[],
  tolerance: number,
  fontSize: number,
): Hit | null {
  "worklet";
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.kind !== "path") continue;
    for (const n of a.anchors) {
      if (Math.hypot(p.x - n.point.x, p.y - n.point.y) <= tolerance) {
        return { id: a.id, anchorId: n.id };
      }
    }
  }
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.kind !== "measurement") continue;
    const layout = measurementLayout(a, annotations, fontSize);
    // No tolerance: the label sits close to its segment and shouldn't steal taps from it.
    if (layout && inTextBox(p, layout.label, measurementLabel(a), fontSize, 0)) {
      return { id: a.id };
    }
  }
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.kind === "path") {
      const pts = pathPoints(a);
      for (let j = 0; j < pts.length - 1; j++) {
        if (distToSegment(p, pts[j], pts[j + 1]) <= tolerance) return { id: a.id };
      }
      if (a.closed && pts.length > 2 && distToSegment(p, pts[pts.length - 1], pts[0]) <= tolerance) {
        return { id: a.id };
      }
    } else if (a.kind === "text") {
      if (inTextBox(p, a.position, a.text, a.fontSize, tolerance)) return { id: a.id };
    }
  }
  return null;
}

export type DragTarget =
  | { kind: "anchor"; pathId: string; anchorId: string; origin: Point }
  | { kind: "path"; id: string }
  | { kind: "text"; id: string; origin: Point };

/** Drag in progress; `delta` is in image pixels since the finger went down. */
export type Drag = { target: DragTarget; delta: Point };

export type Selection = { id: string; anchorId?: string };

export function targetSelection(t: DragTarget): Selection {
  "worklet";
  return t.kind === "anchor" ? { id: t.pathId, anchorId: t.anchorId } : { id: t.id };
}

/** What a drag starting at `p` would move. Measurements follow their anchors, so they aren't draggable. */
export function pickDragTarget(
  p: Point,
  annotations: Annotation[],
  tolerance: number,
  fontSize: number,
): DragTarget | null {
  "worklet";
  const hit = hitTest(p, annotations, tolerance, fontSize);
  const a = hit ? findAnnotation(annotations, hit.id) : undefined;
  if (!hit || !a) return null;
  if (a.kind === "path") {
    const anchor = hit.anchorId ? findAnchorPoint(annotations, a.id, hit.anchorId) : undefined;
    return anchor && hit.anchorId
      ? { kind: "anchor", pathId: a.id, anchorId: hit.anchorId, origin: anchor }
      : { kind: "path", id: a.id };
  }
  if (a.kind === "text") return { kind: "text", id: a.id, origin: a.position };
  return null;
}

/** The edit a drag produces; used for both the live preview and the final commit. */
export function dragToAction(drag: Drag): DocAction {
  "worklet";
  const { target: t, delta: d } = drag;
  switch (t.kind) {
    case "anchor":
      return {
        type: "moveAnchor",
        pathId: t.pathId,
        anchorId: t.anchorId,
        point: { x: t.origin.x + d.x, y: t.origin.y + d.y },
      };
    case "path":
      return { type: "movePath", id: t.id, dx: d.x, dy: d.y };
    case "text":
      return { type: "moveText", id: t.id, position: { x: t.origin.x + d.x, y: t.origin.y + d.y } };
  }
}

export type ViewTransform = { scale: number; tx: number; ty: number };

/** Scale and offset that fit the image inside the canvas, centred ("contain"). */
export function fitTransform(canvasW: number, canvasH: number, imageW: number, imageH: number): ViewTransform {
  "worklet";
  const scale = Math.min(canvasW / imageW, canvasH / imageH);
  return { scale, tx: (canvasW - imageW * scale) / 2, ty: (canvasH - imageH * scale) / 2 };
}

export function toImagePoint(x: number, y: number, v: ViewTransform): Point {
  "worklet";
  return { x: (x - v.tx) / v.scale, y: (y - v.ty) / v.scale };
}


/** Zoom and pan on top of the fit transform. `x`/`y` are screen-pixel offsets applied after zooming. */
export type Camera = { zoom: number; x: number; y: number };

export const IDENTITY_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

/** The image-to-screen transform with the camera applied. */
export function combineView(fit: ViewTransform, cam: Camera): ViewTransform {
  "worklet";
  return { scale: fit.scale * cam.zoom, tx: fit.tx * cam.zoom + cam.x, ty: fit.ty * cam.zoom + cam.y };
}

/** Scales `start` by `factor` (clamped to the zoom limits), keeping the screen point `focal` fixed. */
export function zoomAround(start: Camera, focal: Point, factor: number): Camera {
  "worklet";
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * factor));
  const ratio = zoom / start.zoom;
  return { zoom, x: focal.x - (focal.x - start.x) * ratio, y: focal.y - (focal.y - start.y) * ratio };
}

/** Keeps the photo covering the canvas when it is larger than it, and centred when it is smaller. */
export function clampCamera(
  cam: Camera,
  fit: ViewTransform,
  canvasW: number,
  canvasH: number,
  imageW: number,
  imageH: number,
): Camera {
  "worklet";
  const axis = (offset: number, fitOffset: number, canvas: number, image: number) => {
    const shown = image * fit.scale * cam.zoom;
    const base = fitOffset * cam.zoom;
    if (shown <= canvas) return (canvas - shown) / 2 - base;
    return Math.min(-base, Math.max(canvas - shown - base, offset));
  };
  return {
    zoom: cam.zoom,
    x: axis(cam.x, fit.tx, canvasW, imageW),
    y: axis(cam.y, fit.ty, canvasH, imageH),
  };
}
