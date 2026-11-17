import { Circle, Path, Skia } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { findAnchorPoint, findAnnotation, pathPoints } from "@/utils/annotations/geometry";
import { HANDLE_RADIUS_PX, OFFSCREEN } from "@/components/canvas/shared";
import type { Annotation, PenPath } from "@/utils/annotations/types";
import { colors } from "@/utils/theme";

function AnchorDot({
  live,
  pathId,
  anchorId,
  pxToImage,
  highlighted,
}: {
  live: SharedValue<Annotation[]>;
  pathId: string;
  anchorId: string;
  pxToImage: SharedValue<number>;
  highlighted: boolean;
}) {
  const radius = useDerivedValue(() => HANDLE_RADIUS_PX * pxToImage.value);
  const ring = useDerivedValue(() => radius.value / 3);
  const center = useDerivedValue(() => findAnchorPoint(live.value, pathId, anchorId) ?? OFFSCREEN);
  return (
    <>
      <Circle c={center} r={radius} color="white" />
      <Circle c={center} r={radius} color={highlighted ? colors.highlight : colors.tint} style="stroke" strokeWidth={ring} />
    </>
  );
}

export function PathShape({
  live,
  path,
  showAnchors,
  selectedAnchorId,
  pxToImage,
}: {
  live: SharedValue<Annotation[]>;
  path: PenPath;
  showAnchors: boolean;
  selectedAnchorId?: string;
  /** Image pixels per screen pixel, so handles keep a constant on-screen size. */
  pxToImage: SharedValue<number>;
}) {
  const skPath = useDerivedValue(() => {
    const current = findAnnotation(live.value, path.id);
    return current?.kind === "path"
      ? Skia.Path.Polygon(pathPoints(current), current.closed)
      : Skia.Path.Make();
  });

  return (
    <>
      <Path path={skPath} style="stroke" color={path.stroke} strokeWidth={path.strokeWidth} strokeJoin="round" strokeCap="round" />
      {showAnchors &&
        path.anchors.map((n) => (
          <AnchorDot
            key={n.id}
            live={live}
            pathId={path.id}
            anchorId={n.id}
            pxToImage={pxToImage}
            highlighted={n.id === selectedAnchorId}
          />
        ))}
    </>
  );
}
