import { Rect, Skia, Text } from "@shopify/react-native-skia";
import type { SkTypeface } from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { OFFSCREEN, systemFont } from "@/components/canvas/shared";
import { findAnnotation, textWidth } from "@/utils/annotations/geometry";
import type { Annotation, TextLabel } from "@/utils/annotations/types";
import { colors } from "@/utils/theme";

export function TextShape({
  live,
  label,
  selected,
  pxToImage,
  typeface,
}: {
  live: SharedValue<Annotation[]>;
  label: TextLabel;
  selected: boolean;
  pxToImage: SharedValue<number>;
  /** A loaded font to draw with. Needed on the web, where `matchFont` (system fonts) is not available. */
  typeface?: SkTypeface;
}) {
  // Each label keeps the size it was created with, so changing the text size setting does not resize old ones.
  const font = useMemo(
    () => (typeface ? Skia.Font(typeface, label.fontSize) : systemFont(label.fontSize)),
    [label.fontSize, typeface],
  );
  const outline = useDerivedValue(() => 2 * pxToImage.value);
  const position = useDerivedValue(() => {
    const current = findAnnotation(live.value, label.id);
    return current?.kind === "text" ? current.position : OFFSCREEN;
  });
  const x = useDerivedValue(() => position.value.x);
  const y = useDerivedValue(() => position.value.y);
  const boxY = useDerivedValue(() => position.value.y - label.fontSize);

  return (
    <>
      <Text x={x} y={y} text={label.text} font={font} color={label.color} />
      {selected && (
        <Rect
          x={x}
          y={boxY}
          width={textWidth(label.text, label.fontSize)}
          height={label.fontSize * 1.2}
          style="stroke"
          color={colors.highlight}
          strokeWidth={outline}
        />
      )}
    </>
  );
}
