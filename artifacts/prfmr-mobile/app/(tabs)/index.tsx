import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert, FlatList, Image, Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useFightCampOverride, type FCOverrideState } from "../../hooks/useFightCampOverride";
import { getCoreFoodUnit, computeUnitGrams, type UnitSize } from "../../lib/coreFoodUnits";
import { QuickLogModal } from "../../components/QuickLogModal";

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
  fatLossRequired: number;
  tempCut: number;
  tempCutDisplayed: number;
  dayMinus4Target: number | null;
  weeklyRate: number;
  weeklyRatePct: number;
  status: string;
  statusLabel: string;
  weeklyTargets: Array<{ week: number; targetWeight: number }>;
  suggestedDeficitKcal: number;
  weighInTiming: "same_day" | "day_before";
  manualTempReductionKg: number | null;
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

interface ReadinessComponent {
  name: string;
  score: number;
  maxPoints: number;
  detail: string;
}

interface ProvisionalReadiness {
  score: number;
  label: string;
  feelScore: number;
  fuelScore: number;
  intensityScore: number;
  message: string;
  suggestedFix: string;
}

interface ReadinessData {
  total: number;
  label: "High" | "Moderate" | "Low" | "Poor" | "Provisional";
  primaryLimiter: string;
  suggestedFix: string;
  components: ReadinessComponent[];
  provisional: boolean;
  hasPlannedTraining: boolean;
  hasYesterdayTraining: boolean;
  bodyweightKg: number | null;
  bodyweightSource: string | null;
  checkin: ProvisionalCheckin | null;
  provisionalReadiness: ProvisionalReadiness | null;
  backToBackHardDays: boolean;
  highLoadCluster: boolean;
  threeDayStreak: boolean;
  crossSignal: string | null;
  missingData: string[];
}

interface FuelSummary {
  fuelStatus: "High" | "Adequate" | "Low";
  provisional: boolean;
  provisionalFuel: { fuelStatus: "Adequate" | "Low" } | null;
}

interface Targets {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  adjustedCalories: number;
  trainingCaloriesEarned: number;
  mode?: string;
  ffmKg?: number;
  eaValue?: number;
  isLowEA?: boolean;
  isLowCarb?: boolean;
  carbsPerKg?: number;
  eaRecommendedCalories?: number;
  carbRecommendedG?: number;
  isBelowPerformanceCarb?: boolean;
  performanceCarbWarning?: string | null;
  planId?: number;
  planFightDate?: string;
  planTargetWeight?: number;
}

interface FoodEntry {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  grams?: number;
  meal: string;
  date: string;
  snackIndex?: number;
  sourceType?: string;
  ingredientIndex?: number;
  normalizedGrams?: number;
}

interface ScheduledSlot {
  stackId: number | null;       // null for direct-reminder supplements (not in a stack)
  stackName: string | null;     // null for direct-reminder supplements
  reminderId: number | null;    // null for direct-reminder supplements
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
  if (weeklyRatePct < 0.5) return { label: "Easy pace", color: "#6b7280", note: "Comfortable pace — you have time." };
  if (weeklyRatePct <= 0.75) return { label: "Moderate pace", color: "#ff7a00", note: "Steady sustainable deficit." };
  return { label: "Aggressive pace", color: "#fb923c", note: "High deficit — monitor energy and recovery." };
}

const STATUS_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  on_track:        { text: "#4ade80", bg: "#4ade8019", border: "#4ade8030" },
  aggressive:      { text: "#facc15", bg: "#facc1519", border: "#facc1530" },
  very_aggressive: { text: "#fb923c", bg: "#fb923c19", border: "#fb923c30" },
  unrealistic:     { text: "#f87171", bg: "#f8717119", border: "#f8717130" },
  complete:        { text: "#4ade80", bg: "#4ade8019", border: "#4ade8030" },
  past_date:       { text: "#6b7280", bg: "#6b728019", border: "#6b728030" },
};

function getTrendMessage(weights: Array<{ date: string; weight: number }>, status: string) {
  if (weights.length < 2) return { text: "Trend forming — keep logging daily", isUp: false };
  if (status === "complete") return { text: "At fight weight — well done 🏆", isUp: false };
  if (status === "past_date") return { text: "Fight date passed", isUp: false };
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const change = sorted[sorted.length - 1].weight - sorted[0].weight;
  if (change < -0.2) return { text: "On trend ↓ — moving in the right direction", isUp: false };
  if (change <= 0.3) return { text: "Fluctuations are normal — trends take time", isUp: false };
  return { text: "Weight naturally fluctuates — stay consistent", isUp: true };
}

