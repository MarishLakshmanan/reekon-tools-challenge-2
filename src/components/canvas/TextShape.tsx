import { Rect, Text } from "@shopify/react-native-skia";
import type { SkFont } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { findAnnotation, textWidth } from "@/utils/annotations/geometry";
import type { Annotation, TextLabel } from "@/utils/annotations/types";

export function TextShape({
  live,
  label,
  font,
  selected,
  pxToImage,
}: {
  live: SharedValue<Annotation[]>;
  label: TextLabel;
  font: SkFont;
  selected: boolean;
  pxToImage: number;
}) {
  const position = useDerivedValue(() => {
    const current = findAnnotation(live.value, label.id);
    return current?.kind === "text" ? current.position : { x: -1e6, y: -1e6 };
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
          color="#ff9f0a"
          strokeWidth={2 * pxToImage}
        />
      )}
    </>
  );
}
