# Phase 5 — Web Build

## Assumption

Tablet users open the app in a browser, not through the native app. The tablet layout and touch input are not tested, because no touchscreen tablet or other large touchscreen device is available for testing.

## 1. Goal

Fix the Expo web build so it works in the browser. On the web, users review documents created in the phone app. They can open projects, view photos and their measurements, zoom and pan the photo, and edit measurement values and text labels.

## 2. Dependencies

No new packages. The web build uses CanvasKit, Skia's web runtime, which comes with the installed Skia package, and one bundled font file (Roboto Regular, Apache-2.0) for drawing text on the canvas.

## 3. What the Web Can Do

| Feature | Web |
| --- | --- |
| Sign in and sign out | Yes |
| View projects and their members | Yes |
| Create or delete projects | No |
| Add or remove project members | No |
| View documents, photos, and measurements | Yes |
| Zoom and pan the photo | Yes |
| Edit a measurement's value and unit | Yes |
| Edit a text label's text | Yes |
| Take or pick a photo, add a document | No |
| Draw paths, add measurements, add text | No |
| Move, link, or delete annotations | No |
| Settings | No |

## 4. Viewer

| Input | Does |
| --- | --- |
| Mouse wheel | Zooms in and out around the cursor, 1× to 5× |
| Click and drag | Pans the photo |
| Click a measurement or text label | Opens it for editing |

- The photo and every saved annotation are shown, drawn the same way as on the phone.
- The measurement list is shown below the canvas. Clicking a card opens it for editing.
- Zoom is not saved; the viewer always opens at 1×.

## 5. Editing

- The web keeps no local copy. A document is loaded from the server each time it is opened.
- Each edit is sent to the server when it is confirmed, with the document's version.
- Matching version: the server saves the edit and the document moves to the next version.
- Stale version: the server rejects the edit. The web shows that the document changed elsewhere and reloads the server copy; the edit is discarded.
- A phone holding unsaved changes to the same document gets a conflict on its next Save, handled the same way as an edit from another phone.

## 6. Layout

- On a wide window the app is a centred column, 960 px at most, on a grey page background. On a phone the column is the full width, so nothing changes.
- Measurement cards are squares in a wrapping grid, with the color bar on the top edge and the remove button in the corner. This applies to both the phone and the web.

## 7. Decision Log

| # | Decision | Why |
| --- | --- | --- |
| 1 | The web uses its own canvas component instead of the phone's annotation canvas. | Web input is mouse wheel zoom, click-drag pan, and click to edit. Adding that beside the phone's touch gestures and drawing tools would clutter the most complex component in the app. |
| 2 | Other screens are shared, with a platform check that renders the web or phone version of the parts that differ. | The differences are small, such as hidden buttons and a different data source, so separate web files would duplicate whole screens for a few lines. |
| 3 | Web edits are sent straight to the server and rejected on a stale version, with no local copy or sync. | The server's version check already prevents lost updates, and nothing on the web needs merging or retrying. |
