import { useCallback, useState } from "react";
import { Alert, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet } from "../lib/api";

type MemberProfile = {
  id: string;
  firstName: string;
  lastName: string;
  coach?: { name: string } | null;
  subscription?: { name: string } | null;
};

type Program = {
  id: string;
};

type AttendanceEntry = {
  id: string;
  checkedInAt: string;
};

type ClassSession = {
  id: string;
  title: string;
  startsAt: string;
  reservations?: Array<{
    memberId: string;
    status: "RESERVED" | "CANCELED" | "CHECKED_IN" | "NO_SHOW";
  }>;
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatNextWorkout(value: Date) {
  const now = new Date();
  if (isSameDay(value, now)) {
    return `Today ${value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return value.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function MemberHomeScreen({ onLogout }: { onLogout: () => void }) {
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [programCount, setProgramCount] = useState(0);
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0);
  const [nextClassTitle, setNextClassTitle] = useState("No reservation");

  const loadSummary = useCallback(() => {
    Promise.all([
      apiGet<MemberProfile>("/members/me"),
      apiGet<Program[]>("/programs"),
      apiGet<ClassSession[]>("/classes"),
      apiGet<AttendanceEntry[]>("/attendance")
    ])
      .then(([member, programs, classes, attendance]) => {
        setProfile(member);
        setProgramCount(programs.length);
        const weekStart = new Date();
        const day = weekStart.getDay();
        const diffToMonday = (day + 6) % 7;
        weekStart.setDate(weekStart.getDate() - diffToMonday);
        weekStart.setHours(0, 0, 0, 0);
        setSessionsThisWeek(
          attendance.filter((entry) => new Date(entry.checkedInAt).getTime() >= weekStart.getTime()).length
        );

        const upcoming = classes
          .filter((item) => new Date(item.startsAt).getTime() > Date.now())
          .filter((item) =>
            item.reservations?.some(
              (reservation) =>
                reservation.memberId === member.id &&
                (reservation.status === "RESERVED" || reservation.status === "CHECKED_IN")
            )
          )
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

        setNextClassTitle(
          upcoming
            ? `${upcoming.title} · ${formatNextWorkout(new Date(upcoming.startsAt))}`
            : "No reservation"
        );
      })
      .catch(() => null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.title}>Member Home</Text>
          <Text style={styles.subtitle}>
            {profile ? `Welcome ${profile.firstName}` : "Your training summary"}
          </Text>
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
        <Card tone="program">
          <Text style={styles.statLabel}>Assigned programs</Text>
          <Text style={styles.statValue}>{programCount}</Text>
        </Card>
        <Card tone="booking">
          <Text style={styles.statLabel}>Next workout</Text>
          <Text style={styles.statValue} numberOfLines={2}>
            {nextClassTitle}
          </Text>
        </Card>
        <Card tone="progress">
          <Text style={styles.statLabel}>Sessions this week</Text>
          <Text style={styles.statValue}>{sessionsThisWeek}</Text>
        </Card>
        <Card>
          <Text style={styles.statLabel}>Coach</Text>
          <Text style={styles.statValue}>{profile?.coach?.name || "Not assigned"}</Text>
        </Card>
      </View>

      <Card tone="dark">
        <Text style={styles.sectionTitle}>Current subscription</Text>
        <Text style={styles.body}>{profile?.subscription?.name || "No active plan"}</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickButton} onPress={() => navigation.navigate("QR")}>
            <Text style={styles.quickButtonText}>Show QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickButton} onPress={() => navigation.navigate("Bookings")}>
            <Text style={styles.quickButtonText}>Book class</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 6,
    color: "#f8fafc"
  },
  body: {
    color: "#d5deee"
  },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14
  },
  quickButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#323b52",
    backgroundColor: "#1d2232",
    paddingVertical: 10,
    alignItems: "center"
  },
  quickButtonText: {
    color: "#f8fafc",
    fontWeight: "600"
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
