import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { ModalCard } from "@/components/ModalCard";
import { colors, radius } from "@/utils/theme";

export function TextInputModal({
  visible,
  title = "Add text",
  placeholder = "Label",
  confirmLabel = "Add",
  initial = "",
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Starting text. Read on mount, so mount the modal per edit to start from it. */
  initial?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const trimmed = text.trim();

  function confirm() {
    onConfirm(trimmed);
    setText("");
  }
  function cancel() {
    setText("");
    onCancel();
  }

  return (
    <ModalCard
      visible={visible}
      title={title}
      confirmLabel={confirmLabel}
      confirmDisabled={!trimmed}
      onConfirm={confirm}
      onCancel={cancel}
    >
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        autoFocus
        placeholder={placeholder}
        placeholderTextColor={colors.tertiaryLabel}
      />
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.label,
  },
});
