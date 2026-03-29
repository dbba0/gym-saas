import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet, apiPatch } from "../lib/api";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  notes?: string | null;
};

export default function CoachMembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadMembers = () => {
    apiGet<Member[]>("/members")
      .then((items) => {
        setMembers(items);
        setDrafts(
          items.reduce<Record<string, string>>((acc, item) => {
            acc[item.id] = item.notes || "";
            return acc;
          }, {})
        );
      })
      .catch(() => null);
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const saveNote = async (memberId: string) => {
    try {
      setSavingId(memberId);
      await apiPatch(`/members/${memberId}`, { notes: (drafts[memberId] || "").trim() });
      loadMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update notes.";
      Alert.alert("Update failed", message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.subtitle}>Assigned athletes</Text>
      </View>

      <View style={styles.list}>
        {members.map((member) => (
          <Card key={member.id} tone="progress">
            <Text style={styles.memberName}>
              {member.firstName} {member.lastName}
            </Text>
            <Text style={styles.memberMeta}>Notes: {member.notes || "No notes yet"}</Text>
            <TextInput
              value={drafts[member.id] || ""}
              onChangeText={(value) => setDrafts((prev) => ({ ...prev, [member.id]: value }))}
              placeholder="Update notes"
              style={styles.input}
            />
            <TouchableOpacity
              style={[styles.button, savingId === member.id && styles.buttonDisabled]}
              onPress={() => saveNote(member.id)}
              disabled={savingId === member.id}
            >
              <Text style={styles.buttonText}>{savingId === member.id ? "Saving..." : "Save notes"}</Text>
            </TouchableOpacity>
          </Card>
        ))}
        {members.length === 0 && (
          <Card tone="progress">
            <Text style={styles.memberMeta}>No assigned members yet.</Text>
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink
  },
  subtitle: {
    color: "#5a5f6c"
  },
  list: {
    gap: 12
  },
  memberName: {
    fontSize: 18,
    fontWeight: "700"
  },
  memberMeta: {
    color: "#4b5563"
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e4ded3",
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff"
  },
  button: {
    marginTop: 10,
    backgroundColor: colors.brand,
    padding: 10,
    borderRadius: 12,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    fontWeight: "600",
    color: colors.ink
  }
});
