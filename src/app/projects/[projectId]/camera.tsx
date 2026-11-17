import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { createDoc } from "@/utils/annotations/storage";

export default function Camera() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!permission) return <View style={styles.center} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>The camera is needed to take a photo to annotate.</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  async function capture() {
    if (!camera.current || !ready || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync();
      const doc = await createDoc(projectId, photo.uri);
      router.replace(`/projects/${projectId}/editor/${doc.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.fill}>
      <CameraView ref={camera} style={styles.fill} facing="back" onCameraReady={() => setReady(true)} />
      <Pressable style={[styles.shutter, (!ready || busy) && styles.disabled]} onPress={capture} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  message: { textAlign: "center" },
  permissionButton: { backgroundColor: "#0a84ff", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  permissionText: { color: "white", fontWeight: "600" },
  shutter: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "white",
    borderWidth: 4,
    borderColor: "rgba(0,0,0,0.3)",
  },
  disabled: { opacity: 0.4 },
});
