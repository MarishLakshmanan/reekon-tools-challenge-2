import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/utils/theme";

const PALETTE = ["#0a84ff", "#5e5ce6", "#ff9500", "#30b0c7", "#ff375f", "#34c759"];

/** A circle with the person's initial, in a colour picked from their name. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const sum = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: PALETTE[sum % PALETTE.length] }]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{name.trim().charAt(0).toUpperCase() || "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The ring keeps overlapping avatars apart.
  circle: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card },
  initial: { color: colors.white, fontWeight: "700" },
});
