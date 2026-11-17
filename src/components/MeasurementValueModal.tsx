import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { ModalCard } from "@/components/ModalCard";
import { Segmented } from "@/components/Segmented";
import { UNITS } from "@/utils/annotations/measurements";
import type { MeasurementUnit } from "@/utils/annotations/types";
import { colors, radius } from "@/utils/theme";

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
    <ModalCard
      title="Measurement"
      confirmLabel={initial ? "Save" : "Add"}
      confirmDisabled={!valid}
      onConfirm={() => onConfirm(value, unit)}
      onCancel={onCancel}
    >
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        autoFocus
        keyboardType="decimal-pad"
        placeholder="Length"
        placeholderTextColor={colors.tertiaryLabel}
      />
      <Segmented options={UNITS.map((u) => ({ id: u, label: u }))} value={unit} onChange={setUnit} />
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: "600",
    color: colors.label,
  },
});
