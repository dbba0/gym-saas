import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet, apiPost } from "../lib/api";

type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
};

type ProgramDetail = {
  id: string;
  title: string;
  description?: string | null;
  isPublic?: boolean;
  level?: string | null;
  durationWeeks?: number | null;
  sessionsPerWeek?: number | null;
  category?: string | null;
  objective?: string | null;
  exercises: Exercise[];
};

type AvailableProgram = {
  id: string;
  title: string;
  shortDescription: string | null;
  level: string | null;
  durationWeeks: number | null;
  sessionsPerWeek: number | null;
  category: string | null;
  objective: string | null;
  isPublic: boolean;
  locked: boolean;
  accessRestricted: boolean;
  creatorName: string | null;
};

type AvailableProgramsResponse = {
  items: AvailableProgram[];
};

type ProgramCompletionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

type MemberProgramSummary = {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  isAssigned: boolean;
  startedAt: string | null;
  assignedByCoachName: string | null;
  progression: {
    sessionsDone: number;
    completionPercent: number | null;
  };
  completionStatus: ProgramCompletionStatus;
};

type MyProgramsResponse = {
  assignedPrograms: MemberProgramSummary[];
  selfStartedPrograms: MemberProgramSummary[];
};

type TabKey = "available" | "mine";
type AvailabilityFilter = "ALL" | "PUBLIC" | "RESTRICTED";

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatStartedAt(value: string | null) {
  if (!value) {
    return "Pas encore commencé";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Pas encore commencé";
  }
  return `Démarré le ${date.toLocaleDateString()}`;
}

function completionBadgeLabel(status: ProgramCompletionStatus) {
  if (status === "COMPLETED") {
    return "Terminé";
  }
  if (status === "IN_PROGRESS") {
    return "En cours";
  }
  return "À démarrer";
}

function normalizeAvailable(payload: AvailableProgramsResponse | AvailableProgram[] | ProgramDetail[]): AvailableProgram[] {
  if (Array.isArray(payload)) {
    return payload.map((item: any) => ({
      id: item.id,
      title: item.title,
      shortDescription: item.shortDescription ?? item.description ?? null,
      level: item.level ?? null,
      durationWeeks: item.durationWeeks ?? null,
      sessionsPerWeek: item.sessionsPerWeek ?? null,
      category: item.category ?? null,
      objective: item.objective ?? null,
      isPublic: Boolean(item.isPublic ?? true),
      locked: Boolean(item.locked ?? !item.isPublic),
      accessRestricted: Boolean(item.accessRestricted ?? !item.isPublic),
      creatorName: item.creatorName ?? item.coach?.name ?? null
    }));
  }
  return Array.isArray(payload.items) ? payload.items : [];
}

function normalizeMine(payload: MyProgramsResponse | ProgramDetail[]): MyProgramsResponse {
  if (Array.isArray(payload)) {
    return {
      assignedPrograms: payload.map((program) => ({
        id: program.id,
        title: program.title,
        description: program.description ?? null,
        isPublic: Boolean(program.isPublic ?? true),
        isAssigned: true,
        startedAt: null,
        assignedByCoachName: null,
        progression: {
          sessionsDone: 0,
          completionPercent: null
        },
        completionStatus: "NOT_STARTED"
      })),
      selfStartedPrograms: []
    };
  }

  return {
    assignedPrograms: Array.isArray(payload.assignedPrograms) ? payload.assignedPrograms : [],
    selfStartedPrograms: Array.isArray(payload.selfStartedPrograms) ? payload.selfStartedPrograms : []
  };
}

function findSummaryById(
  programId: string | null,
  available: AvailableProgram[],
  mine: MyProgramsResponse
): MemberProgramSummary | null {
  if (!programId) {
    return null;
  }

  const fromAssigned = mine.assignedPrograms.find((program) => program.id === programId);
  if (fromAssigned) {
    return fromAssigned;
  }

  const fromSelfStarted = mine.selfStartedPrograms.find((program) => program.id === programId);
  if (fromSelfStarted) {
    return fromSelfStarted;
  }

  const fromAvailable = available.find((program) => program.id === programId);
  if (!fromAvailable) {
    return null;
  }

  return {
    id: fromAvailable.id,
    title: fromAvailable.title,
    description: fromAvailable.shortDescription,
    isPublic: fromAvailable.isPublic,
    isAssigned: false,
    startedAt: null,
    assignedByCoachName: null,
    progression: {
      sessionsDone: 0,
      completionPercent: null
    },
    completionStatus: "NOT_STARTED"
  };
}

