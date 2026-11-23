# Phase 1 — Skia Canvas Annotation

## 1. Goal

Take a photo with the camera, show it on a Skia canvas, and let the user draw on it. The user can build paths with a pen tool (tap to drop anchors joined by straight lines), tap any segment of a path to attach a length they type in, and place typed text labels. Any annotation can be selected, moved, and deleted. Gestures and redraws run on the UI thread.

## 2. Dependencies

The project must run in Expo Go, so every package here is checked against the SDK 58 docs ("Included in Expo Go").

Already installed (Expo SDK 58): `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets`, `expo-image`.

To install with `npx expo install`:

| Package | Why |
| --- | --- |
| `@shopify/react-native-skia` (v2, 2.14.0) | The canvas. Draws the image, paths, and text. Reads Reanimated shared values directly, so a drag redraws without a React re-render. |
| `expo-camera` | Take the photo inside the app. |
| `expo-image-picker` | Pick an existing photo. Needed for testing on the iOS simulator, which has no camera. |
| `expo-file-system` | Copy the photo out of the temp cache so it is not deleted, and save the annotation JSON next to it. |

Considered, not adding yet:
- **State library (Zustand etc.)** — `useReducer` is enough for one screen.
- **ID library** — a small `makeId()` helper in `src/utils/` is enough.

## 3. Data Model

Rules:
- **All points are in image pixels**, not screen pixels. Zoom, pan, and different screen sizes then do not change the saved data. We convert to screen space only when drawing.
- **Plain JSON objects**, so they can be saved, loaded, and kept as undo history.
- **Shared values only for the live gesture.** While a finger is dragging, the point lives in a Reanimated shared value. On release, we write it into the document state once.

```ts
type Point = { x: number; y: number }; // image pixels

// One point on a pen path. Anchors are joined by straight lines.
type Anchor = {
  id: string;
  point: Point;
};

type PenPath = {
  id: string;
  kind: 'path';
  anchors: Anchor[];
  closed: boolean;
  stroke: string;      // color
  strokeWidth: number;
};

// A length the user typed in for one segment of a path (two adjacent anchors).
// It has no points of its own: it is drawn from its two anchors, so it stays
// on its segment when an anchor moves.
type Measurement = {
  id: string;
  kind: 'measurement';
  pathId: string;
  startAnchorId: string;
  endAnchorId: string;
  value: number;       // entered by the user, not calculated from pixels
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  labelOffset: number; // gap between the segment and its label, in image pixels
  color: string;
};

// Typed text that the user places on the image.
type TextLabel = {
  id: string;
  kind: 'text';
  position: Point;
  text: string;
  fontSize: number;    // in image pixels, so it scales with zoom
  color: string;
};

type Annotation = PenPath | Measurement | TextLabel;

type AnnotationDoc = {
  id: string;
  image: { uri: string; width: number; height: number };
  annotations: Annotation[]; // array order = draw order
  createdAt: number;
  updatedAt: number;
};
```

Why this shape:
- **Anchors with ids** let us move or delete a single point later, and turning a path into a Skia path is a simple loop of `moveTo` / `lineTo`.
- **One `annotations` list with a `kind` field** gives one draw order, one hit-test loop, and one undo history for every tool.
- **Measurement value is typed in**, because the photo has no real-world scale.
- **A measurement belongs to a segment, not to free points.** The segment is stored as the path id plus its two anchor ids, and its position is looked up at draw time.
- **One measurement per segment.**

Measurement rules:
- Measure tool: tap a segment, enter a value and unit in the dialog, then Add. Tapping an already-measured segment reopens the dialog with its value and a Save button.
- Select tool: tap a measurement's label to select it and use Delete to remove it. Measurements can't be dragged; they move with their anchors.
- Deleting a path also deletes every measurement on it.
- Deleting a single anchor deletes the measurements on the segments that touch that anchor.

## 4. Storage

Everything is stored locally on the device as plain files, using `expo-file-system`. There is no database.

```
<app documents>/docs/<id>/
  image.jpg   copy of the photo (camera and picker files are temporary)
  doc.json    the annotations
```

- **Image:** the photo itself is copied into the folder, not just linked.
- **Image URI on load:** rebuilt from the folder path, because the saved `uri` can go stale between launches.
- **Autosave:** runs 500 ms after the last change. Leaving the screen saves once more.
- **While dragging:** nothing is saved. The document changes once, when the finger lifts.

Limits: data stays on this device (no sync or backup), and the home screen reads every `doc.json` when opened.

## 5. Decision Log

| # | Decision | Why |
| --- | --- | --- |
| 1 | Use Skia v2 (2.14.0), not v3. | We want a pure Expo Go app with no native builds. v3 is not in Expo Go yet, so it would need a development build. |
