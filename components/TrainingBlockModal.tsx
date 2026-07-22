import React, { useState, useEffect } from "react";
import {
  View, Text, Modal, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, addDays } from "date-fns";
import { apiFetch } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { useToast } from "@/components/AppToast";

// ─── Types ───────────────────────────────────────────────────

interface BlockActivity {
  activityType: "cardio" | "lifting";
  name: string;
  durationMinutes: number;
  rpe: number;
  intensity: string;
  metValue?: number;
  bodyRegion?: string;
  activityCatalogId?: number;
  slot: "morning" | "afternoon" | "evening";
}

interface WeekPreview {
  weekNum: number;
  startDate: string;
  endDate: string;
  peakAcwr: number | null;
  avgLoad: number;
  hasSpike: boolean;
  hasCluster: boolean;
  warningReasons: string[];
}

interface PreviewResult {
  weeks: WeekPreview[];
  hasAnyOvertraining: boolean;
}

interface ActivityCatalogItem {
  id: number;
  name: string;
  intensity: string;
  metValue: number | null;
}

type DayActivities = Record<number, BlockActivity[]>;

export interface InitialBlock {
  name: string;
  startDate: string;
  weekCount: number;
  days: Array<{
    dayOfWeek: number;
    activities?: Partial<BlockActivity>[];
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon
  const daysUntil = day === 0 ? 1 : 8 - day;
  return format(addDays(d, daysUntil), "yyyy-MM-dd");
}

function computeAU(activities: BlockActivity[]): number {
  return activities.reduce((sum, a) => {
    const dur = a.durationMinutes || 0;
    if (a.rpe > 0) return sum + a.rpe * dur;
    if (a.metValue) return sum + a.metValue * dur;
    return sum + dur * 3;
  }, 0);
}

function auLabel(au: number): { text: string; color: string } {
  if (au === 0) return { text: "Rest", color: "#6b7280" };
  if (au < 300) return { text: "Light", color: "#4ade80" };
  if (au < 600) return { text: "Moderate", color: "#facc15" };
  if (au < 900) return { text: "Hard", color: "#fb923c" };
  return { text: "Very Hard", color: "#f87171" };
}

function rpeToIntensity(rpe: number): string {
  if (rpe <= 4) return "light";
  if (rpe <= 7) return "moderate";
  return "vigorous";
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = [
  { key: "morning" as const, label: "AM" },
  { key: "afternoon" as const, label: "PM" },
  { key: "evening" as const, label: "Eve" },
];
const WEEK_OPTIONS = [2, 3, 4, 6, 8] as const;

function emptyDays(): DayActivities {
  return Object.fromEntries(DAYS.map((_, i) => [i, []])) as DayActivities;
}

// ─── Component ───────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  activeBlockId?: number | null;
  initialBlock?: InitialBlock | null;
}

export function TrainingBlockModal({ visible, onClose, activeBlockId, initialBlock }: Props) {
  const colors = useColors();
  const qc = useQueryClient();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [blockName, setBlockName] = useState("");
  const [startDate, setStartDate] = useState(nextMonday());
  const [weekCount, setWeekCount] = useState<2 | 3 | 4 | 6 | 8>(4);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Step 2
  const [dayActivities, setDayActivities] = useState<DayActivities>(emptyDays());
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [activeFormType, setActiveFormType] = useState<"cardio" | "lifting" | null>(null);

  // Cardio search
  const [activitySearch, setActivitySearch] = useState("");
  const [activityResults, setActivityResults] = useState<ActivityCatalogItem[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityCatalogItem | null>(null);
  const [formSearching, setFormSearching] = useState(false);

  // Shared form fields
  const [formName, setFormName] = useState("");
  const [formDuration, setFormDuration] = useState("45");
  const [formRpe, setFormRpe] = useState("7");
  const [formSlot, setFormSlot] = useState<"morning" | "afternoon" | "evening">("morning");
  const [formBodyRegion, setFormBodyRegion] = useState<"upper" | "lower" | "full">("full");

  // Step 3
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [ambersAcknowledged, setAmbersAcknowledged] = useState(false);

  // Pre-fill / reset on open
  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setActiveDay(null);
    setActiveFormType(null);
    setPreview(null);
    setAcknowledged(false);
    setAmbersAcknowledged(false);
    setShowDatePicker(false);

    if (initialBlock) {
      setBlockName(initialBlock.name);
      setStartDate(initialBlock.startDate || nextMonday());
      setWeekCount(([2, 3, 4, 6, 8].includes(initialBlock.weekCount) ? initialBlock.weekCount : 4) as 2 | 3 | 4 | 6 | 8);
      const filled = emptyDays();
      for (const d of initialBlock.days) {
        filled[d.dayOfWeek] = (d.activities || []).map(a => ({
          activityType: (a.activityType || "cardio") as "cardio" | "lifting",
          name: a.name || "Activity",
          durationMinutes: a.durationMinutes || 45,
          rpe: a.rpe || 7,
          intensity: a.intensity || "moderate",
          metValue: a.metValue,
          bodyRegion: a.bodyRegion,
          activityCatalogId: a.activityCatalogId,
          slot: (a.slot || "morning") as "morning" | "afternoon" | "evening",
        }));
      }
      setDayActivities(filled);
    } else {
      setBlockName("");
      setStartDate(nextMonday());
      setWeekCount(4);
      setDayActivities(emptyDays());
    }
  }, [visible]);

