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
  durationMinutes: number | null;
  rpe: number | null;
  estimatedKcal: number | null;
  activityType: string | null;
  sessionRpe: number | null;
  bodyRegion: string | null;
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
  intensity: string;
  metValue: number | null;
}

interface MorningStatus {
  hasSleep: boolean;
  hasWeight: boolean;
  hasPlannedTraining: boolean;
  isRestDay: boolean;
}

interface TrainingLoad {
  // DailyLoadResult fields
  totalLoad: number;
  classification: string;
  provisional: boolean;
  sessionCount: number;
  totalDurationMinutes: number;
  totalKcal: number;
  // Route-added fields
  date: string;
  overrideClassification: string | null;
  effectiveClassification: string;
  // LoadWarningResult fields (spread in)
  warnings: string[];
  backToBackHardDays: boolean;
  highLoadCluster: boolean;
  threeDayStreak: boolean;
  acuteLoad: number;
  acuteDaily: number;
  baselineLoad: number | null;
  baselineDaysUsed: number | null;
  acwr: number | null;
  relativeLoad: number | null;
  highStress: boolean;
  veryHighStress: boolean;
  loadStatus: "low" | "stable" | "spike" | null;
  activeDaysInWindow: number;
  insufficientHistory: boolean;
  // Legacy / load-trend
  history: LoadHistoryEntry[];
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

// Classification helpers per §10.2.13
function clsStyle(cls: string | undefined) {
  switch (cls) {
    case "light":     return { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa", border: "rgba(59,130,246,0.30)" };
    case "moderate":  return { bg: "rgba(234,179,8,0.15)",   text: "#facc15", border: "rgba(234,179,8,0.30)" };
    case "hard":      return { bg: "rgba(249,115,22,0.15)",  text: "#fb923c", border: "rgba(249,115,22,0.30)" };
    case "very_hard": return { bg: "rgba(239,68,68,0.15)",   text: "#f87171", border: "rgba(239,68,68,0.30)" };
    default:          return { bg: "rgba(107,114,128,0.15)", text: "#9ca3af", border: "rgba(107,114,128,0.30)" };
  }
}

function clsLabel(cls: string | undefined) {
  switch (cls) {
    case "light":     return "Light";
    case "moderate":  return "Moderate";
    case "hard":      return "Hard";
    case "very_hard": return "Very Hard";
    default:          return cls ?? "Unknown";
  }
}

// ─────────────────────────────────────────
// Training Load Warning Modal (§10.2.11)
// ─────────────────────────────────────────
const OVERRIDE_OPTIONS = [
  { value: "keep",      label: "Use system estimate" },
  { value: "light",     label: "Light day" },
  { value: "moderate",  label: "Moderate day" },
  { value: "hard",      label: "Hard day" },
  { value: "very_hard", label: "Very hard day" },
];

function TrainingLoadWarningModal({
  analysis, date, onClose, onViewTrend,
}: {
  analysis: TrainingLoad;
  date: string;
  onClose: () => void;
  onViewTrend: () => void;
}) {
  const qc = useQueryClient();
  const [override, setOverride] = useState("keep");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const cs = clsStyle(analysis.effectiveClassification);

  async function handleContinue() {
    if (override !== "keep") {
      setSaving(true);
      try {
        await apiFetch(`/me/training/load-override/${date}`, {
          method: "POST",
          body: { classification: override },
        });
        qc.invalidateQueries({ queryKey: ["training-load", date] });
      } catch (_) { /* ignore */ }
      setSaving(false);
    }
    onClose();
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: "#111318", borderRadius: 16, borderWidth: 1,
          borderColor: "#2a2e3a", padding: 20, gap: 16 }}>

          {/* Title */}
          <View style={{ alignItems: "center", gap: 4 }}>
            <Feather name="alert-triangle" size={22} color="#fb923c" />
            <Text style={{ color: "#eceef2", fontSize: 16, fontWeight: "700", marginTop: 4 }}>
              Training Load Insight
            </Text>
          </View>

          {/* Metrics row */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "Today", value: String(Math.round(analysis.totalLoad)), sub: "load pts" },
              {
                label: "Baseline",
                value: analysis.baselineLoad != null ? String(Math.round(analysis.baselineLoad)) : "—",
                sub: analysis.baselineDaysUsed ? `${analysis.baselineDaysUsed}d avg` : "< 7 days",
              },
              {
                label: "ACWR",
                value: analysis.acwr != null ? analysis.acwr.toFixed(2) : "—",
                sub: analysis.insufficientHistory ? "building" : "ratio",
              },
            ].map(m => (
              <View key={m.label} style={{ flex: 1, backgroundColor: "#181c26", borderRadius: 10,
                borderWidth: 1, borderColor: "#2a2e3a", padding: 10, alignItems: "center" }}>
                <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>{m.label.toUpperCase()}</Text>
                <Text style={{ color: "#eceef2", fontSize: 20, fontWeight: "900", marginTop: 2 }}>{m.value}</Text>
                <Text style={{ color: "#6b7280", fontSize: 10, marginTop: 1 }}>{m.sub}</Text>
              </View>
            ))}
          </View>

          {/* Insufficient history notice */}
          {analysis.insufficientHistory && (
            <View style={{ backgroundColor: "rgba(234,179,8,0.05)", borderRadius: 8,
              borderWidth: 1, borderColor: "rgba(234,179,8,0.2)", padding: 10 }}>
              <Text style={{ color: "#facc15", fontSize: 12 }}>
                We're still building your training baseline. Until you have at least 7 training
                days logged, load insights use simple thresholds.
              </Text>
            </View>
          )}

          {/* Classification badge */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: "#6b7280", fontSize: 12 }}>System estimate:</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
              backgroundColor: cs.bg, borderWidth: 1, borderColor: cs.border }}>
              <Text style={{ color: cs.text, fontWeight: "700", fontSize: 12 }}>
                {clsLabel(analysis.effectiveClassification)}
              </Text>
            </View>
          </View>

          {/* Warning list */}
          {analysis.warnings?.length > 0 && (
            <View style={{ gap: 6 }}>
              {analysis.warnings.map((w, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8,
                  backgroundColor: "rgba(234,179,8,0.05)", borderRadius: 8,
                  borderWidth: 1, borderColor: "rgba(234,179,8,0.2)", padding: 10 }}>
                  <Feather
                    name={w.toLowerCase().includes("spike") ? "trending-up" : "alert-triangle"}
                    size={13}
                    color={w.toLowerCase().includes("spike") ? "#f87171" : "#facc15"}
                    style={{ marginTop: 1 }}
                  />
                  <Text style={{ color: "#d1d5db", fontSize: 12, flex: 1, lineHeight: 17 }}>{w}</Text>
                </View>
              ))}
            </View>
          )}

          {/* No-baseline notice */}
          {analysis.baselineLoad === null && !analysis.insufficientHistory && (
            <Text style={{ color: "#6b7280", fontSize: 12 }}>
              You have fewer than 7 days of data. Thresholds are based on absolute load
              until your baseline is established.
            </Text>
          )}

          {/* Override dropdown */}
          <View>
            <Text style={{ color: "#9ca3af", fontSize: 12, marginBottom: 6 }}>How would you rate today?</Text>
            <TouchableOpacity onPress={() => setOverrideOpen(o => !o)}
              style={{ flexDirection: "row", alignItems: "center", height: 44,
                borderRadius: 10, borderWidth: 1,
                borderColor: overrideOpen ? "#ff7a00" : "#2a2e3a",
                backgroundColor: "#181c26", paddingHorizontal: 12 }}>
              <Text style={{ flex: 1, color: "#eceef2", fontSize: 14 }}>
                {OVERRIDE_OPTIONS.find(o => o.value === override)?.label}
              </Text>
              <Feather name={overrideOpen ? "chevron-up" : "chevron-down"} size={15} color="#6b7280" />
            </TouchableOpacity>
            {overrideOpen && (
              <View style={{ marginTop: 3, borderRadius: 10, borderWidth: 1,
                borderColor: "#1a1e28", backgroundColor: "#181c26", overflow: "hidden" }}>
                {OVERRIDE_OPTIONS.map((opt, i) => (
                  <TouchableOpacity key={opt.value}
                    onPress={() => { setOverride(opt.value); setOverrideOpen(false); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 11,
                      borderBottomWidth: i < OVERRIDE_OPTIONS.length - 1 ? 1 : 0,
                      borderBottomColor: "#1a1e28",
                      backgroundColor: override === opt.value ? "rgba(255,122,0,0.08)" : "transparent" }}>
                    <Text style={{ color: override === opt.value ? "#ff7a00" : "#eceef2",
                      fontWeight: override === opt.value ? "700" : "400", fontSize: 13 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {override !== "keep" && (
              <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 6 }}>
                Your rating will be saved for this day and used to reduce unnecessary warnings.
              </Text>
            )}
          </View>

          {/* Actions */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={saving}
            style={{ height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center",
              backgroundColor: "#ff7a00" }}>
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Continue</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onViewTrend} style={{ alignItems: "center" }}>
            <Text style={{ color: "#ff7a00", fontSize: 13, fontWeight: "600" }}>
              View 28-day load trend →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Add Activity Modal
// ─────────────────────────────────────────
const BODY_REGION_OPTIONS: { label: string; value: "upper" | "lower" | "full" }[] = [
  { label: "Upper Body (×1.0)", value: "upper" },
  { label: "Lower Body (×1.25)", value: "lower" },
  { label: "Full Body (×1.1)", value: "full" },
];

function isLiftingActivity(a: ActivityCatalogItem | null): boolean {
  if (!a) return false;
  return a.name.toLowerCase().includes("strength training") || !a.metValue;
}

function activityDisplayName(a: ActivityCatalogItem): string {
  return a.metValue ? `${a.name} (MET ${a.metValue})` : a.name;
}

// Shared inline body-region dropdown
function BodyRegionDropdown({
  value, onChange,
}: { value: "upper" | "lower" | "full" | null; onChange: (v: "upper" | "lower" | "full") => void }) {
  const [open, setOpen] = useState(false);
  const current = BODY_REGION_OPTIONS.find(o => o.value === value);
  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(o => !o)}
        style={{ flexDirection: "row", alignItems: "center", height: 48,
          borderRadius: 10, borderWidth: 1, borderColor: open ? "#ff7a00" : "#2a2e3a",
          backgroundColor: "#181c26", paddingHorizontal: 14 }}>
        <Text style={{ flex: 1, color: current ? "#eceef2" : "#6b7280", fontSize: 15 }}>
          {current?.label ?? "Select body region"}
        </Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color="#6b7280" />
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 3, borderRadius: 10, borderWidth: 1,
          borderColor: "#1a1e28", backgroundColor: "#181c26", overflow: "hidden" }}>
          {BODY_REGION_OPTIONS.map((o, i) => (
            <TouchableOpacity key={o.value}
              onPress={() => { onChange(o.value); setOpen(false); }}
              style={{ paddingHorizontal: 14, paddingVertical: 13,
                borderBottomWidth: i < BODY_REGION_OPTIONS.length - 1 ? 1 : 0,
                borderBottomColor: "#1a1e28",
                backgroundColor: value === o.value ? "rgba(255,122,0,0.08)" : "transparent" }}>
              <Text style={{ color: value === o.value ? "#ff7a00" : "#eceef2",
                fontWeight: value === o.value ? "700" : "400", fontSize: 14 }}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────
// Add Activity Modal
// ─────────────────────────────────────────
function AddActivityModal({
  visible, sessionId, date, onClose, onActivityMutated,
}: { visible: boolean; sessionId: number; date: string; onClose: () => void; onActivityMutated?: (date: string) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityCatalogItem | null>(null);
  const [customName, setCustomName] = useState("");
  const [duration, setDuration] = useState("");
  const [rpeStr, setRpeStr] = useState("");
  const [bodyRegion, setBodyRegion] = useState<"upper" | "lower" | "full" | null>(null);

  const reset = () => {
    setSearch(""); setDropdownOpen(false); setSelectedActivity(null);
    setCustomName(""); setDuration(""); setRpeStr(""); setBodyRegion(null);
  };

  const { data: catalog = [] } = useQuery<ActivityCatalogItem[]>({
    queryKey: ["activities"],
    queryFn: () => apiFetch("/activities"),
  });

  const isLifting = isLiftingActivity(selectedActivity);
  const filtered = catalog.filter(a => a.name.toLowerCase().includes(search.toLowerCase())).slice(0, 15);

  const addMut = useMutation({
    mutationFn: () => {
      const name = selectedActivity?.name ?? customName.trim();
      const durationMinutes = Math.round(parseFloat(duration)) || null;
      const rpe = parseFloat(rpeStr) || null;

      if (isLifting) {
        return apiFetch(`/workouts/sessions/${sessionId}/activities`, {
          method: "POST",
          body: {
            name,
            durationMinutes,
            activityType: "lifting",
            sessionRpe: rpe,
            bodyRegion,
          },
        });
      }
      return apiFetch(`/workouts/sessions/${sessionId}/activities`, {
        method: "POST",
        body: {
          name,
          durationMinutes,
          activityCatalogId: selectedActivity?.id ?? null,
          metValue: selectedActivity?.metValue ?? 5.0,
          rpe: rpe ?? null,
          intensity: selectedActivity?.intensity ?? null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      qc.invalidateQueries({ queryKey: ["training-summary", date] });
      qc.invalidateQueries({ queryKey: ["training-load", date] });
      onClose();
      reset();
      onActivityMutated?.(date);
    },
  });

  const hasName = selectedActivity !== null || customName.trim().length > 0;
  const hasDuration = parseFloat(duration) > 0;
  const liftingReady = isLifting && parseFloat(rpeStr) > 0 && bodyRegion !== null;
  const cardioReady = !isLifting;
  const canSubmit = hasName && hasDuration && (liftingReady || cardioReady) && !addMut.isPending;

  const lbl = { color: "#eceef2", fontSize: 14, fontWeight: "600" as const, marginBottom: 8 };
  const hint = { color: "#6b7280", fontSize: 12, marginTop: 6 };
  const inp: object = { height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#2a2e3a",
    backgroundColor: "#181c26", paddingHorizontal: 14, color: "#eceef2", fontSize: 15 };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        {/* Header */}
        <View style={{ alignItems: "center", paddingTop: 18, paddingBottom: 10, paddingHorizontal: 44,
          borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
          <TouchableOpacity style={{ position: "absolute", right: 16, top: 16 }} onPress={onClose}>
            <Feather name="x" size={22} color="#6b7280" />
          </TouchableOpacity>
          <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17 }}>Add Activity</Text>
          <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 3, textAlign: "center" }}>
            Add a cardio, sports, or strength activity
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">

          {/* Select Activity dropdown */}
          <View>
            <Text style={lbl}>Select Activity</Text>
            <TouchableOpacity onPress={() => setDropdownOpen(o => !o)}
              style={{ flexDirection: "row", alignItems: "center", height: 48,
                borderRadius: 10, borderWidth: 1,
                borderColor: dropdownOpen ? "#ff7a00" : "#2a2e3a",
                backgroundColor: "#181c26", paddingHorizontal: 14 }}>
              <Text style={{ flex: 1, color: selectedActivity ? "#eceef2" : "#6b7280", fontSize: 15 }} numberOfLines={1}>
                {selectedActivity ? activityDisplayName(selectedActivity) : "Search activities..."}
              </Text>
              <Feather name={dropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#6b7280" />
            </TouchableOpacity>

            {dropdownOpen && (
              <View style={{ marginTop: 3, borderRadius: 10, borderWidth: 1,
                borderColor: "#1a1e28", backgroundColor: "#181c26", overflow: "hidden" }}>
                <View style={{ flexDirection: "row", alignItems: "center",
                  paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
                  <Feather name="search" size={14} color="#6b7280" />
                  <TextInput style={{ flex: 1, height: 42, color: "#eceef2", fontSize: 14, marginLeft: 8 }}
                    placeholder="Search activities..." placeholderTextColor="#6b7280"
                    value={search} onChangeText={setSearch} autoFocus />
                </View>
                {filtered.map((a, i) => (
                  <TouchableOpacity key={a.id}
                    onPress={() => { setSelectedActivity(a); setCustomName(""); setDropdownOpen(false); setSearch(""); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 12,
                      borderBottomWidth: i < filtered.length - 1 ? 1 : 0,
                      borderBottomColor: "#1a1e28",
                      backgroundColor: selectedActivity?.id === a.id ? "rgba(255,122,0,0.08)" : "transparent" }}>
                    <Text style={{ color: selectedActivity?.id === a.id ? "#ff7a00" : "#eceef2",
                      fontWeight: "500", fontSize: 14 }}>
                      {activityDisplayName(a)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {filtered.length === 0 && (
                  <Text style={{ color: "#6b7280", padding: 14, fontSize: 13 }}>No results</Text>
                )}
              </View>
            )}
          </View>

          {/* Lifting fields */}
          {isLifting && (
            <View style={{ gap: 14 }}>
              <View style={{ backgroundColor: "#181c26", borderRadius: 8, padding: 12,
                borderWidth: 1, borderColor: "#2a2e3a" }}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>
                  Session RPE method — training load = duration × RPE × region multiplier
                </Text>
              </View>

              <View>
                <Text style={lbl}>Session RPE (1–10) *</Text>
                <TextInput style={inp} keyboardType="decimal-pad"
                  placeholder="e.g. 7" placeholderTextColor="#6b7280"
                  value={rpeStr} onChangeText={setRpeStr} />
                <Text style={hint}>How hard was the session overall? 1 = very easy, 10 = maximal</Text>
              </View>

              <View>
                <Text style={lbl}>Body Region</Text>
                <BodyRegionDropdown value={bodyRegion} onChange={setBodyRegion} />
              </View>
            </View>
          )}

          {/* Cardio: OR custom name */}
          {!isLifting && (
            <View>
              <Text style={{ color: "#6b7280", fontSize: 13, textAlign: "center", marginBottom: 12 }}>or</Text>
              <Text style={lbl}>Custom Activity Name</Text>
              <TextInput style={inp}
                placeholder="e.g., Swimming" placeholderTextColor="#6b7280"
                value={customName}
                onChangeText={t => { setCustomName(t); setSelectedActivity(null); }} />
            </View>
          )}

          {/* Duration */}
          <View>
            <Text style={lbl}>Duration (minutes) *</Text>
            <TextInput style={inp} keyboardType="decimal-pad"
              placeholder="e.g., 60" placeholderTextColor="#6b7280"
              value={duration} onChangeText={setDuration} />
          </View>

          {/* RPE — cardio only */}
          {!isLifting && (
            <View>
              <Text style={lbl}>Effort (RPE) — optional</Text>
              <TextInput style={inp} keyboardType="decimal-pad"
                placeholder="1–10" placeholderTextColor="#4b5563"
                value={rpeStr} onChangeText={setRpeStr} />
              <Text style={hint}>1 = very easy · 10 = max effort</Text>
            </View>
          )}

          {addMut.error && (
            <Text style={{ color: "#f87171", fontSize: 12 }}>
              {(addMut.error as Error).message}
            </Text>
          )}

          <TouchableOpacity style={[s.fullBtn, { backgroundColor: "#ff7a00", opacity: canSubmit ? 1 : 0.4 }]}
            disabled={!canSubmit} onPress={() => addMut.mutate()}>
            {addMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  {isLifting ? "Add Lifting Session" : "Add Activity"}
                </Text>}
          </TouchableOpacity>
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Edit Activity Modal
// ─────────────────────────────────────────
function EditActivityModal({
  activity, date, onClose, onActivityMutated,
}: { activity: SessionActivity; date: string; onClose: () => void; onActivityMutated?: (date: string) => void }) {
  const qc = useQueryClient();
  const isLifting = activity.activityType === "lifting";

  const [duration, setDuration] = useState(String(activity.durationMinutes ?? ""));
  const [rpeStr, setRpeStr] = useState(
    String(isLifting ? (activity.sessionRpe ?? "") : (activity.rpe ?? ""))
  );
  const [bodyRegion, setBodyRegion] = useState<"upper" | "lower" | "full" | null>(
    (activity.bodyRegion as "upper" | "lower" | "full" | null) ?? null
  );

  const patchMut = useMutation({
    mutationFn: () => {
      const rpe = parseFloat(rpeStr) || null;
      const body: Record<string, unknown> = {
        durationMinutes: Math.round(parseFloat(duration)) || activity.durationMinutes,
      };
      if (isLifting) {
        if (rpe != null) body.sessionRpe = rpe;
        if (bodyRegion) body.bodyRegion = bodyRegion;
      } else {
        if (rpe != null) body.rpe = rpe;
      }
      return apiFetch(`/workouts/activities/${activity.id}`, { method: "PATCH", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      qc.invalidateQueries({ queryKey: ["training-summary", date] });
      qc.invalidateQueries({ queryKey: ["training-load", date] });
      onClose();
      onActivityMutated?.(date);
    },
  });

  const canSave = parseFloat(duration) > 0 && !patchMut.isPending;

  const lbl = { color: "#eceef2", fontSize: 14, fontWeight: "600" as const, marginBottom: 8 };
  const hint = { color: "#6b7280", fontSize: 12, marginTop: 6 };
  const inp: object = { height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#2a2e3a",
    backgroundColor: "#181c26", paddingHorizontal: 14, color: "#eceef2", fontSize: 15 };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        {/* Header */}
        <View style={{ alignItems: "center", paddingTop: 18, paddingBottom: 10, paddingHorizontal: 44,
          borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
          <TouchableOpacity style={{ position: "absolute", right: 16, top: 16 }} onPress={onClose}>
            <Feather name="x" size={22} color="#6b7280" />
          </TouchableOpacity>
          <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17 }}>Edit Activity</Text>
          <Text style={{ color: "#6b7280", fontSize: 13, marginTop: 3, textAlign: "center" }}>
            Update activity details and recalculate calories
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">

          {/* Activity display (read-only) */}
          <View>
            <Text style={lbl}>Activity</Text>
            <View style={{ flexDirection: "row", alignItems: "center", height: 48,
              borderRadius: 10, borderWidth: 1, borderColor: "#2a2e3a",
              backgroundColor: "#181c26", paddingHorizontal: 14 }}>
              <Text style={{ flex: 1, color: "#eceef2", fontSize: 15 }} numberOfLines={1}>
                {activity.name}
              </Text>
              <Feather name="chevron-down" size={16} color="#374151" />
            </View>
          </View>

          {/* Lifting: info box → Session RPE → Body Region → Duration */}
          {isLifting && (
            <>
              <View style={{ backgroundColor: "#181c26", borderRadius: 8, padding: 12,
                borderWidth: 1, borderColor: "#2a2e3a" }}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>
                  Session RPE method — training load = duration × RPE × region multiplier
                </Text>
              </View>

              <View>
                <Text style={lbl}>Session RPE (1–10)</Text>
                <TextInput style={inp} keyboardType="decimal-pad"
                  placeholder="1–10" placeholderTextColor="#4b5563"
                  value={rpeStr} onChangeText={setRpeStr} />
                <Text style={hint}>1 = very easy, 10 = maximal</Text>
              </View>

              <View>
                <Text style={lbl}>Body Region</Text>
                <BodyRegionDropdown value={bodyRegion} onChange={setBodyRegion} />
              </View>
            </>
          )}

          {/* Duration */}
          <View>
            <Text style={lbl}>Duration (minutes){isLifting ? "" : ""}</Text>
            <TextInput style={inp} keyboardType="decimal-pad"
              value={duration} onChangeText={setDuration} />
          </View>

          {/* Cardio: Effort RPE below duration */}
          {!isLifting && (
            <View>
              <Text style={lbl}>Effort (RPE) — optional</Text>
              <TextInput style={inp} keyboardType="decimal-pad"
                placeholder="1–10" placeholderTextColor="#4b5563"
                value={rpeStr} onChangeText={setRpeStr} />
              <Text style={hint}>1 = very easy · 10 = max effort</Text>
            </View>
          )}

          {patchMut.error && (
            <Text style={{ color: "#f87171", fontSize: 12 }}>
              {(patchMut.error as Error).message}
            </Text>
          )}

          <TouchableOpacity style={[s.fullBtn, { backgroundColor: "#ff7a00", opacity: canSave ? 1 : 0.4 }]}
            disabled={!canSave} onPress={() => patchMut.mutate()}>
            {patchMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
          </TouchableOpacity>
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Session Card
// ─────────────────────────────────────────
function SessionCard({ session, date, onActivityMutated }: { session: WorkoutSession; date: string; onActivityMutated?: (date: string) => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [addActivity, setAddActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SessionActivity | null>(null);

  const deleteSessionMut = useMutation({
    mutationFn: () => apiFetch(`/workouts/sessions/${session.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      qc.invalidateQueries({ queryKey: ["training-summary", date] });
    },
  });

  const deleteActivityMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/workouts/activities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      qc.invalidateQueries({ queryKey: ["training-summary", date] });
      qc.invalidateQueries({ queryKey: ["training-load", date] });
    },
  });

  const totalCal = session.activities.reduce((s, a) => s + (a.estimatedKcal || 0), 0);
  const totalMin = session.activities.reduce((s, a) => s + (a.durationMinutes || 0), 0);

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

      {session.activities.map(a => {
        const isLifting = a.activityType === "lifting";
        const rpeDisplay = isLifting
          ? (a.sessionRpe ? `Session RPE ${a.sessionRpe}` : null)
          : (a.rpe ? `RPE ${a.rpe}` : null);
        const regionDisplay = isLifting && a.bodyRegion ? a.bodyRegion : null;
        const detail = [
          a.durationMinutes ? `${a.durationMinutes} min` : null,
          rpeDisplay,
          regionDisplay,
        ].filter(Boolean).join(" · ");

        return (
          <View key={a.id} style={[s.activityRow, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sm, { color: colors.foreground, fontWeight: "600" }]}>{a.name}</Text>
              {detail ? <Text style={[s.xs, { color: colors.mutedForeground }]}>{detail}</Text> : null}
              {a.estimatedKcal ? <Text style={[s.xs, { color: colors.mutedForeground }]}>~{Math.round(a.estimatedKcal)} kcal</Text> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 2 }}>
              <TouchableOpacity onPress={() => setEditingActivity(a)} style={{ padding: 6 }}>
                <Feather name="edit-2" size={13} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteActivityMut.mutate(a.id)} style={{ padding: 6 }}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={[s.addActivityBtn, { borderColor: colors.border }]} onPress={() => setAddActivity(true)}>
        <Feather name="plus" size={14} color={colors.mutedForeground} />
        <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 6 }]}>Add activity</Text>
      </TouchableOpacity>

      <AddActivityModal visible={addActivity} sessionId={session.id} date={date} onClose={() => setAddActivity(false)} onActivityMutated={onActivityMutated} />
      {editingActivity && (
        <EditActivityModal activity={editingActivity} date={date} onClose={() => setEditingActivity(null)} onActivityMutated={onActivityMutated} />
      )}
    </Card>
  );
}

// ─────────────────────────────────────────
// Time Section
// ─────────────────────────────────────────
function TimeSection({ section, sessions, date, onActivityMutated }: {
  section: typeof TIME_SECTIONS[number];
  sessions: WorkoutSession[];
  date: string;
  onActivityMutated?: (date: string) => void;
}) {
  const colors = useColors();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);

  const createSessionMut = useMutation({
    mutationFn: () => apiFetch("/workouts/sessions", { method: "POST", body: { date, timeOfDay: section.key } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      qc.invalidateQueries({ queryKey: ["training-summary", date] });
    },
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
          {sessions.map(s => <SessionCard key={s.id} session={s} date={date} onActivityMutated={onActivityMutated} />)}
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
  const [loadWarning, setLoadWarning] = useState<{ analysis: TrainingLoad; date: string } | null>(null);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", selectedDate] });
      qc.invalidateQueries({ queryKey: ["targets", selectedDate] });
      qc.invalidateQueries({ queryKey: ["training-summary", selectedDate] });
    },
  });

  const { data: loadData, refetch: refetchLoad } = useQuery<TrainingLoad>({
    queryKey: ["training-load", selectedDate],
    queryFn: () => apiFetch(`/me/training-load/${selectedDate}`),
    staleTime: 0,
    retry: false,
  });

  const checkAndShowLoadWarning = useCallback(async (date: string) => {
    try {
      const data = await apiFetch<TrainingLoad>(`/me/training-load/${date}`);
      qc.setQueryData(["training-load", date], data);
      if ((data.warnings?.length ?? 0) > 0) {
        setLoadWarning({ analysis: data, date });
      }
    } catch (_) { /* best-effort */ }
  }, [qc]);

  const sessionsByTime = (tod: TimeOfDay) => sessions.filter(s => s.timeOfDay === tod);
  const totalCal = sessions.flatMap(s => s.activities).reduce((acc, a) => acc + (a.estimatedKcal || 0), 0);

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

        {/* Training Load Insight */}
        {loadData && (() => {
          const cs = clsStyle(loadData.effectiveClassification);
          return (
            <Card style={{ borderColor: "rgba(255,122,0,0.15)", backgroundColor: "rgba(255,122,0,0.04)" }}>
              <View style={s.rowBetween}>
                <View style={s.row}>
                  <Feather name="trending-up" size={14} color={colors.primary} />
                  <Text style={[s.sm, { color: colors.foreground, fontWeight: "700", marginLeft: 8 }]}>Training Load</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ backgroundColor: cs.bg, borderRadius: 6, borderWidth: 1,
                    borderColor: cs.border, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ color: cs.text, fontSize: 11, fontWeight: "700" }}>
                      {clsLabel(loadData.effectiveClassification)}
                    </Text>
                  </View>
                  {loadData.overrideClassification && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>(overridden)</Text>
                  )}
                </View>
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
                  {loadData.warnings.map((w, i) => (
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
          );
        })()}

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
              onActivityMutated={checkAndShowLoadWarning}
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

      {loadWarning && (
        <TrainingLoadWarningModal
          analysis={loadWarning.analysis}
          date={loadWarning.date}
          onClose={() => setLoadWarning(null)}
          onViewTrend={() => router.push("/load-trend" as any)}
        />
      )}
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
