// On web, Skia reads `global.CanvasKit` when it is first imported, so CanvasKit has to be
// loaded before the app (and any Skia import) starts. `canvaskit.wasm` is copied to
// `public/` by the `postinstall` script. This is a separate file so the phone bundles never
// include CanvasKit's loader, which needs Node's `fs`.
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web/LoadSkiaWeb";

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => require("expo-router/entry"));
