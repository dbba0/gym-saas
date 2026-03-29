import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet, apiPatch, apiPost } from "../lib/api";

type ClassSession = {
  id: string;
  title: string;
  startsAt: string;
  capacity: number;
  coach?: { name: string } | null;
  reservations?: Array<{
    id: string;
    memberId: string;
    status: "RESERVED" | "CANCELED" | "CHECKED_IN" | "NO_SHOW";
  }>;
};

type MemberProfile = {
  id: string;
};

export default function MemberBookingsScreen() {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadClasses = () => {
    Promise.all([apiGet<ClassSession[]>("/classes"), apiGet<MemberProfile>("/members/me")])
      .then(([classItems, member]) => {
        setClasses(classItems);
        setMemberId(member.id);
      })
      .catch(() => null);
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const reserve = async (classId: string) => {
    try {
      setPendingId(classId);
      await apiPost("/classes/reserve", { classId });
      loadClasses();
      Alert.alert("Done", "Class reserved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reserve this class.";
      Alert.alert("Reservation failed", message);
    } finally {
      setPendingId(null);
    }
  };

  const cancelReservation = async (reservationId: string, classId: string) => {
    try {
      setPendingId(classId);
      await apiPatch(`/classes/reservation/${reservationId}/cancel`, {});
      loadClasses();
      Alert.alert("Done", "Reservation canceled.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel reservation.";
      Alert.alert("Cancel failed", message);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>Reserve your spot</Text>
      </View>

      <View style={styles.list}>
        {classes.map((item) => {
          const myReservation = item.reservations?.find(
            (reservation) => reservation.memberId === memberId && reservation.status === "RESERVED"
          );
          const activeReservations = item.reservations?.filter(
            (reservation) => reservation.status === "RESERVED" || reservation.status === "CHECKED_IN"
          ).length;

          return (
            <Card key={item.id} tone="booking">
              <Text style={styles.classTitle}>{item.title}</Text>
              <Text style={styles.classMeta}>
                {item.coach?.name || "Coach"} | {new Date(item.startsAt).toLocaleString()}
              </Text>
              <Text style={styles.classMeta}>
                Spots: {activeReservations || 0} / {item.capacity}
              </Text>

              {myReservation ? (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => cancelReservation(myReservation.id, item.id)}
                  disabled={pendingId === item.id}
                >
                  <Text style={styles.buttonText}>
                    {pendingId === item.id ? "Canceling..." : "Cancel reservation"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={() => reserve(item.id)} disabled={pendingId === item.id}>
                  <Text style={styles.buttonText}>{pendingId === item.id ? "Reserving..." : "Reserve"}</Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        })}
        {classes.length === 0 && (
          <Card tone="booking">
            <Text style={styles.classMeta}>No classes available.</Text>
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
  classTitle: {
    fontSize: 18,
    fontWeight: "700"
  },
  classMeta: {
    color: "#4b5563",
    marginBottom: 10
  },
  button: {
    backgroundColor: colors.brand,
    padding: 10,
    borderRadius: 12,
    alignItems: "center"
  },
  buttonText: {
    fontWeight: "600",
    color: colors.ink
  },
  secondaryButton: {
    backgroundColor: "#f5e2d6"
  }
});