  // Activity search with debounce
  useEffect(() => {
    if (!activitySearch || activitySearch.length < 2) {
      setActivityResults([]);
      return;
    }
    setFormSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<ActivityCatalogItem[]>(`/activities?query=${encodeURIComponent(activitySearch)}`);
        setActivityResults(Array.isArray(res) ? res.slice(0, 8) : []);
      } catch {
        setActivityResults([]);
      } finally {
        setFormSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [activitySearch]);

  function openForm(day: number, type: "cardio" | "lifting") {
    setActiveDay(day);
    setActiveFormType(type);
    setActivitySearch("");
    setActivityResults([]);
    setSelectedActivity(null);
    setFormName("");
    setFormDuration("45");
    setFormRpe("7");
    setFormSlot("morning");
    setFormBodyRegion("full");
  }

  function closeForm() {
    setActiveDay(null);
    setActiveFormType(null);
    setActivitySearch("");
    setActivityResults([]);
    setSelectedActivity(null);
  }

  function saveActivity() {
    if (activeDay === null || !activeFormType) return;
    const dur = Math.max(5, parseInt(formDuration) || 45);
    const rpe = Math.min(10, Math.max(1, parseFloat(formRpe) || 7));
    const isCardio = activeFormType === "cardio";
    const resolvedName = isCardio
      ? (selectedActivity?.name || formName || "Cardio")
      : (formName || `${formBodyRegion.charAt(0).toUpperCase() + formBodyRegion.slice(1)} Body Lift`);

    const activity: BlockActivity = {
      activityType: activeFormType,
      name: resolvedName,
      durationMinutes: dur,
      rpe,
      intensity: rpeToIntensity(rpe),
      slot: formSlot,
      ...(isCardio ? {
        metValue: selectedActivity?.metValue || 5,
        activityCatalogId: selectedActivity?.id,
      } : {
        bodyRegion: formBodyRegion,
        metValue: 4.0,
      }),
    };

    setDayActivities(prev => ({
      ...prev,
      [activeDay]: [...(prev[activeDay] || []), activity],
    }));
    closeForm();
  }

  function removeActivity(day: number, idx: number) {
    setDayActivities(prev => ({
      ...prev,
      [day]: (prev[day] || []).filter((_, i) => i !== idx),
    }));
  }

  function clearDay(day: number) {
    setDayActivities(prev => ({ ...prev, [day]: [] }));
    if (activeDay === day) closeForm();
  }

  async function fetchPreview() {
    setPreviewLoading(true);
    setPreview(null);
    setAcknowledged(false);
    setAmbersAcknowledged(false);
    try {
      const days = Object.entries(dayActivities)
        .map(([dow, acts]) => ({ dayOfWeek: parseInt(dow), activities: acts }))
        .filter(d => d.activities.length > 0);
      const result = await apiFetch<PreviewResult>("/training-blocks/preview", {
        method: "POST",
        body: { startDate, weekCount, days },
      });
      setPreview(result);
      setStep(3);
    } catch {
      showToast({ title: "Preview failed", description: "Could not load preview. Please try again." });
    } finally {
      setPreviewLoading(false);
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (activeBlockId) {
        await apiFetch(`/training-blocks/${activeBlockId}`, { method: "DELETE" });
      }
      const days = Object.entries(dayActivities).map(([dow, acts]) => ({
        dayOfWeek: parseInt(dow),
        activities: acts,
      }));
      return apiFetch("/training-blocks", {
        method: "POST",
        body: { name: blockName.trim(), startDate, weekCount, days },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-block-active"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      showToast({
        title: "Training block saved",
        description: `${blockName} is active — sessions created for each week.`,
      });
      onClose();
    },
    onError: () => {
      showToast({ title: "Error saving block", description: "Please try again." });
    },
  });

