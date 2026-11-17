import { useImage } from "@shopify/react-native-skia";
import { Stack, useRouter } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { deleteRemote, getRemote, saveToServer, toLocalDoc, updateDoc } from "@/api/documents";

import { AnnotationCanvas } from "@/components/canvas/AnnotationCanvas";
import { AddMeasurementRow } from "@/components/AddMeasurementRow";
import { Icon } from "@/components/Icon";
import { MeasurementList } from "@/components/MeasurementList";
import { StatusView } from "@/components/StatusView";
import { MeasurementValueModal } from "@/components/MeasurementValueModal";
import { TextInputModal } from "@/components/TextInputModal";
import { Toolbar } from "@/components/Toolbar";
import type { Tool } from "@/components/Toolbar";
import { useSettings } from "@/hooks/useSettings";
import { styleFor } from "@/utils/annotations/defaults";
import { editorReducer } from "@/utils/annotations/docReducer";
import type { DocAction } from "@/utils/annotations/docReducer";
import type { Selection } from "@/utils/annotations/geometry";
import { findMeasurement, hitSegment, hitTest } from "@/utils/annotations/geometry";
import { makeId } from "@/utils/annotations/makeId";
import { UNASSIGNED, randomValue } from "@/utils/annotations/measurements";
import { deleteLocalDoc, imageUriFor, saveDoc } from "@/utils/annotations/storage";
import { hasUnsavedChanges } from "@/utils/annotations/sync";
import type { AnnotationDoc, Measurement, MeasurementUnit, PenPath, Point, Segment } from "@/utils/annotations/types";
import { SIZE_FACTOR, WIDTH_FACTOR } from "@/utils/settings";
import { colors, radius, typography } from "@/utils/theme";

const AUTOSAVE_MS = 500;

