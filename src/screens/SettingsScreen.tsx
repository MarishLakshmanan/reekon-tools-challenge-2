import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSettings } from "@/hooks/useSettings";
import { SWATCHES } from "@/utils/settings";

function SwatchRow({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <View style={styles.row}>
      {SWATCHES.map((c) => (
        <Pressable
          key={c}
          accessibilityLabel={`Color ${c}`}
          onPress={() => onChange(c)}
          style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchActive]}
        />
      ))}
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <Pressable key={o.id} style={[styles.segment, value === o.id && styles.segmentActive]} onPress={() => onChange(o.id)}>
          <Text style={[styles.segmentLabel, value === o.id && styles.segmentLabelActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SettingsScreen() {
  const { settings, update } = useSettings();
  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.note}>Applies to new lines and text. Saved on this phone only.</Text>

      <Text style={styles.heading}>Line color</Text>
      <SwatchRow value={settings.lineColor} onChange={(lineColor) => update({ lineColor })} />

      <Text style={styles.heading}>Line width</Text>
      <Segmented
        options={[
          { id: "thin", label: "Thin" },
          { id: "medium", label: "Medium" },
          { id: "thick", label: "Thick" },
        ]}
        value={settings.lineWidth}
        onChange={(lineWidth) => update({ lineWidth })}
      />

      <Text style={styles.heading}>Text color</Text>
      <SwatchRow value={settings.textColor} onChange={(textColor) => update({ textColor })} />

      <Text style={styles.heading}>Text size</Text>
      <Segmented
        options={[
          { id: "small", label: "Small" },
          { id: "medium", label: "Medium" },
          { id: "large", label: "Large" },
        ]}
        value={settings.textSize}
        onChange={(textSize) => update({ textSize })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  note: { color: "#666" },
  heading: { fontSize: 16, fontWeight: "600", color: "#111", marginTop: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#c7c7cc" },
  swatchActive: { borderWidth: 3, borderColor: "#0a84ff" },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#e5e5ea" },
  segmentActive: { backgroundColor: "#0a84ff" },
  segmentLabel: { color: "#111", fontWeight: "500" },
  segmentLabelActive: { color: "white" },
});
