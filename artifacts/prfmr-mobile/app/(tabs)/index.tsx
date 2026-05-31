import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, subWeeks } from "date-fns";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface WeightCutData {
  planId: number;
  currentWeight: number;
  targetWeight: number;
  fightDate: string;
  daysUntil: number;
  weeksUntil: number;
  totalToLose: number;
  weeklyRate: number;
  weeklyRatePct: number;
  status: string;
  statusLabel: string;
  weeklyTargets: Array<{ week: number; targetWeight: number }>;
  suggestedDeficitKcal: number;
}

interface MorningStatus {
  hasSleep: boolean;
  hasWeight: boolean;
  hasPlannedTraining: boolean;
  isRestDay: boolean;
  sleepLog: { hoursSlept: number; sleepQuality: number | null } | null;
  weightLog: { weight: number } | null;
}

interface ProvisionalCheckin {
  id: number;
  feelToday: "fresh" | "okay" | "tired";
  fueledToday: "yes" | "somewhat" | "no";
  plannedIntensity: "light" | "moderate" | "hard";
  trainedYesterday: boolean | null;
}

interface ReadinessData {
  provisional: boolean;
  hasYesterdayTraining: boolean;
  checkin: ProvisionalCheckin | null;
}

interface Targets {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  adjustedCalories: number;
  trainingCaloriesEarned: number;
}

interface FoodEntry {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  meal: string;
  date: string;
}

interface ScheduledSlot {
  stackId: number;
  stackName: string;
  reminderId: number;
  time: string;
  supplementId: number;
  supplementName: string;
  doseAmount: number | null;
  doseUnit: string | null;
}

interface RawIntake {
  id: number;
  supplementId: number;
  stackId: number | null;
  reminderId: number | null;
  taken: boolean;
  date: string;
}

interface AmqsScore {
  score: number;
  maxScore: number;
  label: string;
  gaps: string[];
}

interface WorkoutSession {
  id: number;
  date: string;
  timeOfDay: "morning" | "afternoon" | "evening";
  exercises: any[];
  activities: any[];
}

