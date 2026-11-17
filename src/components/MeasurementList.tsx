import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatMeasurement } from "@/utils/annotations/measurements";
import type { Measurement } from "@/utils/annotations/types";

/** Fixed colors: blue for measurements on a segment, orange for unassigned ones. */
const LINKED = "#0a84ff";
const UNASSIGNED = "#ff9f0a";

/** Side of a square card. Fixed, because `aspectRatio` is ignored in a wrapping row on Android. */
const CARD_SIZE = 110;

/**
 * Linked measurements first, then unassigned ones, each in draw order.
 * While `linking`, tapping an unassigned card puts it on the highlighted segment; otherwise a tap edits.
 */
export function MeasurementList({
  measurements,
  linking,
  onPress,
  onRemove,
}: {
  measurements: Measurement[];
  linking: boolean;
  onPress: (m: Measurement) => void;
  /** Shows a remove button on each card when given. */
  onRemove?: (m: Measurement) => void;
}) {
  const linked = measurements.filter((m) => m.pathId !== null);
  const unassigned = measurements.filter((m) => m.pathId === null);
  const hint = unassigned.length > 0 ? "Tap an orange measurement to put it on the highlighted line." : "Add a measurement, then tap it to put it on the highlighted line.";

  return (
    <View style={styles.grid}>
      {linking && <Text style={styles.hint}>{hint}</Text>}
      {measurements.length === 0 && !linking && <Text style={styles.empty}>No measurements yet</Text>}
      {[...linked, ...unassigned].map((m) => {
        const color = m.pathId === null ? UNASSIGNED : LINKED;
        const target = linking && m.pathId === null;
        return (
          <Pressable
            key={m.id}
            style={[styles.card, { borderTopColor: color }, target && styles.target]}
            onPress={() => onPress(m)}
          >
            <Text style={styles.value}>{formatMeasurement(m.value, m.unit)}</Text>
            {onRemove && (
              <Pressable style={styles.removeButton} onPress={() => onRemove(m)} hitSlop={10} accessibilityLabel={`Remove ${formatMeasurement(m.value, m.unit)}`}>
                <Text style={styles.remove}>×</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8 },
  // Full-width rows inside the wrapping grid.
  empty: { width: "100%", color: "#666", textAlign: "center", paddingVertical: 16 },
  hint: { width: "100%", color: "#ff9f0a", fontWeight: "600", textAlign: "center", paddingVertical: 4 },
  // Squares; the color bar is on the top edge.
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderTopWidth: 6,
    backgroundColor: "#f2f2f7",
  },
  target: { backgroundColor: "#fff4e5" },
  value: { fontSize: 16, fontWeight: "600", color: "#111" },
  removeButton: { position: "absolute", top: 2, right: 4 },
  remove: { fontSize: 22, lineHeight: 22, color: "#8e8e93", paddingHorizontal: 4 },
});
