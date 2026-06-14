import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert, FlatList, Image, Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, subWeeks } from "date-fns";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useRouter } from "expo-router";
import Svg, { Polyline, Circle as SvgCircle, Line as SvgLine, Text as SvgText } from "react-native-svg";
import { INGREDIENTS_DATA } from "../../lib/ingredients-data";

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

type TabId = "search" | "wholefood" | "barcode" | "custom";

interface NormalizedFood {
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
  sourceType: "off" | "database" | "manual" | "ingredient";
  defaultGrams?: number;
  imageUrl?: string;
}

const MODAL_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "search", label: "Search", icon: "search" },
  { id: "wholefood", label: "Whole Food", icon: "box" },
  { id: "barcode", label: "Barcode", icon: "maximize" },
  { id: "custom", label: "Custom", icon: "edit-2" },
];

const CORE_FOODS: NormalizedFood[] = INGREDIENTS_DATA;

const WHOLE_FOODS_IDX = CORE_FOODS;

function normalizeFood(item: any, sourceType: "off" | "database" | "manual"): NormalizedFood {
  return {
    name: item.name ?? item.product_name ?? "Unknown",
    brand: item.brand ?? item.brands ?? undefined,
    caloriesPer100g: item.caloriesPer100g ?? item.calories ?? item.nutriments?.["energy-kcal_100g"] ?? 0,
    proteinPer100g: item.proteinPer100g ?? item.protein ?? item.nutriments?.proteins_100g ?? 0,
    carbsPer100g: item.carbsPer100g ?? item.carbs ?? item.nutriments?.carbohydrates_100g ?? 0,
    fatPer100g: item.fatPer100g ?? item.fat ?? item.nutriments?.fat_100g ?? 0,
    fibrePer100g: item.fibrePer100g ?? item.fibre ?? item.nutriments?.fiber_100g ?? item.nutriments?.fibre_100g ?? 0,
    sourceType,
  };
}

