import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet, apiPost } from "../lib/api";

type ProgressEntry = {
  id: string;
  entryDate: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  notes?: string | null;
};

type AttendanceEntry = {
  id: string;
  checkedInAt: string;
};

type MemberProfile = {
  id: string;
};

type TrendPoint = {
  label: string;
  value: number;
};

function formatShortDate(dateValue: string) {
  const date = new Date(dateValue);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function parseTailleCm(notes?: string | null) {
  if (!notes) {
    return null;
  }
  const match = notes.match(/tailleCm:([0-9]+(?:\\.[0-9]+)?)/i);
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[1]);
}

export default function MemberProgressScreen() {
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [tailleInput, setTailleInput] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    apiGet<MemberProfile>("/members/me")
      .then((member) =>
        Promise.all([
          apiGet<ProgressEntry[]>(`/progress/${member.id}`),
          apiGet<AttendanceEntry[]>("/attendance")
        ])
      )
      .then(([progressEntries, attendanceEntries]) => {
        setProgress(progressEntries);
        setAttendance(attendanceEntries);
      })
      .catch(() => null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const orderedProgress = useMemo(
    () => [...progress].sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()),
    [progress]
  );

  const weightTrend = useMemo<TrendPoint[]>(
    () =>
      orderedProgress
        .filter((entry) => typeof entry.weightKg === "number")
        .slice(-6)
        .map((entry) => ({ label: formatShortDate(entry.entryDate), value: entry.weightKg as number })),
    [orderedProgress]
  );

  const tailleTrend = useMemo<TrendPoint[]>(
    () =>
      orderedProgress
        .map((entry) => ({
          label: formatShortDate(entry.entryDate),
          value: parseTailleCm(entry.notes)
        }))
        .filter((entry) => typeof entry.value === "number")
        .slice(-6)
        .map((entry) => ({ label: entry.label, value: entry.value as number })),
    [orderedProgress]
  );

  const bodyFatTrend = useMemo<TrendPoint[]>(
    () =>
      orderedProgress
        .filter((entry) => typeof entry.bodyFatPct === "number")
        .slice(-6)
        .map((entry) => ({ label: formatShortDate(entry.entryDate), value: entry.bodyFatPct as number })),
    [orderedProgress]
  );

  const performanceTrend = useMemo<TrendPoint[]>(() => {
    const weeks: TrendPoint[] = [];
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diffToMonday = (day + 6) % 7;
    weekStart.setDate(weekStart.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    for (let i = 5; i >= 0; i -= 1) {
      const from = new Date(weekStart);
      from.setDate(weekStart.getDate() - i * 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 7);
      const count = attendance.filter((entry) => {
        const date = new Date(entry.checkedInAt);
        return date >= from && date < to;
      }).length;
      weeks.push({
        label: `${from.toLocaleDateString([], { month: "short" })} ${from.getDate()}`,
        value: count
      });
    }
    return weeks;
  }, [attendance]);

  const sessionsDone = attendance.length;
  const lastWeight = weightTrend.length ? weightTrend[weightTrend.length - 1].value : null;
  const lastBodyFat = bodyFatTrend.length ? bodyFatTrend[bodyFatTrend.length - 1].value : null;
  const lastTaille = tailleTrend.length ? tailleTrend[tailleTrend.length - 1].value : null;

  const saveProgress = async () => {
    const weight = weightInput.trim() ? Number.parseFloat(weightInput) : undefined;
    const bodyFat = bodyFatInput.trim() ? Number.parseFloat(bodyFatInput) : undefined;
    const taille = tailleInput.trim() ? Number.parseFloat(tailleInput) : undefined;

    if (
      weight === undefined &&
      bodyFat === undefined &&
      taille === undefined
    ) {
      Alert.alert("Info manquante", "Ajoute au moins le poids, la taille ou le body fat.");
      return;
    }

    if (
      (weight !== undefined && (!Number.isFinite(weight) || weight <= 0)) ||
      (bodyFat !== undefined && (!Number.isFinite(bodyFat) || bodyFat <= 0)) ||
      (taille !== undefined && (!Number.isFinite(taille) || taille <= 0))
    ) {
      Alert.alert("Valeur invalide", "Utilise des nombres positifs.");
      return;
    }

    try {
      setSaving(true);
      await apiPost("/progress/self", {
        weightKg: weight,
        bodyFatPct: bodyFat,
        notes: taille !== undefined ? `tailleCm:${taille}` : undefined
      });
      setWeightInput("");
      setBodyFatInput("");
      setTailleInput("");
      loadData();
      Alert.alert("Enregistré", "Ton suivi a bien été ajouté.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'enregistrer.";
      Alert.alert("Erreur", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Ajoute ton poids/taille et suis ton évolution</Text>
        </View>

        <Card tone="progress">
          <Text style={styles.sectionTitle}>Ajouter une mesure</Text>
          <TextInput
            style={styles.input}
            placeholder="Poids (kg) - ex: 74.5"
            keyboardType="decimal-pad"
            value={weightInput}
            onChangeText={setWeightInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Taille (cm) - ex: 180"
            keyboardType="decimal-pad"
            value={tailleInput}
            onChangeText={setTailleInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Body fat (%) - ex: 18.5"
            keyboardType="decimal-pad"
            value={bodyFatInput}
            onChangeText={setBodyFatInput}
          />
          <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={saveProgress} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? "Enregistrement..." : "Enregistrer"}</Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.kpiRow}>
          <Card tone="progress" style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Latest weight</Text>
            <Text style={styles.kpiValue}>{lastWeight !== null ? `${lastWeight} kg` : "-"}</Text>
          </Card>
          <Card tone="progress" style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Latest body fat</Text>
            <Text style={styles.kpiValue}>{lastBodyFat !== null ? `${lastBodyFat}%` : "-"}</Text>
          </Card>
          <Card tone="progress" style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Latest taille</Text>
            <Text style={styles.kpiValue}>{lastTaille !== null ? `${lastTaille} cm` : "-"}</Text>
          </Card>
          <Card tone="booking" style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Sessions done</Text>
            <Text style={styles.kpiValue}>{sessionsDone}</Text>
          </Card>
        </View>

        <Card tone="progress">
          <Text style={styles.sectionTitle}>Weight trend</Text>
          <TrendBars points={weightTrend} suffix="kg" color={colors.mint} />
        </Card>

        <Card tone="progress">
          <Text style={styles.sectionTitle}>Taille trend</Text>
          <TrendBars points={tailleTrend} suffix="cm" color="#1e9d60" />
        </Card>

        <Card tone="progress">
          <Text style={styles.sectionTitle}>Body fat trend</Text>
          <TrendBars points={bodyFatTrend} suffix="%" color="#1f8d54" />
        </Card>

        <Card tone="booking">
          <Text style={styles.sectionTitle}>Performance trend (weekly check-ins)</Text>
          <TrendBars points={performanceTrend} suffix="" color={colors.sky} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function TrendBars({
  points,
  suffix,
  color
}: {
  points: TrendPoint[];
  suffix: string;
  color: string;
}) {
  if (points.length === 0) {
    return <Text style={styles.emptyText}>No data yet.</Text>;
  }

  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <View style={styles.chart}>
      {points.map((point) => (
        <View key={`${point.label}-${point.value}`} style={styles.chartRow}>
          <Text style={styles.chartLabel}>{point.label}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max((point.value / max) * 100, 6)}%`, backgroundColor: color }
              ]}
            />
          </View>
          <Text style={styles.chartValue}>
            {point.value}
            {suffix}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: 12,
    paddingBottom: 34
  },
  header: {
    marginBottom: 4
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink
  },
  subtitle: {
    color: "#5a5f6c"
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbead8",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10
  },
  saveButton: {
    borderRadius: 12,
    backgroundColor: colors.mint,
    paddingVertical: 12,
    alignItems: "center"
  },
  saveButtonDisabled: {
    opacity: 0.6
  },
  saveButtonText: {
    color: "#0f1018",
    fontWeight: "700"
  },
  kpiRow: {
    gap: 10
  },
  kpiCard: {
    paddingVertical: 14
  },
  kpiLabel: {
    fontSize: 12,
    color: "#3d6650",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink
  },
  chart: {
    gap: 8
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  chartLabel: {
    width: 58,
    fontSize: 12,
    color: "#4b5563"
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#dcefe4",
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: 999
  },
  chartValue: {
    width: 66,
    textAlign: "right",
    fontWeight: "600",
    color: colors.ink
  },
  emptyText: {
    color: "#4b5563"
  }
});
