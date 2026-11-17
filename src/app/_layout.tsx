import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { SessionProvider, useSession } from "@/hooks/useSession";
import { SettingsProvider } from "@/hooks/useSettings";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { loading, me } = useSession();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Held on the splash screen until the saved token has been checked.
  if (loading) return null;

  return (
    <Stack>
      <Stack.Protected guard={!!me}>
        <Stack.Screen name="index" options={{ title: me?.org.name ?? "" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="projects/[projectId]/index" options={{ title: "Project" }} />
        <Stack.Screen name="projects/[projectId]/camera" options={{ title: "Camera" }} />
        {/* Opaque on iOS 26, where headers are transparent by default and the photo would draw under it. */}
        <Stack.Screen
          name="projects/[projectId]/editor/[id]"
          options={{ title: "Annotate", headerTransparent: false, headerStyle: { backgroundColor: "white" } }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!me}>
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SessionProvider>
        <SettingsProvider>
          {/* On a wide window (the web) the app is a centred column; a phone is narrower, so this has no effect there. */}
          <View style={styles.column}>
            <Routes />
          </View>
        </SettingsProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", backgroundColor: "#d1d1d6" },
  column: { flex: 1, width: "100%", maxWidth: 960 },
});
