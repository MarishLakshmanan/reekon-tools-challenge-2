import {
  Canvas,
  Group,
  Image,
  matchFont,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureDetector, useExclusiveGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { MeasurementShape } from "@/components/canvas/MeasurementShape";
import { PathShape } from "@/components/canvas/PathShape";
import { TextShape } from "@/components/canvas/TextShape";
import type { Tool } from "@/components/Toolbar";
import { HIT_SLOP_PX, styleFor } from "@/utils/annotations/defaults";
import type { DocAction } from "@/utils/annotations/docReducer";
import { applyAction } from "@/utils/annotations/docReducer";
import type { Drag, DragTarget, Selection, ViewTransform } from "@/utils/annotations/geometry";
import { dragToAction, fitTransform, pickDragTarget, targetSelection, toImagePoint } from "@/utils/annotations/geometry";
import type { Annotation, Point } from "@/utils/annotations/types";

export function AnnotationCanvas({
  image,
  annotations,
  tool,
  selection,
  onTap,
  onSelect,
  onCommit,
}: {
  image: SkImage;
  /** Saved annotations plus any pen path still being drawn. */
  annotations: Annotation[];
  tool: Tool;
  selection: Selection | null;
  onTap: (point: Point, tolerance: number) => void;
  onSelect: (selection: Selection) => void;
  onCommit: (action: DocAction) => void;
}) {
  const imageW = image.width();
  const imageH = image.height();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const view = fitTransform(size.width || 1, size.height || 1, imageW, imageH);
  const style = styleFor(imageW);
  const fontSize = style.fontSize;
  const font = matchFont({
    fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }),
    fontSize: style.fontSize,
  });

  // Shared copies of what the gestures need, since they run on the UI thread.
  const docSV = useSharedValue(annotations);
  const dragSV = useSharedValue<Drag | null>(null);
  const targetSV = useSharedValue<DragTarget | null>(null);
  const viewSV = useSharedValue<ViewTransform>(view);
  const toolSV = useSharedValue<Tool>(tool);

  useEffect(() => {
    viewSV.set(view);
    toolSV.set(tool);
  });

  // The edit has landed in React state, so the live preview can stop.
  useEffect(() => {
    docSV.set(annotations);
    dragSV.set(null);
  }, [annotations, docSV, dragSV]);

  // What is drawn: the document with any drag applied, computed on the UI thread.
  const live = useDerivedValue(() => {
    const drag = dragSV.value;
    return drag ? applyAction(docSV.value, dragToAction(drag)) : docSV.value;
  });

  const tap = useTapGesture({
    onActivate: (e) => {
      "worklet";
      const v = viewSV.value;
      scheduleOnRN(onTap, toImagePoint(e.x, e.y, v), HIT_SLOP_PX / v.scale);
    },
  });

  // Dragging only happens in the select tool; other tools act on taps.
  const pan = usePanGesture({
    minDistance: 4,
    onBegin: (e) => {
      "worklet";
      if (toolSV.value !== "select") return;
      const v = viewSV.value;
      const target = pickDragTarget(toImagePoint(e.x, e.y, v), docSV.value, HIT_SLOP_PX / v.scale, fontSize);
      targetSV.set(target);
      if (target) scheduleOnRN(onSelect, targetSelection(target));
    },
    onActivate: () => {
      "worklet";
      if (toolSV.value === "select" && targetSV.value) {
        dragSV.set({ target: targetSV.value, delta: { x: 0, y: 0 } });
      }
    },
    onUpdate: (e) => {
      "worklet";
      const drag = dragSV.value;
      if (!drag) return;
      const scale = viewSV.value.scale;
      dragSV.set({ target: drag.target, delta: { x: e.translationX / scale, y: e.translationY / scale } });
    },
    onDeactivate: () => {
      "worklet";
      if (dragSV.value) scheduleOnRN(onCommit, dragToAction(dragSV.value));
    },
  });

  const gesture = useExclusiveGestures(pan, tap);
  const pxToImage = 1 / view.scale;
  const anchorsVisible = tool === "pen" || tool === "measure";

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.fill}
        onLayout={(e) => setSize(e.nativeEvent.layout)}
      >
        <Canvas style={styles.fill}>
          <Group transform={[{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }]}>
            <Image image={image} x={0} y={0} width={imageW} height={imageH} />
            {annotations.map((a) => {
              const selected = a.id === selection?.id;
              if (a.kind === "path") {
                return (
                  <PathShape
                    key={a.id}
                    live={live}
                    path={a}
                    showAnchors={anchorsVisible || selected}
                    selectedAnchorId={selected ? selection?.anchorId : undefined}
                    pxToImage={pxToImage}
                  />
                );
              }
              if (a.kind === "measurement") {
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
              return <TextShape key={a.id} live={live} label={a} font={font} selected={selected} pxToImage={pxToImage} />;
            })}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
