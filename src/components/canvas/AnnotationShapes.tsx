import type { SkFont, SkTypeface } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";

import { MeasurementShape } from "@/components/canvas/MeasurementShape";
import { PathShape } from "@/components/canvas/PathShape";
import { TextShape } from "@/components/canvas/TextShape";
import { styleFor } from "@/utils/annotations/defaults";
import type { Selection } from "@/utils/annotations/geometry";
import type { Annotation } from "@/utils/annotations/types";

/** Draws every annotation; shared by the phone and web canvases. Goes inside the image-space `Group`. */
export function AnnotationShapes({
  annotations,
  live,
  pxToImage,
  imageWidth,
  font,
  selection = null,
  showAnchors = false,
  typeface,
}: {
  annotations: Annotation[];
  live: SharedValue<Annotation[]>;
  pxToImage: SharedValue<number>;
  imageWidth: number;
  /** Measurement label font. */
  font: SkFont;
  selection?: Selection | null;
  /** Show every path's anchors; a selected path always shows them. */
  showAnchors?: boolean;
  /** Text label typeface, needed on the web. */
  typeface?: SkTypeface;
}) {
  const style = styleFor(imageWidth);
  return annotations.map((a) => {
    const selected = a.id === selection?.id;
    if (a.kind === "path") {
      return (
        <PathShape
          key={a.id}
          live={live}
          path={a}
          showAnchors={showAnchors || selected}
          selectedAnchorId={selected ? selection?.anchorId : undefined}
          pxToImage={pxToImage}
        />
      );
    }
    if (a.kind === "measurement") {
      // Unassigned measurements are only in the list.
      if (a.pathId === null) return null;
      return (
        <MeasurementShape
          key={a.id}
          live={live}
          measurement={a}
          font={font}
          fontSize={style.fontSize}
          strokeWidth={style.strokeWidth * 1.5}
          selected={selected}
          pxToImage={pxToImage}
        />
      );
    }
    return <TextShape key={a.id} live={live} label={a} selected={selected} pxToImage={pxToImage} typeface={typeface} />;
  });
}
