import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, authHeaders } from "@/api/client";
import { listRemote } from "@/api/documents";
import type { RemoteSummary } from "@/api/documents";
import { deleteProject, getProject } from "@/api/projects";
import type { ProjectDetail } from "@/api/projects";
import { syncWithServer } from "@/api/sync";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { MembersModal } from "@/components/MembersModal";
import { ServerImage } from "@/components/ServerImage";
import { useSession } from "@/hooks/useSession";
import { createDoc, deleteLocalProject, imageUriFor, listDocs } from "@/utils/annotations/storage";
import { hasUnsavedChanges } from "@/utils/annotations/sync";
import type { AnnotationDoc } from "@/utils/annotations/types";
import { colors, radius, shadow, typography } from "@/utils/theme";
import { isWeb } from "@/utils/platform";


export function ProjectScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { me } = useSession();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [docs, setDocs] = useState<(AnnotationDoc | RemoteSummary)[]>([]);
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [managing, setManaging] = useState(false);

  const loadProject = useCallback(() => {
    getProject(projectId)
      .then(setProject)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          // Deleted, or this user was removed: the photos can't be saved anymore.
          if (!isWeb) deleteLocalProject(projectId);
          Alert.alert("This project is no longer available");
          router.back();
        }
        // Any other error means offline: photos still work, only the owner actions are hidden.
      });
  }, [projectId, router]);

  useFocusEffect(
    useCallback(() => {
      let focused = true;
      loadProject();
      if (isWeb) {
        listRemote(projectId)
          .then((list) => focused && setDocs(list))
          .catch(() => {});
        return () => {
          focused = false;
        };
      }
      setDocs(listDocs(projectId));
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

  const isOwner = !isWeb && project !== null && project.ownerId === me?.user.id;

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
                <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Delete project">
                  <Icon name="trash" size={22} color={colors.danger} />
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
            {!isWeb && (
              <View style={styles.actions}>
                <Button label="Take photo" icon="camera" onPress={() => router.push(`/projects/${projectId}/camera`)} style={styles.action} />
                <Button label="Pick photo" icon="photos" variant="secondary" onPress={pickPhoto} style={styles.action} />
              </View>
            )}
            {project && (
              <View style={styles.members}>
                <View style={styles.avatars}>
                  {project.members.slice(0, 5).map((m, i) => (
                    <View key={m.id} style={i > 0 && styles.overlap}>
                      <Avatar name={m.name} size={32} />
                    </View>
                  ))}
                </View>
                <Text style={styles.membersText} numberOfLines={2}>
                  {project.members.map((m) => m.name).join(", ")}
                </Text>
                {isOwner && (
                  <Pressable onPress={() => setManaging(true)} hitSlop={8}>
                    <Text style={styles.link}>Manage</Text>
                  </Pressable>
                )}
              </View>
            )}
            <Button label="Chat" icon="chat" variant="secondary" onPress={() => router.push(`/projects/${projectId}/chat`)} />
            {docs.length > 0 && <Text style={typography.section}>Photos</Text>}
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="photos" title="No photos yet" subtitle={isWeb ? undefined : "Take or pick a photo to annotate."} />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push(`/projects/${projectId}/editor/${item.id}`)}
          >
            {/* A server summary (web) has no annotations; a local document (phone) does. */}
            {"annotations" in item ? (
              <>
                <Image
                  source={{ uri: imageUriFor(item), headers: authHeaders() }}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <View style={styles.captionRow}>
                  <Text style={styles.caption}>
                    {item.annotations.length} {item.annotations.length === 1 ? "annotation" : "annotations"}
                  </Text>
                  {conflicts.has(item.id) ? (
                    <Text style={[styles.badge, styles.conflict]}>Conflict</Text>
                  ) : (
                    hasUnsavedChanges(item) && <Text style={styles.badge}>Unsaved</Text>
                  )}
                </View>
              </>
            ) : (
              <ServerImage path={item.image.uri} style={styles.thumb} />
            )}
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
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  header: { marginBottom: 12, gap: 14 },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
  members: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, padding: 12, borderRadius: radius.lg, ...shadow },
  avatars: { flexDirection: "row" },
  overlap: { marginLeft: -10 },
  membersText: { flex: 1, ...typography.caption, fontSize: 13 },
  link: { color: colors.tint, fontSize: 14, fontWeight: "600" },
  row: { gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 6, ...shadow },
  pressed: { opacity: 0.7 },
  thumb: { aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.fill },
  captionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingTop: 6, paddingBottom: 2 },
  caption: typography.caption,
  badge: { fontSize: 11, fontWeight: "700", color: colors.warning },
  conflict: { color: colors.danger },
});
