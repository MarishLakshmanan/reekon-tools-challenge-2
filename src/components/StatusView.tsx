import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "@/utils/theme";

export const PHOTO_UNAVAILABLE = "This photo could not be opened.";

/** A full-screen centred spinner, or `message` instead when given. `children` render too, e.g. a `Stack.Screen`. */
export function StatusView({ message, children }: { message?: string; children?: ReactNode }) {
  return (
    <View style={styles.center}>
      {children}
      {message ? <Text style={styles.message}>{message}</Text> : <ActivityIndicator />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  message: { fontSize: 16, color: colors.secondaryLabel, textAlign: "center" },
});
