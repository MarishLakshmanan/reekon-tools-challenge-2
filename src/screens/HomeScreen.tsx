import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { createProject, listProjects } from "@/api/projects";
import type { Project } from "@/api/projects";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { TextInputModal } from "@/components/TextInputModal";
import { useSession } from "@/hooks/useSession";
import { hasUnsavedDocs, pruneLocalProjects } from "@/utils/annotations/storage";
import { colors, radius, shadow, typography } from "@/utils/theme";
import { isWeb } from "@/utils/platform";


export function HomeScreen() {
  const router = useRouter();
  const { me, signOut } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await listProjects();
      // Drop local photos of projects that were deleted or that this user lost access to.
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
                <Pressable onPress={() => router.push("/settings")} hitSlop={10} accessibilityLabel="Settings">
                  <Icon name="settings" size={22} color={colors.tint} />
                </Pressable>
              )}
              <Pressable onPress={confirmSignOut} hitSlop={10} accessibilityLabel="Sign out">
                <Icon name="signOut" size={22} color={colors.tint} />
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
            <View style={styles.profile}>
              <Avatar name={me?.user.name ?? "?"} size={48} />
              <View style={styles.profileText}>
                <Text style={typography.headline}>{me?.user.name}</Text>
                <Text style={typography.caption}>{me?.user.email}</Text>
              </View>
            </View>
            {!isWeb && <Button label="New project" icon="add" onPress={() => setNaming(true)} />}
            <Text style={styles.sectionTitle}>Projects</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder"
            title={error ?? "No projects yet"}
            subtitle={error ? "Pull down to try again." : isWeb ? undefined : "Create one to start adding photos."}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push(`/projects/${item.id}`)}
          >
            <View style={styles.folder}>
              <Icon name="folder" size={22} color={colors.tint} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={typography.caption}>
                {item.documentCount} {item.documentCount === 1 ? "photo" : "photos"} · {item.memberCount}{" "}
                {item.memberCount === 1 ? "member" : "members"}
              </Text>
            </View>
            {item.ownerId === me?.user.id && (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Owner</Text>
              </View>
            )}
            <Icon name="chevron" size={14} color={colors.tertiaryLabel} />
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 10 },
  // The web header adds no inset of its own on the right.
  headerActions: { flexDirection: "row", gap: 20, alignItems: "center", paddingRight: isWeb ? 16 : 0 },
  header: { gap: 14, marginBottom: 4 },
  profile: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, padding: 14, borderRadius: radius.lg, ...shadow },
  profileText: { flex: 1, gap: 2 },
  sectionTitle: { ...typography.section, marginTop: 6 },
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, gap: 12, ...shadow },
  pressed: { opacity: 0.7 },
  folder: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: colors.label },
  pill: { backgroundColor: colors.tintSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.tint },
});
