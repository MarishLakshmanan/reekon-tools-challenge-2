import { Pressable, StyleSheet, Text, View } from "react-native";

export type Tool = "select" | "pen" | "measure" | "text";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "pen", label: "Pen" },
  { id: "measure", label: "Measure" },
  { id: "text", label: "Text" },
];

export function Toolbar({
  tool,
  onToolChange,
  onFinishPath,
  onDelete,
  onUndo,
}: {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  /** Set only while a pen path is being drawn. */
  onFinishPath?: () => void;
  /** Set only while something is selected. */
  onDelete?: () => void;
  /** Set only while there is something to undo. */
  onUndo?: () => void;
}) {
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        {TOOLS.map((t) => (
          <Pressable key={t.id} style={[styles.tool, tool === t.id && styles.active]} onPress={() => onToolChange(t.id)}>
            <Text style={[styles.label, tool === t.id && styles.activeLabel]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {(onFinishPath || onDelete || onUndo) && (
        <View style={styles.row}>
          {onUndo && (
            <Pressable style={[styles.action, styles.undo]} onPress={onUndo}>
              <Text style={styles.actionLabel}>Undo</Text>
            </Pressable>
          )}
          {onFinishPath && (
            <Pressable style={styles.action} onPress={onFinishPath}>
              <Text style={styles.actionLabel}>Done</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable style={[styles.action, styles.danger]} onPress={onDelete}>
              <Text style={styles.actionLabel}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingVertical: 8, paddingHorizontal: 12, gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  tool: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#e5e5ea" },
  active: { backgroundColor: "#0a84ff" },
  label: { color: "#111", fontWeight: "500" },
  activeLabel: { color: "white" },
  action: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", backgroundColor: "#34c759" },
  danger: { backgroundColor: "#ff3b30" },
  undo: { backgroundColor: "#8e8e93" },
  actionLabel: { color: "white", fontWeight: "600" },
});
