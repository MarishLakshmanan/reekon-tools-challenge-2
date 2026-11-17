import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/Icon";
import { colors, typography } from "@/utils/theme";

export function EmptyState({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  return (
    <View style={styles.box}>
      <View style={styles.circle}>
        <Icon name={icon} size={32} color={colors.tertiaryLabel} />
      </View>
      <Text style={typography.headline}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  circle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  subtitle: { ...typography.caption, fontSize: 14, textAlign: "center" },
});
