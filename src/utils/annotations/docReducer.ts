import type { Annotation, AnnotationDoc, MeasurementUnit, PenPath, Point, Segment } from "./types";

export type DocAction =
  | { type: "add"; annotation: Annotation }
  | { type: "movePath"; id: string; dx: number; dy: number }
  | { type: "moveAnchor"; pathId: string; anchorId: string; point: Point }
  | { type: "moveText"; id: string; position: Point }
  | { type: "updateMeasurement"; id: string; value: number; unit: MeasurementUnit }
  | { type: "updateText"; id: string; text: string }
  /** Puts an unassigned measurement on `segment`. Ignored if that segment already has one. */
  | { type: "linkMeasurement"; id: string; segment: Segment }
  | { type: "delete"; id: string }
  | { type: "deleteAnchor"; pathId: string; anchorId: string };

/** Unassign measurements on `pathId`, or only those touching one of its anchors. They stay in the list. */
function unassignAttached(list: Annotation[], pathId: string, anchorId?: string): Annotation[] {
  "worklet";
  return list.map((a) =>
    a.kind === "measurement" &&
    a.pathId === pathId &&
    (anchorId === undefined || a.startAnchorId === anchorId || a.endAnchorId === anchorId)
      ? { ...a, pathId: null, startAnchorId: null, endAnchorId: null }
      : a,
  );
}

function onSegment(a: Annotation, seg: Segment): boolean {
  "worklet";
  if (a.kind !== "measurement" || a.pathId !== seg.pathId) return false;
  const same = a.startAnchorId === seg.startAnchorId && a.endAnchorId === seg.endAnchorId;
  const flipped = a.startAnchorId === seg.endAnchorId && a.endAnchorId === seg.startAnchorId;
  return same || flipped;
}

function mapPath(list: Annotation[], id: string, fn: (p: PenPath) => PenPath): Annotation[] {
  "worklet";
  return list.map((a) => (a.kind === "path" && a.id === id ? fn(a) : a));
}

/** Applies one action to the annotation list. A worklet so drags can preview on the UI thread. */
export function applyAction(list: Annotation[], action: DocAction): Annotation[] {
  "worklet";
  switch (action.type) {
    case "add":
      return [...list, action.annotation];
    case "movePath":
      return mapPath(list, action.id, (p) => ({
        ...p,
        anchors: p.anchors.map((n) => ({
          ...n,
          point: { x: n.point.x + action.dx, y: n.point.y + action.dy },
        })),
      }));
    case "moveAnchor":
      return mapPath(list, action.pathId, (p) => ({
        ...p,
        anchors: p.anchors.map((n) => (n.id === action.anchorId ? { ...n, point: action.point } : n)),
      }));
    case "moveText":
      return list.map((a) =>
        a.kind === "text" && a.id === action.id ? { ...a, position: action.position } : a,
      );
    case "updateMeasurement":
      return list.map((a) =>
        a.kind === "measurement" && a.id === action.id
          ? { ...a, value: action.value, unit: action.unit }
          : a,
      );
    case "updateText":
      return list.map((a) => (a.kind === "text" && a.id === action.id ? { ...a, text: action.text } : a));
    case "linkMeasurement": {
      if (list.some((a) => onSegment(a, action.segment))) return list;
      const { pathId, startAnchorId, endAnchorId } = action.segment;
      return list.map((a) =>
        a.kind === "measurement" && a.id === action.id && a.pathId === null
          ? { ...a, pathId, startAnchorId, endAnchorId }
          : a,
      );
    }
    case "delete": {
      const target = list.find((a) => a.id === action.id);
      if (!target) return list;
      const rest = list.filter((a) => a.id !== action.id);
      return target.kind === "path" ? unassignAttached(rest, target.id) : rest;
    }
    case "deleteAnchor": {
      const path = list.find((a): a is PenPath => a.kind === "path" && a.id === action.pathId);
      if (!path) return list;
      // A path needs two anchors to be a line; removing one of two removes the path.
      if (path.anchors.length <= 2) {
        return applyAction(list, { type: "delete", id: path.id });
      }
      const without = mapPath(list, path.id, (p) => ({
        ...p,
        anchors: p.anchors.filter((n) => n.id !== action.anchorId),
      }));
      return unassignAttached(without, path.id, action.anchorId);
    }
  }
}

/**
 * A Save finished. `savedAt` is the `updatedAt` that was sent, so edits made during the request stay unsaved.
 * `imageUri` is the server URL, given after the first upload.
 */
export type SavedAction = { type: "markSaved"; serverVersion: number; savedAt: number; imageUri?: string };

export function docReducer(doc: AnnotationDoc, action: DocAction | SavedAction): AnnotationDoc {
  if (action.type === "markSaved") {
    const image = action.imageUri ? { ...doc.image, uri: action.imageUri } : doc.image;
    return { ...doc, image, serverVersion: action.serverVersion, savedAt: action.savedAt };
  }
  const annotations = applyAction(doc.annotations, action);
  if (annotations === doc.annotations) return doc;
  return { ...doc, annotations, updatedAt: Date.now() };
}

/** How many edits Undo can step back through. */
export const UNDO_LIMIT = 5;

/** The editor's document plus earlier `annotations` arrays for Undo. History is in memory only. */
export type EditorState = { doc: AnnotationDoc; past: Annotation[][] };

export type UndoAction = { type: "undo" };

/**
 * `docReducer` with Undo. Each edit that changes annotations records the previous array (last {@link UNDO_LIMIT}).
 * Undo restores annotations only, so save state (`serverVersion`, `savedAt`) is never rolled back,
 * and it bumps `updatedAt` so the undo counts as an unsaved change.
 */
export function editorReducer(state: EditorState, action: DocAction | SavedAction | UndoAction): EditorState {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      doc: { ...state.doc, annotations: previous, updatedAt: Date.now() },
      past: state.past.slice(0, -1),
    };
  }
  const doc = docReducer(state.doc, action);
  if (doc === state.doc) return state;
  if (doc.annotations === state.doc.annotations) return { ...state, doc };
  return { doc, past: [...state.past, state.doc.annotations].slice(-UNDO_LIMIT) };
}
