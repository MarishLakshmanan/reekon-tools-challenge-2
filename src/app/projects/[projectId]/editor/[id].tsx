import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";

import { EditorScreen } from "@/screens/EditorScreen";
import { WebEditorScreen } from "@/screens/WebEditorScreen";
import { downloadImage, loadDoc, localImage } from "@/utils/annotations/storage";
import type { AnnotationDoc } from "@/utils/annotations/types";

/**
 * Loads the document, downloading the photo first if it isn't on this phone yet.
 * Skia's `useImage` can't send the auth header, so the editor only ever gets a local file.
 * @returns null when the document or its photo can't be read.
 */
async function load(projectId: string, id: string): Promise<AnnotationDoc | null> {
  try {
    const doc = loadDoc(projectId, id);
    if (!localImage(projectId, id).exists) await downloadImage(projectId, id, doc.image.uri);
    return doc;
  } catch {
    return null;
  }
}

export default function EditorRoute() {
  const { projectId, id } = useLocalSearchParams<{ projectId: string; id: string }>();
  // The web views and edits the server copy directly; the phone works on a local copy.
  return Platform.OS === "web" ? <WebEditorScreen id={id} /> : <PhoneEditor projectId={projectId} id={id} />;
}

function PhoneEditor({ projectId, id }: { projectId: string; id: string }) {
  const [doc, setDoc] = useState<AnnotationDoc | null | undefined>(undefined);

  useEffect(() => {
    let current = true;
    load(projectId, id).then((loaded) => current && setDoc(loaded));
    return () => {
      current = false;
    };
  }, [projectId, id]);

  if (doc === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!doc) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>This photo could not be opened.</Text>
      </View>
    );
  }
  return <EditorScreen initialDoc={doc} />;
}
