import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { colors, radius } from "@/utils/theme";

type Variant = "primary" | "secondary" | "danger";

const BACKGROUND: Record<Variant, string> = {
  primary: colors.tint,
  secondary: colors.fill,
  danger: colors.danger,
};
const FOREGROUND: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.label,
  danger: colors.white,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  busy = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  const fg = FOREGROUND[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.base, { backgroundColor: BACKGROUND[variant] }, pressed && styles.pressed, off && styles.off, style]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={fg} />}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.75 },
  off: { opacity: 0.45 },
});