export function EditorScreen({ initialDoc }: { initialDoc: AnnotationDoc }) {
  const router = useRouter();
  const [{ doc, past }, dispatch] = useReducer(editorReducer, { doc: initialDoc, past: [] });
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<PenPath | null>(null);
  const [pendingText, setPendingText] = useState<Point | null>(null);
  /** Segment picked with the Measure tool, waiting for an unassigned card to be tapped. */
  const [linkSegment, setLinkSegment] = useState<Segment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addUnit, setAddUnit] = useState<MeasurementUnit>("cm");
  const { settings } = useSettings();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

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
      router.replace(`/projects/${doc.projectId}/editor/${doc.id}`);
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
    deleteLocalDoc(doc.projectId, doc.id);
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
    setLinkSegment(null);
    setTool(next);
  }

  function handleTap(p: Point, tolerance: number) {
    if (tool === "select") {
      const hit = hitTest(p, doc.annotations, tolerance, style.fontSize);
      // A measurement label opens its editor instead of being selected.
      if (hit && doc.annotations.some((a) => a.id === hit.id && a.kind === "measurement")) {
        setSelection(null);
        setEditingId(hit.id);
      } else {
        setSelection(hit);
      }
    } else if (tool === "measure") {
      const seg = hitSegment(p, doc.annotations, tolerance);
      const existing = seg ? findMeasurement(doc.annotations, seg) : undefined;
      // A segment holds one measurement: tapping a measured one edits it instead.
      if (existing) {
        setLinkSegment(null);
        setEditingId(existing.id);
      } else {
        setLinkSegment(seg);
      }
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
              stroke: settings.lineColor,
              strokeWidth: style.strokeWidth * WIDTH_FACTOR[settings.lineWidth],
            },
      );
    }
  }

  const editing = doc.annotations.find((a): a is Measurement => a.kind === "measurement" && a.id === editingId);

  function confirmEdit(value: number, unit: MeasurementUnit) {
    if (editing) dispatch({ type: "updateMeasurement", id: editing.id, value, unit });
    setEditingId(null);
  }

  function pressCard(m: Measurement) {
    if (linkSegment && m.pathId === null) {
      dispatch({ type: "linkMeasurement", id: m.id, segment: linkSegment });
      setLinkSegment(null);
    } else {
      setEditingId(m.id);
    }
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
        fontSize: style.fontSize * SIZE_FACTOR[settings.textSize],
        color: settings.textColor,
      },
    });
    setPendingText(null);
  }

  function addRandomMeasurement() {
    dispatch({
      type: "add",
      annotation: {
        id: makeId(),
        kind: "measurement",
        ...UNASSIGNED,
        value: randomValue(addUnit),
        unit: addUnit,
        labelOffset: style.labelOffset,
        color: style.measureColor,
      },
    });
  }

  /** While drawing, removes the draft's last point; otherwise steps back one edit. */
  function undo() {
    if (draft) {
      setDraft(draft.anchors.length > 1 ? { ...draft, anchors: draft.anchors.slice(0, -1) } : null);
      return;
    }
    dispatch({ type: "undo" });
    // What these point at may not exist after the undo.
    setSelection(null);
    setLinkSegment(null);
    setEditingId(null);
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
            <Pressable onPress={confirmDelete} disabled={busy} hitSlop={10} accessibilityLabel="Delete photo">
              <Icon name="trash" size={22} color={colors.danger} />
            </Pressable>
            <Pressable
              onPress={save}
              disabled={busy || !unsaved}
              hitSlop={8}
              style={[styles.savePill, unsaved ? styles.savePillOn : styles.savePillOff]}
              accessibilityLabel={unsaved ? "Save" : "Saved"}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.saveLabel, !unsaved && styles.saveLabelOff]}>{unsaved ? "Save" : "Saved"}</Text>
              )}
            </Pressable>
          </View>
        ),
      }}
    />
  );

  if (!image) return <StatusView>{header}</StatusView>;

  const measurements = doc.annotations.filter((a): a is Measurement => a.kind === "measurement");
  // As tall as the photo needs, up to 70% of the screen: enough for 3:4 camera photos to fill the width.
  const canvasHeight = Math.min((windowW * doc.image.height) / doc.image.width, windowH * 0.7);

  return (
    <View style={styles.fill}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 16 }]}>
        <AnnotationCanvas
          image={image}
          height={canvasHeight}
          annotations={annotations}
          tool={tool}
          selection={selection}
          highlight={linkSegment}
          onTap={handleTap}
          onSelect={setSelection}
          onCommit={dispatch}
        />
        <Text style={styles.sectionTitle}>Tools</Text>
        <Toolbar
          tool={tool}
          onToolChange={changeTool}
          onFinishPath={draft && draft.anchors.length >= 2 ? () => finishPath(false) : undefined}
          onDelete={selection ? deleteSelection : undefined}
          onUndo={draft || past.length > 0 ? undo : undefined}
        />
        <Text style={styles.sectionTitle}>Measurements</Text>
        <AddMeasurementRow unit={addUnit} onUnitChange={setAddUnit} onAdd={addRandomMeasurement} />
        <MeasurementList
          measurements={measurements}
          linking={linkSegment !== null}
          onPress={pressCard}
          onRemove={(m) => dispatch({ type: "delete", id: m.id })}
        />
      </ScrollView>
      {editing && (
        <MeasurementValueModal initial={editing} onConfirm={confirmEdit} onCancel={() => setEditingId(null)} />
      )}
      <TextInputModal visible={pendingText !== null} onConfirm={confirmText} onCancel={() => setPendingText(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { gap: 12 },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 16 },
  savePill: { minWidth: 70, height: 32, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  savePillOn: { backgroundColor: colors.tint },
  savePillOff: { backgroundColor: colors.fill },
  saveLabel: { fontSize: 15, fontWeight: "600", color: colors.white },
  saveLabelOff: { color: colors.secondaryLabel },
  sectionTitle: { ...typography.section, paddingHorizontal: 16, marginTop: 4 },
});

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
