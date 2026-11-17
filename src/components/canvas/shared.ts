import { matchFont } from "@shopify/react-native-skia";
import { Platform } from "react-native";

/** Where a shape is drawn while its annotation is missing (deleted mid-gesture), so nothing shows. */
export const OFFSCREEN = { x: -1e6, y: -1e6 };

/** Radius of anchor and measurement handles, in screen pixels. */
export const HANDLE_RADIUS_PX = 7;

/** A system font. Not available on the web, which loads its own typeface. */
export function systemFont(fontSize: number) {
  return matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize });
}
