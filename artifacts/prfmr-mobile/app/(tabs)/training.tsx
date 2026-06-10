import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type TimeOfDay = "morning" | "afternoon" | "evening";

interface SessionActivity {
  id: number;
  name: string;
  duration: number | null;
  rpe: number | null;
  caloriesBurned: number | null;
}

interface WorkoutSession {
  id: number;
  date: string;
  timeOfDay: TimeOfDay;
  notes: string | null;
  exercises: any[];
  activities: SessionActivity[];
}

interface ActivityCatalogItem {
  id: number;
  name: string;
  category: string;
  metValue: number | null;
}

interface MorningStatus {
  hasSleep: boolean;
  hasWeight: boolean;
  hasPlannedTraining: boolean;
  isRestDay: boolean;
}

interface TrainingLoad {
  acwr: number | null;
  acuteLoad: number;
  acuteDaily: number;
  baselineLoad: number | null;
  baselineDaysUsed: number;
  date: string;
  history: LoadHistoryEntry[];
  warnings?: string[];
}

interface LoadHistoryEntry {
  date: string;
  totalLoad: number;
  classification: string;
  relativeLoad: number;
  sessionCount: number;
}

// ─────────────────────────────────────────
// Time-of-day config
// ─────────────────────────────────────────
const TIME_SECTIONS: { key: TimeOfDay; label: string; hours: string; icon: string }[] = [
  { key: "morning", label: "Morning", hours: "6:00 – 12:00", icon: "sunrise" },
  { key: "afternoon", label: "Afternoon", hours: "12:00 – 18:00", icon: "sun" },
  { key: "evening", label: "Evening", hours: "18:00 – 24:00", icon: "moon" },
];

const INTENSITY_OPTS: { label: string; value: number }[] = [
  { label: "1 – Very light", value: 1 }, { label: "2", value: 2 },
  { label: "3 – Light", value: 3 }, { label: "4", value: 4 },
  { label: "5 – Moderate", value: 5 }, { label: "6", value: 6 },
  { label: "7 – Hard", value: 7 }, { label: "8", value: 8 },
  { label: "9 – Very hard", value: 9 }, { label: "10 – Max effort", value: 10 },
];

// ─────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const colors = useColors();
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

function SmallBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg, borderColor: color + "60" }]}>
      <Text style={[s.xs, { color, fontWeight: "700" }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Add Activity Modal
// ─────────────────────────────────────────
function AddActivityModal({
  visible, sessionId, date, onClose,
}: { visible: boolean; sessionId: number; date: string; onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityCatalogItem | null>(null);
  const [customName, setCustomName] = useState("");
  const [duration, setDuration] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);

  const { data: catalog = [] } = useQuery<ActivityCatalogItem[]>({
    queryKey: ["activities"],
    queryFn: () => apiFetch("/activities"),
  });

  const addMut = useMutation({
    mutationFn: () => apiFetch(`/workouts/sessions/${sessionId}/activities`, {
      method: "POST",
      body: {
        activityId: selectedActivity?.id ?? null,
        name: selectedActivity?.name ?? customName,
        durationMinutes: parseFloat(duration) || null,
        rpe: rpe ?? null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      onClose();
      setSearch(""); setSelectedActivity(null); setCustomName(""); setDuration(""); setRpe(null);
    },
  });

  const filtered = catalog.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).slice(0, 12);
  const canSubmit = (selectedActivity || customName.trim().length > 0) && !addMut.isPending;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        <View style={[s.rowBetween, { padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }]}>
          <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17 }}>Log Activity</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>SEARCH ACTIVITY</Text>
          <View style={[s.searchBar, { borderColor: "#1a1e28", backgroundColor: "#181c26" }]}>
            <Feather name="search" size={15} color="#6b7280" />
            <TextInput style={{ flex: 1, color: "#eceef2", fontSize: 14, marginLeft: 8 }}
              placeholder="e.g. Running, Sparring..." placeholderTextColor="#6b7280"
              value={search} onChangeText={setSearch} />
          </View>
          {filtered.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              {filtered.map(a => (
                <TouchableOpacity key={a.id} style={[s.catalogItem, {
                  borderColor: selectedActivity?.id === a.id ? "#ff7a00" : "#1a1e28",
                  backgroundColor: selectedActivity?.id === a.id ? "rgba(255,122,0,0.1)" : "#181c26",
                }]} onPress={() => { setSelectedActivity(a); setCustomName(""); }}>
                  <Text style={{ color: selectedActivity?.id === a.id ? "#ff7a00" : "#eceef2", fontWeight: "600", fontSize: 14 }}>{a.name}</Text>
                  {a.category ? <Text style={{ color: "#6b7280", fontSize: 12 }}>{a.category}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>OR CUSTOM NAME</Text>
          <TextInput style={[s.input, { borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26", marginBottom: 14 }]}
            placeholder="Custom activity name" placeholderTextColor="#6b7280"
            value={customName} onChangeText={t => { setCustomName(t); setSelectedActivity(null); }} />

          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>DURATION (minutes)</Text>
          <TextInput style={[s.input, { borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26", marginBottom: 14 }]}
            placeholder="e.g. 45" placeholderTextColor="#6b7280"
            keyboardType="decimal-pad" value={duration} onChangeText={setDuration} />

          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>EFFORT / RPE (optional)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
              <TouchableOpacity key={r} style={[s.rpeBtn, {
                borderColor: rpe === r ? "#ff7a00" : "#1a1e28",
                backgroundColor: rpe === r ? "rgba(255,122,0,0.1)" : "#181c26",
              }]} onPress={() => setRpe(rpe === r ? null : r)}>
                <Text style={{ color: rpe === r ? "#ff7a00" : "#6b7280", fontWeight: "700", fontSize: 14 }}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rpe && <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 14 }}>RPE {rpe} — {INTENSITY_OPTS[rpe - 1]?.label}</Text>}

          <TouchableOpacity style={[s.fullBtn, { backgroundColor: "#ff7a00", opacity: canSubmit ? 1 : 0.4 }]}
            disabled={!canSubmit} onPress={() => addMut.mutate()}>
            {addMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Log Activity</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Session Card
// ─────────────────────────────────────────
function SessionCard({ session, date }: { session: WorkoutSession; date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [addActivity, setAddActivity] = useState(false);

  const deleteSessionMut = useMutation({
    mutationFn: () => apiFetch(`/workouts/sessions/${session.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions", date] }),
  });

  const deleteActivityMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/workouts/activities/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions", date] }),
  });

  const totalCal = session.activities.reduce((s, a) => s + (a.caloriesBurned || 0), 0);
  const totalMin = session.activities.reduce((s, a) => s + (a.duration || 0), 0);

  return (
    <Card style={{ marginTop: 8 }}>
      <View style={s.rowBetween}>
        <View style={s.row}>
          <Feather name="activity" size={14} color={colors.primary} />
          <Text style={[s.sm, { color: colors.foreground, fontWeight: "700", marginLeft: 6 }]}>Session</Text>
          {totalMin > 0 && <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 8 }]}>{totalMin} min</Text>}
          {totalCal > 0 && <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 6 }]}>~{Math.round(totalCal)} kcal</Text>}
        </View>
        <TouchableOpacity onPress={() => deleteSessionMut.mutate()}>
          <Feather name="trash-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {session.activities.length === 0 && session.exercises.length === 0 && (
        <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 6 }]}>No activities yet. Tap + to log one.</Text>
      )}

      {session.activities.map(a => (
        <View key={a.id} style={[s.activityRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sm, { color: colors.foreground, fontWeight: "600" }]}>{a.name}</Text>
            <Text style={[s.xs, { color: colors.mutedForeground }]}>
              {[a.duration ? `${a.duration} min` : null, a.rpe ? `RPE ${a.rpe}` : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <TouchableOpacity onPress={() => deleteActivityMut.mutate(a.id)} style={{ padding: 4 }}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={[s.addActivityBtn, { borderColor: colors.border }]} onPress={() => setAddActivity(true)}>
        <Feather name="plus" size={14} color={colors.mutedForeground} />
        <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 6 }]}>Add activity</Text>
      </TouchableOpacity>

      <AddActivityModal visible={addActivity} sessionId={session.id} date={date} onClose={() => setAddActivity(false)} />
    </Card>
  );
}

// ─────────────────────────────────────────
// Time Section
// ─────────────────────────────────────────
function TimeSection({ section, sessions, date }: {
  section: typeof TIME_SECTIONS[number];
  sessions: WorkoutSession[];
  date: string;
}) {
  const colors = useColors();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);

  const createSessionMut = useMutation({
    mutationFn: () => apiFetch("/workouts/sessions", { method: "POST", body: { date, timeOfDay: section.key } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions", date] }),
  });

  return (
    <View style={{ marginBottom: 4 }}>
      <TouchableOpacity style={[s.timeHeader, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => setOpen(o => !o)}>
        <View style={s.row}>
          <Feather name={section.icon as any} size={15} color={colors.mutedForeground} />
          <Text style={[s.sm, { color: colors.foreground, fontWeight: "700", marginLeft: 8 }]}>{section.label}</Text>
          <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 6 }]}>{section.hours}</Text>
        </View>
        <View style={s.row}>
          {sessions.length > 0 && (
            <SmallBadge label={`${sessions.length} session${sessions.length > 1 ? "s" : ""}`} color={colors.primary} bg={"rgba(255,122,0,0.1)"} />
          )}
          <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>

      {open && (
        <View style={{ paddingHorizontal: 0 }}>
          {sessions.map(s => <SessionCard key={s.id} session={s} date={date} />)}
          <TouchableOpacity style={[s.addSessionBtn, { borderColor: colors.border }]}
            onPress={() => createSessionMut.mutate()}
            disabled={createSessionMut.isPending}>
            {createSessionMut.isPending ? <ActivityIndicator size="small" color="#6b7280" /> : (
              <>
                <Feather name="plus" size={14} color="#6b7280" />
                <Text style={[s.xs, { color: "#6b7280", marginLeft: 6 }]}>
                  {sessions.length === 0 ? `No ${section.label.toLowerCase()} session yet — tap to add` : `Add another ${section.label.toLowerCase()} session`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function TrainingScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const displayDate = format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy");

  const { data: sessions = [], isLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["sessions", selectedDate],
    queryFn: () => apiFetch(`/workouts/sessions?start=${selectedDate}&end=${selectedDate}`),
  });

  const { data: morning } = useQuery<MorningStatus>({
    queryKey: ["morning-status", selectedDate],
    queryFn: () => apiFetch(`/me/morning-status/${selectedDate}`),
  });

  const restMut = useMutation({
    mutationFn: (mark: boolean) =>
      apiFetch(`/me/rest-day/${selectedDate}`, { method: mark ? "POST" : "DELETE", body: mark ? {} : undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["morning-status", selectedDate] }),
  });

  const { data: loadData } = useQuery<TrainingLoad>({
    queryKey: ["training-load", selectedDate],
    queryFn: () => apiFetch(`/me/training-load/${selectedDate}`),
    retry: false,
  });

  const sessionsByTime = (tod: TimeOfDay) => sessions.filter(s => s.timeOfDay === tod);
  const totalCal = sessions.flatMap(s => s.activities).reduce((acc, a) => acc + (a.caloriesBurned || 0), 0);

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>Training</Text>
        <Text style={[s.xs, { color: colors.mutedForeground }]}>{format(new Date(), "EEE, d MMM")}</Text>
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Date Navigation */}
        <View style={[s.dateNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={s.dateNavBtn}
            onPress={() => setSelectedDate(format(subDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.dateNavText, { color: colors.foreground }]}>{displayDate}</Text>
          <TouchableOpacity style={s.dateNavBtn}
            onPress={() => setSelectedDate(format(addDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Rest Day + Cal Burned */}
        <Card>
          <View style={s.rowBetween}>
            <View style={s.row}>
              <Feather name="zap" size={15} color={morning?.isRestDay ? "#4ade80" : colors.mutedForeground} />
              <Text style={[s.sm, { color: colors.foreground, fontWeight: "600", marginLeft: 8 }]}>
                {morning?.isRestDay ? "Rest Day" : "Training Day"}
              </Text>
            </View>
            <TouchableOpacity
              style={[s.btnSm, {
                backgroundColor: morning?.isRestDay ? "rgba(74,222,128,0.1)" : colors.secondary,
                borderWidth: 1,
                borderColor: morning?.isRestDay ? "rgba(74,222,128,0.3)" : colors.border,
              }]}
              onPress={() => restMut.mutate(!morning?.isRestDay)}
              disabled={restMut.isPending}>
              <Text style={[s.xs, { color: morning?.isRestDay ? "#4ade80" : colors.mutedForeground, fontWeight: "700" }]}>
                {morning?.isRestDay ? "Unmark rest day" : "Mark as rest day"}
              </Text>
            </TouchableOpacity>
          </View>

          {totalCal > 0 && (
            <View style={[s.calRow, { borderColor: colors.border }]}>
              <Feather name="flame" size={14} color={colors.primary} />
              <Text style={[s.sm, { color: colors.foreground, fontWeight: "700", marginLeft: 6 }]}>
                ~{Math.round(totalCal)} kcal
              </Text>
              <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 4 }]}>estimated burned</Text>
            </View>
          )}
        </Card>

        {/* 28-Day Training Load */}
        {loadData && (
          <Card style={{ borderColor: "rgba(255,122,0,0.15)", backgroundColor: "rgba(255,122,0,0.04)" }}>
            <View style={s.rowBetween}>
              <View style={s.row}>
                <Feather name="trending-up" size={14} color={colors.primary} />
                <Text style={[s.sm, { color: colors.foreground, fontWeight: "700", marginLeft: 8 }]}>Training Load</Text>
              </View>
              {(() => {
                if (!loadData.acwr) return null;
                const acwr = loadData.acwr;
                const cls = acwr > 1.5 ? "very_hard" : acwr > 1.3 ? "caution" : acwr >= 0.8 ? "optimal" : "undertrained";
                const bc = acwr > 1.3 ? "#f87171" : acwr >= 0.8 ? "#4ade80" : "#facc15";
                return (
                  <View style={{ backgroundColor: bc + "22", borderRadius: 6, borderWidth: 1,
                    borderColor: bc + "55", paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: bc, fontSize: 11, fontWeight: "700" }}>{cls}</Text>
                  </View>
                );
              })()}
            </View>

            <View style={[s.row, { marginTop: 10, gap: 16 }]}>
              {loadData.acwr != null && (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>
                    {loadData.acwr.toFixed(2)}
                  </Text>
                  <Text style={[s.xs, { color: colors.mutedForeground }]}>ACWR</Text>
                </View>
              )}
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>
                  {Math.round(loadData.acuteLoad)}
                </Text>
                <Text style={[s.xs, { color: colors.mutedForeground }]}>7-day load</Text>
              </View>
              {loadData.baselineLoad != null && (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>
                    {Math.round(loadData.baselineLoad)}
                  </Text>
                  <Text style={[s.xs, { color: colors.mutedForeground }]}>{loadData.baselineDaysUsed}-day avg</Text>
                </View>
              )}
            </View>

            {(loadData.warnings?.length ?? 0) > 0 && (
              <View style={{ marginTop: 10, gap: 4 }}>
                {loadData.warnings!.map((w, i) => (
                  <View key={i} style={s.row}>
                    <Feather name="alert-triangle" size={12} color="#fb923c" />
                    <Text style={[s.xs, { color: "#fb923c", marginLeft: 6, flex: 1 }]}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <Text style={[s.xs, { color: colors.mutedForeground, fontStyle: "italic", flex: 1 }]}>
                Classification is personalised to your baseline.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/load-trend" as any)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 8 }}
              >
                <Feather name="bar-chart-2" size={12} color={colors.primary} />
                <Text style={[s.xs, { color: colors.primary, fontWeight: "600" }]}>28-day trend</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Time of Day Sections */}
        {isLoading ? (
          <View style={{ alignItems: "center", padding: 20 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          TIME_SECTIONS.map(section => (
            <TimeSection
              key={section.key}
              section={section}
              sessions={sessionsByTime(section.key)}
              date={selectedDate}
            />
          ))
        )}

        {/* Disclaimer */}
        <Card style={{ borderColor: "rgba(107,114,128,0.2)" }}>
          <View style={s.row}>
            <Feather name="info" size={13} color={colors.mutedForeground} />
            <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 6, flex: 1, lineHeight: 16 }]}>
              Calorie estimates are approximate and based on MET values. Actual expenditure varies by body weight, fitness level, and effort.
            </Text>
          </View>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  pageTitle: { fontSize: 20, fontWeight: "800" },
  scrollPad: { padding: 12, gap: 10 },
  card: { borderRadius: 9, borderWidth: 1, padding: 14 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 9, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 4 },
  dateNavBtn: { padding: 8 },
  dateNavText: { fontSize: 15, fontWeight: "700" },
  timeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 9, borderWidth: 1, padding: 12 },
  addSessionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, borderStyle: "dashed", padding: 12, marginTop: 8 },
  addActivityBtn: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, borderStyle: "dashed", padding: 10, marginTop: 8 },
  activityRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 6, gap: 8 },
  calRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  btnSm: { flexDirection: "row", alignItems: "center", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 14 },
  fullBtn: { borderRadius: 9, padding: 14, alignItems: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, padding: 10, marginBottom: 8 },
  catalogItem: { borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 6 },
  rpeBtn: { width: 42, height: 42, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
