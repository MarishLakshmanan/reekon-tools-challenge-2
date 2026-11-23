import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { listMessages, sendMessage } from "@/api/messages";
import type { Message } from "@/api/messages";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { useSession } from "@/hooks/useSession";
import { colors, radius, typography } from "@/utils/theme";

const formatTime = (ms: number) => new Date(ms).toLocaleString([], { dateStyle: "short", timeStyle: "short" });

/** Adds the messages not already in `list`, kept in id order. */
function merge(list: Message[], incoming: Message[]): Message[] {
  const seen = new Set(list.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  if (added.length === 0) return list;
  return [...list, ...added].sort((a, b) => a.id - b.id);
}

/** The project's chat. New messages are fetched on focus, on pull to refresh, with the check button, and after a send. */
export function ChatScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { me } = useSession();
  const { bottom } = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const list = useRef<FlatList<Message>>(null);
  const keyboard = useKeyboardHeight();

  const add = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const next = merge(prev, incoming);
      lastId.current = next.at(-1)?.id ?? 0;
      return next;
    });
  }, []);

  /** Leaves the screen on a 404: the project was deleted or the user removed from it. @returns true if it left. */
  const leftProject = useCallback(
    (e: unknown) => {
      if (!(e instanceof ApiError && e.status === 404)) return false;
      Alert.alert("This project is no longer available");
      router.back();
      return true;
    },
    [router],
  );

  const fetchNew = useCallback(async () => {
    try {
      add(await listMessages(projectId, lastId.current));
      setError(null);
    } catch (e) {
      if (!leftProject(e)) setError("Couldn't load messages. Try again.");
    } finally {
      setLoaded(true);
    }
  }, [projectId, add, leftProject]);

  useFocusEffect(
    useCallback(() => {
      fetchNew();
    }, [fetchNew]),
  );

  async function refresh() {
    setRefreshing(true);
    await fetchNew();
    setRefreshing(false);
  }

  async function check() {
    setChecking(true);
    await fetchNew();
    setChecking(false);
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      add([await sendMessage(projectId, body)]);
      setText("");
      setError(null);
      // Picks up anything others sent before this message.
      fetchNew();
    } catch (e) {
      if (!leftProject(e)) setError("Couldn't send. Check your connection and try again.");
    }
    setSending(false);
  }

  return (
    <View style={[styles.fill, { paddingBottom: keyboard }]}>
      <FlatList
        ref={list}
        style={styles.fill}
        contentContainerStyle={styles.content}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          loaded ? (
            <EmptyState icon="chat" title="No messages yet" />
          ) : (
            <ActivityIndicator style={styles.loading} color={colors.tint} />
          )
        }
        ListFooterComponent={
          loaded ? (
            <Button
              label="Check for new messages"
              icon="refresh"
              variant="secondary"
              busy={checking}
              onPress={check}
              style={styles.check}
            />
          ) : undefined
        }
        renderItem={({ item }) => {
          const mine = item.userId === me?.user.id;
          return (
            <View style={[styles.message, mine ? styles.mine : styles.theirs]}>
              {!mine && <Text style={styles.sender}>{item.userName}</Text>}
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
              </View>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
          );
        }}
      />
      <View style={[styles.bar, { paddingBottom: 10 + bottom }]}>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            editable={!sending}
            placeholder="Message"
            placeholderTextColor={colors.tertiaryLabel}
            returnKeyType="send"
            onSubmitEditing={send}
            maxLength={2000}
          />
          <Pressable
            onPress={send}
            disabled={sending || !text.trim()}
            hitSlop={8}
            style={styles.send}
            accessibilityLabel="Send"
          >
            {sending ? (
              <ActivityIndicator color={colors.tint} />
            ) : (
              <Icon name="send" size={30} color={text.trim() ? colors.tint : colors.tertiaryLabel} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, flexGrow: 1 },
  loading: { marginTop: 48 },
  check: { marginTop: 8 },
  message: { maxWidth: "80%", gap: 3 },
  mine: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  sender: { ...typography.caption, fontWeight: "600" },
  bubble: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: colors.tint },
  bubbleTheirs: { backgroundColor: colors.card },
  body: { fontSize: 16, color: colors.label },
  bodyMine: { color: colors.white },
  time: { ...typography.caption, fontSize: 11 },
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
