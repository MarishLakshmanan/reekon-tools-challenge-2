import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { syncWithServer } from "@/api/sync";
import { createDoc, imageUriFor, listDocs } from "@/utils/annotations/storage";
import { hasUnsavedChanges } from "@/utils/annotations/sync";
import type { AnnotationDoc } from "@/utils/annotations/types";

export default function Home() {
  const router = useRouter();
  const [docs, setDocs] = useState<AnnotationDoc[]>([]);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let focused = true;
      setDocs(listDocs());
      syncWithServer()
        .then((ids) => {
          if (!focused) return;
          setConflicts(ids);
          setDocs(listDocs());
        })
        .catch(() => {}); // offline: the local list is already shown
      return () => {
        focused = false;
      };
    }, []),
  );

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
    if (result.canceled) return;
    const doc = await createDoc(result.assets[0].uri);
    router.push(`/editor/${doc.id}`);
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={docs}
      keyExtractor={(d) => d.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={
        <View style={styles.actions}>
          <Pressable style={styles.button} onPress={() => router.push("/camera")}>
            <Text style={styles.buttonText}>Take photo</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={pickPhoto}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Pick photo</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No photos yet.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => router.push(`/editor/${item.id}`)}>
          <Image source={imageUriFor(item)} style={styles.thumb} contentFit="cover" />
          <View style={styles.captionRow}>
            <Text style={styles.caption}>{item.annotations.length} annotations</Text>
            {conflicts.has(item.id) ? (
              <Text style={[styles.badge, styles.conflict]}>Conflict</Text>
            ) : (
              hasUnsavedChanges(item) && <Text style={styles.badge}>Unsaved</Text>
            )}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  actions: { flexDirection: "row", gap: 12, marginBottom: 16 },
  button: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: "#0a84ff", alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600" },
  secondary: { backgroundColor: "#e5e5ea" },
  secondaryText: { color: "#111" },
  row: { gap: 12, marginBottom: 12 },
  card: { flex: 1 },
  thumb: { aspectRatio: 1, borderRadius: 10, backgroundColor: "#ddd" },
  captionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  caption: { fontSize: 12, color: "#666" },
  badge: { fontSize: 12, fontWeight: "600", color: "#ff9500" },
  conflict: { color: "#ff3b30" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
});