interface WeightEntry {
  date: string;
  weight: number;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function getPaceInfo(weeklyRatePct: number) {
  if (weeklyRatePct < 0.5) return { label: "Easy pace", color: "#6b7280" };
  if (weeklyRatePct <= 0.75) return { label: "Moderate pace", color: "#ff7a00" };
  return { label: "Aggressive pace", color: "#fb923c" };
}

const FEEL_OPTIONS = [
  { value: "fresh", label: "Fresh", emoji: "💪" },
  { value: "okay", label: "Okay", emoji: "😐" },
  { value: "tired", label: "Tired", emoji: "😴" },
] as const;

const FUEL_OPTIONS = [
  { value: "yes", label: "Yes", emoji: "🟢" },
  { value: "somewhat", label: "Somewhat", emoji: "🟡" },
  { value: "no", label: "Not really", emoji: "🔴" },
] as const;

const INTENSITY_OPTIONS = [
  { value: "light", label: "Light", emoji: "🚶" },
  { value: "moderate", label: "Moderate", emoji: "🏃" },
  { value: "hard", label: "Hard", emoji: "🔥" },
] as const;

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

// ─────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

function SmallBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color + "60" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function MacroCard({ label, value, unit, target, color, emoji }: {
  label: string; value: number; unit: string; target: number; color: string; emoji: string;
}) {
  const colors = useColors();
  const pct = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  return (
    <Card style={styles.macroCard}>
      <View style={styles.row}>
        <Text style={styles.macroEmoji}>{emoji}</Text>
        <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.macroValue, { color: colors.foreground }]}>
        {Math.round(value)}<Text style={[styles.macroUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </Text>
      <ProgressBar value={value} max={target} color={color} />
      <Text style={[styles.macroMeta, { color: colors.mutedForeground }]}>Target: {Math.round(target)} · {pct}%</Text>
    </Card>
  );
}

// ─────────────────────────────────────────
// Fight Camp Hero
// ─────────────────────────────────────────
function FightCampHero({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [showWeight, setShowWeight] = useState(false);
  const [weightVal, setWeightVal] = useState("");

  const { data: plan } = useQuery<WeightCutData | null>({
    queryKey: ["weight-cut"],
    queryFn: () => apiFetch<WeightCutData | null>("/me/weight-cut").catch(() => null),
    retry: false,
  });

  const weightMut = useMutation({
    mutationFn: (w: number) => apiFetch("/weights", { method: "POST", body: { date, weight: w } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["weights-range"] });
      setShowWeight(false); setWeightVal("");
    },
  });

  if (!plan || plan.daysUntil <= 0) return null;

  const pace = getPaceInfo(plan.weeklyRatePct);
  const thisWeekTarget = plan.weeklyTargets?.[0];

  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Feather name="target" size={13} color={colors.primary} />
          <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 4 }]}>Fight Camp</Text>
        </View>
        <SmallBadge label={pace.label} color={pace.color} bg={pace.color + "1a"} />
      </View>

      <Text style={[styles.heroNum, { color: colors.foreground }]}>
        {plan.daysUntil}{" "}
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>days to fight night</Text>
      </Text>

      <View style={[styles.weightRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.weightNum, { color: colors.foreground }]}>{plan.currentWeight}</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>current</Text>
        </View>
        <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.weightNum, { color: colors.primary }]}>{plan.targetWeight}</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>fight weight</Text>
        </View>
      </View>

      <Text style={[styles.sm, { color: colors.mutedForeground, marginTop: 4 }]}>
        {plan.totalToLose.toFixed(1)} kg to go · {plan.weeklyRate.toFixed(2)} kg/wk fat loss
      </Text>

      {thisWeekTarget && (
        <View style={[styles.thisWeek, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.xs, { color: colors.mutedForeground, fontWeight: "700", letterSpacing: 0.5 }]}>THIS WEEK'S TARGET</Text>
          <Text style={[styles.sm, { color: colors.foreground, fontWeight: "700", marginTop: 2 }]}>
            {thisWeekTarget.targetWeight.toFixed(1)} kg
            {plan.suggestedDeficitKcal > 0 && (
              <Text style={{ color: colors.mutedForeground }}> · ~{Math.round(plan.suggestedDeficitKcal)} kcal deficit/day</Text>
            )}
          </Text>
        </View>
      )}

      {!showWeight ? (
        <TouchableOpacity
          style={[styles.logWeightRow, { borderColor: colors.border }]}
          onPress={() => setShowWeight(true)}
        >
          <Feather name="plus" size={13} color={colors.mutedForeground} />
          <Text style={[styles.sm, { color: colors.mutedForeground, marginLeft: 6 }]}>Log today's weight</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.row, { marginTop: 10 }]}>
          <TextInput
            style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            placeholder="Weight (kg)"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            value={weightVal}
            onChangeText={setWeightVal}
            autoFocus
          />
          <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.primary, marginLeft: 8 }]}
            onPress={() => { const w = parseFloat(weightVal); if (!isNaN(w) && w > 0) weightMut.mutate(w); }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, marginLeft: 6 }]}
            onPress={() => { setShowWeight(false); setWeightVal(""); }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────
// Morning Check-In
// ─────────────────────────────────────────
function MorningCheckIn({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [showSleep, setShowSleep] = useState(false);
  const [sleepH, setSleepH] = useState("");
  const [sleepQ, setSleepQ] = useState<number | null>(null);
  const [showWeight, setShowWeight] = useState(false);
  const [weightVal, setWeightVal] = useState("");

  const { data: status } = useQuery<MorningStatus>({
    queryKey: ["morning-status", date],
    queryFn: () => apiFetch(`/me/morning-status/${date}`),
  });

  const sleepMut = useMutation({
    mutationFn: (d: { hoursSlept: number; sleepQuality: number | null }) =>
      apiFetch(`/me/sleep/${date}`, { method: "PUT", body: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["readiness", date] });
      setShowSleep(false); setSleepH(""); setSleepQ(null);
    },
  });

  const weightMut = useMutation({
    mutationFn: (w: number) => apiFetch("/weights", { method: "POST", body: { date, weight: w } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      qc.invalidateQueries({ queryKey: ["weights-range"] });
      setShowWeight(false); setWeightVal("");
    },
  });

  const restMut = useMutation({
    mutationFn: (mark: boolean) =>
      apiFetch(`/me/rest-day/${date}`, { method: mark ? "POST" : "DELETE", body: mark ? {} : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
    },
  });

  if (!status) return null;
  const trainingDone = status.hasPlannedTraining || status.isRestDay;
  const done = [status.hasSleep, status.hasWeight, trainingDone].filter(Boolean).length;
  if (done === 3) return null;

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Morning Check-In</Text>
        <SmallBadge label={`${done}/3`} color={colors.primary} bg={"rgba(255,122,0,0.1)"} />
      </View>

      {/* Sleep */}
      {!status.hasSleep && !showSleep && (
        <TouchableOpacity style={[styles.checkRow, { borderColor: colors.border }]} onPress={() => setShowSleep(true)}>
          <View style={[styles.checkIcon, { backgroundColor: "rgba(147,197,253,0.08)", borderColor: "rgba(147,197,253,0.2)" }]}>
            <Feather name="moon" size={16} color="#93c5fd" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sm, { color: colors.foreground, fontWeight: "600" }]}>How did you sleep?</Text>
            <Text style={[styles.xs, { color: colors.mutedForeground }]}>Log hours + quality</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
      {showSleep && (
        <View style={[styles.expandBox, { borderColor: colors.border }]}>
          <Text style={[styles.xs, { color: colors.mutedForeground, fontWeight: "600", marginBottom: 6 }]}>Hours slept</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            placeholder="e.g. 7.5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            value={sleepH}
            onChangeText={setSleepH}
          />
          <Text style={[styles.xs, { color: colors.mutedForeground, fontWeight: "600", marginTop: 10, marginBottom: 6 }]}>Quality (1-5, optional)</Text>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map(q => (
              <TouchableOpacity key={q} style={[styles.qBtn, {
                borderColor: sleepQ === q ? colors.primary : colors.border,
                backgroundColor: sleepQ === q ? "rgba(255,122,0,0.1)" : colors.secondary,
                flex: 1, marginRight: q < 5 ? 4 : 0,
              }]} onPress={() => setSleepQ(q)}>
                <Text style={{ color: sleepQ === q ? colors.primary : colors.mutedForeground, fontWeight: "700", fontSize: 13 }}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.primary, flex: 1, justifyContent: "center", marginRight: 6 }]}
              onPress={() => { const h = parseFloat(sleepH); if (!isNaN(h) && h > 0) sleepMut.mutate({ hoursSlept: h, sleepQuality: sleepQ }); }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => { setShowSleep(false); setSleepH(""); setSleepQ(null); }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Weight */}
      {!status.hasWeight && !showWeight && (
        <TouchableOpacity style={[styles.checkRow, { borderColor: colors.border }]} onPress={() => setShowWeight(true)}>
          <View style={[styles.checkIcon, { backgroundColor: "rgba(255,122,0,0.08)", borderColor: "rgba(255,122,0,0.2)" }]}>
            <Feather name="activity" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sm, { color: colors.foreground, fontWeight: "600" }]}>Morning weight?</Text>
            <Text style={[styles.xs, { color: colors.mutedForeground }]}>Log today's scale weight</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
      {showWeight && (
        <View style={[styles.expandBox, { borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            placeholder="Weight in kg"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            value={weightVal}
            onChangeText={setWeightVal}
            autoFocus
          />
          <View style={[styles.row, { marginTop: 8 }]}>
            <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.primary, flex: 1, justifyContent: "center", marginRight: 6 }]}
              onPress={() => { const w = parseFloat(weightVal); if (!isNaN(w) && w > 0) weightMut.mutate(w); }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => { setShowWeight(false); setWeightVal(""); }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Training */}
      {!trainingDone && (
        <View style={[styles.checkRow, { borderColor: colors.border }]}>
          <View style={[styles.checkIcon, { backgroundColor: "rgba(74,222,128,0.08)", borderColor: "rgba(74,222,128,0.2)" }]}>
            <Feather name="zap" size={16} color="#4ade80" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sm, { color: colors.foreground, fontWeight: "600" }]}>Training today?</Text>
            <Text style={[styles.xs, { color: colors.mutedForeground }]}>Log a session or mark rest</Text>
          </View>
          <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => restMut.mutate(!status.isRestDay)}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700" }}>
              {status.isRestDay ? "Unmark rest" : "Mark rest"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────
// Provisional Check-In
// ─────────────────────────────────────────
function ProvisionalCheckIn({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [feel, setFeel] = useState<string | null>(null);
  const [fuel, setFuel] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data: readiness } = useQuery<ReadinessData>({
    queryKey: ["readiness", date],
    queryFn: () => apiFetch(`/me/readiness/${date}`),
  });

  const submitMut = useMutation({
    mutationFn: () => apiFetch("/me/provisional-checkin", {
      method: "POST",
      body: { feelToday: feel, fueledToday: fuel, plannedIntensity: intensity, date },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["readiness", date] }); setEditing(false); },
  });

  if (!readiness) return null;
  const ci = readiness.checkin;

  if (ci && !editing) {
    return (
      <Card>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Quick Check-In</Text>
          <TouchableOpacity onPress={() => { setFeel(ci.feelToday); setFuel(ci.fueledToday); setIntensity(ci.plannedIntensity); setEditing(true); }}>
            <Feather name="edit-2" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <Text style={{ fontSize: 20 }}>{FEEL_OPTIONS.find(o => o.value === ci.feelToday)?.emoji}</Text>
          <Text style={{ fontSize: 20, marginHorizontal: 8 }}>{FUEL_OPTIONS.find(o => o.value === ci.fueledToday)?.emoji}</Text>
          <Text style={{ fontSize: 20 }}>{INTENSITY_OPTIONS.find(o => o.value === ci.plannedIntensity)?.emoji}</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 8 }]}>Check-in saved ✓</Text>
        </View>
      </Card>
    );
  }

  if (!readiness.provisional && !editing) return null;

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Quick Check-In</Text>
        <SmallBadge label="Estimated" color={colors.mutedForeground} bg={"rgba(107,114,128,0.1)"} />
      </View>

      {([
        { label: "How do you feel today?", options: FEEL_OPTIONS, val: feel, set: setFeel },
        { label: "Did you fuel well?", options: FUEL_OPTIONS, val: fuel, set: setFuel },
        { label: "Planned session intensity?", options: INTENSITY_OPTIONS, val: intensity, set: setIntensity },
      ] as const).map(({ label, options, val, set }) => (
        <View key={label} style={{ marginTop: 10 }}>
          <Text style={[styles.xs, { color: colors.mutedForeground, fontWeight: "600", marginBottom: 6 }]}>{label}</Text>
          <View style={styles.ciRow}>
            {options.map(o => (
              <TouchableOpacity key={o.value} style={[styles.ciBtn, {
                borderColor: val === o.value ? colors.primary : colors.border,
                backgroundColor: val === o.value ? "rgba(255,122,0,0.1)" : colors.secondary,
              }]} onPress={() => (set as any)(o.value)}>
                <Text style={{ fontSize: 20 }}>{o.emoji}</Text>
                <Text style={[styles.xs, { color: val === o.value ? colors.primary : colors.mutedForeground, fontWeight: "600" }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.fullBtn, { backgroundColor: colors.primary, opacity: (feel && fuel && intensity) ? 1 : 0.4, marginTop: 14 }]}
        disabled={!feel || !fuel || !intensity || submitMut.isPending}
        onPress={() => submitMut.mutate()}
      >
        {submitMut.isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Submit Check-In</Text>}
      </TouchableOpacity>
    </Card>
  );
}

// ─────────────────────────────────────────
// Daily Intake Card
// ─────────────────────────────────────────
function DailyIntakeCard({ date }: { date: string }) {
  const colors = useColors();
  const { data: targets } = useQuery<Targets>({
    queryKey: ["targets", date],
    queryFn: () => apiFetch(`/me/targets/effective?date=${date}`),
  });
  const { data: plan } = useQuery<WeightCutData | null>({
    queryKey: ["weight-cut"],
    queryFn: () => apiFetch<WeightCutData | null>("/me/weight-cut").catch(() => null),
    retry: false,
  });

  if (!targets) return null;
  const cal = Math.round(targets.adjustedCalories || targets.targetCalories);

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Daily Intake Estimates</Text>
        {plan && plan.daysUntil > 0 && (
          <SmallBadge label="Fight Camp" color={colors.primary} bg={"rgba(255,122,0,0.1)"} />
        )}
      </View>
      <View style={styles.macroRow}>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: colors.foreground, fontSize: 22 }]}>{cal}</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>cal</Text>
        </View>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: "#93c5fd", fontSize: 22 }]}>{Math.round(targets.targetProtein)}g</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>protein</Text>
        </View>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: "#f59e0b", fontSize: 22 }]}>{Math.round(targets.targetCarbs)}g</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>carbs</Text>
        </View>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: "#facc15", fontSize: 22 }]}>{Math.round(targets.targetFat)}g</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>fat</Text>
        </View>
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────
// Supplements Today
// ─────────────────────────────────────────
function SupplementsToday({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const displayDate = format(new Date(date + "T12:00:00"), "MMM d");

  const { data: slots = [] } = useQuery<ScheduledSlot[]>({
    queryKey: ["stacks-scheduled", date],
    queryFn: () => apiFetch(`/me/stacks/scheduled?date=${date}`),
  });
  const { data: intakes = [] } = useQuery<RawIntake[]>({
    queryKey: ["supplement-intakes", date],
    queryFn: () => apiFetch(`/me/supplement-intakes/${date}`),
  });

  const iKey = (i: { supplementId: number; stackId: number | null; reminderId: number | null }) =>
    `${i.stackId ?? 0}-${i.reminderId ?? 0}-${i.supplementId}`;
  const takenSet = new Set(intakes.filter(i => i.taken).map(iKey));

  const toggleMut = useMutation({
    mutationFn: (d: { supplementId: number; stackId: number; reminderId: number; taken: boolean }) =>
      apiFetch("/supplement-intakes", { method: "POST", body: { ...d, date } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplement-intakes", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
    },
  });

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Supplements — {displayDate}</Text>
        <SmallBadge label="Manage" color={colors.mutedForeground} bg={colors.secondary} />
      </View>
      {slots.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          No supplements scheduled today. Enable reminders on your supplements to see them here.
        </Text>
      ) : (
        slots.map(slot => {
          const key = iKey({ supplementId: slot.supplementId, stackId: slot.stackId, reminderId: slot.reminderId });
          const taken = takenSet.has(key);
          return (
            <TouchableOpacity key={`${slot.stackId}-${slot.reminderId}-${slot.supplementId}`}
              style={[styles.suppRow, { borderColor: colors.border }]}
              onPress={() => toggleMut.mutate({ supplementId: slot.supplementId, stackId: slot.stackId, reminderId: slot.reminderId, taken: !taken })}>
              <View style={[styles.suppCheck, { borderColor: taken ? colors.primary : colors.border, backgroundColor: taken ? "rgba(255,122,0,0.1)" : "transparent" }]}>
                {taken && <Feather name="check" size={11} color={colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sm, { color: colors.foreground, fontWeight: "600" }]}>{slot.supplementName}</Text>
                {slot.doseAmount && <Text style={[styles.xs, { color: colors.mutedForeground }]}>{slot.doseAmount} {slot.doseUnit}</Text>}
              </View>
              <Text style={[styles.xs, { color: colors.mutedForeground }]}>{slot.time}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </Card>
  );
}

// ─────────────────────────────────────────
// Training Today
// ─────────────────────────────────────────
function TrainingToday({ date }: { date: string }) {
  const colors = useColors();
  const displayDate = format(new Date(date + "T12:00:00"), "MMM d");
  const { data: sessions = [] } = useQuery<WorkoutSession[]>({
    queryKey: ["sessions", date],
    queryFn: () => apiFetch(`/workouts/sessions?start=${date}&end=${date}`),
  });

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Training — {displayDate}</Text>
        <View style={styles.row}>
          <SmallBadge label="Manual" color={colors.mutedForeground} bg={colors.secondary} />
          <View style={{ width: 4 }} />
          <SmallBadge label="Log" color={colors.mutedForeground} bg={colors.secondary} />
        </View>
      </View>
      {sessions.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No workouts logged for this date.</Text>
      ) : (
        sessions.map(s => (
          <View key={s.id} style={[styles.sessionItem, { borderColor: colors.border }]}>
            <Text style={[styles.xs, { color: colors.mutedForeground, fontWeight: "700", textTransform: "capitalize" }]}>{s.timeOfDay}</Text>
            <Text style={[styles.sm, { color: colors.foreground, fontWeight: "600" }]}>
              {s.activities.length + s.exercises.length} item(s) logged
            </Text>
          </View>
        ))
      )}
    </Card>
  );
}

// ─────────────────────────────────────────
// AMQS Score Card
// ─────────────────────────────────────────
function AmqsCard({ date }: { date: string }) {
  const colors = useColors();
  const { data: amqs } = useQuery<AmqsScore>({
    queryKey: ["amqs-score", date],
    queryFn: () => apiFetch(`/me/amqs/score/${date}`),
  });
  if (!amqs) return null;
  const pct = amqs.maxScore > 0 ? Math.round((amqs.score / amqs.maxScore) * 100) : 0;
  const scoreColor = pct >= 70 ? "#4ade80" : pct >= 40 ? "#facc15" : "#f87171";

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Micronutrient Score</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: scoreColor }}>{amqs.score}</Text>
      </View>
      <ProgressBar value={amqs.score} max={amqs.maxScore} color={scoreColor} />
      <View style={[styles.rowBetween, { marginTop: 4 }]}>
        <Text style={[styles.xs, { color: colors.mutedForeground }]}>{amqs.label}</Text>
        {amqs.gaps?.length > 0 && (
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>{amqs.gaps[0]} gap</Text>
        )}
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────
// Weight Trend
// ─────────────────────────────────────────
function WeightTrend({ date }: { date: string }) {
  const colors = useColors();
  const start = format(subWeeks(new Date(date + "T12:00:00"), 4), "yyyy-MM-dd");

  const { data: weights = [] } = useQuery<WeightEntry[]>({
    queryKey: ["weights-range", start, date],
    queryFn: () => apiFetch(`/me/weights/range?start=${start}&end=${date}`),
  });

  const last7 = [...weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).reverse();
  const minW = last7.length ? Math.min(...last7.map(w => w.weight)) : 0;
  const maxW = last7.length ? Math.max(...last7.map(w => w.weight)) : 1;
  const range = maxW - minW || 1;

  return (
    <Card>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Weight Trend</Text>
      <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 2 }]}>Last 7 recorded entries</Text>
      {last7.length < 2 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Record more weight data to see trends.
        </Text>
      ) : (
        <View style={{ marginTop: 10, gap: 6 }}>
          {last7.map(entry => {
            const barPct = ((entry.weight - minW) / range) * 0.7 + 0.1;
            return (
              <View key={entry.date} style={styles.wEntry}>
                <Text style={[styles.xs, { color: colors.mutedForeground, width: 46 }]}>
                  {format(new Date(entry.date + "T12:00:00"), "MMM d")}
                </Text>
                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <View style={[styles.wBar, { width: `${barPct * 100}%` as any, backgroundColor: colors.primary + "60" }]} />
                </View>
                <Text style={[styles.xs, { color: colors.foreground, fontWeight: "600", width: 52, textAlign: "right" }]}>
                  {entry.weight} kg
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────
// Meals Section
// ─────────────────────────────────────────
function MealsSection({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [mealType, setMealType] = useState<string>("breakfast");
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const { data: entries = [] } = useQuery<FoodEntry[]>({
    queryKey: ["food", date],
    queryFn: () => apiFetch(`/me/food/${date}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/food/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food", date] }),
  });

  const addMut = useMutation({
    mutationFn: (d: any) => apiFetch("/food", { method: "POST", body: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
      setModal(false);
      setName(""); setCal(""); setProtein(""); setCarbs(""); setFat(""); setSearchQ(""); setResults([]);
    },
  });

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return; }
    try {
      const r = await apiFetch<any[]>(`/foods/search?q=${encodeURIComponent(q)}`);
      setResults((r || []).slice(0, 8));
    } catch { setResults([]); }
  }, []);

  const grouped = MEAL_TYPES.map(mt => ({
    type: mt, items: entries.filter(e => e.meal === mt),
  })).filter(g => g.items.length > 0);

  const mealIcon: Record<string, any> = {
    breakfast: "coffee", lunch: "sun", dinner: "moon", snack: "package",
  };

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Today's Meals</Text>
        <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.primary }]} onPress={() => setModal(true)}>
          <Feather name="plus" size={13} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12, marginLeft: 4 }}>Add Food</Text>
        </TouchableOpacity>
      </View>

      {grouped.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No food logged for this date.</Text>
      ) : (
        grouped.map(g => (
          <View key={g.type} style={{ marginTop: 10 }}>
            <View style={styles.row}>
              <Feather name={mealIcon[g.type] ?? "utensils"} size={12} color={colors.mutedForeground} />
              <Text style={[styles.xs, { color: colors.mutedForeground, fontWeight: "700", marginLeft: 4, textTransform: "capitalize" }]}>{g.type}</Text>
            </View>
            {g.items.map(e => (
              <View key={e.id} style={[styles.foodRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sm, { color: colors.foreground, fontWeight: "600" }]} numberOfLines={1}>{e.name}</Text>
                  <Text style={[styles.xs, { color: colors.mutedForeground }]}>
                    {Math.round(e.calories)} kcal · P:{Math.round(e.protein)}g · C:{Math.round(e.carbs)}g · F:{Math.round(e.fat)}g
                  </Text>
                </View>
                <TouchableOpacity onPress={() => deleteMut.mutate(e.id)} style={{ padding: 4 }}>
                  <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
          <View style={[styles.rowBetween, { padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }]}>
            <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17 }}>Add Food</Text>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Feather name="x" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Meal type */}
            <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>MEAL TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {MEAL_TYPES.map(mt => (
                <TouchableOpacity key={mt} style={[styles.mealTypeChip, {
                  borderColor: mealType === mt ? "#ff7a00" : "#1a1e28",
                  backgroundColor: mealType === mt ? "rgba(255,122,0,0.1)" : "#181c26",
                }]} onPress={() => setMealType(mt)}>
                  <Text style={{ color: mealType === mt ? "#ff7a00" : "#6b7280", fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>{mt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>SEARCH FOOD DATABASE</Text>
            <View style={[styles.searchBar, { borderColor: "#1a1e28", backgroundColor: "#181c26" }]}>
              <Feather name="search" size={15} color="#6b7280" />
              <TextInput style={{ flex: 1, color: "#eceef2", fontSize: 14, marginLeft: 8 }}
                placeholder="Search..." placeholderTextColor="#6b7280"
                value={searchQ} onChangeText={t => { setSearchQ(t); doSearch(t); }} />
            </View>
            {results.map(item => (
              <TouchableOpacity key={item.id || item.name}
                style={[styles.searchResult, { borderColor: "#1a1e28" }]}
                onPress={() => addMut.mutate({
                  name: item.name,
                  calories: item.caloriesPer100g ?? item.calories ?? 0,
                  protein: item.proteinPer100g ?? item.protein ?? 0,
                  carbs: item.carbsPer100g ?? item.carbs ?? 0,
                  fat: item.fatPer100g ?? item.fat ?? 0,
                  fibre: item.fibre ?? item.fibrePer100g ?? 0,
                  grams: 100,
                  date,
                  meal: mealType,
                  sourceType: "off",
                  macroSource: "manual",
                  microSource: "none",
                })}>
                <Text style={{ color: "#eceef2", fontWeight: "600", fontSize: 14 }}>{item.name}</Text>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>{item.caloriesPer100g ?? item.calories ?? 0} kcal / 100g</Text>
              </TouchableOpacity>
            ))}

            <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>MANUAL ENTRY</Text>
            {[
              { label: "Name", val: name, set: setName, kb: "default" },
              { label: "Calories (kcal)", val: cal, set: setCal, kb: "decimal-pad" },
              { label: "Protein (g)", val: protein, set: setProtein, kb: "decimal-pad" },
              { label: "Carbs (g)", val: carbs, set: setCarbs, kb: "decimal-pad" },
              { label: "Fat (g)", val: fat, set: setFat, kb: "decimal-pad" },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>{f.label}</Text>
                <TextInput style={[styles.input, { borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26" }]}
                  placeholder={f.label} placeholderTextColor="#6b7280"
                  keyboardType={f.kb as any} value={f.val} onChangeText={f.set} />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.fullBtn, { backgroundColor: "#ff7a00", opacity: name && cal ? 1 : 0.4, marginTop: 8 }]}
              disabled={!name || !cal || addMut.isPending}
              onPress={() => addMut.mutate({
                name,
                calories: parseFloat(cal) || 0,
                protein: parseFloat(protein) || 0,
                carbs: parseFloat(carbs) || 0,
                fat: parseFloat(fat) || 0,
                fibre: 0,
                grams: 100,
                date,
                meal: mealType,
                sourceType: "manual",
                macroSource: "manual",
                microSource: "none",
              })}>
              {addMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Add Food</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Card>
  );
}

// ─────────────────────────────────────────
// Current Weight Card
// ─────────────────────────────────────────
function CurrentWeightCard({ date }: { date: string }) {
  const colors = useColors();
  const { data: morning } = useQuery<MorningStatus>({
    queryKey: ["morning-status", date],
    queryFn: () => apiFetch(`/me/morning-status/${date}`),
  });

  return (
    <Card>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Current Weight</Text>
      {morning?.weightLog ? (
        <Text style={[styles.heroNum, { color: colors.foreground }]}>
          {morning.weightLog.weight}
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}> kg</Text>
        </Text>
      ) : (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No weight recorded today.</Text>
      )}
      <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 6 }]}>
        Weight naturally fluctuates day to day. Track trends over time for accurate insights.
      </Text>
    </Card>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function DashboardScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [updateWeightModal, setUpdateWeightModal] = useState(false);
  const [weightVal, setWeightVal] = useState("");

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");
  const displayDate = format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy");

  const { data: foodEntries = [] } = useQuery<FoodEntry[]>({
    queryKey: ["food", selectedDate],
    queryFn: () => apiFetch(`/me/food/${selectedDate}`),
  });
  const { data: targets } = useQuery<Targets>({
    queryKey: ["targets", selectedDate],
    queryFn: () => apiFetch(`/me/targets/effective?date=${selectedDate}`),
  });

  const weightMut = useMutation({
    mutationFn: (w: number) => apiFetch("/weights", { method: "POST", body: { date: selectedDate, weight: w } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", selectedDate] });
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      qc.invalidateQueries({ queryKey: ["weights-range"] });
      setUpdateWeightModal(false); setWeightVal("");
    },
  });

  const totals = foodEntries.reduce(
    (acc, e) => ({ calories: acc.calories + (e.calories || 0), protein: acc.protein + (e.protein || 0), carbs: acc.carbs + (e.carbs || 0), fat: acc.fat + (e.fat || 0), fibre: acc.fibre + (e.fibre || 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }
  );
  const t = targets || { targetCalories: 2000, targetProtein: 150, targetCarbs: 200, targetFat: 70, adjustedCalories: 2000, trainingCaloriesEarned: 0 };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.logo, { color: colors.primary }]}>PRFMR</Text>
        <Text style={[styles.xs, { color: colors.mutedForeground }]}>{format(new Date(), "EEE, d MMM yyyy")}</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Fight Camp Hero */}
        {isToday && <FightCampHero date={selectedDate} />}

        {/* Morning Check-In */}
        {isToday && <MorningCheckIn date={selectedDate} />}

        {/* Provisional Check-In */}
        {isToday && <ProvisionalCheckIn date={selectedDate} />}

        {/* Daily Intake Estimates */}
        <DailyIntakeCard date={selectedDate} />

        {/* Date Navigation */}
        <View style={[styles.dateNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.dateNavBtn}
            onPress={() => setSelectedDate(format(subDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.dateNavText, { color: colors.foreground }]}>{displayDate}</Text>
          <TouchableOpacity style={styles.dateNavBtn}
            onPress={() => setSelectedDate(format(addDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setUpdateWeightModal(true)}>
            <Feather name="activity" size={14} color={colors.primary} />
            <Text style={[styles.xs, { color: colors.foreground, fontWeight: "600", marginLeft: 5 }]}>Update Weight</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="plus-circle" size={14} color={colors.primary} />
            <Text style={[styles.xs, { color: colors.foreground, fontWeight: "600", marginLeft: 5 }]}>Quick Log</Text>
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View>
          <Text style={[styles.greeting, { color: colors.foreground }]}>Hello, {user?.username ?? "there"}</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>Here is your daily nutrition summary</Text>
        </View>

        {/* Macro Cards */}
        <View style={styles.macroGrid}>
          <MacroCard label="Calories" value={totals.calories} unit=" kcal" target={t.adjustedCalories || t.targetCalories} color={colors.primary} emoji="🔥" />
          <MacroCard label="Protein" value={totals.protein} unit="g" target={t.targetProtein} color="#93c5fd" emoji="🥩" />
          <MacroCard label="Carbs" value={totals.carbs} unit="g" target={t.targetCarbs} color="#f59e0b" emoji="🌾" />
          <MacroCard label="Fat" value={totals.fat} unit="g" target={t.targetFat} color="#facc15" emoji="🥑" />
          <MacroCard label="Fibre" value={totals.fibre} unit="g" target={30} color="#4ade80" emoji="🥦" />
        </View>

        {/* AMQS */}
        <AmqsCard date={selectedDate} />

        {/* Supplements Today */}
        <SupplementsToday date={selectedDate} />

        {/* Training Today */}
        <TrainingToday date={selectedDate} />

        {/* Weight Trend */}
        <WeightTrend date={selectedDate} />

        {/* Meals */}
        <MealsSection date={selectedDate} />

        {/* Current Weight */}
        <CurrentWeightCard date={selectedDate} />

        {/* Feedback Card */}
        <Card style={{ borderColor: "rgba(255,122,0,0.2)", backgroundColor: "rgba(255,122,0,0.04)" }}>
          <View style={styles.row}>
            <Feather name="message-square" size={15} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground, marginLeft: 8 }]}>Beta Feedback</Text>
          </View>
          <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 6 }]}>
            Found a bug or have a suggestion? We'd love to hear from you — tap Feedback in the tab bar.
          </Text>
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Update Weight Modal */}
      <Modal visible={updateWeightModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setUpdateWeightModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117", padding: 20 }}>
          <View style={[styles.rowBetween, { marginBottom: 16 }]}>
            <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 18 }}>Update Weight</Text>
            <TouchableOpacity onPress={() => setUpdateWeightModal(false)}>
              <Feather name="x" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26", marginBottom: 12 }]}
            placeholder="Weight in kg (e.g. 72.5)" placeholderTextColor="#6b7280"
            keyboardType="decimal-pad" value={weightVal} onChangeText={setWeightVal} autoFocus />
          <TouchableOpacity style={[styles.fullBtn, { backgroundColor: "#ff7a00", opacity: weightVal ? 1 : 0.4 }]}
            disabled={!weightVal || weightMut.isPending}
            onPress={() => { const w = parseFloat(weightVal); if (!isNaN(w) && w > 0) weightMut.mutate(w); }}>
            {weightMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Save</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  logo: { fontSize: 18, fontWeight: "900", letterSpacing: 3 },
  scrollPad: { padding: 12, gap: 10 },
  card: { borderRadius: 9, borderWidth: 1, padding: 14 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  empty: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  heroNum: { fontSize: 34, fontWeight: "900", marginVertical: 6 },
  heroSub: { fontSize: 16, fontWeight: "500" },
  weightRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, padding: 10, marginVertical: 8, justifyContent: "space-around" },
  weightNum: { fontSize: 22, fontWeight: "800" },
  thisWeek: { borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 8 },
  logWeightRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 6, gap: 10 },
  checkIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  expandBox: { borderRadius: 8, borderWidth: 1, padding: 12, marginTop: 6 },
  qBtn: { alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, paddingVertical: 8 },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 14 },
  btnSm: { flexDirection: "row", alignItems: "center", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 8 },
  ciRow: { flexDirection: "row", gap: 6 },
  ciBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 10, gap: 3 },
  fullBtn: { borderRadius: 9, padding: 14, alignItems: "center" },
  macroRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  macroCard: { width: "47.5%", padding: 12 },
  macroEmoji: { fontSize: 15, marginRight: 4 },
  macroLabel: { fontSize: 11, fontWeight: "600" },
  macroValue: { fontSize: 22, fontWeight: "800", marginVertical: 6 },
  macroUnit: { fontSize: 13 },
  macroMeta: { fontSize: 11, marginTop: 4 },
  progressBg: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  suppRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 6, gap: 10 },
  suppCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  sessionItem: { borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 6 },
  wEntry: { flexDirection: "row", alignItems: "center" },
  wBar: { height: 6, borderRadius: 3 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 9, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 4 },
  dateNavBtn: { padding: 8 },
  dateNavText: { fontSize: 15, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, padding: 11 },
  greeting: { fontSize: 20, fontWeight: "800", marginTop: 2 },
  foodRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, padding: 10, marginTop: 4, gap: 8 },
  mealTypeChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, padding: 10, marginBottom: 8 },
  searchResult: { borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 6 },
});
