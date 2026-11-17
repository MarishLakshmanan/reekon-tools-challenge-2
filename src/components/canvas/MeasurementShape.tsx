import { Circle, Line, Text } from "@shopify/react-native-skia";
import type { SkFont } from "@shopify/react-native-skia";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";

import { HANDLE_RADIUS_PX, OFFSCREEN } from "@/components/canvas/shared";
import { findAnnotation, measurementLayout } from "@/utils/annotations/geometry";
import { formatMeasurement } from "@/utils/annotations/measurements";
import type { Annotation, Measurement } from "@/utils/annotations/types";
import { colors } from "@/utils/theme";

export function MeasurementShape({
  live,
  measurement,
  font,
  fontSize,
  strokeWidth,
  selected,
  pxToImage,
}: {
  live: SharedValue<Annotation[]>;
  measurement: Measurement;
  font: SkFont;
  fontSize: number;
  strokeWidth: number;
  selected: boolean;
  pxToImage: SharedValue<number>;
}) {
  const handleRadius = useDerivedValue(() => HANDLE_RADIUS_PX * pxToImage.value);
  const layout = useDerivedValue(() => {
    const current = findAnnotation(live.value, measurement.id);
    const out =
      current?.kind === "measurement"
        ? measurementLayout(current, live.value, fontSize)
        : null;
    return out ?? { p1: OFFSCREEN, p2: OFFSCREEN, label: OFFSCREEN };
  });
  const p1 = useDerivedValue(() => layout.value.p1);
  const p2 = useDerivedValue(() => layout.value.p2);
  const labelX = useDerivedValue(() => layout.value.label.x);
  const labelY = useDerivedValue(() => layout.value.label.y);

  return (
    <>
      <Line p1={p1} p2={p2} color={measurement.color} strokeWidth={strokeWidth} />
      <Text x={labelX} y={labelY} text={formatMeasurement(measurement.value, measurement.unit)} font={font} color={measurement.color} />
      {selected &&
        [p1, p2].map((c, i) => (
          <Circle key={i} c={c} r={handleRadius} color={colors.highlight} />
        ))}
    </>
  );
}
