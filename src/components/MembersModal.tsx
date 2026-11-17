import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { User } from "@/api/auth";
import { addMember, listOrgUsers, removeMember } from "@/api/projects";

/** Owner's view of a project's members: remove any member but the owner, or add organization users. */
export function MembersModal({
  visible,
  projectId,
  ownerId,
  members,
  onClose,
  onChanged,
}: {
  visible: boolean;
  projectId: string;
  ownerId: string;
  members: User[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [orgUsers, setOrgUsers] = useState<User[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    listOrgUsers()
      .then(setOrgUsers)
      .catch(() => {
        Alert.alert("Could not load users");
        onClose();
      });
  }, [visible, onClose]);

  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action();
      onChanged();
    } catch {
      Alert.alert(failure);
    }
  }

  function confirmRemove(user: User) {
    Alert.alert(`Remove ${user.name}?`, "They lose access to this project and its photos.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => run(() => removeMember(projectId, user.id), "Could not remove member") },
    ]);
  }

  const candidates = orgUsers?.filter((u) => !members.some((m) => m.id === u.id));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Members</Text>
          <ScrollView>
            {members.map((m) => (
              <View key={m.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{m.name}</Text>
                  <Text style={styles.email}>{m.id === ownerId ? "Owner" : m.email}</Text>
                </View>
                {m.id !== ownerId && (
                  <Pressable onPress={() => confirmRemove(m)} hitSlop={8}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Text style={styles.section}>Add</Text>
            {!candidates ? (
              <ActivityIndicator />
            ) : candidates.length === 0 ? (
              <Text style={styles.empty}>Everyone is already in this project.</Text>
            ) : (
              candidates.map((u) => (
                <Pressable
                  key={u.id}
                  style={styles.row}
                  onPress={() => run(() => addMember(projectId, u.id), "Could not add member")}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.email}>{u.email}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "white", borderRadius: 14, padding: 20, gap: 12, maxHeight: "75%" },
  title: { fontSize: 18, fontWeight: "600" },
  section: { fontSize: 14, fontWeight: "600", color: "#666", marginTop: 16, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, color: "#111" },
  email: { fontSize: 12, color: "#666" },
  remove: { color: "#ff3b30", fontSize: 14 },
  empty: { color: "#888", paddingVertical: 12 },
  close: { color: "#0a84ff", fontSize: 16, textAlign: "right" },
});
