import { Canvas, Group, Image } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { AnnotationShapes } from "@/components/canvas/AnnotationShapes";
import { SegmentHighlight } from "@/components/canvas/SegmentHighlight";
import { systemFont } from "@/components/canvas/shared";
import type { Tool } from "@/components/Toolbar";
import { HIT_SLOP_PX, styleFor } from "@/utils/annotations/defaults";
import type { DocAction } from "@/utils/annotations/docReducer";
import { applyAction } from "@/utils/annotations/docReducer";
import type { Camera, Drag, DragTarget, Selection, ViewTransform } from "@/utils/annotations/geometry";
import {
  IDENTITY_CAMERA,
  clampCamera,
  combineView,
  dragToAction,
  fitTransform,
  pickDragTarget,
  targetSelection,
  toImagePoint,
  zoomAround,
} from "@/utils/annotations/geometry";
import type { Annotation, Point, Segment } from "@/utils/annotations/types";

export function AnnotationCanvas({
  image,
  height,
  annotations,
  tool,
  selection,
  highlight,
  onTap,
  onSelect,
  onCommit,
}: {
  image: SkImage;
  /** Height of the canvas box; the box clips everything drawn outside it. */
  height: number;
  /** Saved annotations plus any pen path still being drawn. */
  annotations: Annotation[];
  tool: Tool;
  selection: Selection | null;
  /** Segment to draw highlighted, or null. */
  highlight: Segment | null;
  onTap: (point: Point, tolerance: number) => void;
  onSelect: (selection: Selection) => void;
  onCommit: (action: DocAction) => void;
}) {
  const imageW = image.width();
  const imageH = image.height();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const fit = fitTransform(size.width || 1, size.height || 1, imageW, imageH);
  const { fontSize } = styleFor(imageW);
  const font = systemFont(fontSize);

  // Shared copies of what the gestures need, since they run on the UI thread.
  const docSV = useSharedValue(annotations);
  const dragSV = useSharedValue<Drag | null>(null);
  const targetSV = useSharedValue<DragTarget | null>(null);
  const toolSV = useSharedValue<Tool>(tool);
  const fitSV = useSharedValue<ViewTransform>(fit);
  const sizeSV = useSharedValue(size);
  const cameraSV = useSharedValue<Camera>(IDENTITY_CAMERA);
  const panningSV = useSharedValue(false);
  /** Image pixels -> screen pixels, with the camera applied. */
  const viewSV = useDerivedValue(() => combineView(fitSV.value, cameraSV.value));
  const groupTransform = useDerivedValue(() => {
    const v = viewSV.value;
    return [{ translateX: v.tx }, { translateY: v.ty }, { scale: v.scale }];
  });
  const pxToImage = useDerivedValue(() => 1 / viewSV.value.scale);

  useEffect(() => {
    fitSV.set(fit);
    toolSV.set(tool);
  });

  // A new canvas size means a new fit, so start again at 1x.
  useEffect(() => {
    sizeSV.set(size);
    cameraSV.set(IDENTITY_CAMERA);
  }, [size, sizeSV, cameraSV]);

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

  /** Moves/zooms the camera, keeping the photo covering the canvas. */
  const setCamera = (cam: Camera) => {
    "worklet";
    cameraSV.set(clampCamera(cam, fitSV.value, sizeSV.value.width, sizeSV.value.height, imageW, imageH));
  };
  const panCamera = (dx: number, dy: number) => {
    "worklet";
    const c = cameraSV.value;
    setCamera({ zoom: c.zoom, x: c.x + dx, y: c.y + dy });
  };

  // Pinch and two-finger drag each apply only their own change, so they can run together.
  const pinch = usePinchGesture({
    onUpdate: (e) => {
      "worklet";
      setCamera(zoomAround(cameraSV.value, { x: e.focalX, y: e.focalY }, e.scaleChange));
    },
  });
  const twoFingerPan = usePanGesture({
    minPointers: 2,
    onUpdate: (e) => {
      "worklet";
      panCamera(e.changeX, e.changeY);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      "worklet";
      cameraSV.set(withTiming(IDENTITY_CAMERA, { duration: 200 }));
    },
  });

  const tap = useTapGesture({
    onActivate: (e) => {
      "worklet";
      const v = viewSV.value;
      scheduleOnRN(onTap, toImagePoint(e.x, e.y, v), HIT_SLOP_PX / v.scale);
    },
  });

  // One finger in the select tool drags what is under it, or the photo when it starts on empty space.
  const pan = usePanGesture({
    minDistance: 4,
    maxPointers: 1,
    onBegin: (e) => {
      "worklet";
      targetSV.set(null);
      panningSV.set(false);
      if (toolSV.value !== "select") return;
      const v = viewSV.value;
      const target = pickDragTarget(toImagePoint(e.x, e.y, v), docSV.value, HIT_SLOP_PX / v.scale, fontSize);
      targetSV.set(target);
      if (target) scheduleOnRN(onSelect, targetSelection(target));
      else panningSV.set(true);
    },
    onActivate: () => {
      "worklet";
      if (toolSV.value === "select" && targetSV.value) {
        dragSV.set({ target: targetSV.value, delta: { x: 0, y: 0 } });
      }
    },
    onUpdate: (e) => {
      "worklet";
      if (panningSV.value) {
        panCamera(e.changeX, e.changeY);
        return;
      }
      const drag = dragSV.value;
      if (!drag) return;
      const scale = viewSV.value.scale;
      dragSV.set({ target: drag.target, delta: { x: e.translationX / scale, y: e.translationY / scale } });
    },
    onDeactivate: () => {
      "worklet";
      panningSV.set(false);
      if (dragSV.value) scheduleOnRN(onCommit, dragToAction(dragSV.value));
    },
  });

  const oneFinger = useExclusiveGestures(pan, doubleTap, tap);
  const gesture = useSimultaneousGestures(pinch, twoFingerPan, oneFinger);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.box, { height }]}
        onLayout={(e) => setSize(e.nativeEvent.layout)}
      >
        <Canvas style={styles.fill}>
          <Group transform={groupTransform}>
            <Image image={image} x={0} y={0} width={imageW} height={imageH} />
            <AnnotationShapes
              annotations={annotations}
              live={live}
              pxToImage={pxToImage}
              imageWidth={imageW}
              font={font}
              selection={selection}
              showAnchors={tool === "pen" || tool === "measure"}
            />
            {highlight && <SegmentHighlight live={live} segment={highlight} pxToImage={pxToImage} />}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  box: { width: "100%", overflow: "hidden", backgroundColor: "black" },
});
