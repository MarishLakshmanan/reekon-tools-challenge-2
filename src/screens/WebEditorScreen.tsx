import { Skia, useTypeface } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { request } from "@/api/client";
import { ApiError, getRemote, updateDoc } from "@/api/documents";
import type { RemoteDoc } from "@/api/documents";
import { WebCanvas } from "@/components/canvas/WebCanvas";
import { MeasurementList } from "@/components/MeasurementList";
import { MeasurementValueModal } from "@/components/MeasurementValueModal";
import { TextInputModal } from "@/components/TextInputModal";
import { applyAction } from "@/utils/annotations/docReducer";
import type { DocAction } from "@/utils/annotations/docReducer";
import type { Measurement } from "@/utils/annotations/types";

const MAX_WIDTH = 960;

/** Decodes the photo into a Skia image. It's fetched with the auth header, which Skia's `useImage` can't send. */
async function loadImage(path: string): Promise<SkImage | null> {
  const bytes = await (await request(path)).arrayBuffer();
  return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(bytes)));
}

/**
 * The web editor: view a document from the server and edit its measurement values and text labels.
 * Nothing is kept locally. Each edit is a PUT with the version it was made on; when another
 * device saved first, the server copy replaces the page and the edit is dropped.
 */
export function WebEditorScreen({ id }: { id: string }) {
  const [doc, setDoc] = useState<RemoteDoc | null>(null);
  const [image, setImage] = useState<SkImage | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const typeface = useTypeface(require("@/assets/fonts/Roboto-Regular.ttf"));
  const { width: windowW, height: windowH } = useWindowDimensions();

  useEffect(() => {
    let current = true;
    getRemote(id)
      .then(async (remote) => {
        const decoded = await loadImage(remote.image.uri);
        if (!current) return;
        setDoc(remote);
        setImage(decoded);
        if (!decoded) setFailed(true);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [id]);

  async function commit(action: DocAction) {
    if (!doc) return;
    const annotations = applyAction(doc.annotations, action);
    setBusy(true);
    setNotice(null);
    try {
      const { version, updatedAt } = await updateDoc(doc.id, annotations, doc.version);
      setDoc({ ...doc, annotations, version, updatedAt });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setNotice("Changed on another device. Showing the latest version; your edit was not saved.");
        setDoc(await getRemote(doc.id).catch(() => doc));
      } else {
        setNotice("Could not save the change.");
      }
    } finally {
      setBusy(false);
    }
  }

  const header = <Stack.Screen options={{ headerRight: () => (busy ? <ActivityIndicator /> : null) }} />;

  if (failed) {
    return (
      <View style={styles.center}>
        {header}
        <Text>This photo could not be opened.</Text>
      </View>
    );
  }
  if (!doc || !image || !typeface) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator />
      </View>
    );
  }

  const editing = doc.annotations.find((a) => a.id === editingId);
  const measurements = doc.annotations.filter((a): a is Measurement => a.kind === "measurement");
  const width = Math.min(windowW, MAX_WIDTH);
  const canvasHeight = Math.min((width * doc.image.height) / doc.image.width, windowH * 0.7);
  const edit = (targetId: string) => !busy && setEditingId(targetId);

  return (
    <View style={styles.fill}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.column, { width }]}>
          <WebCanvas
            image={image}
            typeface={typeface}
            height={canvasHeight}
            annotations={doc.annotations}
            onPick={edit}
          />
          {notice && <Text style={styles.notice}>{notice}</Text>}
          <MeasurementList measurements={measurements} linking={false} onPress={(m) => edit(m.id)} />
        </View>
      </ScrollView>
      {editing?.kind === "measurement" && (
        <MeasurementValueModal
          initial={editing}
          onConfirm={(value, unit) => {
            setEditingId(null);
            commit({ type: "updateMeasurement", id: editing.id, value, unit });
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
      {editing?.kind === "text" && (
        <TextInputModal
          visible
          title="Edit text"
          confirmLabel="Save"
          initial={editing.text}
          onConfirm={(text) => {
            setEditingId(null);
            commit({ type: "updateText", id: editing.id, text });
          }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "white" },
  content: { alignItems: "center", paddingBottom: 24 },
  column: { gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  notice: { marginHorizontal: 16, color: "#ff3b30" },
});
