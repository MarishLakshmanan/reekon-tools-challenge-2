/** Distance in screen pixels within which a touch counts as hitting something. */
export const HIT_SLOP_PX = 22;

/** Sizes scale with the photo so annotations look the same on any resolution. */
export function styleFor(imageWidth: number) {
  return {
    strokeWidth: Math.max(2, imageWidth * 0.004),
    fontSize: imageWidth * 0.04,
    labelOffset: imageWidth * 0.015,
    // Line and text colors come from settings.
    measureColor: "#0a84ff",
  };
}