function getConsistencyLabel(count: number) {
  if (count >= 6) return { label: "Great momentum", color: "#4ade80", bg: "#4ade8019" };
  if (count >= 4) return { label: "Building rhythm", color: "#facc15", bg: "#facc1519" };
  if (count >= 2) return { label: "Getting started", color: "#6b7280", bg: "#6b728019" };
  return null;
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
  ingredientIndex?: number;
  offBarcode?: string;
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
  const macros = item.macros_per_100g ?? item.off?.macros_per_100g ?? {};
  return {
    name: item.name ?? item.off?.name ?? item.product_name ?? "Unknown",
    brand: item.brand ?? item.off?.brand ?? item.brands ?? undefined,
    caloriesPer100g: item.caloriesPer100g ?? macros.kcal ?? item.calories ?? item.nutriments?.["energy-kcal_100g"] ?? 0,
    proteinPer100g: item.proteinPer100g ?? macros.protein ?? item.protein ?? item.nutriments?.proteins_100g ?? 0,
    carbsPer100g: item.carbsPer100g ?? macros.carbs ?? item.carbs ?? item.nutriments?.carbohydrates_100g ?? 0,
    fatPer100g: item.fatPer100g ?? macros.fat ?? item.fat ?? item.nutriments?.fat_100g ?? 0,
    fibrePer100g: item.fibrePer100g ?? macros.fibre ?? item.fibre ?? item.nutriments?.fiber_100g ?? item.nutriments?.fibre_100g ?? 0,
    sourceType,
    offBarcode: item.barcode ?? item.off?.barcode ?? undefined,
    ingredientIndex: item.mapping?.ingredientIndex ?? undefined,
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

  // Inline weight logging
  const [showWeight, setShowWeight] = useState(false);
  const [weightVal, setWeightVal] = useState("");

  // Breakdown dialog
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Create/edit modal
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [formCW, setFormCW] = useState("");
  const [formTW, setFormTW] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTiming, setFormTiming] = useState<"same_day" | "day_before">("same_day");
  const [formManualTemp, setFormManualTemp] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 7-day start for trend/consistency
  const sevenDayStart = format(subDays(new Date(date + "T12:00:00"), 6), "yyyy-MM-dd");

  const { data: plan } = useQuery<WeightCutData | null>({
    queryKey: ["weight-cut"],
    queryFn: () => apiFetch<WeightCutData | null>("/me/weight-cut").catch(() => null),
    retry: false,
  });

  const { data: recentWeights = [] } = useQuery<Array<{ date: string; weight: number }>>({
    queryKey: ["weights-range-7d", sevenDayStart, date],
    queryFn: () => apiFetch(`/me/weights/range?start=${sevenDayStart}&end=${date}`),
    enabled: !!plan,
  });

  const weightMut = useMutation({
    mutationFn: (w: number) => apiFetch("/weights", { method: "POST", body: { date, weight: w } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["weights-range"] });
      qc.invalidateQueries({ queryKey: ["weights-range-7d"] });
      qc.invalidateQueries({ queryKey: ["readiness", date] });
      qc.invalidateQueries({ queryKey: ["fuel", date] });
      setShowWeight(false); setWeightVal("");
    },
  });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch("/me/weight-cut", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      setDialogMode(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => apiFetch("/me/weight-cut", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight-cut"] }),
  });

  function openCreate() {
    setFormCW(plan?.currentWeight?.toString() ?? "");
    setFormTW(""); setFormDate(""); setFormTiming("same_day");
    setFormManualTemp(""); setShowAdvanced(false);
    setDialogMode("create");
  }

  function openEdit() {
    if (!plan) return;
    setFormCW(plan.currentWeight.toString());
    setFormTW(plan.targetWeight.toString());
    setFormDate(plan.fightDate);
    setFormTiming(plan.weighInTiming ?? "same_day");
    setFormManualTemp(plan.manualTempReductionKg ? plan.manualTempReductionKg.toString() : "");
    setShowAdvanced((plan.manualTempReductionKg ?? 0) > 0);
    setDialogMode("edit");
  }

  function handleSubmit() {
    const cw = parseFloat(formCW);
    const tw = parseFloat(formTW);
    if (!cw || !tw || !formDate) return;
    const body: any = { currentWeight: cw, targetWeight: tw, fightDate: formDate, weighInTiming: formTiming };
    const mt = parseFloat(formManualTemp);
    if (!isNaN(mt) && mt > 0) body.manualTempReductionKg = mt;
    createMut.mutate(body);
  }

  // ── Derived display values ──
  const pace = plan ? getPaceInfo(plan.weeklyRatePct) : null;
  const thisWeekTarget = plan?.weeklyTargets?.[0];
  const statusColor = plan ? (STATUS_COLORS[plan.status] ?? STATUS_COLORS.on_track) : null;
  const trend = plan ? getTrendMessage(recentWeights, plan.status) : null;
  const consistencyCount = recentWeights.length;
  const consistencyInfo = getConsistencyLabel(consistencyCount);

  // ─── CREATE / EDIT MODAL ───────────────────────────────────────
  const formModal = (
    <Modal visible={dialogMode !== null} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={() => setDialogMode(null)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
            <View>
              <Text style={{ color: "#eceef2", fontSize: 17, fontWeight: "700" }}>
                {dialogMode === "edit" ? "Edit Fight Camp Plan" : "Set Up Fight Camp Plan"}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                {dialogMode === "edit"
                  ? "Update your target or timeline — the plan recalculates automatically."
                  : "Plan a gradual weight cut targeting 0.5–1.0% bodyweight per week."}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setDialogMode(null)}>
              <Feather name="x" size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Current Weight */}
            <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Current Weight (kg)</Text>
            <TextInput
              style={{ backgroundColor: "#13161d", borderWidth: 1, borderColor: "#1a1e28", borderRadius: 10,
                color: "#eceef2", padding: 12, fontSize: 15, marginBottom: 14 }}
              placeholder="e.g. 77.2"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
              value={formCW}
              onChangeText={setFormCW}
            />
            {/* Fight Weight */}
            <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Fight Weight (kg)</Text>
            <TextInput
              style={{ backgroundColor: "#13161d", borderWidth: 1, borderColor: "#1a1e28", borderRadius: 10,
                color: "#eceef2", padding: 12, fontSize: 15, marginBottom: 14 }}
              placeholder="e.g. 72.0"
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
              value={formTW}
              onChangeText={setFormTW}
            />
            {/* Fight Date */}
            <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Fight Date (YYYY-MM-DD)</Text>
            <TextInput
              style={{ backgroundColor: "#13161d", borderWidth: 1, borderColor: "#1a1e28", borderRadius: 10,
                color: "#eceef2", padding: 12, fontSize: 15, marginBottom: 14 }}
              placeholder="2025-09-15"
              placeholderTextColor="#6b7280"
              value={formDate}
              onChangeText={setFormDate}
            />
            {/* Weigh-In Timing */}
            <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Weigh-In Timing</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              {([
                { value: "same_day" as const, label: "Same day", sub: "Weigh in on fight day" },
                { value: "day_before" as const, label: "Day before", sub: "Weigh in the evening prior" },
              ] as const).map(opt => (
                <TouchableOpacity key={opt.value} onPress={() => setFormTiming(opt.value)}
                  style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: "center",
                    borderColor: formTiming === opt.value ? "#ff7a00" : "#1a1e28",
                    backgroundColor: formTiming === opt.value ? "#ff7a0019" : "#13161d" }}>
                  <Text style={{ color: formTiming === opt.value ? "#eceef2" : "#6b7280", fontWeight: "600", fontSize: 13 }}>{opt.label}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2, textAlign: "center" }}>{opt.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: "#6b7280", fontSize: 11, marginBottom: 14 }}>
              {formTiming === "same_day"
                ? "Same-day: plan targets fight weight by fight week."
                : "Day-before timing: a small additional buffer is factored in."}
            </Text>
            {/* Advanced options */}
            <TouchableOpacity onPress={() => setShowAdvanced(v => !v)} style={{ marginBottom: 10 }}>
              <Text style={{ color: "#ff7a00", fontSize: 13, fontWeight: "600" }}>
                {showAdvanced ? "▲" : "▼"} Advanced options
              </Text>
            </TouchableOpacity>
            {showAdvanced && (
              <View style={{ backgroundColor: "#13161d", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1a1e28", marginBottom: 14 }}>
                <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Manual temp. reduction override (kg)</Text>
                <TextInput
                  style={{ backgroundColor: "#0f1117", borderWidth: 1, borderColor: "#1a1e28", borderRadius: 8,
                    color: "#eceef2", padding: 10, fontSize: 14, marginBottom: 8 }}
                  placeholder="Leave blank to use automatic estimate"
                  placeholderTextColor="#6b7280"
                  keyboardType="decimal-pad"
                  value={formManualTemp}
                  onChangeText={setFormManualTemp}
                />
                <Text style={{ color: "#6b7280", fontSize: 11, lineHeight: 16 }}>
                  {"Overrides the automatic water-weight estimate (2–6% BW) with your own value.\nLeave blank to keep automatic calculation.\nThis app does not provide acute weight-cut guidance."}
                </Text>
              </View>
            )}
            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={createMut.isPending || !formCW || !formTW || !formDate}
              style={{ backgroundColor: "#ff7a00", borderRadius: 12, padding: 14, alignItems: "center",
                opacity: (createMut.isPending || !formCW || !formTW || !formDate) ? 0.5 : 1 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                {createMut.isPending ? "Saving…" : dialogMode === "edit" ? "Update Plan" : "Start Camp Plan"}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: "#6b7280", fontSize: 10, textAlign: "center", marginTop: 10, marginBottom: 20 }}>
              Educational tool only — not medical or nutritional advice.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // ─── PLAN BREAKDOWN MODAL ──────────────────────────────────────
  const breakdownModal = plan ? (
    <Modal visible={showBreakdown} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={() => setShowBreakdown(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
          <View>
            <Text style={{ color: "#eceef2", fontSize: 17, fontWeight: "700" }}>Plan breakdown</Text>
            <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>How your weight cut is structured.</Text>
          </View>
          <TouchableOpacity onPress={() => setShowBreakdown(false)}><Feather name="x" size={22} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={{ backgroundColor: "#13161d", borderRadius: 12, borderWidth: 1, borderColor: "#1a1e28", overflow: "hidden", marginBottom: 14 }}>
            {/* Fat loss target */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
              <Text style={{ color: "#6b7280", fontSize: 13 }}>Fat loss target</Text>
              <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 13 }}>{(plan.fatLossRequired ?? plan.totalToLose).toFixed(1)} kg</Text>
            </View>
            {/* Temp cut */}
            {(plan.tempCutDisplayed ?? 0) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>Temporary reduction</Text>
                <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 13 }}>~{(plan.tempCutDisplayed).toFixed(1)} kg</Text>
              </View>
            )}
            {(plan.tempCutDisplayed ?? 0) === 0 && (plan.tempCut ?? 0) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>Estimated temp.</Text>
                <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 13 }}>~{(plan.tempCut).toFixed(1)} kg</Text>
              </View>
            )}
            {/* D-4 row — only within 10 days */}
            {plan.dayMinus4Target !== null && plan.daysUntil <= 10 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>Target by D−4</Text>
                <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 13 }}>≤ {(plan.dayMinus4Target!).toFixed(1)} kg</Text>
              </View>
            )}
            {/* Fat-loss pace */}
            {pace && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 13, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>Fat-loss pace</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ backgroundColor: pace.color + "20", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: pace.color, fontWeight: "700", fontSize: 12 }}>{pace.label}</Text>
                  </View>
                  <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>{pace.note}</Text>
                </View>
              </View>
            )}
            {/* Daily deficit */}
            {plan.suggestedDeficitKcal > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13 }}>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>Daily deficit target</Text>
                <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 13 }}>~{Math.round(plan.suggestedDeficitKcal)} kcal</Text>
              </View>
            )}
          </View>
          {/* Weekly targets */}
          {plan.weeklyTargets?.length > 0 && (
            <View style={{ backgroundColor: "#13161d", borderRadius: 12, borderWidth: 1, borderColor: "#1a1e28", overflow: "hidden" }}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
                <Text style={{ color: "#6b7280", fontWeight: "700", fontSize: 11, letterSpacing: 0.5 }}>WEEKLY WEIGHT TARGETS</Text>
              </View>
              {plan.weeklyTargets.map((wt) => (
                <View key={wt.week} style={{ flexDirection: "row", justifyContent: "space-between", padding: 11, borderBottomWidth: 1, borderBottomColor: "#1a1e2840" }}>
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
  ) : null;

  // ─── EMPTY STATE ───────────────────────────────────────────────
  if (!plan) {
    return (
      <>
        {formModal}
        <Card>
          <View style={{ alignItems: "center", paddingVertical: 10 }}>
            <Feather name="target" size={28} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", marginTop: 10 }}>Fight Camp</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", marginTop: 4, marginBottom: 16, lineHeight: 18 }}>
              Set a fight date to start your camp plan — track your cut and stay on pace.
            </Text>
            <TouchableOpacity onPress={openCreate}
              style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Set a fight date</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </>
    );
  }

  // ─── ACTIVE PLAN ───────────────────────────────────────────────
  return (
    <>
      {formModal}
      {breakdownModal}
      <Card>
        {/* Header row: Fight Camp label | status badge | edit | delete */}
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Feather name="target" size={13} color={colors.primary} />
            <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 4 }]}>Fight Camp</Text>
          </View>
          <View style={styles.row}>
            {statusColor && (
              <View style={{ backgroundColor: statusColor.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
                borderWidth: 1, borderColor: statusColor.border, marginRight: 8 }}>
                <Text style={{ color: statusColor.text, fontWeight: "700", fontSize: 11 }}>{plan.statusLabel}</Text>
              </View>
            )}
            <TouchableOpacity onPress={openEdit} style={{ marginRight: 10 }}>
              <Feather name="edit-2" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              Alert.alert("Delete plan", "Remove this fight camp plan?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() },
              ]);
            }}>
              <Feather name="trash-2" size={15} color="#f87171" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Countdown */}
        <Text style={[styles.heroNum, { color: colors.foreground, marginTop: 6 }]}>
          {plan.daysUntil}{" "}
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>days to fight night</Text>
        </Text>

        {/* Inline weight logging */}
        {!showWeight ? (
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 4,
              backgroundColor: colors.secondary, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border }}
            onPress={() => setShowWeight(true)}>
            <Feather name="plus-circle" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", marginLeft: 6 }}>Log today's weight →</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: 8, marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Feather name="activity" size={13} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 4 }}>Morning weight (kg)</Text>
            </View>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
                placeholder="e.g. 77.2"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={weightVal}
                onChangeText={setWeightVal}
                autoFocus
              />
              <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.primary, marginLeft: 8 }]}
                onPress={() => { const w = parseFloat(weightVal); if (!isNaN(w) && w > 0) weightMut.mutate(w); }}
                disabled={weightMut.isPending}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSm, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, marginLeft: 6 }]}
                onPress={() => { setShowWeight(false); setWeightVal(""); }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3-panel weight row */}
        <View style={{ flexDirection: "row", marginTop: 10, backgroundColor: colors.secondary,
          borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
          <View style={{ flex: 1, alignItems: "center", padding: 12, borderRightWidth: 1, borderRightColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 17 }}>{plan.currentWeight}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>Current</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>kg</Text>
          </View>
          <View style={{ flex: 1, alignItems: "center", padding: 10, justifyContent: "center",
            borderRightWidth: 1, borderRightColor: colors.border }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 2 }}>↓</Text>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>{plan.totalToLose.toFixed(1)} kg to go</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{plan.weeklyRate.toFixed(2)} kg/wk</Text>
          </View>
          <View style={{ flex: 1, alignItems: "center", padding: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 17 }}>{plan.targetWeight}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>Fight wt</Text>
          </View>
        </View>

        {/* Pace badge row — taps to breakdown */}
        <TouchableOpacity onPress={() => setShowBreakdown(true)} style={{ marginTop: 10 }} activeOpacity={0.7}>
          {pace && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ backgroundColor: pace.color + "20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: pace.color + "40" }}>
                <Text style={{ color: pace.color, fontWeight: "700", fontSize: 12 }}>{pace.label}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 2 }}>Plan breakdown</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* This week's target */}
        {thisWeekTarget && (
          <View style={{ marginTop: 10, backgroundColor: colors.secondary, borderRadius: 8, padding: 10,
            borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>THIS WEEK'S TARGET</Text>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14, marginTop: 2 }}>
              {thisWeekTarget.targetWeight.toFixed(1)} kg
              {plan.suggestedDeficitKcal > 0 && (
                <Text style={{ color: colors.mutedForeground, fontWeight: "400" }}> · ~{Math.round(plan.suggestedDeficitKcal)} kcal deficit</Text>
              )}
            </Text>
          </View>
        )}

        {/* Trend message */}
        {trend && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
            <Feather name={trend.isUp ? "trending-up" : "zap"} size={13}
              color={trend.isUp ? "#fb923c" : colors.primary} style={{ marginRight: 5 }} />
            <Text style={{ color: trend.isUp ? "#fb923c" : colors.mutedForeground, fontSize: 12, flex: 1 }}>
              {trend.text}
            </Text>
          </View>
        )}

        {/* Consistency row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            Weight logged: {consistencyCount} of last 7 days
          </Text>
          {consistencyInfo && (
            <View style={{ backgroundColor: consistencyInfo.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ color: consistencyInfo.color, fontWeight: "700", fontSize: 11 }}>{consistencyInfo.label}</Text>
            </View>
          )}
        </View>

        {/* Share row */}
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", marginTop: 10,
          paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Feather name="share" size={14} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 6 }}>Try sharing a moment</Text>
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 6, lineHeight: 14 }}>
          Educational tool only. Consult a sports nutritionist for individual guidance.
        </Text>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────
