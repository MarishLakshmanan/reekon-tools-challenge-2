import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { UNITS } from "@/utils/annotations/measurements";
import type { MeasurementUnit } from "@/utils/annotations/types";

export function AddMeasurementRow({
  unit,
  onUnitChange,
  onAdd,
}: {
  unit: MeasurementUnit;
  onUnitChange: (unit: MeasurementUnit) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0 });
  const unitButton = useRef<ComponentRef<typeof View>>(null);

  function openMenu() {
    // The menu lives in a Modal, so it needs the button's position on screen.
    unitButton.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y: y + height + 4, width });
      setOpen(true);
    });
  }

  return (
    <View style={styles.row}>
      <Pressable style={styles.add} onPress={onAdd}>
        <Text style={styles.addLabel}>Add Measurement</Text>
      </Pressable>
      <View ref={unitButton} collapsable={false}>
        <Pressable style={styles.unit} onPress={openMenu} accessibilityLabel="Choose unit">
          <Text style={styles.unitLabel}>{unit} ▾</Text>
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { left: anchor.x, top: anchor.y, minWidth: anchor.width }]}>
            {UNITS.map((u) => (
              <Pressable
                key={u}
                style={[styles.option, u === unit && styles.optionActive]}
                onPress={() => {
                  onUnitChange(u);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionLabel, u === unit && styles.optionLabelActive]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
  add: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center", backgroundColor: "#0a84ff" },
  addLabel: { color: "white", fontWeight: "600" },
  unit: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#e5e5ea" },
  unitLabel: { color: "#111", fontWeight: "600" },
  menu: {
    position: "absolute",
    backgroundColor: "white",
    borderRadius: 8,
    paddingVertical: 4,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  option: { paddingVertical: 10, paddingHorizontal: 16 },
  optionActive: { backgroundColor: "#e5f1ff" },
  optionLabel: { color: "#111", fontSize: 16 },
  optionLabelActive: { color: "#0a84ff", fontWeight: "600" },
});
