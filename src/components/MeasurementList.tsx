import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, shadow, typography } from "@/utils/theme";
import { formatMeasurement } from "@/utils/annotations/measurements";
import type { Measurement } from "@/utils/annotations/types";

/** Blue for measurements on a segment, orange for unassigned ones; the same colours as on the photo. */
const LINKED_COLOR = colors.tint;
const UNASSIGNED_COLOR = colors.highlight;

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
        const color = m.pathId === null ? UNASSIGNED_COLOR : LINKED_COLOR;
        const target = linking && m.pathId === null;
        return (
          <Pressable
            key={m.id}
            style={[styles.card, { borderTopColor: color }, target && styles.target]}
            onPress={() => onPress(m)}
          >
            <Text style={styles.value}>{formatMeasurement(m.value, m.unit)}</Text>
            {onRemove && (
              <Pressable style={styles.removeButton} onPress={() => onRemove(m)} hitSlop={6} accessibilityLabel={`Remove ${formatMeasurement(m.value, m.unit)}`}>
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
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },
  // Full-width rows inside the wrapping grid.
  empty: { width: "100%", ...typography.caption, fontSize: 14, textAlign: "center", paddingVertical: 16 },
  hint: { width: "100%", color: UNASSIGNED_COLOR, fontWeight: "600", textAlign: "center", paddingVertical: 4 },
  // Squares; the color bar is on the top edge.
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderTopWidth: 6,
    backgroundColor: colors.card,
    ...shadow,
  },
  target: { backgroundColor: colors.warningSoft },
  value: { fontSize: 18, fontWeight: "700", color: colors.label },
  removeButton: { position: "absolute", top: 0, right: 0, padding: 6 },
  remove: { fontSize: 22, lineHeight: 22, color: colors.tertiaryLabel, paddingHorizontal: 4 },
});
