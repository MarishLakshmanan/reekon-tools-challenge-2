import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { askAgent } from "@/api/ai";
import { ApiError } from "@/api/client";
import { Icon } from "@/components/Icon";
import type { Annotation } from "@/utils/annotations/types";
import { colors, radius } from "@/utils/theme";

function failureMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 422) return "Couldn't find lines for that. Try describing it differently.";
  if (e instanceof ApiError && e.status === 503) return "AI isn't set up on the server.";
  return "Couldn't reach the AI. Check your connection and try again.";
}

/**
 * One-line request to the drawing agent, docked under the canvas so the photo stays in view.
 * The typed text is kept after a failure so the user can try again.
 */
export function AiPromptBar({
  docId,
  annotations,
  penStyle,
  textStyle,
  bottomInset,
  onAdd,
}: {
  docId: string;
  /** What is on the photo now, including unsaved edits. */
  annotations: Annotation[];
  penStyle: { stroke: string; strokeWidth: number };
  textStyle: { fontSize: number; color: string };
  bottomInset: number;
  /** Called once with what the agent drew. The bar clears itself after. */
  onAdd: (added: Annotation[]) => void;
}) {
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Leaving the screen stops the request, and with it the server's model calls.
  useEffect(() => () => abort.current?.abort(), []);

  async function send() {
    const request = text.trim();
    if (!request || running) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setError(null);
    try {
      const added = await askAgent(docId, { request, annotations, style: penStyle, textStyle }, controller.signal);
      if (controller.signal.aborted) return;
      if (added.length === 0) {
        setError("Nothing to mark found.");
        return;
      }
      onAdd(added);
      setText("");
    } catch (e) {
      if (!controller.signal.aborted) setError(failureMessage(e));
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  }

  return (
    <View style={[styles.bar, { paddingBottom: 10 + bottomInset }]}>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          editable={!running}
          placeholder="What should I mark?"
          placeholderTextColor={colors.tertiaryLabel}
          returnKeyType="send"
          onSubmitEditing={send}
          autoFocus
        />
        <Pressable
          onPress={send}
          disabled={running || !text.trim()}
          hitSlop={8}
          style={styles.send}
          accessibilityLabel="Send"
        >
          {running ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Icon name="send" size={30} color={text.trim() ? colors.tint : colors.tertiaryLabel} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 6,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.fill,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    flex: 1,
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.label,
  },
  send: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 14, color: colors.danger },
});
