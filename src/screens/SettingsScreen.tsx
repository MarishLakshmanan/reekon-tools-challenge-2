import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Segmented } from "@/components/Segmented";
import { useSettings } from "@/hooks/useSettings";
import { SWATCHES } from "@/utils/settings";
import { colors, radius, shadow, typography } from "@/utils/theme";

function SwatchRow({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <View style={styles.swatches}>
      {SWATCHES.map((c) => (
        <Pressable
          key={c}
          accessibilityLabel={`Color ${c}`}
          onPress={() => onChange(c)}
          style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchActive]}
        >
          {value === c && <Icon name="check" size={18} color={isLight(c) ? colors.label : colors.white} />}
        </Pressable>
      ))}
    </View>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return false;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return r * 0.299 + g * 0.587 + b * 0.114 > 160;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={typography.section}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export function SettingsScreen() {
  const { settings, update } = useSettings();
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.note}>Applies to new lines and text. Saved on this phone only.</Text>

      <Section title="Lines">
        <Text style={styles.heading}>Color</Text>
        <SwatchRow value={settings.lineColor} onChange={(lineColor) => update({ lineColor })} />
        <Text style={styles.heading}>Width</Text>
        <Segmented
          options={[
            { id: "thin", label: "Thin" },
            { id: "medium", label: "Medium" },
            { id: "thick", label: "Thick" },
          ]}
          value={settings.lineWidth}
          onChange={(lineWidth) => update({ lineWidth })}
        />
      </Section>

      <Section title="Text">
        <Text style={styles.heading}>Color</Text>
        <SwatchRow value={settings.textColor} onChange={(textColor) => update({ textColor })} />
        <Text style={styles.heading}>Size</Text>
        <Segmented
          options={[
            { id: "small", label: "Small" },
            { id: "medium", label: "Medium" },
            { id: "large", label: "Large" },
          ]}
          value={settings.textSize}
          onChange={(textSize) => update({ textSize })}
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 20 },
  note: { ...typography.caption, fontSize: 14 },
  section: { gap: 8 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow },
  heading: { fontSize: 16, fontWeight: "600", color: colors.label },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.separator, alignItems: "center", justifyContent: "center" },
  swatchActive: { borderWidth: 3, borderColor: colors.tint },
});
