# Drawing a Square — Flow

A square is a pen path with four anchors and `closed: true`. The app does not know it is a square; it is just four taps.

## The data

- **Anchor** — `{ id, point }`. One corner. `point` is in image pixels.
- **PenPath** — `{ id, kind: "path", anchors[], closed, stroke, strokeWidth }`. The shape.
- **Measurement** — `{ id, kind: "measurement", pathId, startAnchorId, endAnchorId, value, unit, labelOffset, color }`. A length on one edge. It stores anchor ids, not points, so it follows the edge when a corner moves.

All three are types in [types.ts](../../src/utils/annotations/types.ts). The logic that uses them is in [src/utils/annotations/](../../src/utils/annotations/).

## Flow

### 1. Pick the Pen tool

`changeTool("pen")` in [EditorScreen.tsx](../../src/screens/EditorScreen.tsx) finishes any path that was in progress and clears the selection. Anchor dots now show.

### 2. Tap the first corner

1. The tap gesture in [AnnotationCanvas.tsx](../../src/components/canvas/AnnotationCanvas.tsx) runs on the UI thread.
2. `toImagePoint(screenX, screenY, view)` turns the screen point into an image point, undoing zoom and pan.
3. Tolerance is `HIT_SLOP_PX / scale`, so a 22-pixel touch area stays the same on screen at any zoom level.
4. `onTap(point, tolerance)` moves to the JS thread and calls `handleTap` in `EditorScreen`.
5. There is no draft yet, so `handleTap` creates one:
   - `id: makeId()`, one anchor `{ id: makeId(), point }`, `closed: false`
   - `stroke` comes from the line color setting
   - `strokeWidth = styleFor(imageWidth).strokeWidth × WIDTH_FACTOR[setting]`

The draft is React state only. It is **not** in the document yet, so it is not saved and Undo does not see it.

### 3. Tap corners two, three, and four

Each tap adds `{ id: makeId(), point }` to `draft.anchors`.

The canvas receives `[...doc.annotations, draft]`. `PathShape` draws it with `Skia.Path.Polygon(pathPoints(path), closed)`, so a new line appears after each tap.

### 4. Tap the first corner again to close

`handleTap` checks that the draft has 3 or more anchors and that the tap is within `tolerance` of anchor 0. If both are true, it calls `finishPath(true)`:

```
dispatch({ type: "add", annotation: { ...draft, closed: true } })
  → editorReducer   saves the old annotations array for Undo (last 5)
  → docReducer      sets updatedAt
  → applyAction     returns [...list, path]
```

The draft is cleared. 500 ms later, autosave writes the document to the phone. The Save button uploads it to the server.

The **Finish** button calls `finishPath(false)` instead. That gives an open path: four corners and three edges.

### 5. (Optional) Put a length on an edge

1. **Add measurement** creates an unassigned measurement (`pathId: null`) with `randomValue(unit)`. It appears in the list only.
2. With the Measure tool, tap an edge. `hitSegment(point, annotations, tolerance)` returns the edge `{ pathId, startAnchorId, endAnchorId }`. For a closed path, the edge from the last corner back to the first counts too.
3. If that edge already has a measurement (`findMeasurement`), its editor opens. If not, the edge is highlighted.
4. Tap an unassigned card. `linkMeasurement` copies the edge's ids onto the measurement.
5. `measurementLayout(m, annotations, fontSize)` finds the two anchor points and places the label beside the middle of the edge.

### 6. (Optional) Drag a corner

1. With the Select tool, the pan gesture calls `pickDragTarget(point, …)`. Anchors are checked first, so it returns `{ kind: "anchor", pathId, anchorId, origin }`.
2. While the finger moves, only a shared value changes. On the UI thread, `applyAction(doc, dragToAction(drag))` gives a live preview with no React re-render.
3. When the finger lifts, the same `moveAnchor` action is dispatched once. The measurement follows because it points at the anchor by id.

## Function inputs and outputs

| Function | Input | Output |
| --- | --- | --- |
| `toImagePoint` | screen x, y + view transform | image point |
| `handleTap` (pen) | image point, tolerance | new or longer draft, or a closed path |
| `pathPoints` | PenPath | list of points for Skia |
| `applyAction` | annotations + action | new annotations (pure) |
| `hitSegment` | point, annotations, tolerance | edge ids or null |
| `findMeasurement` | annotations, edge | measurement on that edge |
| `measurementLayout` | measurement, annotations, fontSize | edge ends + label position |
| `pickDragTarget` | point, annotations, tolerance, fontSize | what to drag |
| `dragToAction` | drag target + delta | `moveAnchor` / `movePath` / `moveText` action |
