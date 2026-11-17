import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { EditorScreen } from "@/screens/EditorScreen";
import { loadDoc } from "@/utils/annotations/storage";
import type { AnnotationDoc } from "@/utils/annotations/types";

function load(id: string): AnnotationDoc | null {
  try {
    return loadDoc(id);
  } catch {
    return null;
  }
}

export default function EditorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc] = useState(() => load(id));

  if (!doc) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>This photo could not be opened.</Text>
      </View>
    );
  }
  return <EditorScreen initialDoc={doc} />;
}