export default function MemberProgramScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("available");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [availablePrograms, setAvailablePrograms] = useState<AvailableProgram[]>([]);
  const [myPrograms, setMyPrograms] = useState<MyProgramsResponse>({
    assignedPrograms: [],
    selfStartedPrograms: []
  });
  const [programDetails, setProgramDetails] = useState<ProgramDetail[]>([]);

  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [errorAvailable, setErrorAvailable] = useState<string | null>(null);
  const [errorMine, setErrorMine] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [restRemaining, setRestRemaining] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [validatingSession, setValidatingSession] = useState(false);
  const [sessionValidated, setSessionValidated] = useState(false);
  const [sessionPrimed, setSessionPrimed] = useState(false);

  const loadAvailable = useCallback(async () => {
    try {
      setLoadingAvailable(true);
      setErrorAvailable(null);
      const payload = await apiGet<AvailableProgramsResponse | AvailableProgram[] | ProgramDetail[]>("/programs/available");
      setAvailablePrograms(normalizeAvailable(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger les programmes disponibles.";
      setErrorAvailable(message);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  const loadMine = useCallback(async () => {
    try {
      setLoadingMine(true);
      setErrorMine(null);
      const payload = await apiGet<MyProgramsResponse | ProgramDetail[]>("/programs/mine");
      setMyPrograms(normalizeMine(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger mes programmes.";
      setErrorMine(message);
    } finally {
      setLoadingMine(false);
    }
  }, []);

  const loadDetails = useCallback(async () => {
    try {
      setLoadingDetails(true);
      setErrorDetails(null);
      const payload = await apiGet<ProgramDetail[]>("/programs");
      setProgramDetails(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger les détails programme.";
      setErrorDetails(message);
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    loadAvailable();
    loadMine();
    loadDetails();
  }, [loadAvailable, loadMine, loadDetails]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      const interval = setInterval(loadAll, 20000);
      return () => clearInterval(interval);
    }, [loadAll])
  );

  const selectedProgramDetail = useMemo(
    () => programDetails.find((program) => program.id === selectedProgramId) || null,
    [programDetails, selectedProgramId]
  );

  const selectedAvailableProgram = useMemo(
    () => availablePrograms.find((program) => program.id === selectedProgramId) || null,
    [availablePrograms, selectedProgramId]
  );

  const selectedProgramSummary = useMemo(
    () => findSummaryById(selectedProgramId, availablePrograms, myPrograms),
    [selectedProgramId, availablePrograms, myPrograms]
  );

  const hasStarted = useMemo(() => {
    if (!selectedProgramSummary) {
      return false;
    }
    return (
      Boolean(selectedProgramSummary.startedAt) ||
      selectedProgramSummary.progression.sessionsDone > 0 ||
      selectedProgramSummary.completionStatus !== "NOT_STARTED"
    );
  }, [selectedProgramSummary]);

  const isAssignedProgram = Boolean(selectedProgramSummary?.isAssigned);
  const isLockedProgram = Boolean(
    selectedProgramSummary &&
      !selectedProgramSummary.isAssigned &&
      !hasStarted &&
      !selectedProgramSummary.isPublic
  );

  useEffect(() => {
    setWorkoutStarted(false);
    setDoneMap({});
    setRestRemaining(0);
    setRestRunning(false);
    setActiveExerciseId(null);
    setSessionValidated(false);
    setSessionPrimed(false);
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

  const filteredAvailablePrograms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return availablePrograms.filter((program) => {
      if (availabilityFilter === "PUBLIC" && program.accessRestricted) {
        return false;
      }
      if (availabilityFilter === "RESTRICTED" && !program.accessRestricted) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        program.title,
        program.shortDescription,
        program.category,
        program.objective,
        program.creatorName
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [availablePrograms, availabilityFilter, searchQuery]);

  const exerciseCount = selectedProgramDetail?.exercises.length || 0;
  const completedCount = useMemo(
    () => selectedProgramDetail?.exercises.filter((exercise) => doneMap[exercise.id]).length || 0,
    [selectedProgramDetail, doneMap]
  );

  const progressPercent = exerciseCount ? Math.round((completedCount / exerciseCount) * 100) : 0;
  const canValidate =
    workoutStarted &&
    Boolean(selectedProgramDetail?.id) &&
    exerciseCount > 0 &&
    completedCount === exerciseCount &&
    !sessionValidated;

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

  const openProgram = (programId: string) => {
    setSelectedProgramId(programId);
  };

  const resetAvailableFilters = () => {
    setAvailabilityFilter("ALL");
    setSearchQuery("");
  };

  const validateSession = async () => {
    if (!selectedProgramDetail) {
      return;
    }

    try {
      setValidatingSession(true);
      if (!sessionPrimed) {
        await apiPost("/attendance/self", { programId: selectedProgramDetail.id });
      }
      await loadMine();
      setSessionValidated(true);
      setSessionPrimed(false);
      setWorkoutStarted(false);
      setRestRunning(false);
      setRestRemaining(0);
      Alert.alert("Session validée", "Excellent travail. Ta progression est enregistrée.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de valider la séance.";
      Alert.alert("Validation impossible", message);
    } finally {
      setValidatingSession(false);
    }
  };

  const handleContextualCta = async () => {
    if (!selectedProgramDetail && !selectedProgramSummary) {
      return;
    }

    if (isLockedProgram) {
      Alert.alert("Accès restreint", "Ce programme est privé. Demande l'assignation à ton coach.");
      return;
    }

    const targetProgramId = selectedProgramDetail?.id || selectedProgramSummary?.id;
    if (!targetProgramId) {
      return;
    }

    const shouldPrimeProgression = !isAssignedProgram && !hasStarted;
    if (shouldPrimeProgression) {
      try {
        await apiPost("/attendance/self", { programId: targetProgramId });
        setSessionPrimed(true);
        await loadMine();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de démarrer ce programme pour le moment.";
        Alert.alert("Démarrage impossible", message);
        return;
      }
    }

    setWorkoutStarted(true);
  };

  const contextualCtaLabel = useMemo(() => {
    if (isLockedProgram) {
      return "Accès restreint";
    }
    if (hasStarted) {
      return "Continuer";
    }
    if (isAssignedProgram) {
      return "Assigné — Commencer";
    }
    return "Commencer";
  }, [hasStarted, isAssignedProgram, isLockedProgram]);

  const hasAvailableFilters = searchQuery.trim().length > 0 || availabilityFilter !== "ALL";

  if (selectedProgramId) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedProgramId(null)}>
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>{selectedProgramSummary?.title || "Programme"}</Text>
            <Text style={styles.subtitle}>
              {selectedProgramSummary?.description || "Consulte les exercices et démarre ta séance."}
            </Text>
          </View>

          {errorDetails ? <Text style={styles.errorText}>{errorDetails}</Text> : null}

          <View style={styles.badgeRow}>
            {(selectedAvailableProgram?.level || selectedProgramDetail?.level) ? (
              <View style={[styles.levelBadge, styles.badgePublic]}>
                <Text style={styles.levelBadgeText}>{selectedAvailableProgram?.level || selectedProgramDetail?.level}</Text>
              </View>
            ) : null}
            {(selectedAvailableProgram?.durationWeeks || selectedProgramDetail?.durationWeeks) ? (
              <View style={[styles.levelBadge, styles.badgeDuration]}>
                <Text style={styles.levelBadgeText}>
                  {selectedAvailableProgram?.durationWeeks || selectedProgramDetail?.durationWeeks} semaines
                </Text>
              </View>
            ) : null}
            {(selectedAvailableProgram?.objective ||
              selectedAvailableProgram?.category ||
              selectedProgramDetail?.objective ||
              selectedProgramDetail?.category) ? (
              <View style={[styles.levelBadge, styles.badgeObjective]}>
                <Text style={styles.levelBadgeText}>
                  {selectedAvailableProgram?.objective ||
                    selectedAvailableProgram?.category ||
                    selectedProgramDetail?.objective ||
                    selectedProgramDetail?.category}
                </Text>
              </View>
            ) : null}
          </View>

          <Card tone={isLockedProgram ? "default" : "program"}>
            <Text style={styles.sectionTitle}>Créé par</Text>
            <Text style={styles.metaText}>
              {selectedAvailableProgram?.creatorName || selectedProgramSummary?.assignedByCoachName || "Coach du gym"}
            </Text>
            <TouchableOpacity
              style={[styles.validateButton, isLockedProgram && styles.validateButtonDisabled]}
              onPress={handleContextualCta}
            >
              <Text style={styles.validateButtonText}>{contextualCtaLabel}</Text>
            </TouchableOpacity>
          </Card>

          {!selectedProgramDetail ? (
            <Card tone={isLockedProgram ? "default" : "program"}>
              <Text style={styles.metaText}>
                {loadingDetails ? "Chargement des détails..." : "Aperçu limité disponible."}
              </Text>
              {!isLockedProgram ? (
                <TouchableOpacity style={styles.secondaryButton} onPress={loadDetails}>
                  <Text style={styles.secondaryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.lockedLabel}>Assignation requise</Text>
              )}
            </Card>
          ) : (
            <>
              {!workoutStarted ? (
                <Card tone={isLockedProgram ? "default" : "program"}>
                  <Text style={styles.sectionTitle}>Aperçu — Semaine 1</Text>
                  {selectedProgramDetail.exercises.slice(0, 4).map((exercise) => (
                    <View key={exercise.id} style={styles.previewRow}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {exercise.sets}x{exercise.reps}
                      </Text>
                    </View>
                  ))}
                  {selectedProgramDetail.exercises.length === 0 ? (
                    <Text style={styles.metaText}>Exercices bientôt disponibles.</Text>
                  ) : null}
                  {isLockedProgram ? <Text style={styles.lockedLabel}>Accès complet verrouillé</Text> : null}
                </Card>
              ) : null}

              {!isLockedProgram && workoutStarted ? (
                <>
                  <Card tone="program">
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>Workout session</Text>
                        <Text style={styles.metaText}>
                          {completedCount}/{exerciseCount} exercices terminés ({progressPercent}%)
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.primaryButton, styles.primaryButtonActive]}
                        onPress={() => setWorkoutStarted(false)}
                        disabled={sessionValidated}
                      >
                        <Text style={styles.primaryButtonText}>Pause</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(progressPercent, 2)}%` }]} />
                    </View>
                  </Card>

                  <Card tone="booking">
                    <Text style={styles.sectionTitle}>Timer repos</Text>
                    <Text style={styles.timerText}>{formatTimer(restRemaining)}</Text>
                    <View style={styles.rowGap}>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setRestRunning((value) => !value)}
                        disabled={restRemaining <= 0}
                      >
                        <Text style={styles.secondaryButtonText}>{restRunning ? "Pause" : "Reprendre"}</Text>
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
                    {selectedProgramDetail.exercises.map((exercise, index) => {
                      const done = !!doneMap[exercise.id];
                      return (
                        <Card key={exercise.id} tone="program">
                          <Text style={styles.exerciseName}>
                            {index + 1}. {exercise.name}
                          </Text>
                          <Text style={styles.exerciseMeta}>
                            {exercise.sets} x {exercise.reps} reps
                          </Text>

                          <View style={styles.rowGap}>
                            <TouchableOpacity
                              style={[styles.setButton, activeExerciseId === exercise.id && styles.setButtonActive]}
                              onPress={() => setActiveExerciseId(exercise.id)}
                              disabled={sessionValidated}
                            >
                              <Text
                                style={[styles.setButtonText, activeExerciseId === exercise.id && styles.setButtonTextActive]}
                              >
                                {activeExerciseId === exercise.id ? "Set en cours" : "Start set"}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.checkButton, done && styles.checkButtonDone]}
                              onPress={() => toggleDone(exercise.id)}
                              disabled={sessionValidated}
                            >
                              <Text style={[styles.checkText, done && styles.checkTextDone]}>
                                {done ? "Fait" : "Terminer"}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={styles.restButton}
                            onPress={() => startRest(exercise.restSeconds)}
                            disabled={sessionValidated}
                          >
                            <Text style={styles.restButtonText}>Repos ({exercise.restSeconds}s)</Text>
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
                      <Text style={styles.metaText}>Ta progression est enregistrée.</Text>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => {
                          setDoneMap({});
                          setSessionValidated(false);
                          setWorkoutStarted(false);
                          setSessionPrimed(false);
                        }}
                      >
                        <Text style={styles.secondaryButtonText}>Nouvelle séance</Text>
                      </TouchableOpacity>
                    </Card>
                  )}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Programmes</Text>
          <Text style={styles.subtitle}>Disponibles et mes programmes en un coup d'oeil</Text>
        </View>

        <View style={styles.tabWrap}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "available" && styles.tabButtonActive]}
            onPress={() => setActiveTab("available")}
          >
            <Text style={[styles.tabText, activeTab === "available" && styles.tabTextActive]}>Disponibles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "mine" && styles.tabButtonActive]}
            onPress={() => setActiveTab("mine")}
          >
            <Text style={[styles.tabText, activeTab === "mine" && styles.tabTextActive]}>Mes programmes</Text>
          </TouchableOpacity>
        </View>

        {activeTab === "available" ? (
          <>
            <Card tone="default">
              <Text style={styles.sectionTitle}>Catalogue des programmes</Text>
              <Text style={styles.metaText}>
                Public: démarre immédiatement. Privé: aperçu visible, assignation du coach requise.
              </Text>
            </Card>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher un programme..."
              placeholderTextColor="#7a7f8a"
              style={styles.searchInput}
            />

            <View style={styles.filterRow}>
              {[
                { key: "ALL", label: "Tous" },
                { key: "PUBLIC", label: "Public" },
                { key: "RESTRICTED", label: "Privés" }
              ].map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    availabilityFilter === filter.key && styles.filterChipActive
                  ]}
                  onPress={() => setAvailabilityFilter(filter.key as AvailabilityFilter)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      availabilityFilter === filter.key && styles.filterTextActive
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loadingAvailable ? (
              <Card tone="default">
                <Text style={styles.metaText}>Chargement des programmes disponibles...</Text>
              </Card>
            ) : null}
            {errorAvailable ? (
              <Card tone="default">
                <Text style={styles.errorText}>{errorAvailable}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={loadAvailable}>
                  <Text style={styles.secondaryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              </Card>
            ) : null}

            <View style={styles.list}>
              {!loadingAvailable && !errorAvailable ? (
                <Text style={styles.sectionHeader}>
                  PROGRAMMES VISIBLES ({filteredAvailablePrograms.length})
                </Text>
              ) : null}
              {filteredAvailablePrograms.map((program) => {
                const locked = program.locked || program.accessRestricted;
                return (
                  <Card key={program.id} tone={locked ? "default" : "program"} style={locked ? styles.lockedCard : undefined}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.programTitle}>{program.title}</Text>
                      <View style={[styles.levelBadge, locked ? styles.badgeLocked : styles.badgePublic]}>
                        <Text style={styles.levelBadgeText}>{locked ? "Privé" : "Public"}</Text>
                      </View>
                    </View>

                    <View style={styles.badgeRow}>
                      {program.level ? (
                        <View style={[styles.levelBadge, styles.badgeDuration]}>
                          <Text style={styles.levelBadgeText}>{program.level}</Text>
                        </View>
                      ) : null}
                      {(program.category || program.objective) ? (
                        <View style={[styles.levelBadge, styles.badgeObjective]}>
                          <Text style={styles.levelBadgeText}>{program.category || program.objective}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.programMeta}>
                      {program.durationWeeks ? `${program.durationWeeks} sem.` : "Durée libre"} ·{" "}
                      {program.sessionsPerWeek ? `${program.sessionsPerWeek}x/sem` : "Fréquence libre"}
                    </Text>
                    <Text style={styles.programMeta}>{program.shortDescription || "Aperçu indisponible"}</Text>
                    <Text style={styles.programMeta}>par {program.creatorName || "Coach"}</Text>

                    {locked ? (
                      <View style={styles.lockedWrap}>
                        <Text style={styles.lockedLabel}>Assignation requise</Text>
                        <Text style={styles.lockedHint}>
                          Ce programme est privé. Tu peux voir l'aperçu, mais seul ton coach peut l'activer.
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={[styles.primaryButton, locked && styles.primaryButtonMuted]}
                      onPress={() => openProgram(program.id)}
                    >
                      <Text style={styles.primaryButtonText}>{locked ? "Voir l'aperçu" : "Voir le programme"}</Text>
                    </TouchableOpacity>
                  </Card>
                );
              })}

              {!loadingAvailable && !errorAvailable && filteredAvailablePrograms.length === 0 && (
                <Card tone="default">
                  <Text style={styles.sectionTitle}>
                    {hasAvailableFilters ? "Aucun résultat" : "Aucun programme visible"}
                  </Text>
                  <Text style={styles.emptyText}>
                    {hasAvailableFilters
                      ? "Aucun programme ne correspond à ta recherche ou à tes filtres."
                      : "Ton gym n'a pas encore publié de programme accessible."}
                  </Text>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={hasAvailableFilters ? resetAvailableFilters : loadAvailable}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {hasAvailableFilters ? "Réinitialiser les filtres" : "Rafraîchir"}
                    </Text>
                  </TouchableOpacity>
                </Card>
              )}
            </View>
          </>
        ) : (
          <>
            <Card tone="default">
              <Text style={styles.sectionTitle}>Mes programmes actifs</Text>
              <Text style={styles.metaText}>
                Assignés: envoyés par ton coach. Autodidactes: démarrés par toi depuis "Disponibles".
              </Text>
            </Card>

            {loadingMine ? (
              <Card tone="default">
                <Text style={styles.metaText}>Chargement de mes programmes...</Text>
              </Card>
            ) : null}
            {errorMine ? (
              <Card tone="default">
                <Text style={styles.errorText}>{errorMine}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={loadMine}>
                  <Text style={styles.secondaryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              </Card>
            ) : null}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>ASSIGNÉS PAR MON COACH</Text>
              <View style={[styles.counterBadge, styles.counterBadgeAssigned]}>
                <Text style={styles.counterBadgeText}>{myPrograms.assignedPrograms.length}</Text>
              </View>
            </View>
            <View style={styles.list}>
              {myPrograms.assignedPrograms.map((program) => (
                <Card key={program.id} tone="progress">
                  <View style={styles.rowBetween}>
                    <Text style={styles.programTitle}>{program.title}</Text>
                    <View style={[styles.levelBadge, styles.badgeAssigned]}>
                      <Text style={styles.levelBadgeText}>Assigné</Text>
                    </View>
                  </View>
                  <Text style={styles.programMeta}>Coach: {program.assignedByCoachName || "Non précisé"}</Text>
                  <Text style={styles.programMeta}>{formatStartedAt(program.startedAt)}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.levelBadge, styles.badgeProgress]}>
                      <Text style={styles.levelBadgeText}>
                        {program.progression.sessionsDone} séance(s)
                      </Text>
                    </View>
                    <View style={[styles.levelBadge, styles.badgeDuration]}>
                      <Text style={styles.levelBadgeText}>
                        {completionBadgeLabel(program.completionStatus)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => openProgram(program.id)}>
                    <Text style={styles.primaryButtonText}>
                      {program.completionStatus === "NOT_STARTED" ? "Commencer" : "Continuer"}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}

              {!loadingMine && myPrograms.assignedPrograms.length === 0 && (
                <Card tone="progress">
                  <Text style={styles.sectionTitle}>Aucun programme assigné</Text>
                  <Text style={styles.emptyText}>
                    Ton coach ne t'a pas encore attribué de programme.
                  </Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab("available")}>
                    <Text style={styles.secondaryButtonText}>Explorer les disponibles</Text>
                  </TouchableOpacity>
                </Card>
              )}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>PROGRAMMES EN COURS (AUTODIDACTE)</Text>
              <View style={[styles.counterBadge, styles.counterBadgeSelf]}>
                <Text style={styles.counterBadgeText}>{myPrograms.selfStartedPrograms.length}</Text>
              </View>
            </View>
            <View style={styles.list}>
              {myPrograms.selfStartedPrograms.map((program) => (
                <Card key={program.id} tone="booking">
                  <View style={styles.rowBetween}>
                    <Text style={styles.programTitle}>{program.title}</Text>
                    <View style={[styles.levelBadge, styles.badgeSelf]}>
                      <Text style={styles.levelBadgeText}>Autodidacte</Text>
                    </View>
                  </View>
                  <Text style={styles.programMeta}>{formatStartedAt(program.startedAt)}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.levelBadge, styles.badgeProgress]}>
                      <Text style={styles.levelBadgeText}>
                        {program.progression.sessionsDone} séance(s)
                      </Text>
                    </View>
                    <View style={[styles.levelBadge, styles.badgeDuration]}>
                      <Text style={styles.levelBadgeText}>
                        {completionBadgeLabel(program.completionStatus)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => openProgram(program.id)}>
                    <Text style={styles.primaryButtonText}>
                      {program.completionStatus === "NOT_STARTED" ? "Commencer" : "Continuer"}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}

              {!loadingMine && myPrograms.selfStartedPrograms.length === 0 && (
                <Card tone="booking">
                  <Text style={styles.sectionTitle}>Aucun programme autodidacte actif</Text>
                  <Text style={styles.emptyText}>
                    Démarre un programme public depuis l'onglet "Disponibles".
                  </Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveTab("available")}>
                    <Text style={styles.secondaryButtonText}>Voir les programmes</Text>
                  </TouchableOpacity>
                </Card>
              )}
            </View>
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
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tabWrap: {
    flexDirection: "row",
    backgroundColor: "#efe9dd",
    borderRadius: 12,
    padding: 4,
    gap: 6
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  tabButtonActive: {
    backgroundColor: "#1a1d28"
  },
  tabText: {
    fontWeight: "700",
    color: "#5e6472"
  },
  tabTextActive: {
    color: "#ffffff"
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#d9d1c4",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.ink
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#d7d0c5",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fffaf6"
  },
  filterChipActive: {
    backgroundColor: colors.skySoft,
    borderColor: "#9fc1ff"
  },
  filterText: {
    color: "#5e6472",
    fontWeight: "600"
  },
  filterTextActive: {
    color: "#1d4ed8"
  },
  list: {
    gap: 12
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3e4350",
    marginTop: 4
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 4
  },
  counterBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  counterBadgeAssigned: {
    backgroundColor: "#d8f3e5"
  },
  counterBadgeSelf: {
    backgroundColor: "#dce9fb"
  },
  counterBadgeText: {
    fontWeight: "700",
    color: "#1f2937"
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  rowGap: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10
  },
  programTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.ink,
    flex: 1
  },
  programMeta: {
    color: "#4b5563",
    marginTop: 4
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  badgePublic: {
    backgroundColor: "#e6f9ee"
  },
  badgeDuration: {
    backgroundColor: "#e6edff"
  },
  badgeObjective: {
    backgroundColor: "#ede8ff"
  },
  badgeLocked: {
    backgroundColor: "#f4e6e1"
  },
  badgeAssigned: {
    backgroundColor: "#d8f3e5"
  },
  badgeSelf: {
    backgroundColor: "#dce9fb"
  },
  badgeProgress: {
    backgroundColor: "#fff4cf"
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2f3a48"
  },
  lockedCard: {
    borderStyle: "dashed",
    borderColor: "#d2c7bb",
    backgroundColor: "#f8f6f2"
  },
  lockedWrap: {
    marginTop: 8,
    gap: 4
  },
  lockedLabel: {
    color: "#9a3412",
    fontWeight: "700"
  },
  lockedHint: {
    color: "#7c5a4d",
    fontSize: 13
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: colors.brand,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
    alignItems: "center"
  },
  primaryButtonMuted: {
    backgroundColor: "#8d857a"
  },
  primaryButtonActive: {
    backgroundColor: "#151926"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700"
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700"
  },
  metaText: {
    color: "#4b5563",
    marginTop: 4
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
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8
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
  emptyText: {
    color: "#616977"
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "600"
  }
});
