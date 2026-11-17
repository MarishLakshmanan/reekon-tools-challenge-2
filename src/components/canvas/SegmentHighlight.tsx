import { Line } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { findAnchorPoint } from "@/utils/annotations/geometry";
import { OFFSCREEN } from "@/components/canvas/shared";
import type { Annotation, Segment } from "@/utils/annotations/types";
import { colors } from "@/utils/theme";

/** The segment picked with the Measure tool, drawn over its path until a card is linked to it. */
export function SegmentHighlight({
  live,
  segment,
  pxToImage,
}: {
  live: SharedValue<Annotation[]>;
  segment: Segment;
  pxToImage: SharedValue<number>;
}) {
  const p1 = useDerivedValue(() => findAnchorPoint(live.value, segment.pathId, segment.startAnchorId) ?? OFFSCREEN);
  const p2 = useDerivedValue(() => findAnchorPoint(live.value, segment.pathId, segment.endAnchorId) ?? OFFSCREEN);
  // Fixed on-screen thickness, so it stays visible at any zoom.
  const width = useDerivedValue(() => 8 * pxToImage.value);
  return <Line p1={p1} p2={p2} color={colors.highlight} strokeWidth={width} strokeCap="round" opacity={0.8} />;
}
