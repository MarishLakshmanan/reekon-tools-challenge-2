import { StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import type { IconName } from "@/components/Icon";
import { Segmented } from "@/components/Segmented";

export type Tool = "select" | "pen" | "measure" | "text";

const TOOLS: { id: Tool; label: string; icon: IconName }[] = [
  { id: "select", label: "Select", icon: "select" },
  { id: "pen", label: "Pen", icon: "pen" },
  { id: "measure", label: "Measure", icon: "measure" },
  { id: "text", label: "Text", icon: "text" },
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
      <Segmented options={TOOLS} value={tool} onChange={onToolChange} />
      {(onFinishPath || onDelete || onUndo) && (
        <View style={styles.row}>
          {onUndo && <Button label="Undo" icon="undo" variant="secondary" onPress={onUndo} style={styles.action} />}
          {onFinishPath && <Button label="Done" icon="done" onPress={onFinishPath} style={styles.action} />}
          {onDelete && <Button label="Delete" icon="trash" variant="danger" onPress={onDelete} style={styles.action} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 12, gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minHeight: 44 },
});
