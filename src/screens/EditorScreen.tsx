import { useImage } from "@shopify/react-native-skia";
import { Stack, useRouter } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, deleteRemote, getRemote, saveToServer, toLocalDoc, updateDoc } from "@/api/documents";

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
import { deleteLocalDoc, imageUriFor, saveDoc } from "@/utils/annotations/storage";
import { hasUnsavedChanges } from "@/utils/annotations/sync";
import type { AnnotationDoc, MeasurementUnit, PenPath, Point } from "@/utils/annotations/types";

const AUTOSAVE_MS = 500;

export function EditorScreen({ initialDoc }: { initialDoc: AnnotationDoc }) {
  const router = useRouter();
  const [doc, dispatch] = useReducer(docReducer, initialDoc);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<PenPath | null>(null);
  const [pendingText, setPendingText] = useState<Point | null>(null);
  const [pendingSegment, setPendingSegment] = useState<Segment | null>(null);

  // Resolved once: `doc.image.uri` becomes the server URL on the first Save, but the local file stays.
  const [imageUri] = useState(() => imageUriFor(initialDoc));
  const image = useImage(imageUri);
  const style = styleFor(doc.image.width);
  const annotations = draft ? [...doc.annotations, draft] : doc.annotations;

  // Save shortly after the last edit, and once more when leaving the screen.
  // `discarded` stops both once the local copy is deleted or replaced by the server's.
  const latest = useRef(doc);
  const discarded = useRef(false);
  useEffect(() => {
    latest.current = doc;
    if (doc === initialDoc) return;
    const timer = setTimeout(() => {
      if (!discarded.current) saveDoc(doc);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, initialDoc]);
  useEffect(
    () => () => {
      if (latest.current !== initialDoc && !discarded.current) saveDoc(latest.current);
    },
    [initialDoc],
  );

  async function save() {
    const sent = latest.current;
    setBusy(true);
    try {
      await saveDoc(sent);
      const { version, imageUri } = await saveToServer(sent);
      dispatch({ type: "markSaved", serverVersion: version, savedAt: sent.updatedAt, imageUri });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) askConflict();
      else Alert.alert("Could not save", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function askConflict() {
    Alert.alert("Changed on another device", "This photo was saved somewhere else since you last saved it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Use server", style: "destructive", onPress: takeServerCopy },
      { text: "Keep mine", onPress: keepMine },
    ]);
  }

  async function keepMine() {
    const sent = latest.current;
    setBusy(true);
    try {
      const remote = await getRemote(sent.id);
      const { version } = await updateDoc(sent.id, sent.annotations, remote.version);
      dispatch({ type: "markSaved", serverVersion: version, savedAt: sent.updatedAt });
    } catch (e) {
      Alert.alert("Could not save", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function takeServerCopy() {
    setBusy(true);
    try {
      const remote = await getRemote(doc.id);
      discarded.current = true;
      await saveDoc(toLocalDoc(remote));
      // Same route again, so the editor remounts with the server's document.
      router.replace(`/editor/${doc.id}`);
    } catch (e) {
      discarded.current = false;
      Alert.alert("Could not load the server copy", errorMessage(e));
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete photo?", "It will be removed from this phone and the server.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: remove },
    ]);
  }

  async function remove() {
    setBusy(true);
    try {
      // Never uploaded means there is nothing on the server to remove.
      if (latest.current.serverVersion !== null) await deleteRemote(doc.id);
    } catch (e) {
      Alert.alert("Could not delete", errorMessage(e));
      setBusy(false);
      return;
    }
    discarded.current = true;
    deleteLocalDoc(doc.id);
    router.back();
  }

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

  const unsaved = hasUnsavedChanges(doc);
  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={styles.headerButtons}>
            <Pressable onPress={confirmDelete} disabled={busy} hitSlop={8}>
              <Text style={[styles.headerButton, styles.danger, busy && styles.disabled]}>Delete</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy || !unsaved} hitSlop={8}>
              {busy ? (
                <ActivityIndicator />
              ) : (
                <Text style={[styles.headerButton, !unsaved && styles.disabled]}>{unsaved ? "Save •" : "Saved"}</Text>
              )}
            </Pressable>
          </View>
        ),
      }}
    />
  );

  if (!image) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {header}
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
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 20 },
  headerButton: { fontSize: 16, fontWeight: "600", color: "#0a84ff" },
  danger: { color: "#ff3b30" },
  disabled: { opacity: 0.4 },
});

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