  const hasAnyActivity = Object.values(dayActivities).some(a => a.length > 0);
  const hasSpikes = preview?.hasAnyOvertraining ?? false;
  const hasClusterWarnings = !hasSpikes && (preview?.weeks.some(w => w.hasCluster) ?? false);
  const commitEnabled = !!preview && (
    (!hasSpikes && !hasClusterWarnings) ||
    (hasSpikes && acknowledged) ||
    (hasClusterWarnings && ambersAcknowledged)
  );

  const c = colors;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[st.root, { backgroundColor: c.background }]}>

        {/* Header */}
        <View style={[st.header, { borderBottomColor: c.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="calendar" size={17} color={c.primary} />
            <View>
              <Text style={[st.headerTitle, { color: c.foreground }]}>Plan Training Block</Text>
              <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                Define weekly activities — sessions created per week
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={c.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Step indicators */}
        <View style={st.stepRow}>
          {(["Setup", "Activities", "Preview"] as const).map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <React.Fragment key={label}>
                {i > 0 && (
                  <View style={[st.stepLine, { backgroundColor: done ? c.primary : c.border }]} />
                )}
                <View style={st.stepItem}>
                  <View style={[st.stepCircle, {
                    backgroundColor: active || done ? c.primary : "transparent",
                    borderColor: active || done ? c.primary : c.border,
                  }]}>
                    {done
                      ? <Feather name="check" size={11} color="#fff" />
                      : <Text style={{ color: active ? "#fff" : c.mutedForeground, fontSize: 11, fontWeight: "700" }}>{n}</Text>
                    }
                  </View>
                  <Text style={{ color: active ? c.foreground : c.mutedForeground, fontSize: 10, marginTop: 4 }}>
                    {label}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── STEP 1: Setup ── */}
          {step === 1 && (
            <>
              <Text style={[st.label, { color: c.mutedForeground }]}>BLOCK NAME</Text>
              <TextInput
                style={[st.input, { backgroundColor: c.input, borderColor: c.border, color: c.foreground }]}
                placeholder="e.g. Pre-camp Strength Block"
                placeholderTextColor={c.mutedForeground}
                value={blockName}
                onChangeText={setBlockName}
              />

              <Text style={[st.label, { color: c.mutedForeground }]}>START DATE</Text>
              <TouchableOpacity
                style={[st.input, { backgroundColor: c.input, borderColor: c.border, justifyContent: "center" }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: startDate ? c.foreground : c.mutedForeground, fontSize: 15 }}>
                  {startDate
                    ? format(new Date(startDate + "T12:00:00"), "EEEE, d MMM yyyy")
                    : "Select start date"}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(startDate + "T12:00:00")}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant="dark"
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (date) setStartDate(format(date, "yyyy-MM-dd"));
                  }}
                />
              )}
              {Platform.OS === "ios" && showDatePicker && (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(false)}
                  style={{ alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 14 }}
                >
                  <Text style={{ color: c.primary, fontWeight: "600" }}>Done</Text>
                </TouchableOpacity>
              )}

              <Text style={[st.label, { color: c.mutedForeground }]}>DURATION</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {WEEK_OPTIONS.map(w => (
                  <TouchableOpacity
                    key={w}
                    onPress={() => setWeekCount(w)}
                    style={[st.weekBtn, {
                      backgroundColor: weekCount === w ? c.primary : c.secondary,
                      borderColor: weekCount === w ? c.primary : c.border,
                    }]}
                  >
                    <Text style={{
                      color: weekCount === w ? "#fff" : c.mutedForeground,
                      fontWeight: "700", fontSize: 13,
                    }}>
                      {w}w
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── STEP 2: Activity Editor ── */}
          {step === 2 && DAYS.map((dayLabel, dow) => {
            const acts = dayActivities[dow] || [];
            const au = computeAU(acts);
            const { text: loadText, color: loadColor } = auLabel(au);
            const isThisDay = activeDay === dow;

            return (
              <View key={dow} style={[st.dayCard, { backgroundColor: c.card, borderColor: "rgba(255,255,255,0.22)" }]}>
                <View style={st.dayHeaderRow}>
                  <Text style={[st.dayLabelText, { color: c.foreground }]}>{dayLabel}</Text>
                  <View style={[st.loadChip, { borderColor: loadColor + "50" }]}>
                    <Text style={{ color: loadColor, fontSize: 11, fontWeight: "700" }}>{loadText}</Text>
                  </View>
                  {acts.length > 0 && (
                    <TouchableOpacity onPress={() => clearDay(dow)} style={{ marginLeft: "auto" }}>
                      <Text style={{ color: c.mutedForeground, fontSize: 11 }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {acts.map((act, i) => (
                  <View key={i} style={[st.actChip, {
                    backgroundColor: act.activityType === "cardio"
                      ? "rgba(59,130,246,0.12)" : "rgba(167,139,250,0.12)",
                    borderColor: act.activityType === "cardio"
                      ? "rgba(59,130,246,0.35)" : "rgba(167,139,250,0.35)",
                  }]}>
                    <Feather
                      name={act.activityType === "cardio" ? "activity" : "zap"}
                      size={12}
                      color={act.activityType === "cardio" ? "#60a5fa" : "#a78bfa"}
                    />
                    <Text style={{ color: c.foreground, fontSize: 12, flex: 1, marginLeft: 6 }}>
                      {act.name} · {act.durationMinutes}min · RPE {act.rpe}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeActivity(dow, i)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="x" size={14} color={c.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}

                {isThisDay && activeFormType && (
                  <View style={[st.formCard, { backgroundColor: c.background, borderColor: c.border }]}>
                    <Text style={{ color: c.foreground, fontWeight: "700", marginBottom: 10, fontSize: 13 }}>
                      {activeFormType === "cardio" ? "Add Cardio Activity" : "Add Lifting Session"}
                    </Text>

                    {activeFormType === "cardio" && (
                      <>
                        <Text style={[st.label, { color: c.mutedForeground, marginBottom: 4 }]}>SEARCH ACTIVITY</Text>
                        <TextInput
                          style={[st.smallInput, { backgroundColor: c.input, borderColor: c.border, color: c.foreground }]}
                          placeholder="e.g. Running, Cycling, Boxing…"
                          placeholderTextColor={c.mutedForeground}
                          value={activitySearch}
                          onChangeText={v => { setActivitySearch(v); setSelectedActivity(null); }}
                          autoFocus
                        />
                        {formSearching && (
                          <ActivityIndicator size="small" color={c.primary} style={{ marginVertical: 4 }} />
                        )}
                        {selectedActivity && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <Feather name="check-circle" size={13} color={c.primary} />
                            <Text style={{ color: c.primary, fontSize: 12 }}>{selectedActivity.name}</Text>
                          </View>
                        )}
                        {activityResults.length > 0 && !selectedActivity && (
                          <View style={[st.searchResults, { backgroundColor: c.card, borderColor: c.border }]}>
                            {activityResults.map(item => (
                              <TouchableOpacity
                                key={item.id}
                                style={[st.searchRow, { borderBottomColor: c.border }]}
                                onPress={() => {
                                  setSelectedActivity(item);
                                  setActivitySearch(item.name);
                                  setActivityResults([]);
                                }}
                              >
                                <Text style={{ color: c.foreground, fontSize: 13 }}>{item.name}</Text>
                                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>
                                  MET {item.metValue?.toFixed(1) ?? "?"}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </>
                    )}

                    {activeFormType === "lifting" && (
                      <>
                        <Text style={[st.label, { color: c.mutedForeground, marginBottom: 6 }]}>BODY REGION</Text>
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                          {(["upper", "lower", "full"] as const).map(r => (
                            <TouchableOpacity
                              key={r}
                              onPress={() => setFormBodyRegion(r)}
                              style={[st.toggleBtn, {
                                backgroundColor: formBodyRegion === r ? c.primary : c.secondary,
                                borderColor: formBodyRegion === r ? c.primary : c.border,
                              }]}
                            >
                              <Text style={{ color: formBodyRegion === r ? "#fff" : c.mutedForeground, fontSize: 12 }}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TextInput
                          style={[st.smallInput, { backgroundColor: c.input, borderColor: c.border, color: c.foreground }]}
                          placeholder="e.g. Bench Press, Squats (optional)"
                          placeholderTextColor={c.mutedForeground}
                          value={formName}
                          onChangeText={setFormName}
                        />
                      </>
                    )}

                    <Text style={[st.label, { color: c.mutedForeground, marginTop: 10, marginBottom: 6 }]}>TIME SLOT</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                      {SLOTS.map(s => (
                        <TouchableOpacity
                          key={s.key}
                          onPress={() => setFormSlot(s.key)}
                          style={[st.toggleBtn, {
                            backgroundColor: formSlot === s.key ? c.primary : c.secondary,
                            borderColor: formSlot === s.key ? c.primary : c.border,
                          }]}
                        >
                          <Text style={{ color: formSlot === s.key ? "#fff" : c.mutedForeground, fontSize: 12 }}>
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.label, { color: c.mutedForeground, marginBottom: 4 }]}>DURATION (min)</Text>
                        <TextInput
                          style={[st.smallInput, { backgroundColor: c.input, borderColor: c.border, color: c.foreground }]}
                          keyboardType="number-pad"
                          value={formDuration}
                          onChangeText={setFormDuration}
                          placeholder="45"
                          placeholderTextColor={c.mutedForeground}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.label, { color: c.mutedForeground, marginBottom: 4 }]}>RPE (1–10)</Text>
                        <TextInput
                          style={[st.smallInput, { backgroundColor: c.input, borderColor: c.border, color: c.foreground }]}
                          keyboardType="decimal-pad"
                          value={formRpe}
                          onChangeText={setFormRpe}
                          placeholder="7"
                          placeholderTextColor={c.mutedForeground}
                        />
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity
                        style={[st.actionBtn, { backgroundColor: c.primary }]}
                        onPress={saveActivity}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Add</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[st.actionBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: c.border }]}
                        onPress={closeForm}
                      >
                        <Text style={{ color: c.mutedForeground, fontSize: 13 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {(!isThisDay || !activeFormType) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: acts.length > 0 ? 4 : 0 }}>
                    <TouchableOpacity
                      style={[st.addBtn, { borderColor: "rgba(59,130,246,0.4)" }]}
                      onPress={() => openForm(dow, "cardio")}
                    >
                      <Feather name="plus" size={12} color="#60a5fa" />
                      <Text style={{ color: "#60a5fa", fontSize: 12, fontWeight: "600", marginLeft: 4 }}>
                        Cardio
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.addBtn, { borderColor: "rgba(167,139,250,0.4)" }]}
                      onPress={() => openForm(dow, "lifting")}
                    >
                      <Feather name="plus" size={12} color="#a78bfa" />
                      <Text style={{ color: "#a78bfa", fontSize: 12, fontWeight: "600", marginLeft: 4 }}>
                        Lift
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* ── STEP 3: Preview ── */}
          {step === 3 && previewLoading && (
            <View style={{ alignItems: "center", padding: 40 }}>
              <ActivityIndicator color={c.primary} />
              <Text style={{ color: c.mutedForeground, marginTop: 12 }}>Calculating load preview…</Text>
            </View>
          )}

          {step === 3 && preview && !previewLoading && (
            <View style={{ gap: 12 }}>
              {/* ACWR bar chart */}
              <View style={[st.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={{ color: c.foreground, fontWeight: "700", marginBottom: 12, fontSize: 13 }}>
                  ACWR by Week
                </Text>
                <View style={{ height: 90, flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                  {preview.weeks.map(w => {
                    const acwr = w.peakAcwr ?? 0;
                    const maxVal = Math.max(...preview.weeks.map(x => x.peakAcwr ?? 0), 1.6);
                    const height = acwr > 0 ? Math.max(8, (acwr / maxVal) * 76) : 4;
                    const barColor = acwr === 0
                      ? c.border
                      : acwr <= 1.3 ? "#4ade80"
                      : acwr <= 1.5 ? "#fb923c"
                      : "#f87171";
                    return (
                      <View key={w.weekNum} style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ color: c.mutedForeground, fontSize: 9, marginBottom: 2 }}>
                          {acwr > 0 ? acwr.toFixed(1) : "—"}
                        </Text>
                        <View style={{ width: "70%", height, backgroundColor: barColor, borderRadius: 3 }} />
                        <Text style={{ color: c.mutedForeground, fontSize: 9, marginTop: 3 }}>
                          W{w.weekNum}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  {[
                    { color: "#4ade80", label: "≤1.3 Optimal" },
                    { color: "#fb923c", label: "1.3–1.5 Elevated" },
                    { color: "#f87171", label: ">1.5 Risk" },
                  ].map(item => (
                    <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: item.color }} />
                      <Text style={{ color: c.mutedForeground, fontSize: 10 }}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Per-week rows */}
              {preview.weeks.map(w => {
                const acwr = w.peakAcwr;
                const rowBg = w.hasSpike
                  ? "rgba(239,68,68,0.06)"
                  : w.hasCluster ? "rgba(249,115,22,0.06)"
                  : "transparent";
                const acwrColor = !acwr
                  ? c.mutedForeground
                  : acwr <= 1.3 ? "#4ade80"
                  : acwr <= 1.5 ? "#fb923c"
                  : "#f87171";
                return (
                  <View key={w.weekNum} style={[st.weekRow, { backgroundColor: rowBg, borderColor: c.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 13 }}>
                        Week {w.weekNum}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 1 }}>
                        {format(new Date(w.startDate + "T12:00:00"), "d MMM")} – {format(new Date(w.endDate + "T12:00:00"), "d MMM")}
                      </Text>
                      {w.warningReasons.map((r, i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                          <Feather name="alert-triangle" size={11} color="#fb923c" />
                          <Text style={{ color: "#fb923c", fontSize: 11, flex: 1 }}>{r}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
                      <Text style={{ color: acwrColor, fontWeight: "800", fontSize: 20 }}>
                        {acwr?.toFixed(2) ?? "—"}
                      </Text>
                      <Text style={{ color: c.mutedForeground, fontSize: 10 }}>ACWR</Text>
                      {w.hasSpike && (
                        <Text style={{ color: "#f87171", fontSize: 10, marginTop: 2 }}>⚠ Spike</Text>
                      )}
                      {w.hasCluster && !w.hasSpike && (
                        <Text style={{ color: "#fb923c", fontSize: 10, marginTop: 2 }}>Cluster</Text>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Warning / OK banners */}
              {hasSpikes && !acknowledged && (
                <View style={[st.warningBanner, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Feather name="alert-triangle" size={15} color="#f87171" />
                    <Text style={{ color: "#f87171", fontSize: 13, flex: 1, fontWeight: "600" }}>
                      Overtraining Risk Detected
                    </Text>
                  </View>
                  <Text style={{ color: "#f87171", fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
                    ACWR &gt;1.5 in one or more weeks — injury risk is elevated.
                  </Text>
                  <TouchableOpacity
                    style={[st.acknowledgeBtn, { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.4)" }]}
                    onPress={() => setAcknowledged(true)}
                  >
                    <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "700", textAlign: "center" }}>
                      I understand the risk — proceed anyway
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {hasClusterWarnings && !hasSpikes && !ambersAcknowledged && (
                <View style={[st.warningBanner, { backgroundColor: "rgba(249,115,22,0.08)", borderColor: "rgba(249,115,22,0.3)" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Feather name="alert-triangle" size={15} color="#fb923c" />
                    <Text style={{ color: "#fb923c", fontSize: 13, flex: 1, fontWeight: "600" }}>
                      Load Warnings Detected
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[st.acknowledgeBtn, { backgroundColor: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.4)" }]}
                    onPress={() => setAmbersAcknowledged(true)}
                  >
                    <Text style={{ color: "#fb923c", fontSize: 12, fontWeight: "700", textAlign: "center" }}>
                      I've reviewed the warnings — proceed
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {!hasSpikes && !hasClusterWarnings && (
                <View style={[st.warningBanner, { backgroundColor: "rgba(74,222,128,0.08)", borderColor: "rgba(74,222,128,0.3)" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="check-circle" size={15} color="#4ade80" />
                    <Text style={{ color: "#4ade80", fontSize: 13, fontWeight: "600" }}>
                      Load looks sustainable
                    </Text>
                  </View>
                </View>
              )}

              {(acknowledged || ambersAcknowledged) && (
                <View style={[st.warningBanner, { backgroundColor: `${c.primary}10`, borderColor: `${c.primary}30` }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="alert-circle" size={14} color={c.primary} />
                    <Text style={{ color: c.primary, fontSize: 12 }}>
                      Warnings acknowledged — tap Commit Block to proceed
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Footer */}
        <View style={[st.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
          {step === 1 && (
            <TouchableOpacity
              style={[st.primaryBtn, {
                backgroundColor: c.primary,
                opacity: !blockName.trim() || !startDate ? 0.5 : 1,
              }]}
              onPress={() => setStep(2)}
              disabled={!blockName.trim() || !startDate}
            >
              <Text style={st.primaryBtnText}>Next: Activities</Text>
            </TouchableOpacity>
          )}

          {step === 2 && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[st.ghostBtn, { borderColor: c.border }]}
                onPress={() => { closeForm(); setStep(1); }}
              >
                <Text style={{ color: c.mutedForeground, fontWeight: "600" }}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.primaryBtn, { flex: 1, opacity: !hasAnyActivity || previewLoading ? 0.5 : 1, borderWidth: 1.5, borderColor: "#fff" }]}
                onPress={fetchPreview}
                disabled={!hasAnyActivity || previewLoading}
              >
                {previewLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={st.primaryBtnText}>Preview Load</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[st.ghostBtn, { borderColor: c.border }]}
                onPress={() => setStep(2)}
              >
                <Text style={{ color: c.mutedForeground, fontWeight: "600" }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.primaryBtn, { flex: 1, opacity: !commitEnabled || createMutation.isPending ? 0.5 : 1 }]}
                onPress={() => createMutation.mutate()}
                disabled={!commitEnabled || createMutation.isPending}
              >
                {createMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={st.primaryBtnText}>Commit Block</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  stepRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, paddingHorizontal: 24,
  },
  stepItem: { alignItems: "center" },
  stepCircle: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  stepLine: { flex: 1, height: 1, marginHorizontal: 8, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, fontFamily: "Inter_600SemiBold" },
  input: { height: 50, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  weekBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: "center" },
  dayCard: { borderRadius: 12, borderWidth: 1, padding: 13, gap: 8 },
  dayHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dayLabelText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold", width: 32 },
  loadChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  actChip: {
    flexDirection: "row", alignItems: "center", borderRadius: 8,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7,
  },
  addBtn: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, borderWidth: 1,
  },
  formCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 4, gap: 0 },
  smallInput: { height: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, borderWidth: 1, alignItems: "center" },
  searchResults: { borderRadius: 8, borderWidth: 1, overflow: "hidden", marginTop: 2, marginBottom: 6 },
  searchRow: {
    paddingHorizontal: 12, paddingVertical: 9,
    flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1,
  },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  chartCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  weekRow: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "flex-start" },
  warningBanner: { borderRadius: 10, borderWidth: 1, padding: 12 },
  acknowledgeBtn: { borderRadius: 8, borderWidth: 1, padding: 10, alignItems: "center" },
  footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1 },
  primaryBtn: { borderRadius: 10, padding: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, fontFamily: "Inter_700Bold" },
  ghostBtn: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10, borderWidth: 1, alignItems: "center" },
});
