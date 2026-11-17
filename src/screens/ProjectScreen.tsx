import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, authHeaders } from "@/api/client";
import { deleteProject, getProject } from "@/api/projects";
import type { ProjectDetail } from "@/api/projects";
import { syncWithServer } from "@/api/sync";
import { MembersModal } from "@/components/MembersModal";
import { useSession } from "@/hooks/useSession";
import { createDoc, deleteLocalProject, imageUriFor, listDocs } from "@/utils/annotations/storage";
import { hasUnsavedChanges } from "@/utils/annotations/sync";
import type { AnnotationDoc } from "@/utils/annotations/types";

export function ProjectScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { me } = useSession();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [docs, setDocs] = useState<AnnotationDoc[]>([]);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [managing, setManaging] = useState(false);

  const loadProject = useCallback(() => {
    getProject(projectId)
      .then(setProject)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          // Deleted, or this user was removed: the photos can't be saved anymore.
          deleteLocalProject(projectId);
          Alert.alert("This project is no longer available");
          router.back();
        }
        // Any other error means offline: photos still work, only the owner actions are hidden.
      });
  }, [projectId, router]);

  useFocusEffect(
    useCallback(() => {
      let focused = true;
      setDocs(listDocs(projectId));
      loadProject();
      syncWithServer(projectId)
        .then((ids) => {
          if (!focused) return;
          setConflicts(ids);
          setDocs(listDocs(projectId));
        })
        .catch(() => {}); // offline: the local list is already shown
      return () => {
        focused = false;
      };
    }, [projectId, loadProject]),
  );

  const closeMembers = useCallback(() => setManaging(false), []);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
    if (result.canceled) return;
    const doc = await createDoc(projectId, result.assets[0].uri);
    router.push(`/projects/${projectId}/editor/${doc.id}`);
  }

  const isOwner = project !== null && project.ownerId === me?.user.id;

  function confirmDelete() {
    Alert.alert("Delete project?", "All its photos are deleted for every member.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: remove },
    ]);
  }

  async function remove() {
    try {
      await deleteProject(projectId);
    } catch {
      Alert.alert("Could not delete the project");
      return;
    }
    deleteLocalProject(projectId);
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: project?.name ?? "Project",
          headerRight: isOwner
            ? () => (
                <Pressable onPress={confirmDelete} hitSlop={8}>
                  <Text style={styles.danger}>Delete</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={docs}
        keyExtractor={(d) => d.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.actions}>
              <Pressable style={styles.button} onPress={() => router.push(`/projects/${projectId}/camera`)}>
                <Text style={styles.buttonText}>Take photo</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.secondary]} onPress={pickPhoto}>
                <Text style={[styles.buttonText, styles.secondaryText]}>Pick photo</Text>
              </Pressable>
            </View>
            {project && (
              <View style={styles.members}>
                <Text style={styles.membersText} numberOfLines={2}>
                  Members: {project.members.map((m) => m.name).join(", ")}
                </Text>
                {isOwner && (
                  <Pressable onPress={() => setManaging(true)} hitSlop={8}>
                    <Text style={styles.link}>Members</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No photos yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/projects/${projectId}/editor/${item.id}`)}>
            <Image
              source={{ uri: imageUriFor(item), headers: authHeaders() }}
              style={styles.thumb}
              contentFit="cover"
            />
            <View style={styles.captionRow}>
              <Text style={styles.caption}>{item.annotations.length} annotations</Text>
              {conflicts.has(item.id) ? (
                <Text style={[styles.badge, styles.conflict]}>Conflict</Text>
              ) : (
                hasUnsavedChanges(item) && <Text style={styles.badge}>Unsaved</Text>
              )}
            </View>
          </Pressable>
        )}
      />
      {project && (
        <MembersModal
          visible={managing}
          projectId={projectId}
          ownerId={project.ownerId}
          members={project.members}
          onClose={closeMembers}
          onChanged={loadProject}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  header: { marginBottom: 16, gap: 12 },
  actions: { flexDirection: "row", gap: 12 },
  button: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: "#0a84ff", alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600" },
  secondary: { backgroundColor: "#e5e5ea" },
  secondaryText: { color: "#111" },
  members: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  membersText: { flex: 1, fontSize: 12, color: "#666" },
  link: { color: "#0a84ff", fontSize: 14 },
  danger: { color: "#ff3b30", fontSize: 16 },
  row: { gap: 12, marginBottom: 12 },
  card: { flex: 1 },
  thumb: { aspectRatio: 1, borderRadius: 10, backgroundColor: "#ddd" },
  captionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  caption: { fontSize: 12, color: "#666" },
  badge: { fontSize: 12, fontWeight: "600", color: "#ff9500" },
  conflict: { color: "#ff3b30" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
});
