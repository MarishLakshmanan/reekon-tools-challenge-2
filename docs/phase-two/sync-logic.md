# Sync Logic

Photos are synced using a version number. The server keeps it in `documents.version`; the phone keeps its copy in each photo's `doc.json` as `serverVersion`.

- Every Save to the server increments the version by 1.
- The phone's `serverVersion` is the version it last saved or downloaded.
- A photo has unsaved changes when its `updatedAt` differs from `savedAt` in `doc.json`.

## Opening a project

1. Pull the metadata of every photo in the project: `id`, `version`, image size. Not the annotations or the images.
2. Compare each photo's server `version` with the local `serverVersion`.
3. Where the version has changed, pull that photo's data (`doc.json`) and replace the local copy.

| Case | Result |
| --- | --- |
| Versions match | Nothing |
| Server version is newer, no unsaved changes | Pull the photo's data and replace the local copy |
| Server version is newer, unsaved changes | Conflict; keep local, show badge |
| Photo not on the phone | Download its data and image |
| Photo gone from the server, no unsaved changes | Delete it locally |

The image file never changes after upload, so it is downloaded only when it isn't on the phone.

## Saving

- The phone sends its annotations with its `serverVersion`.
- Versions match: the server saves and increments the version.
- Versions don't match: the server returns `409`, and the user chooses **Keep mine** (overwrite the server) or **Use server** (discard local edits).
