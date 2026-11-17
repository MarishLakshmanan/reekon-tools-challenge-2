import { Modal, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { Button } from "@/components/Button";
import { colors, radius, typography } from "@/utils/theme";

/** Shared dialog: dimmed backdrop, a card with a title, content, and a Cancel / confirm footer. */
export function ModalCard({
  visible = true,
  title,
  children,
  confirmLabel,
  confirmDisabled = false,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  maxHeight,
}: {
  visible?: boolean;
  title: string;
  children: ReactNode;
  /** Omit for a dialog with only a close button. */
  confirmLabel?: string;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  maxHeight?: `${number}%`;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, maxHeight ? { maxHeight } : null]}>
          <Text style={typography.headline}>{title}</Text>
          {children}
          <View style={styles.footer}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={styles.footerButton} />
            {confirmLabel && onConfirm && (
              <Button label={confirmLabel} onPress={onConfirm} disabled={confirmDisabled} style={styles.footerButton} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, gap: 14 },
  footer: { flexDirection: "row", gap: 10 },
  footerButton: { flex: 1 },
});
