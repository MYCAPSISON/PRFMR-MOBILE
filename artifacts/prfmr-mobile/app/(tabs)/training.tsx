import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(d: string, n: number) {
  const date = new Date(d + "T12:00:00");
  date.setDate(date.getDate() + n);
  return date.toISOString().split("T")[0];
}
function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const SESSION_TYPES = ["lifting", "cardio", "sparring", "wrestling", "bjj", "muay_thai", "conditioning", "other"];

export default function TrainingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [refreshing, setRefreshing] = useState(false);
  const [newSessionModal, setNewSessionModal] = useState(false);
  const [addExerciseModal, setAddExerciseModal] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sessionType, setSessionType] = useState("lifting");
  const [sessionLabel, setSessionLabel] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("8");
  const [weight, setWeight] = useState("");
  const [rpe, setRpe] = useState("");
  const isToday = selectedDate === todayStr();

  const { data: sessions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/workouts/sessions", selectedDate],
    queryFn: () => apiFetch(`/workouts/sessions?start=${selectedDate}&end=${selectedDate}`),
  });

  const { data: trainingLoad } = useQuery<any>({
    queryKey: ["/api/me/training-load", selectedDate],
    queryFn: () => apiFetch(`/me/training-load/${selectedDate}`),
  });

  const { data: exercises = [] } = useQuery<any[]>({
    queryKey: ["/api/exercises"],
    queryFn: () => apiFetch("/exercises"),
  });

  const { data: activities = [] } = useQuery<any[]>({
    queryKey: ["/api/activities"],
    queryFn: () => apiFetch("/activities"),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/api/workouts/sessions"] });
    await qc.invalidateQueries({ queryKey: ["/api/me/training-load"] });
    setRefreshing(false);
  }, [qc]);

  const createSessionMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/workouts/sessions", { method: "POST", body: data }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/workouts/sessions"] });
      qc.invalidateQueries({ queryKey: ["/api/me/training/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/me/targets/effective"] });
      setNewSessionModal(false);
      setActiveSessionId(data.id);
      setAddExerciseModal(true);
      setSessionLabel("");
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "Failed to create session"),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/workouts/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workouts/sessions"] });
      qc.invalidateQueries({ queryKey: ["/api/me/training/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/me/targets/effective"] });
    },
  });

  const addExerciseMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/workouts/sessions/${activeSessionId}/exercises`, { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workouts/sessions"] });
      qc.invalidateQueries({ queryKey: ["/api/me/training/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/me/targets/effective"] });
      setSelectedExercise(null);
      setSets("3"); setReps("8"); setWeight(""); setRpe("");
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "Failed to add exercise"),
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/workouts/exercises/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/workouts/sessions"] }),
  });

  function confirmAddExercise() {
    if (!selectedExercise || !activeSessionId) return;
    addExerciseMutation.mutate({
      exerciseId: selectedExercise.id,
      name: selectedExercise.name,
      sets: parseInt(sets) || 3,
      reps: parseInt(reps) || 8,
      weight: parseFloat(weight) || null,
      rpe: parseFloat(rpe) || null,
    });
  }

  const filteredExercises = [...exercises, ...activities].filter((e: any) =>
    !exerciseSearch || e.name?.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const acwr = trainingLoad?.acwr;
  const acwrColor = !acwr ? colors.mutedForeground : acwr > 1.3 ? colors.destructive : acwr < 0.8 ? colors.warning : colors.success;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Training</Text>
          <TouchableOpacity onPress={() => setNewSessionModal(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
            <Feather name="plus" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setSelectedDate(d => addDays(d, -1))} style={styles.navBtn}>
            <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.dateText, { color: colors.foreground }]}>{isToday ? "Today" : formatDate(selectedDate)}</Text>
          <TouchableOpacity onPress={() => setSelectedDate(d => addDays(d, 1))} style={[styles.navBtn, { opacity: isToday ? 0.3 : 1 }]} disabled={isToday}>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {acwr != null && (
          <View style={[styles.card, { backgroundColor: acwrColor + "11", borderColor: acwrColor + "33" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>TRAINING LOAD (ACWR)</Text>
                <Text style={{ color: acwrColor, fontSize: 32, fontWeight: "800", marginTop: 4 }}>{acwr.toFixed(2)}</Text>
                <Text style={{ color: acwrColor, fontSize: 13, fontWeight: "600" }}>
                  {acwr > 1.3 ? "High Load — Risk of overtraining" : acwr < 0.8 ? "Under-training" : "Optimal Training Load"}
                </Text>
              </View>
              {trainingLoad?.chronicLoad != null && (
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Acute: {trainingLoad.acuteLoad?.toFixed(0)}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Chronic: {trainingLoad.chronicLoad?.toFixed(0)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {isLoading ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", padding: 32 }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", padding: 32, gap: 12 }]}>
            <Feather name="activity" size={36} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center" }}>No sessions logged for this day.</Text>
            <TouchableOpacity onPress={() => setNewSessionModal(true)}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Log Session</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {sessions.map((session: any) => (
          <View key={session.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <View style={[styles.typeBadge, { backgroundColor: colors.primary + "22" }]}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{session.type?.toUpperCase() ?? "SESSION"}</Text>
                </View>
                <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 4 }}>{session.label ?? session.type}</Text>
                {session.calsBurned > 0 && (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{session.calsBurned} kcal burned</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => { setActiveSessionId(session.id); setAddExerciseModal(true); }}
                  style={[styles.smallBtn, { backgroundColor: colors.secondary }]}>
                  <Feather name="plus" size={14} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert("Delete Session", "Remove this session?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteSessionMutation.mutate(session.id) },
                ])} style={[styles.smallBtn, { backgroundColor: colors.secondary }]}>
                  <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            {(session.exercises ?? []).map((ex: any) => (
              <View key={ex.id} style={[styles.exRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600" }}>{ex.name}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}kg` : ""}{ex.rpe ? ` · RPE ${ex.rpe}` : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteExerciseMutation.mutate(ex.id)} style={{ padding: 8 }}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ))}

            {(session.exercises?.length ?? 0) === 0 && (
              <TouchableOpacity onPress={() => { setActiveSessionId(session.id); setAddExerciseModal(true); }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>+ Add exercises</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={newSessionModal} animationType="slide" presentationStyle="formSheet">
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, gap: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}>New Session</Text>
            <TouchableOpacity onPress={() => setNewSessionModal(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8 }}>SESSION TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {SESSION_TYPES.map(t => (
                <TouchableOpacity key={t} onPress={() => setSessionType(t)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sessionType === t ? colors.primary : colors.secondary }}>
                  <Text style={{ color: sessionType === t ? "#fff" : colors.mutedForeground, fontWeight: "600", fontSize: 13, textTransform: "capitalize" }}>
                    {t.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8 }}>LABEL (OPTIONAL)</Text>
          <TextInput
            style={[styles.inputField, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            value={sessionLabel} onChangeText={setSessionLabel}
            placeholder="e.g. Upper body strength" placeholderTextColor={colors.mutedForeground}
          />
          <TouchableOpacity
            onPress={() => createSessionMutation.mutate({ type: sessionType, date: selectedDate, label: sessionLabel || undefined })}
            disabled={createSessionMutation.isPending}
            style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
            {createSessionMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Create Session</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={addExerciseModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Add Exercise</Text>
            <TouchableOpacity onPress={() => { setAddExerciseModal(false); setSelectedExercise(null); setExerciseSearch(""); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {!selectedExercise ? (
            <>
              <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="search" size={18} color={colors.mutedForeground} />
                <TextInput style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder="Search exercises..." placeholderTextColor={colors.mutedForeground}
                  value={exerciseSearch} onChangeText={setExerciseSearch} autoFocus />
              </View>
              <FlatList data={filteredExercises.slice(0, 50)} keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => setSelectedExercise(item)}
                    style={[styles.resultRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600" }}>{item.name}</Text>
                      {item.category && <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.category}</Text>}
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{selectedExercise.name}</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {[
                  { label: "Sets", value: sets, set: setSets },
                  { label: "Reps", value: reps, set: setReps },
                  { label: "Weight (kg)", value: weight, set: setWeight },
                  { label: "RPE (1-10)", value: rpe, set: setRpe },
                ].map(f => (
                  <View key={f.label} style={{ flex: 1 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 6 }}>{f.label.toUpperCase()}</Text>
                    <TextInput
                      style={[styles.numInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                      value={f.value} onChangeText={f.set}
                      placeholder="-" placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={confirmAddExercise} disabled={addExerciseMutation.isPending}
                style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                {addExerciseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Exercise</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedExercise(null)} style={{ alignItems: "center", padding: 12 }}>
                <Text style={{ color: colors.mutedForeground }}>← Back</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: "800" },
  addBtn: { padding: 10, borderRadius: 10, borderWidth: 1 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  navBtn: { padding: 6 },
  dateText: { fontSize: 15, fontWeight: "600", minWidth: 140, textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  typeBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  exRow: { flexDirection: "row", alignItems: "center", paddingTop: 10, borderTopWidth: 1 },
  smallBtn: { padding: 8, borderRadius: 8 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  inputField: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  numInput: { height: 52, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, fontSize: 18, textAlign: "center" },
});
