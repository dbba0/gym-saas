import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import { apiGet, apiPatch, apiPost } from "../lib/api";

type Program = {
  id: string;
  memberId?: string | null;
  title: string;
  description?: string | null;
  exercises?: Array<{ id: string; name: string }>;
  member?: { firstName: string; lastName: string } | null;
};

type Member = {
  id: string;
  firstName: string;
  lastName: string;
};

type AssignableMember = {
  id: string;
  firstName: string;
  lastName: string;
  isAssigned: boolean;
  sessionsDone: number;
  startedAt: string | null;
  statusLabel: string;
};

type AssignableMembersResponse = {
  programId: string;
  assignedMemberId: string | null;
  members: AssignableMember[];
};

function initials(firstName: string, lastName: string) {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  return `${a}${b}`;
}

export default function CoachProgramsScreen() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("3");
  const [exerciseReps, setExerciseReps] = useState("10");
  const [exerciseRest, setExerciseRest] = useState("60");

  const [exerciseProgramId, setExerciseProgramId] = useState<string | null>(null);
  const [addingExercise, setAddingExercise] = useState(false);
  const [extraExerciseName, setExtraExerciseName] = useState("");
  const [extraExerciseSets, setExtraExerciseSets] = useState("3");
  const [extraExerciseReps, setExtraExerciseReps] = useState("10");
  const [extraExerciseRest, setExtraExerciseRest] = useState("60");

  const [assignViewProgramId, setAssignViewProgramId] = useState<string | null>(null);
  const [assignMembers, setAssignMembers] = useState<AssignableMember[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [loadingAssignMembers, setLoadingAssignMembers] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningTargetKey, setAssigningTargetKey] = useState<string | null>(null);

  const loadData = () => {
    Promise.all([apiGet<Program[]>("/programs"), apiGet<Member[]>("/members")])
      .then(([programItems, memberItems]) => {
        setPrograms(programItems);
        setMembers(memberItems);
      })
      .catch(() => null);
  };

  const loadAssignableMembers = async (programId: string) => {
    try {
      setLoadingAssignMembers(true);
      setAssignError(null);
      const payload = await apiGet<AssignableMembersResponse>(`/programs/${programId}/assignable-members`);
      setAssignMembers(payload.members || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load members.";
      setAssignError(message);
    } finally {
      setLoadingAssignMembers(false);
    }
  };

  const openAssignView = async (programId: string) => {
    if (assignViewProgramId === programId) {
      setAssignViewProgramId(null);
      setAssignSearch("");
      setAssignMembers([]);
      setAssignError(null);
      return;
    }

    setAssignViewProgramId(programId);
    setAssignSearch("");
    await loadAssignableMembers(programId);
  };

  const createProgram = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a program title.");
      return;
    }

    const parsedSets = Number.parseInt(exerciseSets, 10);
    const parsedReps = Number.parseInt(exerciseReps, 10);
    const parsedRest = Number.parseInt(exerciseRest, 10);
    const hasExercise = exerciseName.trim().length > 0;

    if (
      hasExercise &&
      (!Number.isFinite(parsedSets) ||
        !Number.isFinite(parsedReps) ||
        !Number.isFinite(parsedRest) ||
        parsedSets <= 0 ||
        parsedReps <= 0 ||
        parsedRest <= 0)
    ) {
      Alert.alert("Invalid exercise", "Sets, reps and rest must be positive numbers.");
      return;
    }

    try {
      setCreating(true);
      await apiPost("/programs", {
        title: title.trim(),
        description: description.trim() || undefined,
        memberId: selectedMemberId || undefined,
        exercises: hasExercise
          ? [
              {
                name: exerciseName.trim(),
                sets: parsedSets,
                reps: parsedReps,
                restSeconds: parsedRest
              }
            ]
          : undefined
      });

      setTitle("");
      setDescription("");
      setSelectedMemberId(null);
      setExerciseName("");
      setExerciseSets("3");
      setExerciseReps("10");
      setExerciseRest("60");
      setCreateOpen(false);
      loadData();
      Alert.alert("Done", "Program created.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create program.";
      Alert.alert("Create failed", message);
    } finally {
      setCreating(false);
    }
  };

  const assignProgram = async (programId: string, memberId: string) => {
    try {
      const key = `${programId}:${memberId}`;
      setAssigningTargetKey(key);
      await apiPatch(`/programs/${programId}/assign`, { memberId });
      await Promise.all([loadData(), loadAssignableMembers(programId)]);
      Alert.alert("Assigné", "Le programme a été assigné au membre.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to assign this program.";
      Alert.alert("Assign failed", message);
    } finally {
      setAssigningTargetKey(null);
    }
  };

  const saveExtraExercise = async () => {
    if (!exerciseProgramId) {
      return;
    }
    const parsedSets = Number.parseInt(extraExerciseSets, 10);
    const parsedReps = Number.parseInt(extraExerciseReps, 10);
    const parsedRest = Number.parseInt(extraExerciseRest, 10);
    if (
      !extraExerciseName.trim() ||
      !Number.isFinite(parsedSets) ||
      !Number.isFinite(parsedReps) ||
      !Number.isFinite(parsedRest) ||
      parsedSets <= 0 ||
      parsedReps <= 0 ||
      parsedRest <= 0
    ) {
      Alert.alert("Invalid exercise", "Please fill valid exercise values.");
      return;
    }

    try {
      setAddingExercise(true);
      await apiPost(`/programs/${exerciseProgramId}/exercises`, {
        exercises: [
          {
            name: extraExerciseName.trim(),
            sets: parsedSets,
            reps: parsedReps,
            restSeconds: parsedRest
          }
        ]
      });
      setExtraExerciseName("");
      setExtraExerciseSets("3");
      setExtraExerciseReps("10");
      setExtraExerciseRest("60");
      setExerciseProgramId(null);
      loadData();
      Alert.alert("Done", "Exercise added.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add exercise.";
      Alert.alert("Add failed", message);
    } finally {
      setAddingExercise(false);
    }
  };

  const filteredAssignMembers = useMemo(() => {
    const query = assignSearch.trim().toLowerCase();
    if (!query) {
      return assignMembers;
    }
    return assignMembers.filter((member) => {
      const label = `${member.firstName} ${member.lastName} ${member.statusLabel}`.toLowerCase();
      return label.includes(query);
    });
  }, [assignMembers, assignSearch]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Programs</Text>
        <Text style={styles.subtitle}>Create and assign plans</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => setCreateOpen((prev) => !prev)}>
        <Text style={styles.buttonText}>{createOpen ? "Close" : "Create program"}</Text>
      </TouchableOpacity>

      {createOpen && (
        <Card tone="program">
          <Text style={styles.formTitle}>New program</Text>
          <TextInput
            style={styles.input}
            placeholder="Program title"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.formLabel}>Assign member (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, !selectedMemberId && styles.chipActive]}
              onPress={() => setSelectedMemberId(null)}
            >
              <Text style={[styles.chipText, !selectedMemberId && styles.chipTextActive]}>Not assigned</Text>
            </TouchableOpacity>
            {members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[styles.chip, selectedMemberId === member.id && styles.chipActive]}
                onPress={() => setSelectedMemberId(member.id)}
              >
                <Text style={[styles.chipText, selectedMemberId === member.id && styles.chipTextActive]}>
                  {member.firstName} {member.lastName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.formLabel}>First exercise (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Exercise name"
            value={exerciseName}
            onChangeText={setExerciseName}
          />
          <View style={styles.inlineInputs}>
            <TextInput
              style={[styles.input, styles.inlineInput]}
              placeholder="Sets"
              keyboardType="number-pad"
              value={exerciseSets}
              onChangeText={setExerciseSets}
            />
            <TextInput
              style={[styles.input, styles.inlineInput]}
              placeholder="Reps"
              keyboardType="number-pad"
              value={exerciseReps}
              onChangeText={setExerciseReps}
            />
            <TextInput
              style={[styles.input, styles.inlineInput]}
              placeholder="Rest(s)"
              keyboardType="number-pad"
              value={exerciseRest}
              onChangeText={setExerciseRest}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, creating && styles.buttonDisabled]}
            onPress={createProgram}
            disabled={creating}
          >
            <Text style={styles.buttonText}>{creating ? "Creating..." : "Save program"}</Text>
          </TouchableOpacity>
        </Card>
      )}

      <View style={styles.list}>
        {programs.map((item) => (
          <Card key={item.id} tone="program">
            <Text style={styles.programTitle}>{item.title}</Text>
            <Text style={styles.programMeta}>
              Member: {item.member ? `${item.member.firstName} ${item.member.lastName}` : "Not assigned"}
            </Text>
            <Text style={styles.programMeta}>Exercises: {item.exercises?.length || 0}</Text>

            <TouchableOpacity
              style={[styles.secondaryButton, assignViewProgramId === item.id && styles.secondaryButtonActive]}
              onPress={() => openAssignView(item.id)}
            >
              <Text style={styles.secondaryButtonText}>
                {assignViewProgramId === item.id ? "Close assignment" : "Assign to member"}
              </Text>
            </TouchableOpacity>

            {assignViewProgramId === item.id && (
              <View style={styles.assignPanel}>
                <Text style={styles.assignTitle}>Assigner à un membre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Rechercher un membre..."
                  value={assignSearch}
                  onChangeText={setAssignSearch}
                />
                {loadingAssignMembers ? <Text style={styles.programMeta}>Loading members...</Text> : null}
                {assignError ? <Text style={styles.errorText}>{assignError}</Text> : null}

                {filteredAssignMembers.map((member) => {
                  const isLoadingThis = assigningTargetKey === `${item.id}:${member.id}`;
                  return (
                    <View key={`${item.id}:${member.id}`} style={styles.memberRow}>
                      <View style={styles.memberIdentity}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{initials(member.firstName, member.lastName)}</Text>
                        </View>
                        <View style={styles.memberTextWrap}>
                          <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
                          <Text style={styles.memberStatus}>{member.statusLabel}</Text>
                        </View>
                      </View>

                      {member.isAssigned ? (
                        <View style={styles.assignedBadge}>
                          <Text style={styles.assignedBadgeText}>✓ Assigné</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.assignButton, isLoadingThis && styles.buttonDisabled]}
                          onPress={() => assignProgram(item.id, member.id)}
                          disabled={isLoadingThis}
                        >
                          <Text style={styles.assignButtonText}>{isLoadingThis ? "..." : "Assigner"}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {!loadingAssignMembers && filteredAssignMembers.length === 0 ? (
                  <Text style={styles.programMeta}>No managed member found.</Text>
                ) : null}

                <Text style={styles.assignmentHint}>
                  Le membre verra ce programme dans "Mes programmes".
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.secondaryButton, exerciseProgramId === item.id && styles.secondaryButtonActive]}
              onPress={() => setExerciseProgramId((current) => (current === item.id ? null : item.id))}
            >
              <Text style={styles.secondaryButtonText}>
                {exerciseProgramId === item.id ? "Close exercise form" : "Add exercise"}
              </Text>
            </TouchableOpacity>

            {exerciseProgramId === item.id && (
              <View style={styles.addExerciseBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Exercise name"
                  value={extraExerciseName}
                  onChangeText={setExtraExerciseName}
                />
                <View style={styles.inlineInputs}>
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="Sets"
                    keyboardType="number-pad"
                    value={extraExerciseSets}
                    onChangeText={setExtraExerciseSets}
                  />
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="Reps"
                    keyboardType="number-pad"
                    value={extraExerciseReps}
                    onChangeText={setExtraExerciseReps}
                  />
                  <TextInput
                    style={[styles.input, styles.inlineInput]}
                    placeholder="Rest(s)"
                    keyboardType="number-pad"
                    value={extraExerciseRest}
                    onChangeText={setExtraExerciseRest}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.button, addingExercise && styles.buttonDisabled]}
                  onPress={saveExtraExercise}
                  disabled={addingExercise}
                >
                  <Text style={styles.buttonText}>{addingExercise ? "Saving..." : "Save exercise"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        ))}

        {programs.length === 0 && (
          <Card tone="program">
            <Text style={styles.programMeta}>No programs created yet.</Text>
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
  button: {
    backgroundColor: colors.brand,
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    fontWeight: "600",
    color: colors.ink
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10
  },
  formLabel: {
    fontSize: 13,
    color: "#4b5563",
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: "#e4ded3",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    marginBottom: 10
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 8
  },
  inlineInput: {
    flex: 1
  },
  chipsRow: {
    marginBottom: 10
  },
  chip: {
    borderWidth: 1,
    borderColor: "#d6d1c8",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: "#fff"
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  chipText: {
    color: "#4b5563",
    fontWeight: "600"
  },
  chipTextActive: {
    color: "#fff"
  },
  list: {
    gap: 12
  },
  programTitle: {
    fontSize: 18,
    fontWeight: "700"
  },
  programMeta: {
    color: "#4b5563"
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d6d1c8",
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonActive: {
    backgroundColor: "#fff7f2",
    borderColor: colors.brand
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: "600"
  },
  addExerciseBox: {
    marginTop: 10
  },
  assignPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ddd6c8",
    borderRadius: 14,
    padding: 10,
    backgroundColor: "#fff"
  },
  assignTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#efe8dc"
  },
  memberIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 8
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#e8ebff",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontWeight: "700",
    color: "#334155"
  },
  memberTextWrap: {
    flex: 1
  },
  memberName: {
    fontWeight: "700",
    color: colors.ink
  },
  memberStatus: {
    color: "#4b5563",
    fontSize: 12
  },
  assignButton: {
    borderWidth: 1,
    borderColor: "#d1cabf",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff"
  },
  assignButtonText: {
    fontWeight: "700",
    color: colors.ink
  },
  assignedBadge: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#dff4e9"
  },
  assignedBadgeText: {
    fontWeight: "700",
    color: "#1f7a4f"
  },
  assignmentHint: {
    marginTop: 10,
    color: "#5f6775",
    fontSize: 12
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "600",
    marginBottom: 8
  }
});
