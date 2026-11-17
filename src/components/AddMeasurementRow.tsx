import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { colors, radius } from "@/utils/theme";
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
      <Button label="Add Measurement" icon="add" onPress={onAdd} style={styles.add} />
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
  add: { flex: 1 },
  unit: { minHeight: 48, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.fill, justifyContent: "center" },
  unitLabel: { color: colors.label, fontWeight: "600", fontSize: 16 },
  menu: {
    position: "absolute",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 4,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  option: { paddingVertical: 12, paddingHorizontal: 18 },
  optionActive: { backgroundColor: colors.tintSoft },
  optionLabel: { color: colors.label, fontSize: 16 },
  optionLabelActive: { color: colors.tint, fontWeight: "600" },
});
