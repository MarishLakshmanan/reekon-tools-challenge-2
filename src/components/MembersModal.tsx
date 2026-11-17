import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { User } from "@/api/auth";
import { addMember, listOrgUsers, removeMember } from "@/api/projects";
import { Avatar } from "@/components/Avatar";
import { ModalCard } from "@/components/ModalCard";
import { colors, typography } from "@/utils/theme";

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
    <ModalCard visible={visible} title="Members" cancelLabel="Close" onCancel={onClose} maxHeight="80%">
      <ScrollView style={styles.list}>
        {members.map((m) => (
          <View key={m.id} style={styles.row}>
            <Avatar name={m.name} size={36} />
            <View style={styles.rowText}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.email}>{m.id === ownerId ? "Owner" : m.email}</Text>
            </View>
            {m.id !== ownerId && (
              <Pressable onPress={() => confirmRemove(m)} hitSlop={8} accessibilityLabel={`Remove ${m.name}`}>
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
              <Avatar name={u.name} size={36} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{u.name}</Text>
                <Text style={styles.email}>{u.email}</Text>
              </View>
              <Text style={styles.add}>Add</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0 },
  section: { ...typography.section, marginTop: 16, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, color: colors.label },
  email: { fontSize: 12, color: colors.secondaryLabel },
  remove: { color: colors.danger, fontSize: 14, fontWeight: "500" },
  add: { color: colors.tint, fontSize: 14, fontWeight: "600" },
  empty: { color: colors.tertiaryLabel, paddingVertical: 12 },
});