// Morning Check-In Gate — "Start your day" modal
// ─────────────────────────────────────────
function MorningCheckInGate({ date }: { date: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useColors();
  const qc = useQueryClient();

  const [visible, setVisible] = useState(false);
  const [seenLoaded, setSeenLoaded] = useState(false);

  // Sleep form state
  const [showSleepForm, setShowSleepForm] = useState(false);
  const [gateSlH, setGateSlH] = useState("");
  const [gateSlQ, setGateSlQ] = useState<number | null>(null);

  // Weight form state
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [gateWtVal, setGateWtVal] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");
  const storageKey = `morningGate:${user?.id ?? "anon"}:${today}`;

  const { data: status } = useQuery<MorningStatus>({
    queryKey: ["morning-status", date],
    queryFn: () => apiFetch(`/me/morning-status/${date}`),
  });

  // Load seen state once on mount
  useEffect(() => {
    AsyncStorage.getItem(storageKey).then(val => {
      setSeenLoaded(true);
      if (!val) setVisible(true);
    });
  }, [storageKey]);

  // Auto-dismiss when allDone
  const allDone = !!(status?.hasSleep && status?.hasWeight && status?.hasPlannedTraining);
  useEffect(() => {
    if (allDone && visible) markSeen();
  }, [allDone]);

  function markSeen() {
    AsyncStorage.setItem(storageKey, "1");
    setVisible(false);
    setShowSleepForm(false);
    setShowWeightForm(false);
  }

  const sleepMut = useMutation({
    mutationFn: (d: { hoursSlept: number; sleepQuality: number | null }) =>
      apiFetch(`/me/sleep/${date}`, { method: "PUT", body: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["readiness", date] });
      qc.invalidateQueries({ queryKey: ["fuel", date] });
      setShowSleepForm(false); setGateSlH(""); setGateSlQ(null);
    },
  });

  const weightMut = useMutation({
    mutationFn: (w: number) => apiFetch("/weights", { method: "POST", body: { date, weight: w } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      qc.invalidateQueries({ queryKey: ["weights-range"] });
      qc.invalidateQueries({ queryKey: ["readiness", date] });
      qc.invalidateQueries({ queryKey: ["fuel", date] });
      setShowWeightForm(false); setGateWtVal("");
    },
  });

  // Only show on today's date, after seen-state is loaded
  if (date !== today || !seenLoaded || !visible || !status) return null;

  const incomplete = !allDone;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={markSeen}
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{
          flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "center", alignItems: "center", padding: 20,
        }}>
          <View style={{
            backgroundColor: "#13161d", borderRadius: 20, width: "100%", maxWidth: 400,
            borderWidth: 1, borderColor: "#1a1e28", overflow: "hidden",
          }}>
            {/* Header */}
            <View style={{ padding: 20, paddingBottom: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <Text style={{ color: "#eceef2", fontSize: 17, fontWeight: "700" }}>Start your day</Text>
                <TouchableOpacity onPress={markSeen} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather name="x" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Text style={{ color: "#6b7280", fontSize: 13, lineHeight: 18 }}>
                Complete your check-in to get accurate readiness and fuel targets
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16 }}>
              {/* ── SLEEP ROW ── */}
              {status.hasSleep ? (
                <View style={[gateRow, { borderColor: "#1a1e28" }]}>
                  <Feather name="moon" size={16} color="#ff7a00" />
                  <Text style={{ color: "#6b7280", fontSize: 14, flex: 1, marginLeft: 10 }}>Sleep logged</Text>
                  <Feather name="check" size={16} color="#4ade80" />
                </View>
              ) : showSleepForm ? (
                <View style={{ backgroundColor: "#0f1117", borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: "#ff7a0040", marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Feather name="moon" size={14} color="#ff7a00" />
                    <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: 6, fontWeight: "600" }}>Hours slept</Text>
                  </View>
                  <TextInput
                    style={{ backgroundColor: "#13161d", borderWidth: 1, borderColor: "#1a1e28",
                      borderRadius: 8, color: "#eceef2", padding: 10, fontSize: 15, marginBottom: 10 }}
                    placeholder="e.g. 7.5"
                    placeholderTextColor="#6b7280"
                    keyboardType="decimal-pad"
                    value={gateSlH}
                    onChangeText={setGateSlH}
                    autoFocus
                  />
                  <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Quality</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map(q => (
                      <TouchableOpacity key={q} onPress={() => setGateSlQ(q)}
                        style={{ flex: 1, alignItems: "center", padding: 6 }}>
                        <Text style={{ fontSize: 20 }}>
                          {(gateSlQ ?? 0) >= q ? "⭐" : "☆"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => { const h = parseFloat(gateSlH); if (!isNaN(h) && h > 0) sleepMut.mutate({ hoursSlept: h, sleepQuality: gateSlQ }); }}
                      disabled={sleepMut.isPending || !gateSlH}
                      style={{ flex: 1, backgroundColor: "#ff7a00", borderRadius: 8, padding: 10, alignItems: "center",
                        opacity: (!gateSlH || sleepMut.isPending) ? 0.5 : 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {sleepMut.isPending ? "Saving…" : "Save"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowSleepForm(false); setGateSlH(""); setGateSlQ(null); }}
                      style={{ paddingHorizontal: 14, justifyContent: "center" }}>
                      <Text style={{ color: "#6b7280", fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[gateRow, { borderColor: "#1a1e28", marginBottom: 8 }]}>
                  <Feather name="moon" size={16} color="#ff7a00" />
                  <Text style={{ color: "#eceef2", fontSize: 14, flex: 1, marginLeft: 10, fontWeight: "500" }}>
                    Log last night's sleep
                  </Text>
                  <TouchableOpacity onPress={() => setShowSleepForm(true)}
                    style={{ borderWidth: 1, borderColor: "#ff7a00", borderRadius: 6,
                      paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: "#ff7a00", fontSize: 12, fontWeight: "700" }}>Log</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── WEIGHT ROW ── */}
              {status.hasWeight ? (
                <View style={[gateRow, { borderColor: "#1a1e28" }]}>
                  <Feather name="activity" size={16} color="#ff7a00" />
                  <Text style={{ color: "#6b7280", fontSize: 14, flex: 1, marginLeft: 10 }}>Weight logged</Text>
                  <Feather name="check" size={16} color="#4ade80" />
                </View>
              ) : showWeightForm ? (
                <View style={{ backgroundColor: "#0f1117", borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: "#ff7a0040", marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Feather name="activity" size={14} color="#ff7a00" />
                    <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: 6, fontWeight: "600" }}>Morning weight (kg)</Text>
                  </View>
                  <TextInput
                    style={{ backgroundColor: "#13161d", borderWidth: 1, borderColor: "#1a1e28",
                      borderRadius: 8, color: "#eceef2", padding: 10, fontSize: 15, marginBottom: 10 }}
                    placeholder="e.g. 77.2"
                    placeholderTextColor="#6b7280"
                    keyboardType="decimal-pad"
                    value={gateWtVal}
                    onChangeText={setGateWtVal}
                    autoFocus
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => { const w = parseFloat(gateWtVal); if (!isNaN(w) && w > 0) weightMut.mutate(w); }}
                      disabled={weightMut.isPending || !gateWtVal}
                      style={{ flex: 1, backgroundColor: "#ff7a00", borderRadius: 8, padding: 10, alignItems: "center",
                        opacity: (!gateWtVal || weightMut.isPending) ? 0.5 : 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {weightMut.isPending ? "Saving…" : "Save"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowWeightForm(false); setGateWtVal(""); }}
                      style={{ paddingHorizontal: 14, justifyContent: "center" }}>
                      <Text style={{ color: "#6b7280", fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[gateRow, { borderColor: "#1a1e28", marginBottom: 8 }]}>
                  <Feather name="activity" size={16} color="#ff7a00" />
                  <Text style={{ color: "#eceef2", fontSize: 14, flex: 1, marginLeft: 10, fontWeight: "500" }}>
                    Log today's weight
                  </Text>
                  <TouchableOpacity onPress={() => setShowWeightForm(true)}
                    style={{ borderWidth: 1, borderColor: "#ff7a0060", borderRadius: 6,
                      paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: "#ff7a00", fontSize: 12, fontWeight: "700" }}>Log</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── TRAINING ROW ── */}
              {status.hasPlannedTraining ? (
                <View style={[gateRow, { borderColor: "#1a1e28" }]}>
                  <Feather name="zap" size={16} color="#ff7a00" />
                  <Text style={{ color: "#6b7280", fontSize: 14, flex: 1, marginLeft: 10 }}>Session created</Text>
                  <Feather name="check" size={16} color="#4ade80" />
                </View>
              ) : (
                <View style={[gateRow, { borderColor: "#1a1e28" }]}>
                  <Feather name="zap" size={16} color="#ff7a00" />
                  <Text style={{ color: "#eceef2", fontSize: 14, flex: 1, marginLeft: 10, fontWeight: "500" }}>
                    Create today's session
                  </Text>
                  <TouchableOpacity
                    onPress={() => { markSeen(); router.push("/(tabs)/training" as any); }}
                    style={{ borderWidth: 1, borderColor: "#ff7a00", borderRadius: 6,
                      paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: "#ff7a00", fontSize: 12, fontWeight: "700" }}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Incomplete notice */}
              {incomplete && (
                <Text style={{ color: "#6b7280", fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 17 }}>
                  Your macro and fuel targets will be less accurate
                </Text>
              )}

              {/* Continue button */}
              <TouchableOpacity
                onPress={markSeen}
                style={{ backgroundColor: "#ff7a00", borderRadius: 12, padding: 14,
                  alignItems: "center", marginTop: 12 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Shared style for gate rows (inline so it can reference styles obj not yet defined)
const gateRow: object = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  padding: 12,
  borderRadius: 10,
  borderWidth: 1,
  marginBottom: 8,
  backgroundColor: "#0f111780",
};

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
      qc.removeQueries({ queryKey: ["targets", date] });
      qc.removeQueries({ queryKey: ["training-summary", date] });
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
// Readiness Summary Card (dashboard compact row)
// ─────────────────────────────────────────
function readinessBadgeStyle(label: string): { text: string; bg: string; border: string } {
  switch (label) {
    case "High":     return { text: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)" };
    case "Moderate": return { text: "#facc15", bg: "rgba(250,204,21,0.1)",  border: "rgba(250,204,21,0.3)" };
    case "Low":      return { text: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.3)" };
    case "Poor":     return { text: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" };
    default:         return { text: "#93c5fd", bg: "rgba(147,197,253,0.1)", border: "rgba(147,197,253,0.3)" };
  }
}

function fuelBadgeStyle(status: string): { text: string; bg: string; border: string } {
  if (status === "Low") return { text: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" };
  return { text: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)" };
}

function ReadinessSummaryCard({ date }: { date: string }) {
  const colors = useColors();
  const router = useRouter();

  const { data: readiness } = useQuery<ReadinessData>({
    queryKey: ["readiness", date],
    queryFn: () => apiFetch(`/me/readiness/${date}`),
  });

  const { data: fuel } = useQuery<FuelSummary>({
    queryKey: ["fuel", date],
    queryFn: () => apiFetch(`/me/fuel/${date}`),
  });

  if (!readiness && !fuel) return null;

  // Display label for readiness badge
  const pr = readiness?.provisionalReadiness ?? null;
  const isProvR = !!(readiness?.provisional);
  const rLabel   = isProvR ? (pr ? pr.label : "Estimated") : (readiness?.label ?? "…");
  const rBadge   = isProvR ? { text: "#93c5fd", bg: "rgba(147,197,253,0.1)", border: "rgba(147,197,253,0.3)" }
                           : readinessBadgeStyle(rLabel);

  // Display label for fuel badge
  const isProvFWithCheckin = !!(fuel?.provisional && fuel?.provisionalFuel);
  const fLabel = fuel?.provisional && !fuel?.provisionalFuel
    ? "Estimated"
    : isProvFWithCheckin ? fuel!.provisionalFuel!.fuelStatus : (fuel?.fuelStatus ?? "…");
  const fBadge = fuel?.provisional && !fuel?.provisionalFuel
    ? { text: "#93c5fd", bg: "rgba(147,197,253,0.1)", border: "rgba(147,197,253,0.3)" }
    : fuelBadgeStyle(fLabel);

  return (
    <Card>
      <View style={styles.rowBetween}>
        {/* READINESS column */}
        <View style={{ flex: 1 }}>
          <View style={[styles.row, { marginBottom: 6 }]}>
            <Feather name="zap" size={12} color={colors.mutedForeground} />
            <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 4, letterSpacing: 0.5, fontSize: 10 }]}>
              READINESS
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: rBadge.bg, borderColor: rBadge.border, alignSelf: "flex-start" }]}>
            <Text style={[styles.badgeText, { color: rBadge.text }]}>{rLabel}</Text>
          </View>
        </View>

        {/* FUEL column */}
        <View style={{ flex: 1 }}>
          <View style={[styles.row, { marginBottom: 6 }]}>
            <Feather name="droplet" size={12} color={colors.mutedForeground} />
            <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 4, letterSpacing: 0.5, fontSize: 10 }]}>
              FUEL
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: fBadge.bg, borderColor: fBadge.border, alignSelf: "flex-start" }]}>
            <Text style={[styles.badgeText, { color: fBadge.text }]}>{fLabel}</Text>
          </View>
        </View>

        {/* Details link */}
        <TouchableOpacity
          style={[styles.row, { paddingLeft: 8 }]}
          onPress={() => router.push({ pathname: "/readiness-detail" as any, params: { date } })}
          activeOpacity={0.7}
        >
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>Details</Text>
          <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
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

  // Reads from the shared readiness query (already fetched by ReadinessSummaryCard)
  const { data: readiness } = useQuery<ReadinessData>({
    queryKey: ["readiness", date],
    queryFn: () => apiFetch(`/me/readiness/${date}`),
  });

  const submitMut = useMutation({
    mutationFn: () => apiFetch(`/me/provisional-checkin/${date}`, {
      method: "PUT",
      body: { feelToday: feel, fueledToday: fuel, plannedIntensity: intensity },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["readiness", date] });
      qc.invalidateQueries({ queryKey: ["fuel", date] });
      setEditing(false);
    },
  });

  // Gate: only render when sleep is not logged (provisional=true) per §8.5.1
  if (!readiness?.provisional) return null;

  const ci = readiness.checkin;

  // ── Completed state (§8.5.7) ──
  if (ci && !editing) {
    const feelOpt      = FEEL_OPTIONS.find(o => o.value === ci.feelToday);
    const fuelOpt      = FUEL_OPTIONS.find(o => o.value === ci.fueledToday);
    const intensityOpt = INTENSITY_OPTIONS.find(o => o.value === ci.plannedIntensity);
    return (
      <Card>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Feather name="check-circle" size={15} color="#4ade80" />
            <Text style={[styles.cardTitle, { color: colors.foreground, marginLeft: 7 }]}>Quick Check-in</Text>
            <View style={[styles.badge, { backgroundColor: "rgba(147,197,253,0.1)", borderColor: "rgba(147,197,253,0.3)", marginLeft: 8 }]}>
              <Text style={[styles.badgeText, { color: "#93c5fd" }]}>Estimated</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => { setFeel(ci.feelToday); setFuel(ci.fueledToday); setIntensity(ci.plannedIntensity); setEditing(true); }}
          >
            <Feather name="edit-2" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* 3-column summary grid */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {[
            { emoji: feelOpt?.emoji ?? "💪",      category: "Feeling",      answer: feelOpt?.label ?? ci.feelToday },
            { emoji: fuelOpt?.emoji ?? "🟢",      category: "Fueled",       answer: fuelOpt?.label ?? ci.fueledToday },
            { emoji: intensityOpt?.emoji ?? "🏃", category: "Today's plan", answer: intensityOpt?.label ?? ci.plannedIntensity },
          ].map(item => (
            <View key={item.category} style={[styles.ciSummaryCol, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
              <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 4, textAlign: "center" }]}>{item.category}</Text>
              <Text style={[styles.xs, { color: colors.foreground, fontWeight: "700", textAlign: "center", marginTop: 2 }]}>{item.answer}</Text>
            </View>
          ))}
        </View>

        {/* Footer disclaimer */}
        <Text style={[styles.xs, { color: colors.mutedForeground, fontStyle: "italic", marginTop: 10, lineHeight: 16, fontSize: 10 }]}>
          Readiness and fuel status are estimated from your self-report — not objective data. Log yesterday's food and training for a complete assessment.
        </Text>
      </Card>
    );
  }

  // ── Form state ──
  return (
    <Card>
      {/* Header */}
      <View style={styles.row}>
        <Feather name="clipboard" size={15} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Quick Check-in</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 1 }]}>
            3 questions — drives estimated readiness & fuel status
          </Text>
        </View>
      </View>

      {/* Q1 — How do you feel today? */}
      {([
        { label: "How do you feel today?",     options: FEEL_OPTIONS,      val: feel,      set: setFeel },
        { label: "Did you fuel well yesterday?", options: FUEL_OPTIONS,    val: fuel,      set: setFuel },
        { label: "Planned session intensity",   options: INTENSITY_OPTIONS, val: intensity, set: setIntensity },
      ] as const).map(({ label, options, val, set }) => (
        <View key={label} style={{ marginTop: 14 }}>
          <Text style={[styles.xs, { color: colors.foreground, fontWeight: "600", marginBottom: 8 }]}>{label}</Text>
          <View style={styles.ciRow}>
            {options.map(o => (
              <TouchableOpacity
                key={o.value}
                style={[styles.ciBtn, {
                  borderColor:       val === o.value ? colors.primary : "rgba(255,255,255,0.12)",
                  backgroundColor:   val === o.value ? "rgba(255,122,0,0.1)" : "rgba(255,255,255,0.04)",
                }]}
                onPress={() => (set as any)(o.value)}
              >
                <Text style={{ fontSize: 22 }}>{o.emoji}</Text>
                <Text style={[styles.xs, {
                  color:      val === o.value ? colors.primary : colors.mutedForeground,
                  fontWeight: "600",
                  marginTop:  4,
                }]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.fullBtn, {
          backgroundColor: colors.primary,
          opacity: (feel && fuel && intensity) ? 1 : 0.4,
          marginTop: 16,
        }]}
        disabled={!feel || !fuel || !intensity || submitMut.isPending}
        onPress={() => submitMut.mutate()}
      >
        {submitMut.isPending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              {readiness.checkin ? "Update" : "Submit check-in"}
            </Text>}
      </TouchableOpacity>
    </Card>
  );
}

// ─────────────────────────────────────────
// Daily Intake Card
// ─────────────────────────────────────────
function DailyIntakeCard({
  date,
  targets: targetsProp,
  adjustedCalories: adjCalProp,
  adjustedCarbs: adjCarbsProp,
  fcOverride,
}: {
  date: string;
  targets?: Targets;
  adjustedCalories?: number;
  adjustedCarbs?: number;
  fcOverride?: FCOverrideState;
}) {
  const colors = useColors();
  const { data: localTargets } = useQuery<Targets>({
    queryKey: ["targets", date],
    queryFn: () => apiFetch(`/me/targets/effective?date=${date}`),
    enabled: !targetsProp,
  });

  const t = targetsProp ?? localTargets;
  if (!t) return null;

  const isFightCamp = t.mode === "fight_camp";
  const cal = adjCalProp ?? Math.round(t.adjustedCalories || t.targetCalories);
  const carbs = adjCarbsProp ?? Math.round(t.targetCarbs);

  const eaDecision = fcOverride?.eaDecision;
  const carbDecision = fcOverride?.carbDecision;
  const originallyLowEA = fcOverride?.originallyLowEA ?? false;
  const originallyLowCarb = fcOverride?.originallyLowCarb ?? false;

  // Re-compute effective EA after override (spec §9.14.3)
  const ffmKg = t.ffmKg;
  const serverCals = t.adjustedCalories || t.targetCalories;
  const exerciseKcal = ffmKg && t.eaValue != null ? serverCals - t.eaValue * ffmKg : 0;
  const effectiveEA = ffmKg && ffmKg > 0 ? Math.round((cal - exerciseKcal) / ffmKg) : t.eaValue;

  // Re-compute isLowCarb after override (spec §9.14.3)
  const bodyWeightKg = t.carbsPerKg && t.carbsPerKg > 0 ? t.targetCarbs / t.carbsPerKg : null;
  const postOverrideIsLowCarb = bodyWeightKg && exerciseKcal > 0 ? (carbs / bodyWeightKg) < 3 : false;

  const showEARow = isFightCamp && t.eaValue != null && fcOverride != null;
  const showCarbRow = isFightCamp && fcOverride != null && (originallyLowCarb || postOverrideIsLowCarb);

  // EA row styling
  const eaIsWarn = (effectiveEA != null ? effectiveEA < 30 : originallyLowEA) && eaDecision !== "accepted";
  const eaIsAccepted = originallyLowEA && eaDecision === "accepted";

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Daily Intake Estimates</Text>
        {isFightCamp && (
          <SmallBadge label="Fight Camp" color={colors.primary} bg={"rgba(255,122,0,0.1)"} />
        )}
      </View>

      <View style={styles.macroRow}>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: colors.foreground, fontSize: 22 }]}>{cal}</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>cal</Text>
        </View>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: "#93c5fd", fontSize: 22 }]}>{Math.round(t.targetProtein)}g</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>protein</Text>
        </View>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: "#f59e0b", fontSize: 22 }]}>{carbs}g</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>carbs</Text>
        </View>
        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={[styles.heroNum, { color: "#facc15", fontSize: 22 }]}>{Math.round(t.targetFat)}g</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>fat</Text>
        </View>
      </View>

      {/* EA row */}
      {showEARow && (
        <View style={[
          styles.eaRow,
          eaIsWarn
            ? { backgroundColor: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.3)", borderWidth: 1 }
            : { backgroundColor: colors.secondary + "80" },
        ]}>
          <Text style={[styles.xs, { color: eaIsWarn ? "#fb923c" : colors.mutedForeground, flex: 1 }]}>
            Energy Availability
          </Text>
          <Text style={[styles.xs, { color: eaIsWarn ? "#fb923c" : colors.mutedForeground, fontVariant: ["tabular-nums"] }]}>
            {effectiveEA ?? t.eaValue} kcal/kg FFM
          </Text>
          {eaIsAccepted && (
            <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 4 }]}>· adjusted ✓</Text>
          )}
          {(eaIsWarn || eaIsAccepted) && (
            <TouchableOpacity onPress={fcOverride!.openEAModal} style={{ marginLeft: 6 }}>
              <Text style={[styles.xs, { color: "#fb923c", textDecorationLine: "underline" }]}>
                {eaDecision === "declined" ? "Review" : eaIsAccepted ? "Review" : "Review →"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Low carb row */}
      {showCarbRow && !postOverrideIsLowCarb && originallyLowCarb && carbDecision === "accepted" && (
        <View style={[styles.eaRow, { backgroundColor: colors.secondary + "80" }]}>
          <Text style={[styles.xs, { color: colors.mutedForeground, flex: 1 }]}>Carbs adjusted to 3 g/kg</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]}>· adjusted ✓</Text>
          <TouchableOpacity onPress={fcOverride!.openCarbModal} style={{ marginLeft: 6 }}>
            <Text style={[styles.xs, { color: colors.mutedForeground, textDecorationLine: "underline" }]}>Review</Text>
          </TouchableOpacity>
        </View>
      )}
      {showCarbRow && postOverrideIsLowCarb && carbDecision !== "accepted" && (
        <View style={[styles.eaRow, { backgroundColor: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.3)", borderWidth: 1 }]}>
          <Text style={[styles.xs, { color: "#facc15", flex: 1 }]}>Carbs below 3 g/kg</Text>
          <TouchableOpacity onPress={fcOverride!.openCarbModal}>
            <Text style={[styles.xs, { color: "#facc15", textDecorationLine: "underline" }]}>
              {carbDecision === "declined" ? "Review" : "Review →"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

    </Card>
  );
}

// ─────────────────────────────────────────
// Supplements Today
// ─────────────────────────────────────────
function SupplementsToday({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const router = useRouter();
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
    // stackId/reminderId must be 0 (not null) in the POST body per spec §23.6
    mutationFn: (d: { supplementId: number; stackId: number | null; reminderId: number | null; taken: boolean }) =>
      apiFetch("/supplement-intakes", { method: "POST", body: {
        supplementId: d.supplementId,
        stackId: d.stackId ?? 0,
        reminderId: d.reminderId ?? 0,
        taken: d.taken,
        date,
      }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplement-intakes", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
    },
  });

  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Supplements — {displayDate}</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/supplements" as any)}>
          <SmallBadge label="Manage" color={colors.mutedForeground} bg={colors.secondary} />
        </TouchableOpacity>
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
                {/* Sub-line: "StackName at HH:MM" for stack slots, "at HH:MM" for direct reminders (§23.6) */}
                <Text style={[styles.xs, { color: colors.mutedForeground }]}>
                  {slot.stackName ? `${slot.stackName} at ${slot.time}` : `at ${slot.time}`}
                </Text>
                {slot.doseAmount != null && slot.doseUnit && (
                  <Text style={[styles.xs, { color: colors.mutedForeground, opacity: 0.7 }]}>
                    {slot.doseAmount} {slot.doseUnit}
                  </Text>
                )}
              </View>
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
  const unit = getCoreFoodUnit(food.name);
  const [count, setCount] = useState(unit ? unit.defaultCount : 1);
  const [size, setSize] = useState<UnitSize>(unit?.defaultSize ?? "medium");

  // Sync computed grams to parent whenever count/size changes (count mode)
  React.useEffect(() => {
    if (unit) {
      onGramsChange(String(computeUnitGrams(unit, count, size)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, size]);

  // Reset count/size when a different food is selected
  React.useEffect(() => {
    if (unit) {
      setCount(unit.defaultCount);
      setSize(unit.defaultSize ?? "medium");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.name]);

  const g = parseFloat(grams) || 100;
  const r = g / 100;
  const cal = Math.round(food.caloriesPer100g * r);
  const prot = rd1(food.proteinPer100g * r);
  const carbs = rd1(food.carbsPer100g * r);
  const fat = rd1(food.fatPer100g * r);
  const fibre = rd1(food.fibrePer100g * r);

  const SIZE_LABELS: { value: UnitSize; label: string }[] = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: "#eceef2", fontSize: 20, fontWeight: "700" }}>{food.name}</Text>
      {food.brand ? <Text style={{ color: "#6b7280" }}>{food.brand}</Text> : null}

      {unit ? (
        /* ── Count mode ── */
        <View style={{ gap: 12 }}>
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
            HOW MANY?
          </Text>

          {/* Count stepper */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 0 }}>
            <TouchableOpacity
              onPress={() => setCount(c => Math.max(1, c - 1))}
              style={{ width: 52, height: 52, borderRadius: 10, borderWidth: 1,
                borderColor: "#1a1e28", backgroundColor: "#181c26",
                alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#eceef2", fontSize: 24, fontWeight: "300" }}>−</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 52,
              borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#1a1e28", backgroundColor: "#181c26" }}>
              <Text style={{ color: "#eceef2", fontSize: 22, fontWeight: "700" }}>
                {count} <Text style={{ fontSize: 14, fontWeight: "400", color: "#9ca3af" }}>
                  {count === 1 ? unit.unitLabel : unit.unitLabel + "s"}
                </Text>
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCount(c => c + 1)}
              style={{ width: 52, height: 52, borderRadius: 10, borderWidth: 1,
                borderColor: "#1a1e28", backgroundColor: "#181c26",
                alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#ff7a00", fontSize: 24, fontWeight: "300" }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Size selector */}
          {unit.supportsSize && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>SIZE</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SIZE_LABELS.map(({ value, label }) => (
                  <TouchableOpacity key={value} onPress={() => setSize(value)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center",
                      borderWidth: 1,
                      borderColor: size === value ? "#ff7a00" : "#1a1e28",
                      backgroundColor: size === value ? "rgba(255,122,0,0.1)" : "#181c26" }}>
                    <Text style={{ color: size === value ? "#ff7a00" : "#6b7280",
                      fontWeight: "700", fontSize: 13 }}>{label}</Text>
                    {unit.gramsBySize && (
                      <Text style={{ color: size === value ? "#ff7a0099" : "#4b5563", fontSize: 10, marginTop: 2 }}>
                        {unit.gramsBySize[value]}g
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Resolved grams badge */}
          <Text style={{ color: "#4b5563", fontSize: 12, textAlign: "center" }}>
            = {g}g total
          </Text>
        </View>
      ) : (
        /* ── Grams mode ── */
        <View style={{ gap: 6 }}>
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 }}>
            SERVING SIZE (grams)
          </Text>
          <TextInput
            style={{ height: 52, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
              backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 22,
              textAlign: "center", color: "#eceef2" }}
            value={grams} onChangeText={onGramsChange} keyboardType="numeric" selectTextOnFocus
          />
        </View>
      )}

      {/* Macro summary */}
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
        style={{ backgroundColor: "#ff7a00", height: 54, borderRadius: 12,
          alignItems: "center", justifyContent: "center" }}>
        {isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Food</Text>}
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
// Edit Food Modal
// ─────────────────────────────────────────
const MEAL_META: { value: string; label: string; icon: string }[] = [
  { value: "breakfast", label: "Breakfast", icon: "coffee" },
  { value: "lunch",     label: "Lunch",     icon: "sun" },
  { value: "dinner",    label: "Dinner",    icon: "moon" },
  { value: "snack",     label: "Snack",     icon: "package" },
];

function EditFoodModal({ entry, date, onClose }: { entry: FoodEntry; date: string; onClose: () => void }) {
  const qc = useQueryClient();
  const unit = getCoreFoodUnit(entry.name);
  const baseGrams = entry.grams || 100;
  const refGrams = entry.normalizedGrams || baseGrams;

  // Infer initial count from stored grams
  const initSize: UnitSize = unit?.defaultSize ?? "medium";
  function inferCount(u: NonNullable<typeof unit>, s: UnitSize): number {
    if (u.supportsSize && u.gramsBySize) {
      return Math.max(1, Math.round(baseGrams / u.gramsBySize[s]));
    }
    return Math.max(1, Math.round(baseGrams / (u.gramsPerUnit ?? 100)));
  }

  // "count" | "grams" — count-mode foods default to count, others to grams
  const [amountMode, setAmountMode] = useState<"count" | "grams">(unit ? "count" : "grams");
  const [count, setCount] = useState(unit ? inferCount(unit, initSize) : 1);
  const [size, setSize] = useState<UnitSize>(initSize);
  const [mealOpen, setMealOpen] = useState(false);
  const [meal, setMeal] = useState(entry.meal ?? "breakfast");

  const [grams, setGrams] = useState(String(baseGrams));
  const [cal, setCal] = useState(String(entry.calories));
  const [protein, setProtein] = useState(String(entry.protein));
  const [carbs, setCarbs] = useState(String(entry.carbs));
  const [fat, setFat] = useState(String(entry.fat));
  const [fibre, setFibre] = useState(String(entry.fibre ?? 0));

  function recalcFromGrams(newGramsStr: string) {
    setGrams(newGramsStr);
    const g = parseFloat(newGramsStr);
    if (!g || !refGrams) return;
    const r = g / refGrams;
    setCal(String(Math.round(entry.calories * r)));
    setProtein(String(Math.round(entry.protein * r)));
    setCarbs(String(Math.round(entry.carbs * r)));
    setFat(String(Math.round(entry.fat * r)));
    setFibre(String(Math.round((entry.fibre ?? 0) * r)));
  }

  // In count mode, sync grams + macros whenever count/size changes
  React.useEffect(() => {
    if (unit && amountMode === "count") {
      recalcFromGrams(String(computeUnitGrams(unit, count, size)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, size, amountMode]);

  const patchMut = useMutation({
    mutationFn: () => apiFetch(`/food/${entry.id}`, {
      method: "PATCH",
      body: {
        meal,
        grams: Math.round(parseFloat(grams) || baseGrams),
        calories: Math.round(parseFloat(cal) || 0),
        protein: Math.round(parseFloat(protein) || 0),
        carbs: Math.round(parseFloat(carbs) || 0),
        fat: Math.round(parseFloat(fat) || 0),
        fibre: Math.round(parseFloat(fibre) || 0),
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
      onClose();
    },
  });

  const canSave = parseFloat(cal) >= 0 && !patchMut.isPending;
  const currentMeal = MEAL_META.find(m => m.value === meal) ?? MEAL_META[0];

  const fieldStyle: object = {
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
    backgroundColor: "#181c26", paddingHorizontal: 12, color: "#eceef2", fontSize: 15,
  };
  const labelStyle = { color: "#9ca3af", fontSize: 13, fontWeight: "500" as const, marginBottom: 6 };

  const SIZE_OPTIONS: { value: UnitSize; label: string }[] = [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
          <Text style={{ color: "#eceef2", fontSize: 16, fontWeight: "700", flex: 1 }} numberOfLines={1}>
            Edit: {entry.name}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 12 }}>
            <Feather name="x" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">

            {/* Meal selector */}
            <View>
              <Text style={labelStyle}>Meal</Text>
              <TouchableOpacity
                onPress={() => setMealOpen(o => !o)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10,
                  height: 48, borderRadius: 10, borderWidth: 2,
                  borderColor: mealOpen ? "#ff7a00" : "#2a2e3a",
                  backgroundColor: "#181c26", paddingHorizontal: 14 }}>
                <Feather name={currentMeal.icon as any} size={16} color="#ff7a00" />
                <Text style={{ flex: 1, color: "#eceef2", fontWeight: "600", fontSize: 15 }}>
                  {currentMeal.label}
                </Text>
                <Feather name={mealOpen ? "chevron-up" : "chevron-down"} size={16} color="#6b7280" />
              </TouchableOpacity>
              {mealOpen && (
                <View style={{ marginTop: 4, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
                  backgroundColor: "#181c26", overflow: "hidden" }}>
                  {MEAL_META.map(m => (
                    <TouchableOpacity key={m.value}
                      onPress={() => { setMeal(m.value); setMealOpen(false); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12,
                        paddingHorizontal: 14, paddingVertical: 13,
                        borderBottomWidth: m.value === "snack" ? 0 : 1, borderBottomColor: "#1a1e28",
                        backgroundColor: meal === m.value ? "rgba(255,122,0,0.08)" : "transparent" }}>
                      <Feather name={m.icon as any} size={15} color={meal === m.value ? "#ff7a00" : "#6b7280"} />
                      <Text style={{ color: meal === m.value ? "#ff7a00" : "#eceef2",
                        fontWeight: meal === m.value ? "700" : "400", fontSize: 14 }}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Amount + Count/Grams toggle */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[labelStyle, { marginBottom: 0, fontSize: 14, fontWeight: "600", color: "#eceef2" }]}>
                Amount
              </Text>
              {unit && (
                <View style={{ flexDirection: "row", borderRadius: 8, overflow: "hidden",
                  borderWidth: 1, borderColor: "#2a2e3a" }}>
                  {(["count", "grams"] as const).map(mode => (
                    <TouchableOpacity key={mode} onPress={() => setAmountMode(mode)}
                      style={{ paddingHorizontal: 16, paddingVertical: 7,
                        backgroundColor: amountMode === mode ? "#ff7a00" : "#181c26" }}>
                      <Text style={{ color: amountMode === mode ? "#fff" : "#9ca3af",
                        fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>
                        {mode === "count" ? "Count" : "Grams"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {amountMode === "count" && unit ? (
              <View style={{ gap: 12 }}>
                {/* Size pills */}
                {unit.supportsSize && (
                  <View>
                    <Text style={labelStyle}>Size</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {SIZE_OPTIONS.map(({ value, label }) => (
                        <TouchableOpacity key={value} onPress={() => setSize(value)}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center",
                            borderWidth: 1,
                            borderColor: size === value ? "#ff7a00" : "#2a2e3a",
                            backgroundColor: size === value ? "rgba(255,122,0,0.15)" : "#181c26" }}>
                          <Text style={{ color: size === value ? "#ff7a00" : "#6b7280",
                            fontWeight: "700", fontSize: 13 }}>{label}</Text>
                          {unit.gramsBySize && (
                            <Text style={{ color: size === value ? "rgba(255,122,0,0.7)" : "#374151",
                              fontSize: 11, marginTop: 2 }}>
                              {unit.gramsBySize[value]}g
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Count stepper row */}
                <View>
                  <Text style={labelStyle}>{unit.unitLabel.charAt(0).toUpperCase() + unit.unitLabel.slice(1)}s</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <TouchableOpacity onPress={() => setCount(c => Math.max(1, c - 1))}
                      style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1,
                        borderColor: "#2a2e3a", backgroundColor: "#181c26",
                        alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#eceef2", fontSize: 22, lineHeight: 26 }}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ color: "#eceef2", fontSize: 28, fontWeight: "700", minWidth: 36, textAlign: "center" }}>
                      {count}
                    </Text>
                    <TouchableOpacity onPress={() => setCount(c => c + 1)}
                      style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1,
                        borderColor: "#2a2e3a", backgroundColor: "#181c26",
                        alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#ff7a00", fontSize: 22, lineHeight: 26 }}>+</Text>
                    </TouchableOpacity>
                    <Text style={{ color: "#6b7280", fontSize: 13, marginLeft: 4 }}>≈{grams}g total</Text>
                  </View>
                </View>
              </View>
            ) : (
              /* Grams mode */
              <View>
                <Text style={labelStyle}>Grams</Text>
                <TextInput style={fieldStyle} keyboardType="decimal-pad" value={grams} onChangeText={recalcFromGrams} />
              </View>
            )}

            {/* Macro grid — matches web app: Grams+Calories | Protein+Carbs | Fat+Fibre */}
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Grams</Text>
                  <TextInput style={fieldStyle} keyboardType="decimal-pad" value={grams}
                    onChangeText={amountMode === "grams" ? recalcFromGrams : setGrams}
                    editable={amountMode === "grams"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Calories</Text>
                  <TextInput style={fieldStyle} keyboardType="decimal-pad" value={cal} onChangeText={setCal} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Protein (g)</Text>
                  <TextInput style={fieldStyle} keyboardType="decimal-pad" value={protein} onChangeText={setProtein} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Carbs (g)</Text>
                  <TextInput style={fieldStyle} keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Fat (g)</Text>
                  <TextInput style={fieldStyle} keyboardType="decimal-pad" value={fat} onChangeText={setFat} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Fibre (g)</Text>
                  <TextInput style={fieldStyle} keyboardType="decimal-pad" value={fibre} onChangeText={setFibre} />
                </View>
              </View>
            </View>

            {patchMut.error && (
              <Text style={{ color: "#f87171", fontSize: 12 }}>{(patchMut.error as Error).message}</Text>
            )}

            <TouchableOpacity
              style={{ height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center",
                backgroundColor: "#ff7a00", opacity: canSave ? 1 : 0.4, marginTop: 4 }}
              disabled={!canSave} onPress={() => patchMut.mutate()}>
              {patchMut.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Changes</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);

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
    const isIngredient = food.sourceType === "ingredient";
    const apiSourceType = isOff ? "off" : isIngredient ? "ingredient" : "manual";
    const isRaw = /\(raw\)/i.test(food.name);
    const hasMappedIngredient = food.ingredientIndex != null;
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
      microSource: (isIngredient || hasMappedIngredient) ? "ingredient" : "none",
      enteredBasis: isRaw ? "raw" : "cooked",
      ...(food.offBarcode && { offBarcode: food.offBarcode }),
      ...(food.ingredientIndex != null && { ingredientIndex: food.ingredientIndex }),
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
                    {e.grams ? ` · ${e.grams}g` : ""}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  <TouchableOpacity onPress={() => setEditingEntry(e)} style={{ padding: 6 }}>
                    <Feather name="edit-2" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteMut.mutate(e.id)} style={{ padding: 6 }}>
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
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

      {editingEntry && (
        <EditFoodModal entry={editingEntry} date={date} onClose={() => setEditingEntry(null)} />
      )}
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
  const [quickLogVisible, setQuickLogVisible] = useState(false);

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

  const isFightCamp = targets?.mode === "fight_camp";

  // Training summary for non-fight-camp add-back (§9.15.5)
  const { data: trainingSummary } = useQuery<{ totalKcal: number; totalKcalAdjusted: number; isRestDay: boolean }>({
    queryKey: ["training-summary", selectedDate],
    queryFn: () => apiFetch(`/me/training/summary/${selectedDate}`),
    enabled: !isFightCamp,
  });
  const fcOverride = useFightCampOverride({
    userId: user?.id,
    date: selectedDate,
    planId: targets?.planId,
    planFightDate: targets?.planFightDate,
    planTargetWeight: targets?.planTargetWeight,
    isLowEA: targets?.isLowEA ?? false,
    isLowCarb: targets?.isLowCarb ?? false,
    eaRecommendedCalories: targets?.eaRecommendedCalories,
    carbRecommendedG: targets?.carbRecommendedG,
    serverCalories: targets?.adjustedCalories ?? targets?.targetCalories ?? 2000,
    serverProtein: targets?.targetProtein ?? 150,
    serverFat: targets?.targetFat ?? 70,
    isFightCamp,
  });

  // Performance toast (spec §9.14.7)
  useEffect(() => {
    if (!isFightCamp || !targets?.isBelowPerformanceCarb || !targets?.performanceCarbWarning || !fcOverride.shouldShowPerfToast) return;
    const timer = setTimeout(() => {
      Alert.alert("Performance note", targets.performanceCarbWarning ?? "");
      fcOverride.markPerfToastShown();
    }, 1500);
    return () => clearTimeout(timer);
  }, [isFightCamp, selectedDate, targets?.isBelowPerformanceCarb, targets?.performanceCarbWarning, fcOverride.shouldShowPerfToast]);

  // Compute adjusted targets (spec §9.14.3 fight-camp, §9.15.5 standard)
  const adjustedCalories = (() => {
    if (isFightCamp) {
      // Fight camp: server bakes training in; apply consent override on top
      return fcOverride.overrideCalories ?? targets?.adjustedCalories ?? targets?.targetCalories ?? 2000;
    }
    // Standard: client adds training credit on top of server base
    const baseCalories = targets?.targetCalories ?? 2000;
    const goal = user?.goal ?? "maintenance";
    const creditPct: Record<string, number> = { fat_loss: 0.5, maintenance: 0.75, weight_gain: 1.0 };
    const pct = creditPct[goal] ?? 0.75;
    const trainingKcal = trainingSummary?.totalKcalAdjusted ?? trainingSummary?.totalKcal ?? 0;
    let cal = baseCalories + Math.round(trainingKcal * pct);
    // Fat-loss cap: deficit ≤ 1% BW/week (§9.15.5)
    if (goal === "fat_loss" && user?.weight) {
      const maxDailyDeficit = Math.round((0.01 * user.weight * 7700) / 7);
      const tdee = (targets as any)?.tdee ?? baseCalories + 500;
      if (tdee - cal > maxDailyDeficit) cal = tdee - maxDailyDeficit;
    }
    return cal;
  })();
  const adjustedCarbs = (() => {
    if (isFightCamp) {
      if (fcOverride.overrideCarbs != null) return fcOverride.overrideCarbs;
      if (fcOverride.overrideCalories != null) {
        const p = targets?.targetProtein ?? 150;
        const f = targets?.targetFat ?? 70;
        return Math.round(Math.max(0, fcOverride.overrideCalories - p * 4 - f * 9) / 4);
      }
      return targets?.targetCarbs ?? 200;
    }
    // Standard: extra calories from training credit go to carbs
    const baseCalories = targets?.targetCalories ?? 2000;
    const baseCarbs = targets?.targetCarbs ?? 200;
    return baseCarbs + Math.round(Math.max(0, adjustedCalories - baseCalories) / 4);
  })();

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
  // Use override-adjusted values for progress tracking
  const effectiveTargetCalories = adjustedCalories;
  const effectiveTargetCarbs = adjustedCarbs;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.logo, { color: colors.primary }]}>PRFMR</Text>
        <Text style={[styles.xs, { color: colors.mutedForeground }]}>{format(new Date(), "EEE, d MMM yyyy")}</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Morning Check-In Gate ("Start your day" modal) */}
        {isToday && <MorningCheckInGate date={selectedDate} />}

        {/* Fight Camp Hero */}
        {isToday && <FightCampHero date={selectedDate} />}

        {/* Morning Check-In */}
        {isToday && <MorningCheckIn date={selectedDate} />}

        {/* Readiness + Fuel Summary Card */}
        <ReadinessSummaryCard date={selectedDate} />

        {/* Provisional Check-In (hidden when sleep is logged) */}
        {isToday && <ProvisionalCheckIn date={selectedDate} />}

        {/* Daily Intake Estimates */}
        <DailyIntakeCard
          date={selectedDate}
          targets={targets}
          adjustedCalories={effectiveTargetCalories}
          adjustedCarbs={effectiveTargetCarbs}
          fcOverride={isFightCamp ? fcOverride : undefined}
        />

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
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setQuickLogVisible(true)}>
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
          <MacroCard label="Calories" value={totals.calories} unit=" kcal" target={effectiveTargetCalories} color={colors.primary} emoji="🔥" />
          <MacroCard label="Protein" value={totals.protein} unit="g" target={t.targetProtein} color="#93c5fd" emoji="🥩" />
          <MacroCard label="Carbs" value={totals.carbs} unit="g" target={effectiveTargetCarbs} color="#f59e0b" emoji="🌾" />
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

      {/* Floating Action Button — Quick Log */}
      <TouchableOpacity
        onPress={() => setQuickLogVisible(true)}
        style={{
          position: "absolute",
          bottom: 90,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: "#ff7a00",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#ff7a00",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 8,
          elevation: 8,
          zIndex: 100,
        }}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Quick Log Modal */}
      <QuickLogModal
        visible={quickLogVisible}
        onClose={() => setQuickLogVisible(false)}
        date={selectedDate}
      />

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

      {/* EA Modal — owned by DashboardScreen so state updates show immediately */}
      {isFightCamp && targets && (
        <Modal visible={fcOverride.eaModalOpen} transparent animationType="fade" onRequestClose={fcOverride.closeEAModal}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={fcOverride.closeEAModal}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.alertCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 6 }]}>Low energy availability</Text>
                <Text style={[styles.xs, { color: colors.mutedForeground, lineHeight: 18, marginBottom: 14 }]}>
                  Your current intake appears to be below the level typically used to support recovery and performance
                  {" "}{"(<"}30 kcal/kg FFM).{"\n\n"}
                  Increasing your intake may help improve energy levels, training quality, and recovery.
                  This may slightly slow weight loss, but can better support performance.{"\n\n"}
                  This is general performance guidance, not medical advice.
                </Text>
                <View style={{ gap: 8, marginBottom: 8 }}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.xs, { color: colors.mutedForeground }]}>Current EA</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.xs, { color: colors.foreground, fontWeight: "600" }]}>
                        {targets.eaValue} kcal/kg FFM
                      </Text>
                      <Text style={[styles.xs, { color: colors.mutedForeground }]}>
                        {targets.adjustedCalories || targets.targetCalories} kcal/day
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.xs, { color: colors.mutedForeground }]}>Calories needed for EA 30</Text>
                    <Text style={[styles.xs, { color: colors.primary, fontWeight: "600" }]}>
                      {targets.eaRecommendedCalories} kcal
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.primaryBtn, { marginBottom: 8 }]} onPress={fcOverride.acceptEA}>
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                    Adjust target to {targets.eaRecommendedCalories} kcal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border }]} onPress={fcOverride.declineEA}>
                  <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>Keep current plan</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Carb Modal */}
      {isFightCamp && targets && (
        <Modal visible={fcOverride.carbModalOpen} transparent animationType="fade" onRequestClose={fcOverride.closeCarbModal}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={fcOverride.closeCarbModal}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.alertCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 6 }]}>Low carbohydrate intake</Text>
                <Text style={[styles.xs, { color: colors.mutedForeground, lineHeight: 18, marginBottom: 14 }]}>
                  Carbohydrate intake is below the minimum recommended for athletes (~3 g/kg bodyweight).
                  This may impact training performance and recovery (IOC / ISSN guidelines).
                </Text>
                <View style={{ gap: 8, marginBottom: 8 }}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.xs, { color: colors.mutedForeground }]}>Current carbs</Text>
                    <Text style={[styles.xs, { color: colors.foreground, fontWeight: "600" }]}>
                      {targets.carbsPerKg != null ? targets.carbsPerKg.toFixed(1) : "—"} g/kg
                    </Text>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.xs, { color: colors.mutedForeground }]}>Suggested minimum</Text>
                    <Text style={[styles.xs, { color: colors.primary, fontWeight: "600" }]}>
                      {targets.carbRecommendedG}g (3 g/kg)
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.primaryBtn, { marginBottom: 8 }]} onPress={fcOverride.acceptCarb}>
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                    Adjust carbs to {targets.carbRecommendedG}g
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border }]} onPress={fcOverride.declineCarb}>
                  <Text style={{ color: colors.foreground, fontWeight: "500", fontSize: 14 }}>Keep current plan</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
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
  ciSummaryCol: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 4 },
  fullBtn: { borderRadius: 9, padding: 14, alignItems: "center" },
  macroRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  eaRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, gap: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  alertCard: { width: "100%", maxWidth: 380, borderRadius: 14, borderWidth: 1, padding: 20 },
  primaryBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", backgroundColor: "#ff7a00" },
  outlineBtn: { borderRadius: 10, paddingVertical: 13, alignItems: "center", borderWidth: 1 },
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
