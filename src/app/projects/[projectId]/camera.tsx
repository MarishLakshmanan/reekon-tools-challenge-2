import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { createDoc } from "@/utils/annotations/storage";
import { colors } from "@/utils/theme";

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
        <Button label="Allow camera" icon="camera" onPress={requestPermission} />
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
      <Pressable
        style={[styles.shutter, (!ready || busy) && styles.disabled]}
        onPress={capture}
        accessibilityLabel="Take photo"
      >
        {busy ? <ActivityIndicator color={colors.label} /> : <View style={styles.shutterInner} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  message: { textAlign: "center", fontSize: 16, color: colors.secondaryLabel },
  shutter: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "white" },
  disabled: { opacity: 0.5 },
});
