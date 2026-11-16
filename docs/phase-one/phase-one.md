# Phase 1 — Skia Canvas Annotation

## 1. Goal

Take a photo with the camera, show it on a Skia canvas, and let the user draw on it. The user can build paths with a pen tool (tap to drop anchors joined by straight lines), add measurement lines with a value they type in, and place typed text labels. Any annotation can be selected, moved, and deleted. All drawing is smooth (gestures and redraws run on the UI thread).

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
- **State library (Zustand etc.)** — `useReducer` is enough for one screen. Add one later if undo/redo or several screens make it painful.
- **ID library** — a small `makeId()` helper in `src/utils/` is enough.

## 3. Data Model

Rules:
- **All points are in image pixels**, not screen pixels. Zoom, pan, and different screen sizes then do not change the saved data. We convert to screen space only when drawing.
- **Plain JSON objects.** Easy to save, load, and undo (keep a list of past states).
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

// A measurement end is either attached to a path's anchor or a free point.
// It snaps to an anchor when dropped close to one.
type MeasurementEnd =
  | { kind: 'anchor'; pathId: string; anchorId: string } // follows the anchor when it moves
  | { kind: 'point'; point: Point };                       // free, not attached

// A line between two ends with a value the user types in.
type Measurement = {
  id: string;
  kind: 'measurement';
  start: MeasurementEnd;
  end: MeasurementEnd;
  value: number;       // entered by the user, not calculated from pixels
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  labelOffset: number; // how far the label sits from the line
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
- **One `annotations` list with a `kind` field** gives one draw order, one hit-test loop, and one undo history for every tool. Adding a new tool later is adding one more type.
- **Measurement value is typed in**, because the photo has no real-world scale. Later we could add a reference length to calculate it.
- **Measurements store an anchor reference, not a copy of the point**, so they stay attached when the anchor moves. The position is looked up from the anchor at draw time.

Snapping rules:
- When a measurement end is dropped within a small distance of an anchor, it attaches to that anchor.
- Deleting a path also deletes every measurement attached to any of its anchors.
- Deleting a single anchor also deletes every measurement attached to that anchor.

## 4. Decision Log

| # | Decision | Why |
| --- | --- | --- |
| 1 | Use Skia v2 (2.14.0), not v3. | We want a pure Expo Go app with no native builds. v3 is not in Expo Go yet, so it would need a development build. |
