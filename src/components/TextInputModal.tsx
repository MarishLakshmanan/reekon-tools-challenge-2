import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function TextInputModal({
  visible,
  title = "Add text",
  placeholder = "Label",
  confirmLabel = "Add",
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput style={styles.input} value={text} onChangeText={setText} autoFocus placeholder={placeholder} />
          <View style={styles.buttons}>
            <Pressable onPress={cancel}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={confirm} disabled={!trimmed}>
              <Text style={[styles.confirm, !trimmed && styles.disabled]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, fontSize: 16 },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: 24 },
  cancel: { color: "#666", fontSize: 16 },
  confirm: { color: "#0a84ff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
