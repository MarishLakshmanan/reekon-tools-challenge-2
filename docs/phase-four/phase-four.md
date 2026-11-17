# Phase 4 — Canvas Screen

## 1. Goal

Improve the canvas screen by adding pinch-zoom and pan, stopping tall photos from overflowing on iPhone, making the editor scrollable with a list of measurement cards, adding undo for the last five edits, and adding on-device settings for line and text style.

## 2. Dependencies

No new packages. Zoom and pan use the already installed `react-native-gesture-handler` and `react-native-reanimated`. Settings are stored with `expo-file-system`.

## 3. Editor Screen

The editor is a scrollable screen: the canvas, then the toolbar (Select / Pen / Measure / Text), then the Add Measurement row, then the measurement cards.

- The canvas has a fixed area: full width, with a height that follows the photo's shape, capped at 70% of the screen, so 3:4 camera photos fill the width.
- Nothing draws outside the canvas area, so tall photos stay clear of the status bar and notch.
- The editor header is opaque on iOS, so the canvas starts below it instead of drawing under the blurred header.
- Dragging on the canvas does not scroll the page.

## 4. Zoom and Pan

| Gesture | Does |
| --- | --- |
| Pinch | Zooms in and out around the fingers, 1× to 5× |
| Two-finger drag | Pans the photo |
| One-finger drag on empty space (Select) | Pans the photo |
| Double tap | Resets to 1× |

- Annotations stay pinned to the photo, and every tool works at any zoom.
- Lines, measurement labels, and text scale with the photo. Anchor handles, selection outlines, and the segment highlight keep the same size on screen.
- Zoom is not saved; the editor always opens at 1×.

## 5. Measurements

| State | Drawn on photo | Card color |
| --- | --- | --- |
| Linked to a path segment | Yes | Blue |
| Unassigned | No | Orange |

- **Create:** the Add Measurement button adds an unassigned measurement with a random value in the unit picked in the dropdown next to it (`mm`, `cm`, `m`, `in`, `ft`).
- **Link:** with the Measure tool, tap a segment to highlight it, then tap an orange card. A segment holds one measurement; tapping a segment that already has one edits it.
- **Edit:** tap a card, or tap the measurement on the photo with Select.
- **Remove:** the × on a card deletes the measurement and takes it off the photo.
- **Deleting a line or anchor** keeps its measurements; they become unassigned.
- **Saved:** every measurement, linked or unassigned, is saved in the document's annotations JSON. Linked cards come first, then unassigned ones.
- Card colors are fixed and are not settings.

## 6. Undo

- An Undo button in the toolbar steps back through the last five edits.
- While drawing a path, Undo removes the last point instead.
- Each action is one step: a drag, a finished path, added text, a delete, or an added, linked, edited, or removed measurement.
- Undo restores annotations only. It counts as an unsaved change, and Save sends it like any other edit.
- History is kept in memory only; it starts empty each time the editor opens.

## 7. Settings

A Settings screen opens from the Home screen.

| Setting | Choices |
| --- | --- |
| Line color | Color swatches |
| Line width | Thin / Medium / Thick |
| Text color | Color swatches |
| Text size | Small / Medium / Large |

- Settings apply to new lines and text. Existing annotations keep their own color and size.
- Measurement label color is not a setting.
- Settings are saved on the device only, not on the server. Signing out keeps them.

## 8. Decision Log

| # | Decision | Why |
| --- | --- | --- |
| 1 | Zoom and pan transform the Skia canvas content, not a zoomable wrapper view. | Annotations are stored in image pixels under one canvas transform, so they stay pinned to the photo and touch positions stay correct. |
| 2 | Unassigned measurements are saved in the annotations JSON, with their segment fields set to `null`. | One list to sync and version, and no database change. Measurements saved before this phase stay valid. |
| 3 | Settings are stored in a file on the device with `expo-file-system`, not on the server or in AsyncStorage. | They are personal preferences, not shared project data, and `expo-file-system` is already a dependency. |
