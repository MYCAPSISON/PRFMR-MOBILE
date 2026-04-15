import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WorkoutCard, WorkoutSession } from "@/components/WorkoutCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface Exercise {
  id: number;
  name: string;
  category?: string;
  muscleGroup?: string;
}

interface LogSet {
  exerciseId: number;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  rpe: string;
}

export default function TrainingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [sessionType, setSessionType] = useState("Strength");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionRpe, setSessionRpe] = useState("");
  const [sets, setSets] = useState<LogSet[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: sessions, isLoading: loadingSessions, refetch: refetchSessions } = useQuery<WorkoutSession[]>({
    queryKey: ["workoutSessions"],
    queryFn: () => apiFetch("/workouts/sessions"),
  });

  const { data: trainingLoad, isLoading: loadingLoad, refetch: refetchLoad } = useQuery<{ acwr?: number; weeklyLoad?: number; trend?: string; chronic?: number; acute?: number }>({
    queryKey: ["trainingLoad"],
    queryFn: () => apiFetch("/me/training/load"),
  });

  const { data: exercises } = useQuery<Exercise[]>({
    queryKey: ["exercises"],
    queryFn: () => apiFetch("/exercises"),
    staleTime: Infinity,
  });

  const filteredExercises = (exercises ?? []).filter((e) =>
    e.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  ).slice(0, 20);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchSessions(), refetchLoad()]);
    setRefreshing(false);
  }

  function addSet(exercise: Exercise) {
    setSets((prev) => [...prev, { exerciseId: exercise.id, exerciseName: exercise.name, sets: "3", reps: "8", weight: "", rpe: "" }]);
    setExerciseSearch("");
  }

  async function saveSession() {
    setSaving(true);
    try {
      const exercisesPayload = sets.map((s) => ({
        exerciseId: s.exerciseId,
        name: s.exerciseName,
        sets: parseInt(s.sets) || 1,
        reps: parseInt(s.reps) || 1,
        weight: s.weight ? parseFloat(s.weight) : undefined,
        rpe: s.rpe ? parseFloat(s.rpe) : undefined,
      }));
      await apiFetch("/workouts/sessions", {
        method: "POST",
        body: {
          type: sessionType,
          duration: duration ? parseInt(duration) : undefined,
          notes,
          rpe: sessionRpe ? parseFloat(sessionRpe) : undefined,
          date: new Date().toISOString(),
          exercises: exercisesPayload,
        },
      });
      qc.invalidateQueries({ queryKey: ["workoutSessions"] });
      qc.invalidateQueries({ queryKey: ["trainingLoad"] });
      setLogModalVisible(false);
      setSets([]);
      setDuration("");
      setNotes("");
      setSessionRpe("");
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top + 67, 100) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 100 + bottomPad, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Training</Text>
          <TouchableOpacity
            onPress={() => setLogModalVisible(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Log Session</Text>
          </TouchableOpacity>
        </View>

        {loadingLoad ? (
          <SkeletonCard />
        ) : trainingLoad ? (
          <View style={[styles.loadCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.loadTitle, { color: colors.mutedForeground }]}>TRAINING LOAD</Text>
            <View style={styles.loadStats}>
              <LoadStat label="ACWR" value={trainingLoad.acwr?.toFixed(2) ?? "—"} colors={colors}
                accent={!!trainingLoad.acwr && (trainingLoad.acwr > 1.3 || trainingLoad.acwr < 0.8)} />
              <LoadStat label="Acute" value={trainingLoad.acute?.toFixed(0) ?? "—"} colors={colors} />
              <LoadStat label="Chronic" value={trainingLoad.chronic?.toFixed(0) ?? "—"} colors={colors} />
              <LoadStat label="Trend" value={trainingLoad.trend ?? "—"} colors={colors} />
            </View>
            {trainingLoad.acwr != null && (
              <View style={[styles.acwrBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.acwrFill,
                    {
                      width: `${Math.min(trainingLoad.acwr / 2, 1) * 100}%`,
                      backgroundColor: trainingLoad.acwr > 1.3 ? colors.destructive : trainingLoad.acwr < 0.8 ? colors.warning : colors.success,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Session History</Text>

        {loadingSessions ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (sessions ?? []).length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="zap" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No sessions logged</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Log your first workout to start tracking</Text>
          </View>
        ) : (
          (sessions ?? []).map((session) => (
            <WorkoutCard key={session.id} session={session} />
          ))
        )}
      </ScrollView>

      <Modal visible={logModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLogModalVisible(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Session</Text>
            <TouchableOpacity onPress={() => setLogModalVisible(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <FormField label="SESSION TYPE" colors={colors}>
            <View style={styles.typePicker}>
              {["Strength", "Cardio", "Sparring", "Drilling", "Other"].map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setSessionType(t)}
                  style={[styles.typeChip, { backgroundColor: sessionType === t ? colors.primary : colors.secondary, borderRadius: 20 }]}
                >
                  <Text style={{ color: sessionType === t ? "#fff" : colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </FormField>

          <View style={styles.rowInputs}>
            <FormField label="DURATION (min)" colors={colors} style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor={colors.mutedForeground}
              />
            </FormField>
            <FormField label="SESSION RPE" colors={colors} style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                value={sessionRpe}
                onChangeText={setSessionRpe}
                keyboardType="decimal-pad"
                placeholder="7"
                placeholderTextColor={colors.mutedForeground}
              />
            </FormField>
          </View>

          <FormField label="EXERCISES" colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, marginBottom: 8 }]}
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              placeholder="Search exercises to add..."
              placeholderTextColor={colors.mutedForeground}
            />
            {exerciseSearch.length > 0 && filteredExercises.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                onPress={() => addSet(ex)}
                style={[styles.exerciseItem, { borderColor: colors.border }]}
              >
                <Text style={[styles.exerciseName, { color: colors.foreground }]}>{ex.name}</Text>
                {ex.category && <Text style={[styles.exerciseCat, { color: colors.mutedForeground }]}>{ex.category}</Text>}
              </TouchableOpacity>
            ))}
          </FormField>

          {sets.map((set, idx) => (
            <View key={idx} style={[styles.setRow, { backgroundColor: colors.secondary, borderRadius: colors.radius, borderColor: colors.border }]}>
              <Text style={[styles.setName, { color: colors.foreground }]}>{set.exerciseName}</Text>
              <View style={styles.setInputs}>
                <MiniInput label="Sets" value={set.sets} onChange={(v) => { const n = [...sets]; n[idx].sets = v; setSets(n); }} colors={colors} />
                <MiniInput label="Reps" value={set.reps} onChange={(v) => { const n = [...sets]; n[idx].reps = v; setSets(n); }} colors={colors} />
                <MiniInput label="kg" value={set.weight} onChange={(v) => { const n = [...sets]; n[idx].weight = v; setSets(n); }} colors={colors} />
                <MiniInput label="RPE" value={set.rpe} onChange={(v) => { const n = [...sets]; n[idx].rpe = v; setSets(n); }} colors={colors} />
              </View>
              <TouchableOpacity onPress={() => setSets(sets.filter((_, i) => i !== idx))}>
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}

          <FormField label="NOTES" colors={colors}>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Session notes..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </FormField>

          <TouchableOpacity
            onPress={saveSession}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Session</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

function FormField({ label, children, colors, style }: { label: string; children: React.ReactNode; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; style?: object }) {
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

function LoadStat({ label, value, colors, accent }: { label: string; value: string; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; accent?: boolean }) {
  return (
    <View style={styles.loadStat}>
      <Text style={[styles.loadStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.loadStatValue, { color: accent ? colors.destructive : colors.foreground }]}>{value}</Text>
    </View>
  );
}

function MiniInput({ label, value, onChange, colors }: { label: string; value: string; onChange: (v: string) => void; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[styles.miniLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.miniInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: 6 }]}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  screenTitle: { fontSize: 24, fontWeight: "800" },
  addBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  loadCard: { padding: 16, borderWidth: 1, marginBottom: 20 },
  loadTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 12 },
  loadStats: { flexDirection: "row", justifyContent: "space-between" },
  loadStat: { alignItems: "center" },
  loadStatLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  loadStatValue: { fontSize: 18, fontWeight: "700", marginTop: 2 },
  acwrBar: { height: 4, borderRadius: 2, marginTop: 12, overflow: "hidden" },
  acwrFill: { height: 4, borderRadius: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  emptyBox: { padding: 40, borderWidth: 1, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyText: { fontSize: 13, textAlign: "center" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: { height: 48, paddingHorizontal: 14, borderWidth: 1, fontSize: 15 },
  textarea: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  typePicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7 },
  rowInputs: { flexDirection: "row", gap: 12 },
  exerciseItem: { padding: 10, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  exerciseName: { fontSize: 14, fontWeight: "500" },
  exerciseCat: { fontSize: 12 },
  setRow: { padding: 12, borderWidth: 1, marginBottom: 8 },
  setName: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  setInputs: { flexDirection: "row", gap: 10, marginBottom: 4 },
  miniLabel: { fontSize: 10, fontWeight: "600", marginBottom: 4 },
  miniInput: { width: 52, height: 36, borderWidth: 1, textAlign: "center", fontSize: 14, fontWeight: "600" },
  saveBtn: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
