import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Photos" }} />
        <Stack.Screen name="camera" options={{ title: "Camera" }} />
        <Stack.Screen name="editor/[id]" options={{ title: "Annotate" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
