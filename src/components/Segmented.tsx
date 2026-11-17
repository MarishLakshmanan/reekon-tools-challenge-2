import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { colors, radius } from "@/utils/theme";

/** A row of mutually exclusive options. With icons, each option shows its icon above a small label. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: active }}
            style={[styles.option, active && styles.active]}
            onPress={() => onChange(o.id)}
          >
            {o.icon && <Icon name={o.icon} size={20} color={active ? colors.white : colors.label} />}
            <Text style={[styles.label, o.icon && styles.smallLabel, active && styles.activeLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: colors.fill, borderRadius: radius.md, padding: 3, gap: 2 },
  option: { flex: 1, paddingVertical: 9, borderRadius: radius.md - 3, alignItems: "center", gap: 2 },
  active: { backgroundColor: colors.tint },
  label: { fontSize: 15, fontWeight: "500", color: colors.label },
  smallLabel: { fontSize: 12 },
  activeLabel: { color: colors.white },
});
