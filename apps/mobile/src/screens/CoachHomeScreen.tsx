import { useEffect, useState } from "react";
import { Alert, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet } from "../lib/api";

export default function CoachHomeScreen({ onLogout }: { onLogout: () => void }) {
  const [memberCount, setMemberCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [taskText, setTaskText] = useState("Review assigned members and update plans.");

  useEffect(() => {
    Promise.all([apiGet<any[]>("/members"), apiGet<any[]>("/programs")])
      .then(([members, programs]) => {
        setMemberCount(members.length);
        setProgramCount(programs.length);

        if (!members.length) {
          setTaskText("No assigned members yet. Ask admin to assign members.");
        } else if (!programs.length) {
          setTaskText("Create the first training program for your members.");
        } else {
          setTaskText(`Check progress of ${members[0].firstName} and adjust this week's plan.`);
        }
      })
      .catch(() => null);
  }, []);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.title}>Coach Hub</Text>
          <Text style={styles.subtitle}>Assigned members and programs</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() =>
            Alert.alert("Logout", "Do you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: onLogout }
            ])
          }
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <Card tone="booking">
          <Text style={styles.statLabel}>Members</Text>
          <Text style={styles.statValue}>{memberCount}</Text>
        </Card>
        <Card tone="program">
          <Text style={styles.statLabel}>Programs</Text>
          <Text style={styles.statValue}>{programCount} active</Text>
        </Card>
      </View>

      <Card tone="progress">
        <Text style={styles.sectionTitle}>Today tasks</Text>
        <Text style={styles.body}>{taskText}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16
  },
  headerRow: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink
  },
  subtitle: {
    color: "#5a5f6c"
  },
  grid: {
    gap: 12,
    marginBottom: 12
  },
  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#6b7280"
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6
  },
  body: {
    color: "#4b5563"
  },
  logoutButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4c7b6",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  logoutText: {
    color: "#4b5563",
    fontWeight: "600",
    fontSize: 12
  }
});
