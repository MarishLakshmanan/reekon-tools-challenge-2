import { useImage } from "@shopify/react-native-skia";
import { useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { AnnotationCanvas } from "@/components/canvas/AnnotationCanvas";
import { MeasurementValueModal } from "@/components/MeasurementValueModal";
import { TextInputModal } from "@/components/TextInputModal";
import { Toolbar } from "@/components/Toolbar";
import type { Tool } from "@/components/Toolbar";
import { styleFor } from "@/utils/annotations/defaults";
import { docReducer } from "@/utils/annotations/docReducer";
import type { DocAction } from "@/utils/annotations/docReducer";
import type { Segment, Selection } from "@/utils/annotations/geometry";
import { findMeasurement, hitSegment, hitTest } from "@/utils/annotations/geometry";
import { makeId } from "@/utils/annotations/makeId";
import { saveDoc } from "@/utils/annotations/storage";
import type { AnnotationDoc, MeasurementUnit, PenPath, Point } from "@/utils/annotations/types";

const AUTOSAVE_MS = 500;

export function EditorScreen({ initialDoc }: { initialDoc: AnnotationDoc }) {
  const [doc, dispatch] = useReducer(docReducer, initialDoc);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<PenPath | null>(null);
  const [pendingText, setPendingText] = useState<Point | null>(null);
  const [pendingSegment, setPendingSegment] = useState<Segment | null>(null);

  const image = useImage(doc.image.uri);
  const style = styleFor(doc.image.width);
  const annotations = draft ? [...doc.annotations, draft] : doc.annotations;

  // Save shortly after the last edit, and once more when leaving the screen.
  const latest = useRef(doc);
  useEffect(() => {
    latest.current = doc;
    if (doc === initialDoc) return;
    const timer = setTimeout(() => saveDoc(doc), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, initialDoc]);
  useEffect(
    () => () => {
      if (latest.current !== initialDoc) saveDoc(latest.current);
    },
    [initialDoc],
  );

  function finishPath(closed: boolean) {
    if (draft && draft.anchors.length >= 2) {
      dispatch({ type: "add", annotation: { ...draft, closed } });
    }
    setDraft(null);
  }

  function changeTool(next: Tool) {
    finishPath(false);
    setSelection(null);
    setTool(next);
  }

  function handleTap(p: Point, tolerance: number) {
    if (tool === "select") {
      setSelection(hitTest(p, doc.annotations, tolerance, style.fontSize));
    } else if (tool === "measure") {
      setPendingSegment(hitSegment(p, doc.annotations, tolerance));
    } else if (tool === "text") {
      setPendingText(p);
    } else if (tool === "pen") {
      const first = draft?.anchors[0]?.point;
      if (draft && first && draft.anchors.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) <= tolerance) {
        finishPath(true);
        return;
      }
      const anchor = { id: makeId(), point: p };
      setDraft(
        draft
          ? { ...draft, anchors: [...draft.anchors, anchor] }
          : {
              id: makeId(),
              kind: "path",
              anchors: [anchor],
              closed: false,
              stroke: style.pathColor,
              strokeWidth: style.strokeWidth,
            },
      );
    }
  }

  const existingMeasurement = pendingSegment ? findMeasurement(doc.annotations, pendingSegment) : undefined;

  function confirmMeasure(value: number, unit: MeasurementUnit) {
    if (!pendingSegment) return;
    if (existingMeasurement) {
      dispatch({ type: "updateMeasurement", id: existingMeasurement.id, value, unit });
    } else {
      dispatch({
        type: "add",
        annotation: {
          id: makeId(),
          kind: "measurement",
          ...pendingSegment,
          value,
          unit,
          labelOffset: style.labelOffset,
          color: style.measureColor,
        },
      });
    }
    setPendingSegment(null);
  }

  function confirmText(text: string) {
    if (!pendingText) return;
    dispatch({
      type: "add",
      annotation: {
        id: makeId(),
        kind: "text",
        position: pendingText,
        text,
        fontSize: style.fontSize,
        color: style.textColor,
      },
    });
    setPendingText(null);
  }

  function deleteSelection() {
    if (!selection) return;
    const action: DocAction = selection.anchorId
      ? { type: "deleteAnchor", pathId: selection.id, anchorId: selection.anchorId }
      : { type: "delete", id: selection.id };
    dispatch(action);
    setSelection(null);
  }

  if (!image) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <AnnotationCanvas
        image={image}
        annotations={annotations}
        tool={tool}
        selection={selection}
        onTap={handleTap}
        onSelect={setSelection}
        onCommit={dispatch}
      />
      <Toolbar
        tool={tool}
        onToolChange={changeTool}
        onFinishPath={draft && draft.anchors.length >= 2 ? () => finishPath(false) : undefined}
        onDelete={selection ? deleteSelection : undefined}
      />
      {pendingSegment && (
        <MeasurementValueModal
          initial={existingMeasurement}
          onConfirm={confirmMeasure}
          onCancel={() => setPendingSegment(null)}
        />
      )}
      <TextInputModal visible={pendingText !== null} onConfirm={confirmText} onCancel={() => setPendingText(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "black" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