function rd1(n: number) { return Math.round(n * 10) / 10; }

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
  const [showPlan, setShowPlan] = useState(false);

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
      {/* Plan Breakdown Modal */}
      <Modal visible={showPlan} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPlan(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
            <Text style={{ color: "#eceef2", fontSize: 18, fontWeight: "700" }}>Fight Camp Plan</Text>
            <TouchableOpacity onPress={() => setShowPlan(false)}><Feather name="x" size={24} color="#6b7280" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View style={{ backgroundColor: "#13161d", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#1a1e28" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>Current</Text>
                <Text style={{ color: "#eceef2", fontWeight: "700" }}>{plan.currentWeight} kg</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>Target</Text>
                <Text style={{ color: "#ff7a00", fontWeight: "700" }}>{plan.targetWeight} kg</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>To lose</Text>
                <Text style={{ color: "#eceef2", fontWeight: "700" }}>{plan.totalToLose.toFixed(1)} kg</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>Weekly fat-loss rate</Text>
                <Text style={{ color: "#eceef2", fontWeight: "700" }}>{plan.weeklyRate.toFixed(2)} kg/wk ({(plan.weeklyRatePct).toFixed(1)}%)</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>Pace</Text>
                <Text style={{ color: pace.color, fontWeight: "700" }}>{pace.label}</Text>
              </View>
              {plan.suggestedDeficitKcal > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>Daily deficit</Text>
                  <Text style={{ color: "#eceef2", fontWeight: "700" }}>~{Math.round(plan.suggestedDeficitKcal)} kcal</Text>
                </View>
              )}
            </View>
            {plan.weeklyTargets?.length > 0 && (
              <View style={{ backgroundColor: "#13161d", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#1a1e28" }}>
                <Text style={{ color: "#6b7280", fontWeight: "700", fontSize: 11, letterSpacing: 0.5, marginBottom: 10 }}>WEEKLY WEIGHT TARGETS</Text>
                {plan.weeklyTargets.map((wt: { week: number; targetWeight: number }) => (
                  <View key={wt.week} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: "#6b7280", fontSize: 13 }}>Week {wt.week}</Text>
                    <Text style={{ color: "#eceef2", fontWeight: "600", fontSize: 13 }}>{wt.targetWeight.toFixed(1)} kg</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Feather name="target" size={13} color={colors.primary} />
          <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 4 }]}>Fight Camp</Text>
        </View>
        <TouchableOpacity onPress={() => setShowPlan(true)} activeOpacity={0.7}>
          <SmallBadge label={pace.label + " ›"} color={pace.color} bg={pace.color + "1a"} />
        </TouchableOpacity>
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
  const router = useRouter();
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
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/training" as any)}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => restMut.mutate(!status.isRestDay)}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700" }}>
                {status.isRestDay ? "Unmark" : "Rest"}
              </Text>
            </TouchableOpacity>
          </View>
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
  const router = useRouter();
  const displayDate = format(new Date(date + "T12:00:00"), "MMM d");
  const { data: sessions = [] } = useQuery<WorkoutSession[]>({
    queryKey: ["sessions", date],
    queryFn: () => apiFetch(`/workouts/sessions?start=${date}&end=${date}`),
  });

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Training — {displayDate}</Text>
        <TouchableOpacity
          style={[styles.btnSm, { backgroundColor: colors.primary, flexDirection: "row", alignItems: "center" }]}
          onPress={() => router.push("/(tabs)/training" as any)}>
          <Feather name="plus" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginLeft: 3 }}>Log Session</Text>
        </TouchableOpacity>
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
function AmqsBreakdownModal({ date, score, maxScore, label, gaps, visible, onClose }: {
  date: string; score: number; maxScore: number; label: string; gaps: string[];
  visible: boolean; onClose: () => void;
}) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const scoreColor = pct >= 70 ? "#4ade80" : pct >= 40 ? "#facc15" : "#f87171";
  const { data: micros, isLoading } = useQuery<any>({
    queryKey: ["amqs-micros", date],
    queryFn: () => apiFetch(`/me/amqs/micros/${date}`),
    enabled: visible,
    retry: false,
  });
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
          <Text style={{ color: "#eceef2", fontSize: 18, fontWeight: "700" }}>Micronutrient Score</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={{ alignItems: "center", padding: 24, backgroundColor: "#13161d",
            borderRadius: 16, borderWidth: 1, borderColor: "#1a1e28" }}>
            <Text style={{ color: scoreColor, fontSize: 56, fontWeight: "900" }}>{score}</Text>
            <Text style={{ color: "#6b7280", fontSize: 13 }}>of {maxScore} points · {pct}%</Text>
            <View style={{ height: 8, backgroundColor: "#1a1e28", borderRadius: 4, width: "100%", marginTop: 12 }}>
              <View style={{ width: `${pct}%` as any, height: 8, backgroundColor: scoreColor, borderRadius: 4 }} />
            </View>
            <Text style={{ color: scoreColor, fontWeight: "700", fontSize: 14, marginTop: 8 }}>{label}</Text>
          </View>
          {gaps?.length > 0 && (
            <View style={{ backgroundColor: "#13161d", borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: "rgba(251,146,60,0.25)" }}>
              <Text style={{ color: "#fb923c", fontWeight: "700", fontSize: 11, letterSpacing: 0.5, marginBottom: 10 }}>NUTRIENT GAPS</Text>
              {gaps.map(g => (
                <View key={g} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                  <Feather name="alert-circle" size={13} color="#fb923c" />
                  <Text style={{ color: "#eceef2", fontSize: 13, marginLeft: 8 }}>{g}</Text>
                </View>
              ))}
            </View>
          )}
          {isLoading ? (
            <ActivityIndicator color="#ff7a00" style={{ padding: 16 }} />
          ) : micros?.nutrients ? (
            <View style={{ backgroundColor: "#13161d", borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: "#1a1e28" }}>
              <Text style={{ color: "#6b7280", fontWeight: "700", fontSize: 11, letterSpacing: 0.5, marginBottom: 10 }}>NUTRIENT COVERAGE</Text>
              {Object.entries(micros.nutrients as Record<string, { coverage: number; label?: string }>).map(([key, val]) => {
                const p = Math.min(Math.round((val.coverage ?? 0) * 100), 100);
                const c = val.coverage ?? 0;
                const bc = c >= 0.8 ? "#4ade80" : c >= 0.4 ? "#facc15" : "#f87171";
                return (
                  <View key={key} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                      <Text style={{ color: "#eceef2", fontSize: 12 }}>{val.label ?? key}</Text>
                      <Text style={{ color: bc, fontSize: 12, fontWeight: "700" }}>{p}%</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: "#1a1e28", borderRadius: 2 }}>
                      <View style={{ width: `${p}%` as any, height: 4, backgroundColor: bc, borderRadius: 2 }} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: "#6b7280", textAlign: "center", fontSize: 13, padding: 16 }}>
              Log food and supplements to see your full nutrient breakdown.
            </Text>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function AmqsCard({ date }: { date: string }) {
  const colors = useColors();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { data: amqs } = useQuery<AmqsScore>({
    queryKey: ["amqs-score", date],
    queryFn: () => apiFetch(`/me/amqs/score/${date}`),
  });
  if (!amqs) return null;
  const pct = amqs.maxScore > 0 ? Math.round((amqs.score / amqs.maxScore) * 100) : 0;
  const scoreColor = pct >= 70 ? "#4ade80" : pct >= 40 ? "#facc15" : "#f87171";

  return (
    <>
      <AmqsBreakdownModal date={date} score={amqs.score} maxScore={amqs.maxScore}
        label={amqs.label} gaps={amqs.gaps ?? []}
        visible={showBreakdown} onClose={() => setShowBreakdown(false)} />
      <TouchableOpacity onPress={() => setShowBreakdown(true)} activeOpacity={0.8}>
        <Card>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Micronutrient Score</Text>
            <View style={styles.row}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: scoreColor }}>{amqs.score}</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
            </View>
          </View>
          <ProgressBar value={amqs.score} max={amqs.maxScore} color={scoreColor} />
          <View style={[styles.rowBetween, { marginTop: 4 }]}>
            <Text style={[styles.xs, { color: colors.mutedForeground }]}>{amqs.label}</Text>
            {amqs.gaps?.length > 0 && (
              <Text style={[styles.xs, { color: "#fb923c" }]}>{amqs.gaps[0]} gap</Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    </>
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
  const rng = (maxW - minW) || 1;

  const SVG_W = 300, SVG_H = 130;
  const PAD = { t: 10, r: 10, b: 28, l: 42 };
  const cW = SVG_W - PAD.l - PAD.r;
  const cH = SVG_H - PAD.t - PAD.b;

  function xOf(i: number) {
    return PAD.l + (last7.length < 2 ? cW / 2 : (i / (last7.length - 1)) * cW);
  }
  function yOf(w: number) {
    return PAD.t + cH - ((w - minW) / rng) * cH;
  }

  const pts = last7.map((e, i) => `${xOf(i)},${yOf(e.weight)}`).join(" ");

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Weight Trend</Text>
        <Text style={[styles.xs, { color: colors.mutedForeground }]}>Last 7 recorded</Text>
      </View>
      {last7.length < 2 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Record more weight data to see trends.
        </Text>
      ) : (
        <Svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ marginTop: 8 }}>
          {[0, 0.5, 1].map(pct => {
            const y = PAD.t + pct * cH;
            const val = (maxW - pct * rng).toFixed(1);
            return (
              <React.Fragment key={String(pct)}>
                <SvgLine x1={PAD.l} y1={y} x2={SVG_W - PAD.r} y2={y}
                  stroke="#1a1e28" strokeWidth={1} strokeDasharray="3,3" />
                <SvgText x={PAD.l - 5} y={y + 4} fontSize={9} fill="#6b7280" textAnchor="end">{val}</SvgText>
              </React.Fragment>
            );
          })}
          {last7.map((e, i) => (
            (i === 0 || i === Math.floor(last7.length / 2) || i === last7.length - 1) ? (
              <SvgText key={e.date} x={xOf(i)} y={SVG_H - 4} fontSize={9} fill="#6b7280" textAnchor="middle">
                {format(new Date(e.date + "T12:00:00"), "dd/M")}
              </SvgText>
            ) : null
          ))}
          <Polyline points={pts} fill="none" stroke="#ff7a00" strokeWidth={2.5}
            strokeLinejoin="round" strokeLinecap="round" />
          {last7.map((e, i) => (
            <SvgCircle key={e.date} cx={xOf(i)} cy={yOf(e.weight)} r={3.5}
              fill="#ff7a00" stroke="#0f1117" strokeWidth={1.5} />
          ))}
          <SvgCircle cx={xOf(last7.length - 1)} cy={yOf(last7[last7.length - 1].weight)} r={5}
            fill="#ff7a00" stroke="#0f1117" strokeWidth={2} />
        </Svg>
      )}
      {last7.length >= 2 && (
        <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 4, textAlign: "right" }]}>
          {last7[last7.length - 1].weight} kg today
        </Text>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────
