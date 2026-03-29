import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet, apiPost } from "../lib/api";

type Program = {
  id: string;
  title: string;
  description?: string | null;
  exercises: Array<{ id: string; name: string; sets: number; reps: number; restSeconds: number }>;
};

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function MemberProgramScreen() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [restRemaining, setRestRemaining] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [validatingSession, setValidatingSession] = useState(false);
  const [sessionValidated, setSessionValidated] = useState(false);

  const loadPrograms = useCallback(async () => {
    try {
      setLoadingPrograms(true);
      setLoadError(null);
      const nextPrograms = await apiGet<Program[]>("/programs");
      setPrograms(nextPrograms);
      setSelectedProgramId((current) => {
        if (!current) {
          return null;
        }
        return nextPrograms.some((program) => program.id === current) ? current : null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger les programmes.";
      setLoadError(message);
    } finally {
      setLoadingPrograms(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPrograms();
      const interval = setInterval(loadPrograms, 15000);
      return () => clearInterval(interval);
    }, [loadPrograms])
  );

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) || null,
    [programs, selectedProgramId]
  );

  useEffect(() => {
    setWorkoutStarted(false);
    setDoneMap({});
    setRestRemaining(0);
    setRestRunning(false);
    setActiveExerciseId(null);
    setSessionValidated(false);
  }, [selectedProgramId]);

  useEffect(() => {
    if (!restRunning || restRemaining <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setRestRemaining((current) => {
        if (current <= 1) {
          setRestRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [restRunning, restRemaining]);

  const completedCount = useMemo(
    () => selectedProgram?.exercises.filter((exercise) => doneMap[exercise.id]).length || 0,
    [selectedProgram, doneMap]
  );

  const exerciseCount = selectedProgram?.exercises.length || 0;
  const progressPercent = exerciseCount ? Math.round((completedCount / exerciseCount) * 100) : 0;
  const canValidate =
    workoutStarted && exerciseCount > 0 && completedCount === exerciseCount && !sessionValidated;

  const toggleDone = (exerciseId: string) => {
    if (!workoutStarted || sessionValidated) {
      return;
    }
    setDoneMap((previous) => ({ ...previous, [exerciseId]: !previous[exerciseId] }));
  };

  const startRest = (seconds: number) => {
    setRestRemaining(seconds);
    setRestRunning(true);
  };

  const validateSession = async () => {
    if (!selectedProgram) {
      return;
    }

    try {
      setValidatingSession(true);
      await apiPost("/attendance/self", { programId: selectedProgram.id });
      setSessionValidated(true);
      setWorkoutStarted(false);
      setRestRunning(false);
      setRestRemaining(0);
      Alert.alert("Session validée", "Excellente séance. Elle a été enregistrée.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de valider la séance.";
      Alert.alert("Validation impossible", message);
    } finally {
      setValidatingSession(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Program</Text>
          <Text style={styles.subtitle}>
            {selectedProgram ? selectedProgram.title : "Choisis un programme pour voir les exercices"}
          </Text>
        </View>

        {!selectedProgram ? (
          <View style={styles.list}>
            <TouchableOpacity style={styles.secondaryButton} onPress={loadPrograms} disabled={loadingPrograms}>
              <Text style={styles.secondaryButtonText}>
                {loadingPrograms ? "Actualisation..." : "Actualiser les programmes"}
              </Text>
            </TouchableOpacity>
            {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
            {programs.map((program) => (
              <Card key={program.id} tone="program">
                <Text style={styles.programTitle}>{program.title}</Text>
                <Text style={styles.programMeta}>
                  {program.exercises.length} exercice{program.exercises.length > 1 ? "s" : ""}
                </Text>
                {program.description ? <Text style={styles.programMeta}>{program.description}</Text> : null}
                <TouchableOpacity style={styles.primaryButton} onPress={() => setSelectedProgramId(program.id)}>
                  <Text style={styles.primaryButtonText}>Voir le programme</Text>
                </TouchableOpacity>
              </Card>
            ))}
            {programs.length === 0 && (
              <Card tone="program">
                <Text style={styles.metaText}>
                  {loadingPrograms ? "Chargement..." : "Ton coach va bientôt te partager un programme."}
                </Text>
              </Card>
            )}
          </View>
        ) : (
          <>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedProgramId(null)}>
              <Text style={styles.backButtonText}>← Retour aux programmes</Text>
            </TouchableOpacity>

            <Card tone="program">
              <View style={styles.row}>
                <View>
                  <Text style={styles.sectionTitle}>Workout session</Text>
                  <Text style={styles.metaText}>
                    {completedCount}/{exerciseCount} exercices terminés ({progressPercent}%)
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.primaryButton, workoutStarted && styles.primaryButtonActive]}
                  onPress={() => {
                    if (sessionValidated) {
                      return;
                    }
                    setWorkoutStarted((value) => !value);
                  }}
                  disabled={sessionValidated}
                >
                  <Text style={styles.primaryButtonText}>{workoutStarted ? "Stop workout" : "Start workout"}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(progressPercent, 2)}%` }]} />
              </View>
            </Card>

            <Card tone="booking">
              <Text style={styles.sectionTitle}>Rest timer</Text>
              <Text style={styles.timerText}>{formatTimer(restRemaining)}</Text>
              <View style={styles.timerButtons}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setRestRunning((value) => !value)}
                  disabled={restRemaining <= 0}
                >
                  <Text style={styles.secondaryButtonText}>{restRunning ? "Pause" : "Resume"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setRestRunning(false);
                    setRestRemaining(0);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </Card>

            <View style={styles.list}>
              {selectedProgram.exercises.map((exercise, index) => {
                const done = !!doneMap[exercise.id];
                return (
                  <Card key={exercise.id} tone="program">
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName}>
                          {index + 1}. {exercise.name}
                        </Text>
                        <Text style={styles.exerciseMeta}>
                          {exercise.sets} sets x {exercise.reps} reps
                        </Text>
                      </View>
                    </View>
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.setButton, activeExerciseId === exercise.id && styles.setButtonActive]}
                        onPress={() => setActiveExerciseId(exercise.id)}
                        disabled={sessionValidated}
                      >
                        <Text
                          style={[
                            styles.setButtonText,
                            activeExerciseId === exercise.id && styles.setButtonTextActive
                          ]}
                        >
                          {activeExerciseId === exercise.id ? "Set in progress" : "Start set"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.checkButton, done && styles.checkButtonDone]}
                        onPress={() => toggleDone(exercise.id)}
                        disabled={sessionValidated}
                      >
                        <Text style={[styles.checkText, done && styles.checkTextDone]}>
                          {done ? "Done" : "Mark done"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.restButton}
                      onPress={() => startRest(exercise.restSeconds)}
                      disabled={sessionValidated}
                    >
                      <Text style={styles.restButtonText}>Start rest ({exercise.restSeconds}s)</Text>
                    </TouchableOpacity>
                  </Card>
                );
              })}
            </View>

            {canValidate && (
              <TouchableOpacity
                style={[styles.validateButton, validatingSession && styles.validateButtonDisabled]}
                onPress={validateSession}
                disabled={validatingSession}
              >
                <Text style={styles.validateButtonText}>
                  {validatingSession ? "Validation..." : "Valider la séance"}
                </Text>
              </TouchableOpacity>
            )}

            {sessionValidated && (
              <Card tone="progress">
                <Text style={styles.sectionTitle}>Séance validée</Text>
                <Text style={styles.metaText}>Ta séance est enregistrée. Tu peux en démarrer une nouvelle.</Text>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setDoneMap({});
                    setSessionValidated(false);
                    setWorkoutStarted(false);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Nouvelle séance</Text>
                </TouchableOpacity>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
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
  list: {
    gap: 12
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700"
  },
  metaText: {
    color: "#4b5563",
    marginTop: 4
  },
  programTitle: {
    fontSize: 18,
    fontWeight: "700"
  },
  programMeta: {
    color: "#4b5563",
    marginTop: 4
  },
  backButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffd8c3",
    backgroundColor: "#fff3eb",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  backButtonText: {
    color: colors.brandDeep,
    fontWeight: "700"
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12
  },
  primaryButtonActive: {
    backgroundColor: "#151926"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  progressTrack: {
    marginTop: 12,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ffd8c3",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.brand
  },
  timerText: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 8
  },
  timerButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#b9cdf2",
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: "600"
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4
  },
  exerciseMeta: {
    color: "#4b5563"
  },
  checkButton: {
    borderWidth: 1,
    borderColor: "#d7d0c5",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff"
  },
  checkButtonDone: {
    borderColor: "#179e5a",
    backgroundColor: "#e9f8f0"
  },
  checkText: {
    fontWeight: "600",
    color: "#4b5563"
  },
  checkTextDone: {
    color: "#17824d"
  },
  restButton: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "#fff3eb",
    paddingVertical: 9,
    alignItems: "center"
  },
  restButtonText: {
    fontWeight: "600",
    color: colors.brandDeep
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  setButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#fac7ab",
    borderRadius: 999,
    backgroundColor: "#fffaf6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center"
  },
  setButtonActive: {
    borderColor: colors.brand,
    backgroundColor: "#ffe8da"
  },
  setButtonText: {
    fontWeight: "600",
    color: colors.brandDeep
  },
  setButtonTextActive: {
    color: colors.brand
  },
  validateButton: {
    borderRadius: 14,
    backgroundColor: "#17824d",
    paddingVertical: 14,
    alignItems: "center"
  },
  validateButtonDisabled: {
    opacity: 0.6
  },
  validateButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "600"
  }
});
