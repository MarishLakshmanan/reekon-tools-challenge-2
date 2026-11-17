# Phase 1 — Skia Canvas Annotation

## 1. Goal

Take a photo with the camera, show it on a Skia canvas, and let the user draw on it. The user can build paths with a pen tool (tap to drop anchors joined by straight lines), tap any segment of a path to attach a length they type in, and place typed text labels. Any annotation can be selected, moved, and deleted. All drawing is smooth (gestures and redraws run on the UI thread).

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
- **One `annotations` list with a `kind` field** gives one draw order, one hit-test loop, and one undo history for every tool. Adding a new tool later is adding one more type.
- **Measurement value is typed in**, because the photo has no real-world scale. Later we could add a reference length to calculate it.
- **A measurement belongs to a segment, not to free points.** The user taps a line that already exists, so there is no separate line to draw, snap, or keep in sync. The segment is stored as the path id plus its two anchor ids, and its position is looked up at draw time.
- **One measurement per segment.** Tapping a segment that already has one opens it for editing instead of adding a second.

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
- **Autosave (debounced):** a save runs 500 ms after the last change, not on a fixed 500 ms timer. Each change restarts the timer. Leaving the screen saves once more.
- **While dragging:** nothing is saved. The moving point lives only in a shared value, and the document changes once, when the finger lifts.

Example `doc.json` (one path with 3 anchors, one measurement on its first segment, one text label):

```json
{
  "id": "m3k9x1ab12cd",
  "image": { "uri": "file:///.../docs/m3k9x1ab12cd/image.jpg", "width": 3000, "height": 4000 },
  "annotations": [
    {
      "id": "p1",
      "kind": "path",
      "anchors": [
        { "id": "a1", "point": { "x": 820, "y": 1200 } },
        { "id": "a2", "point": { "x": 2100, "y": 1180 } },
        { "id": "a3", "point": { "x": 2150, "y": 2600 } }
      ],
      "closed": false,
      "stroke": "#ff3b30",
      "strokeWidth": 12
    },
    {
      "id": "m1",
      "kind": "measurement",
      "pathId": "p1",
      "startAnchorId": "a1",
      "endAnchorId": "a2",
      "value": 120,
      "unit": "cm",
      "labelOffset": 45,
      "color": "#0a84ff"
    },
    {
      "id": "t1",
      "kind": "text",
      "position": { "x": 900, "y": 3000 },
      "text": "Window",
      "fontSize": 120,
      "color": "#ffd60a"
    }
  ],
  "createdAt": 1763300000000,
  "updatedAt": 1763300500000
}
```

Limits: data stays on this device (no sync or backup), and the home screen reads every `doc.json` when opened, which is fine for dozens of photos.

## 5. Decision Log

| # | Decision | Why |
| --- | --- | --- |
| 1 | Use Skia v2 (2.14.0), not v3. | We want a pure Expo Go app with no native builds. v3 is not in Expo Go yet, so it would need a development build. |