// Meals Section — sub-components
// ─────────────────────────────────────────
function MealConfirmView({ food, grams, onGramsChange, onConfirm, onBack, isPending }: {
  food: NormalizedFood; grams: string; onGramsChange: (g: string) => void;
  onConfirm: () => void; onBack: () => void; isPending: boolean;
}) {
  const g = parseFloat(grams) || 100;
  const r = g / 100;
  const cal = Math.round(food.caloriesPer100g * r);
  const prot = rd1(food.proteinPer100g * r);
  const carbs = rd1(food.carbsPer100g * r);
  const fat = rd1(food.fatPer100g * r);
  const fibre = rd1(food.fibrePer100g * r);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: "#eceef2", fontSize: 20, fontWeight: "700" }}>{food.name}</Text>
      {food.brand ? <Text style={{ color: "#6b7280" }}>{food.brand}</Text> : null}
      <Text style={{ color: "#6b7280", fontSize: 13, fontWeight: "700", marginTop: 8 }}>SERVING SIZE (grams)</Text>
      <TextInput
        style={{ height: 52, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
          backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 22, textAlign: "center", color: "#eceef2" }}
        value={grams} onChangeText={onGramsChange} keyboardType="numeric" selectTextOnFocus
      />
      <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: "#13161d",
        borderRadius: 12, borderWidth: 1, borderColor: "#1a1e28", padding: 16 }}>
        {[
          { l: "Calories", v: cal, u: "kcal" },
          { l: "Protein", v: prot, u: "g" },
          { l: "Carbs", v: carbs, u: "g" },
          { l: "Fat", v: fat, u: "g" },
          { l: "Fibre", v: fibre, u: "g" },
        ].map(s => (
          <View key={s.l} style={{ alignItems: "center" }}>
            <Text style={{ color: "#eceef2", fontSize: 18, fontWeight: "800" }}>{s.v}</Text>
            <Text style={{ color: "#6b7280", fontSize: 10 }}>{s.u}</Text>
            <Text style={{ color: "#6b7280", fontSize: 9 }}>{s.l}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={onConfirm} disabled={isPending}
        style={{ backgroundColor: "#ff7a00", height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
        {isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Food</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ alignItems: "center", padding: 12 }}>
        <Text style={{ color: "#6b7280" }}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function MealSearchTab({ query, onQueryChange, results, searching, onSelect }: {
  query: string; onQueryChange: (q: string) => void; results: any[];
  searching: boolean; onSelect: (item: any) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginVertical: 10,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
        backgroundColor: "#181c26", borderColor: "#1a1e28" }}>
        <Feather name="search" size={18} color="#6b7280" />
        <TextInput style={{ flex: 1, color: "#eceef2", fontSize: 15, marginLeft: 8 }}
          placeholder="Search foods..." placeholderTextColor="#6b7280"
          value={query} onChangeText={onQueryChange} autoFocus />
        {searching && <ActivityIndicator size="small" color="#ff7a00" />}
      </View>
      <FlatList
        data={results}
        keyExtractor={(_, i) => String(i)}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.length > 1 && !searching
            ? <Text style={{ color: "#6b7280", textAlign: "center", padding: 32 }}>No results</Text>
            : query.length < 2
            ? <Text style={{ color: "#6b7280", textAlign: "center", padding: 32, fontSize: 13 }}>Type to search the food database</Text>
            : null
        }
        renderItem={({ item }) => {
          const name = item.name ?? item.product_name ?? "Unknown";
          const brand = item.brand ?? item.brands ?? "";
          const cal = Math.round(item.caloriesPer100g ?? item.calories ?? 0);
          const prot = Math.round(item.proteinPer100g ?? item.protein ?? 0);
          const carbs = Math.round(item.carbsPer100g ?? item.carbs ?? 0);
          const fat = Math.round(item.fatPer100g ?? item.fat ?? 0);
          const img = item.image ?? item.imageUrl ?? item.image_url ?? item.image_front_thumb_url ?? null;
          return (
            <TouchableOpacity onPress={() => onSelect(item)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
              {img ? (
                <Image source={{ uri: img }} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "#1a1e28" }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "#1a1e28", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="package" size={18} color="#6b7280" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#eceef2", fontWeight: "600" }} numberOfLines={1}>{name}</Text>
                {brand ? <Text style={{ color: "#6b7280", fontSize: 12 }}>{brand}</Text> : null}
                <Text style={{ color: "#6b7280", fontSize: 11 }}>P{prot} C{carbs} F{fat} per 100g</Text>
              </View>
              <Text style={{ color: "#ff7a00", fontWeight: "700" }}>{cal}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function MealCustomTab({ name, setName, grams, setGrams, cal, setCal, protein, setProtein,
  carbs, setCarbs, fat, setFat, fibre, setFibre, onAdd, isPending }: {
  name: string; setName: (v: string) => void;
  grams: string; setGrams: (v: string) => void;
  cal: string; setCal: (v: string) => void;
  protein: string; setProtein: (v: string) => void;
  carbs: string; setCarbs: (v: string) => void;
  fat: string; setFat: (v: string) => void;
  fibre: string; setFibre: (v: string) => void;
  onAdd: () => void; isPending: boolean;
}) {
  const canAdd = name.trim().length > 0 && (parseFloat(cal) || 0) >= 0 && (parseFloat(grams) || 0) > 0;
  const fields = [
    { label: "Calories (kcal) *", val: cal, set: setCal },
    { label: "Protein (g)", val: protein, set: setProtein },
    { label: "Carbs (g)", val: carbs, set: setCarbs },
    { label: "Fat (g)", val: fat, set: setFat },
    { label: "Fibre (g)", val: fibre, set: setFibre },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 4, fontWeight: "600" }}>FOOD NAME *</Text>
        <TextInput
          style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
            backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 15, color: "#eceef2" }}
          placeholder="e.g. Chicken breast" placeholderTextColor="#6b7280"
          value={name} onChangeText={setName}
        />
      </View>
      <View>
        <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 4, fontWeight: "600" }}>GRAMS *</Text>
        <TextInput
          style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
            backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 15, color: "#eceef2" }}
          placeholder="100" placeholderTextColor="#6b7280"
          value={grams} onChangeText={setGrams} keyboardType="decimal-pad"
        />
      </View>
      {fields.map(f => (
        <View key={f.label}>
          <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 4, fontWeight: "600" }}>{f.label.toUpperCase()}</Text>
          <TextInput
            style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
              backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 15, color: "#eceef2" }}
            placeholder="0" placeholderTextColor="#6b7280"
            value={f.val} onChangeText={f.set} keyboardType="decimal-pad"
          />
        </View>
      ))}
      <TouchableOpacity onPress={onAdd} disabled={!canAdd || isPending}
        style={{ height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4,
          backgroundColor: canAdd ? "#ff7a00" : "#181c26" }}>
        {isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: canAdd ? "#fff" : "#6b7280", fontWeight: "700", fontSize: 16 }}>Add Food</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────
