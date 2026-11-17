import { useFocusEffect, useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { createDoc, listDocs } from "@/utils/annotations/storage";
import type { AnnotationDoc } from "@/utils/annotations/types";

export default function Home() {
  const router = useRouter();
  const [docs, setDocs] = useState<AnnotationDoc[]>([]);

  useFocusEffect(
    useCallback(() => {
      setDocs(listDocs());
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
          <Image source={item.image.uri} style={styles.thumb} contentFit="cover" />
          <Text style={styles.caption}>{item.annotations.length} annotations</Text>
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
  caption: { marginTop: 4, fontSize: 12, color: "#666" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
});
