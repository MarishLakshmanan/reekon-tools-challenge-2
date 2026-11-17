import { Canvas, Group, Image, Skia } from "@shopify/react-native-skia";
import type { SkImage, SkTypeface } from "@shopify/react-native-skia";
import { useEffect, useRef, useState } from "react";
import type { ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { MeasurementShape } from "@/components/canvas/MeasurementShape";
import { PathShape } from "@/components/canvas/PathShape";
import { TextShape } from "@/components/canvas/TextShape";
import { HIT_SLOP_PX, styleFor } from "@/utils/annotations/defaults";
import type { Camera } from "@/utils/annotations/geometry";
import {
  IDENTITY_CAMERA,
  clampCamera,
  combineView,
  fitTransform,
  hitTest,
  toImagePoint,
  zoomAround,
} from "@/utils/annotations/geometry";
import type { Annotation } from "@/utils/annotations/types";

/** Pointer movement, in screen pixels, after which a press pans instead of clicking. */
const CLICK_SLOP_PX = 4;
/** Zoom change per pixel of wheel scroll. */
const WHEEL_ZOOM_RATE = 0.0015;

/**
 * Read-only canvas for the web: the photo and its annotations, zoomed with the mouse wheel
 * and panned by dragging. A click on a measurement or text label reports its id.
 */
export function WebCanvas({
  image,
  typeface,
  height,
  annotations,
  onPick,
}: {
  image: SkImage;
  typeface: SkTypeface;
  height: number;
  annotations: Annotation[];
  onPick: (id: string) => void;
}) {
  const imageW = image.width();
  const imageH = image.height();
  const style = styleFor(imageW);
  const font = Skia.Font(typeface, style.fontSize);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>(IDENTITY_CAMERA);
  const fit = fitTransform(size.width || 1, size.height || 1, imageW, imageH);
  const view = combineView(fit, camera);

  // The shapes are shared with the phone canvas, which reads these as shared values.
  const live = useSharedValue(annotations);
  const pxToImage = useSharedValue(1 / view.scale);
  useEffect(() => {
    live.set(annotations);
    pxToImage.set(1 / view.scale);
  }, [annotations, view.scale, live, pxToImage]);

  // The DOM listeners are added once, so they read the latest values from here.
  const latest = useRef({ fit, size, view, annotations, onPick });
  useEffect(() => {
    latest.current = { fit, size, view, annotations, onPick };
  });

  const boxRef = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    // On react-native-web a View's ref is its DOM element.
    const el = boxRef.current as unknown as HTMLElement | null;
    if (!el) return;
    el.style.touchAction = "none";

    const clamp = (cam: Camera) => {
      const { fit: f, size: s } = latest.current;
      return clampCamera(cam, f, s.width, s.height, imageW, imageH);
    };
    const local = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    function onWheel(e: WheelEvent) {
      e.preventDefault(); // zoom the photo, not scroll the page
      const focal = local(e);
      setCamera((c) => clamp(zoomAround(c, focal, Math.exp(-e.deltaY * WHEEL_ZOOM_RATE))));
    }

    let press: { startX: number; startY: number; lastX: number; lastY: number; panning: boolean } | null = null;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      el!.setPointerCapture(e.pointerId);
      press = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, panning: false };
    }

    function onPointerMove(e: PointerEvent) {
      if (!press) return;
      if (!press.panning && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < CLICK_SLOP_PX) return;
      press.panning = true;
      const dx = e.clientX - press.lastX;
      const dy = e.clientY - press.lastY;
      press.lastX = e.clientX;
      press.lastY = e.clientY;
      setCamera((c) => clamp({ zoom: c.zoom, x: c.x + dx, y: c.y + dy }));
    }

    function onPointerUp(e: PointerEvent) {
      const wasClick = press !== null && !press.panning;
      press = null;
      if (!wasClick) return;
      const { view: v, annotations: list, onPick: pick } = latest.current;
      const { x, y } = local(e);
      const hit = hitTest(toImagePoint(x, y, v), list, HIT_SLOP_PX / v.scale, style.fontSize);
      const target = hit && list.find((a) => a.id === hit.id);
      if (target && (target.kind === "measurement" || target.kind === "text")) pick(target.id);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [imageW, imageH, style.fontSize]);

  const transform = [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.scale }];

  return (
    <View
      ref={boxRef}
      style={[styles.box, { height }]}
      onLayout={(e) => {
        // A new canvas size means a new fit, so start again at 1x.
        setSize(e.nativeEvent.layout);
        setCamera(IDENTITY_CAMERA);
      }}
    >
      <Canvas style={styles.fill}>
        <Group transform={transform}>
          <Image image={image} x={0} y={0} width={imageW} height={imageH} />
          {annotations.map((a) => {
            if (a.kind === "path") {
              return <PathShape key={a.id} live={live} path={a} showAnchors={false} pxToImage={pxToImage} />;
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
                  selected={false}
                  pxToImage={pxToImage}
                />
              );
            }
            return (
              <TextShape key={a.id} live={live} label={a} selected={false} pxToImage={pxToImage} typeface={typeface} />
            );
          })}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  box: { width: "100%", overflow: "hidden", backgroundColor: "black", cursor: "grab" },
});