// Meals Section
// ─────────────────────────────────────────
function MealsSection({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [modal, setModal] = useState(false);
  const [mealType, setMealType] = useState<string>("breakfast");
  const [activeTab, setActiveTab] = useState<TabId>("search");
  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);
  const [grams, setGrams] = useState("100");

  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [barcodeCode, setBarcodeCode] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const [cameraScanned, setCameraScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [customName, setCustomName] = useState("");
  const [customGrams, setCustomGrams] = useState("100");
  const [customCal, setCustomCal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customFibre, setCustomFibre] = useState("0");
  const [wholeSearch, setWholeSearch] = useState("");

  const { data: entries = [] } = useQuery<FoodEntry[]>({
    queryKey: ["food", date],
    queryFn: () => apiFetch(`/me/food/${date}`),
  });

  function closeModal() {
    setModal(false);
    setSelectedFood(null);
    setSearchQ(""); setResults([]); setGrams("100");
    setBarcodeCode(""); setBarcodeError(""); setCameraScanned(false);
    setCustomName(""); setCustomGrams("100"); setCustomCal("");
    setCustomProtein(""); setCustomCarbs(""); setCustomFat(""); setCustomFibre("0");
    setWholeSearch("");
  }

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/food/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food", date] }),
  });

  const addMut = useMutation({
    mutationFn: (d: any) => apiFetch("/food", { method: "POST", body: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
      closeModal();
    },
    onError: (err: any) => {
      Alert.alert("Could not add food", err?.message ?? "Unknown error");
    },
  });

  const doSearch = useCallback(async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await apiFetch<any[]>(`/foods/search?q=${encodeURIComponent(q.trim())}`);
      setResults(Array.isArray(r) ? r.slice(0, 20) : []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  async function lookupBarcode(overrideCode?: string) {
    const code = (overrideCode ?? barcodeCode).trim();
    if (!code) return;
    setBarcodeLoading(true); setBarcodeError("");
    try {
      const result = await apiFetch<any>(`/food/barcode/${code}`);
      if (!result || (!result.name && !result.product_name)) {
        setBarcodeError("No food found for this barcode.");
        setCameraScanned(false);
      } else {
        setSelectedFood(normalizeFood(result, "off"));
        setGrams("100");
      }
    } catch (err: any) {
      setBarcodeError(err?.message ?? "Barcode lookup failed");
      setCameraScanned(false);
    } finally {
      setBarcodeLoading(false);
    }
  }

  function handleBarcodeScanned({ data }: { data: string }) {
    if (cameraScanned || barcodeLoading) return;
    setCameraScanned(true);
    setBarcodeCode(data);
    lookupBarcode(data);
  }

  function buildPayload(food: NormalizedFood, gramsStr: string) {
    const g = parseFloat(gramsStr) || 100;
    const r = g / 100;
    const isOff = food.sourceType === "off" || food.sourceType === "database";
    const apiSourceType = isOff ? "off" : food.sourceType === "ingredient" ? "ingredient" : "manual";
    const isRaw = /\(raw\)/i.test(food.name);
    const snackIdx = mealType === "snack" ? entries.filter((e: any) => e.meal === "snack").length : undefined;
    return {
      userId: user!.id,
      name: food.name,
      calories: Math.round(food.caloriesPer100g * r),
      protein: Math.round(food.proteinPer100g * r),
      carbs: Math.round(food.carbsPer100g * r),
      fat: Math.round(food.fatPer100g * r),
      fibre: Math.round(food.fibrePer100g * r),
      grams: Math.round(g),
      meal: mealType,
      date,
      sourceType: apiSourceType,
      macroSource: isOff ? "off" : "ingredient",
      microSource: "none",
      enteredBasis: isRaw ? "raw" : "cooked",
      ...(snackIdx !== undefined && { snackIndex: snackIdx }),
    };
  }

  function addCustom() {
    const snackIdx = mealType === "snack" ? entries.filter((e: any) => e.meal === "snack").length : undefined;
    addMut.mutate({
      userId: user!.id,
      name: customName.trim(),
      calories: Math.round(parseFloat(customCal) || 0),
      protein: Math.round(parseFloat(customProtein) || 0),
      carbs: Math.round(parseFloat(customCarbs) || 0),
      fat: Math.round(parseFloat(customFat) || 0),
      fibre: Math.round(parseFloat(customFibre) || 0),
      grams: Math.round(parseFloat(customGrams) || 100),
      meal: mealType,
      date,
      sourceType: "manual",
      macroSource: "ingredient",
      microSource: "none",
      enteredBasis: "cooked",
      ...(snackIdx !== undefined && { snackIndex: snackIdx }),
    });
  }

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

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
            <Text style={{ color: "#eceef2", fontSize: 18, fontWeight: "700" }}>Add Food</Text>
            <TouchableOpacity onPress={closeModal}><Feather name="x" size={24} color="#6b7280" /></TouchableOpacity>
          </View>

          {/* Meal type pills */}
          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>
            {MEAL_TYPES.map(mt => (
              <TouchableOpacity key={mt} onPress={() => setMealType(mt)}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center",
                  backgroundColor: mealType === mt ? "#ff7a00" : "#181c26" }}>
                <Text style={{ color: mealType === mt ? "#fff" : "#6b7280", fontSize: 10, fontWeight: "700", textTransform: "capitalize" }}>{mt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab bar */}
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
            {MODAL_TABS.map(tab => (
              <TouchableOpacity key={tab.id} onPress={() => { setActiveTab(tab.id); setSelectedFood(null); }}
                style={{ flex: 1, paddingVertical: 10, alignItems: "center", gap: 2,
                  borderBottomWidth: 2, borderBottomColor: activeTab === tab.id ? "#ff7a00" : "transparent" }}>
                <Feather name={tab.icon as any} size={14} color={activeTab === tab.id ? "#ff7a00" : "#6b7280"} />
                <Text style={{ color: activeTab === tab.id ? "#ff7a00" : "#6b7280", fontSize: 10, fontWeight: "700" }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          {selectedFood ? (
            <MealConfirmView
              food={selectedFood} grams={grams} onGramsChange={setGrams}
              onConfirm={() => addMut.mutate(buildPayload(selectedFood, grams))}
              onBack={() => setSelectedFood(null)}
              isPending={addMut.isPending}
            />
          ) : (
            <View style={{ flex: 1 }}>
              {activeTab === "search" && (
                <MealSearchTab query={searchQ} onQueryChange={doSearch} results={results}
                  searching={searching}
                  onSelect={item => { setSelectedFood(normalizeFood(item, "off")); setGrams("100"); }} />
              )}
              {activeTab === "wholefood" && (
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", margin: 12, marginBottom: 6,
                    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
                    backgroundColor: "#181c26", borderColor: "#1a1e28" }}>
                    <Feather name="search" size={15} color="#6b7280" />
                    <TextInput style={{ flex: 1, color: "#eceef2", fontSize: 14, marginLeft: 8 }}
                      placeholder="Filter foods…" placeholderTextColor="#6b7280"
                      value={wholeSearch} onChangeText={setWholeSearch} />
                    {wholeSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setWholeSearch("")}>
                        <Feather name="x" size={14} color="#6b7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    data={CORE_FOODS.filter(f =>
                      wholeSearch.length < 1 || f.name.toLowerCase().includes(wholeSearch.toLowerCase())
                    )}
                    keyExtractor={item => item.name}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: 12, paddingTop: 4, gap: 6 }}
                    ListEmptyComponent={
                      <Text style={{ color: "#6b7280", textAlign: "center", padding: 24 }}>No match found</Text>
                    }
                    renderItem={({ item: wf }) => {
                      const serving = wf.defaultGrams ?? 100;
                      const r = serving / 100;
                      const servingCal = Math.round(wf.caloriesPer100g * r);
                      return (
                        <TouchableOpacity key={wf.name}
                          onPress={() => { setSelectedFood(wf); setGrams(String(serving)); }}
                          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
                            backgroundColor: "#13161d", borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: "#eceef2", fontWeight: "600", fontSize: 14 }}>{wf.name}</Text>
                            <Text style={{ color: "#6b7280", fontSize: 11 }}>
                              P{rd1(wf.proteinPer100g * r)}g · C{rd1(wf.carbsPer100g * r)}g · F{rd1(wf.fatPer100g * r)}g per {serving}g serving
                            </Text>
                          </View>
                          <Text style={{ color: "#ff7a00", fontWeight: "700", marginRight: 4 }}>{servingCal}</Text>
                          <Text style={{ color: "#6b7280", fontSize: 11 }}>kcal</Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              )}
              {activeTab === "barcode" && (
                <View style={{ flex: 1 }}>
                  {!cameraPermission ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
                      <ActivityIndicator color="#ff7a00" />
                    </View>
                  ) : !cameraPermission.granted ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
                      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#ff7a0022", alignItems: "center", justifyContent: "center" }}>
                        <Feather name="camera" size={32} color="#ff7a00" />
                      </View>
                      <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17, textAlign: "center" }}>Camera Access Required</Text>
                      <Text style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                        Allow PRFMR to use your camera to scan product barcodes.
                      </Text>
                      <TouchableOpacity onPress={requestCameraPermission}
                        style={{ backgroundColor: "#ff7a00", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 }}>
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Allow Camera</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flex: 1 }}>
                      <View style={{ position: "relative", height: 280, backgroundColor: "#000", overflow: "hidden" }}>
                        <CameraView
                          style={StyleSheet.absoluteFillObject}
                          facing="back"
                          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] }}
                          onBarcodeScanned={cameraScanned ? undefined : handleBarcodeScanned}
                        />
                        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                          <View style={{ flexDirection: "row", height: 160 }}>
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                            <View style={{ width: 240, borderWidth: 2, borderColor: "#ff7a00", borderRadius: 4 }}>
                              <View style={{ position: "absolute", top: -2, left: -2, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                              <View style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                              <View style={{ position: "absolute", bottom: -2, left: -2, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                              <View style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                            </View>
                            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                          </View>
                          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                        </View>
                        {(cameraScanned || barcodeLoading) && (
                          <View style={{ position: "absolute", bottom: 16, left: 0, right: 0, alignItems: "center" }}>
                            <View style={{ backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <ActivityIndicator size="small" color="#ff7a00" />
                              <Text style={{ color: "#eceef2", fontSize: 13 }}>Looking up barcode…</Text>
                            </View>
                          </View>
                        )}
                        {!cameraScanned && !barcodeLoading && (
                          <View style={{ position: "absolute", bottom: 16, left: 0, right: 0, alignItems: "center" }}>
                            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Point at any food barcode</Text>
                          </View>
                        )}
                      </View>
                      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
                        <Text style={{ color: "#6b7280", fontSize: 12, textAlign: "center" }}>— or enter barcode manually —</Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <TextInput
                            style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
                              backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 16, color: "#eceef2" }}
                            placeholder="e.g. 5000112548167" placeholderTextColor="#6b7280"
                            value={barcodeCode} onChangeText={t => { setBarcodeCode(t); setCameraScanned(false); setBarcodeError(""); }}
                            keyboardType="number-pad" returnKeyType="search" onSubmitEditing={() => lookupBarcode()}
                          />
                          <TouchableOpacity onPress={() => lookupBarcode()} disabled={barcodeLoading || !barcodeCode.trim()}
                            style={{ height: 48, paddingHorizontal: 16, borderRadius: 10, alignItems: "center",
                              justifyContent: "center", backgroundColor: barcodeCode.trim() ? "#ff7a00" : "#181c26" }}>
                            {barcodeLoading
                              ? <ActivityIndicator color="#fff" size="small" />
                              : <Text style={{ color: barcodeCode.trim() ? "#fff" : "#6b7280", fontWeight: "700" }}>Lookup</Text>}
                          </TouchableOpacity>
                        </View>
                        {!!barcodeError && (
                          <View style={{ backgroundColor: "#f8717122", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#f8717144" }}>
                            <Text style={{ color: "#f87171", fontSize: 14 }}>{barcodeError}</Text>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
              {activeTab === "custom" && (
                <MealCustomTab
                  name={customName} setName={setCustomName}
                  grams={customGrams} setGrams={setCustomGrams}
                  cal={customCal} setCal={setCustomCal}
                  protein={customProtein} setProtein={setCustomProtein}
                  carbs={customCarbs} setCarbs={setCustomCarbs}
                  fat={customFat} setFat={setCustomFat}
                  fibre={customFibre} setFibre={setCustomFibre}
                  onAdd={addCustom} isPending={addMut.isPending}
                />
              )}
            </View>
          )}
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
