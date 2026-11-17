import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { MeasurementUnit } from "@/utils/annotations/types";

const UNITS: MeasurementUnit[] = ["mm", "cm", "m", "in", "ft"];

/** Mount it only while open; it starts from `initial` each time. */
export function MeasurementValueModal({
  initial,
  onConfirm,
  onCancel,
}: {
  initial?: { value: number; unit: MeasurementUnit };
  onConfirm: (value: number, unit: MeasurementUnit) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial ? String(initial.value) : "");
  const [unit, setUnit] = useState<MeasurementUnit>(initial?.unit ?? "cm");
  const value = Number(text.replace(",", "."));
  const valid = text.trim() !== "" && Number.isFinite(value) && value > 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Measurement</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            autoFocus
            keyboardType="decimal-pad"
            placeholder="Length"
          />
          <View style={styles.units}>
            {UNITS.map((u) => (
              <Pressable key={u} style={[styles.unit, u === unit && styles.unitActive]} onPress={() => setUnit(u)}>
                <Text style={u === unit && styles.unitActiveText}>{u}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.buttons}>
            <Pressable onPress={onCancel}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value, unit)} disabled={!valid}>
              <Text style={[styles.confirm, !valid && styles.disabled]}>{initial ? "Save" : "Add"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, fontSize: 16 },
  units: { flexDirection: "row", gap: 8 },
  unit: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: "#e5e5ea" },
  unitActive: { backgroundColor: "#0a84ff" },
  unitActiveText: { color: "white" },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 24 },
  cancel: { color: "#666", fontSize: 16 },
  confirm: { color: "#0a84ff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
