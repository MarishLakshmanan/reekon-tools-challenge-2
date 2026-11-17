import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { createProject, listProjects } from "@/api/projects";
import type { Project } from "@/api/projects";
import { TextInputModal } from "@/components/TextInputModal";
import { useSession } from "@/hooks/useSession";
import { hasUnsavedDocs, pruneLocalProjects } from "@/utils/annotations/storage";

// The web only views projects, keeps no local photos, and has no settings.
const isWeb = Platform.OS === "web";

export function HomeScreen() {
  const router = useRouter();
  const { me, signOut } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listProjects();
      // Projects that were deleted, or that this user was removed from, can't be saved to anymore.
      if (!isWeb) pruneLocalProjects(list.map((p) => p.id));
      setProjects(list);
      setError(null);
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function add(name: string) {
    setNaming(false);
    try {
      await createProject(name);
      await load();
    } catch {
      Alert.alert("Could not create the project");
    }
  }

  function confirmSignOut() {
    // Nothing is stored in the browser to warn about.
    if (isWeb) {
      signOut();
      return;
    }
    const unsaved = hasUnsavedDocs();
    Alert.alert(
      "Sign out?",
      unsaved
        ? "Some photos have unsaved changes. Signing out removes all photos from this phone, and those changes will be lost."
        : "Photos on this phone are removed. They stay on the server.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => signOut() },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              {!isWeb && (
                <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
                  <Text style={styles.headerAction}>Settings</Text>
                </Pressable>
              )}
              <Pressable onPress={confirmSignOut} hitSlop={8}>
                <Text style={styles.headerAction}>Sign out</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={projects}
        keyExtractor={(p) => p.id}
        refreshing={false}
        onRefresh={load}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.user}>Signed in as {me?.user.name}</Text>
            <Text style={styles.meta}>{me?.user.email}</Text>
            {!isWeb && (
              <Pressable style={styles.button} onPress={() => setNaming(true)}>
                <Text style={styles.buttonText}>New project</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{error ?? "No projects yet."}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/projects/${item.id}`)}>
            <View style={styles.cardText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.documentCount} {item.documentCount === 1 ? "photo" : "photos"} · {item.memberCount}{" "}
                {item.memberCount === 1 ? "member" : "members"}
              </Text>
            </View>
            {item.ownerId === me?.user.id && <Text style={styles.badge}>Owner</Text>}
          </Pressable>
        )}
      />
      <TextInputModal
        visible={naming}
        title="New project"
        placeholder="Project name"
        confirmLabel="Create"
        onConfirm={add}
        onCancel={() => setNaming(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  // The web header adds no inset of its own on the right.
  headerActions: { flexDirection: "row", gap: 16, paddingRight: isWeb ? 16 : 0 },
  headerAction: { color: "#0a84ff", fontSize: 16 },
  header: { gap: 2, marginBottom: 4 },
  user: { fontSize: 16, fontWeight: "600", color: "#111" },
  button: { padding: 14, borderRadius: 10, backgroundColor: "#0a84ff", alignItems: "center", marginTop: 12 },
  buttonText: { color: "white", fontWeight: "600" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#f2f2f7",
    gap: 8,
  },
  cardText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: "#111" },
  meta: { fontSize: 12, color: "#666" },
  badge: { fontSize: 12, fontWeight: "600", color: "#0a84ff" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
});
