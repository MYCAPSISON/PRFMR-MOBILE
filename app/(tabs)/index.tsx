import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert, FlatList, Image, Dimensions,
  KeyboardAvoidingView, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays, subWeeks } from "date-fns";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";
import { useRouter } from "expo-router";
import Svg, { Path as SvgPath, Polyline, Polygon as SvgPolygon, Circle as SvgCircle, Line as SvgLine, Text as SvgText, Rect as SvgRect } from "react-native-svg";
import { INGREDIENTS_DATA } from "../../lib/ingredients-data";
import { useFightCampOverride, type FCOverrideState } from "../../hooks/useFightCampOverride";
import { getCoreFoodUnit, computeUnitGrams, type UnitSize } from "../../lib/coreFoodUnits";
import { QuickLogModal } from "../../components/QuickLogModal";
import { useToast } from "../../components/AppToast";
import { AppLogoHeader } from "../../components/AppLogoHeader";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

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
  requiredWeeklyRate?: number;
  requiredWeeklyRatePct?: number;
  recommendedWeeklyRate?: number;
  recommendedWeeklyRatePct?: number;
  dayMinus4Target: number | null;
  predictedWeekMinus1Weight?: number | null;
  predictedDayMinus4Weight?: number | null;
  weeklyRate: number;
  weeklyRatePct: number;
  status: string;
  statusLabel: string;
  weeklyTargets: Array<{ week: number; targetWeight: number }>;
  suggestedDeficitKcal: number;
  weighInTiming: "same_day" | "day_before";
  manualTempReductionKg: number | null;
  bodyweightSource?: "log" | "profile";
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

function showWeightLogError(err: unknown) {
  const message = err instanceof Error ? err.message : "Please try again.";
  Alert.alert("Weight not logged", message);
}

function getErrorMessage(err: unknown, fallback = "Please try again.") {
  return err instanceof Error ? err.message : fallback;
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
  enteredBasis?: string;
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

interface AmqsGap {
  microKey: string;
  label: string;
  pctOfTarget: number;
  suggestion?: string;
}

interface AmqsScore {
  score: number;
  tier: "Elite" | "Optimal" | "Good" | "Fair" | "Basic";
  confidence: "Low" | "Medium" | "High";
  allMet: boolean;
  topGaps: AmqsGap[];
  layer2Score?: number;
  layer2Tier?: string;
  layer2TopGaps?: AmqsGap[];
  coverageStats?: {
    totalFoodEntries?: number;
    totalTakenSupplements?: number;
    overallCoverage?: number;
  };
}

interface AmqsTrendLayer {
  currentWeekAvg: number;
  prevWeekAvg: number;
  delta: number;
  trend: "improving" | "slightly_down" | "steady";
  dailyScores: { date: string; score: number }[];
}

interface AmqsTrend {
  layer1: AmqsTrendLayer;
  layer2: AmqsTrendLayer;
}

const AMQS_TIER_COLOR: Record<string, string> = {
  Elite: "#10b981",
  Optimal: "#3b82f6",
  Good: "#f59e0b",
  Fair: "#94a3b8",
  Basic: "#94a3b8",
};

const AMQS_CONFIDENCE_VALUE: Record<string, number> = { High: 100, Medium: 60, Low: 30 };

function amqsGapPercent(gap: AmqsGap) {
  return Math.max(0, Math.min(100, Math.round(gap.pctOfTarget)));
}

function amqsGapPointEstimate(gap: AmqsGap) {
  return Math.min(8, Math.max(2, Math.round(((100 - gap.pctOfTarget) / 100) * 7)));
}

function formatAmqsTrendLine(layer?: AmqsTrendLayer) {
  if (!layer) return "";
  if (layer.prevWeekAvg === 0) return "still building";
  if (layer.trend === "improving") return `↑ +${layer.delta} vs last week`;
  if (layer.trend === "slightly_down") return `↓ ${layer.delta} vs last week`;
  return "→ steady vs last week";
}

function amqsTrendLineColor(layer?: AmqsTrendLayer) {
  if (!layer || layer.prevWeekAvg === 0) return "#6b7280";
  if (layer.trend === "improving") return "#10b981";
  if (layer.trend === "slightly_down") return "#fb923c";
  return "#6b7280";
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
let lastAmqsToastTime = 0;
const AMQS_TOAST_DEBOUNCE_MS = 5000;

function getPaceInfo(weeklyRatePct: number) {
  if (weeklyRatePct < 0.5) return { label: "Easy pace", color: "#6b7280", note: "Comfortable pace — you have time." };
  if (weeklyRatePct <= 0.75) return { label: "Moderate pace", color: "#ff7a00", note: "Steady sustainable deficit." };
  return { label: "Aggressive pace", color: "#fb923c", note: "Quite fast — consider extending timeline" };
}

function getWeightCutStatusLabel(plan: WeightCutData) {
  if (plan.statusLabel) return plan.statusLabel;
  if (plan.daysUntil <= 0) return "Fight date has passed";
  if (plan.totalToLose <= 0) return "Already at or below target";
  const pct = plan.requiredWeeklyRatePct;
  if (typeof pct !== "number") return "On track";
  if (pct <= 0.5) return "Steady pace";
  if (pct <= 1.0) return "On track";
  if (pct <= 1.5) return "Quite aggressive — consider extending timeline";
  if (pct <= 2.0) return "Very aggressive — adjust target or date";
  return "Timeline too tight — adjust target or date";
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
    imageUrl: item.image ?? item.imageUrl ?? item.image_url ?? item.image_front_thumb_url
      ?? item.off?.image_url ?? item.off?.image_front_thumb_url ?? undefined,
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

function MacroCard({ label, value, unit, target, color, icon }: {
  label: string; value: number; unit: string; target: number; color: string; icon: string;
}) {
  const colors = useColors();
  const pct = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  return (
    <Card style={[styles.macroCard, { borderLeftColor: color }]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <MaterialCommunityIcons name={icon as any} size={24} color={`${colors.mutedForeground}80`} />
      </View>
      <Text style={[styles.macroValue, { color: colors.foreground }]}>
        {Math.round(value)}<Text style={[styles.macroUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </Text>
      <View style={styles.rowBetween}>
        <Text style={[styles.macroMeta, { color: colors.mutedForeground }]}>Target: {Math.round(target)}</Text>
        <Text style={[styles.macroMeta, { color: colors.mutedForeground }]}>{pct}%</Text>
      </View>
      <ProgressBar value={value} max={target} color={colors.primary} />
    </Card>
  );
}

const SPORT_ICON_SOURCES = {
  boxing: require("@/assets/sport-icons/boxing.png"),
  wrestling: require("@/assets/sport-icons/wrestling.png"),
  traditional: require("@/assets/sport-icons/traditional.png"),
  mma: require("@/assets/sport-icons/mma.png"),
  bjj: require("@/assets/sport-icons/bjj.png"),
  kickboxing: require("@/assets/sport-icons/kickboxing.png"),
  "muay-thai": require("@/assets/sport-icons/muay-thai.png"),
} as const;

function sportIconSource(label: string | null | undefined) {
  const normalised = (label ?? "").toLowerCase().replace(/[_\s]+/g, "-");
  if (normalised.includes("muay")) return SPORT_ICON_SOURCES["muay-thai"];
  if (normalised.includes("kick")) return SPORT_ICON_SOURCES.kickboxing;
  if (normalised.includes("box")) return SPORT_ICON_SOURCES.boxing;
  if (normalised.includes("wrest")) return SPORT_ICON_SOURCES.wrestling;
  if (normalised.includes("bjj") || normalised.includes("jiu")) return SPORT_ICON_SOURCES.bjj;
  if (normalised.includes("mma")) return SPORT_ICON_SOURCES.mma;
  if (normalised.includes("martial") || normalised.includes("traditional")) return SPORT_ICON_SOURCES.traditional;
  return undefined;
}

function SportIdentityPill({ label }: { label: string }) {
  const colors = useColors();
  const icon = sportIconSource(label);
  return (
    <View
      style={[styles.sportPill, { borderColor: colors.mutedForeground, backgroundColor: colors.secondary }]}
      testID="badge-main-sport"
    >
      {icon ? <Image source={icon} style={styles.sportIcon} resizeMode="contain" /> : null}
      <Text style={[styles.sm, { color: colors.foreground, fontWeight: "700", marginLeft: icon ? 8 : 0 }]}>
        {label}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Fight Camp Hero
// ─────────────────────────────────────────
function FightCampHero({ date }: { date: string }) {
  const colors = useColors();
  const qc = useQueryClient();
  const { showToast } = useToast();

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
    onError: (err) => showToast({
      title: "Weight not logged",
      description: getErrorMessage(err),
      variant: "destructive",
    }),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch("/me/weight-cut", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      if (dialogMode === "edit") {
        showToast({ title: "Fight camp plan updated 🎯" });
      }
      setDialogMode(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => apiFetch("/me/weight-cut", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      showToast({ title: "Weight cut plan removed" });
    },
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
  const hasWeightForDate = recentWeights.some(entry => entry.date?.slice(0, 10) === date);
  const isPlanDateToday = date === format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (hasWeightForDate && showWeight) {
      setShowWeight(false);
      setWeightVal("");
    }
  }, [hasWeightForDate, showWeight]);

  // ─── CREATE / EDIT MODAL ───────────────────────────────────────
  const formModal = (
    <Modal visible={dialogMode !== null} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={() => setDialogMode(null)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View>
              <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>
                {dialogMode === "edit" ? "Edit Fight Camp Plan" : "Set Up Fight Camp Plan"}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {dialogMode === "edit"
                  ? "Update your target or timeline — the plan recalculates automatically."
                  : "Plan a gradual weight cut targeting 0.5–1.0% bodyweight per week."}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setDialogMode(null)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {/* Current Weight */}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Current Weight (kg)</Text>
            <TextInput
              style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                color: colors.foreground, padding: 12, fontSize: 15, marginBottom: 14 }}
              placeholder="e.g. 77.2"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={formCW}
              onChangeText={setFormCW}
            />
            {/* Fight Weight */}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Fight Weight (kg)</Text>
            <TextInput
              style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                color: colors.foreground, padding: 12, fontSize: 15, marginBottom: 14 }}
              placeholder="e.g. 72.0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={formTW}
              onChangeText={setFormTW}
            />
            {/* Fight Date */}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Fight Date (YYYY-MM-DD)</Text>
            <TextInput
              style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
                color: colors.foreground, padding: 12, fontSize: 15, marginBottom: 14 }}
              placeholder="2025-09-15"
              placeholderTextColor={colors.mutedForeground}
              value={formDate}
              onChangeText={setFormDate}
            />
            {/* Weigh-In Timing */}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Weigh-In Timing</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              {([
                { value: "same_day" as const, label: "Same day", sub: "Weigh in on fight day" },
                { value: "day_before" as const, label: "Day before", sub: "Weigh in the evening prior" },
              ] as const).map(opt => (
                <TouchableOpacity key={opt.value} onPress={() => setFormTiming(opt.value)}
                  style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: "center",
                    borderColor: formTiming === opt.value ? colors.primary : colors.border,
                    backgroundColor: formTiming === opt.value ? `${colors.primary}19` : colors.input }}>
                  <Text style={{ color: formTiming === opt.value ? colors.foreground : colors.mutedForeground, fontWeight: "600", fontSize: 13 }}>{opt.label}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2, textAlign: "center" }}>{opt.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginBottom: 14 }}>
              {formTiming === "same_day"
                ? "Same-day: plan targets fight weight by fight week."
                : "Day-before timing: a small additional buffer is factored in."}
            </Text>
            {/* Advanced options */}
            <TouchableOpacity onPress={() => setShowAdvanced(v => !v)} style={{ marginBottom: 10 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                {showAdvanced ? "▲" : "▼"} Advanced options
              </Text>
            </TouchableOpacity>
            {showAdvanced && (
              <View style={{ backgroundColor: colors.input, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 14 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Manual temp. reduction override (kg)</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                    color: colors.foreground, padding: 10, fontSize: 14, marginBottom: 8 }}
                  placeholder="Leave blank to use automatic estimate"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  value={formManualTemp}
                  onChangeText={setFormManualTemp}
                />
                <Text style={{ color: colors.mutedForeground, fontSize: 11, lineHeight: 16 }}>
                  {"Overrides the automatic water-weight estimate (2–6% BW) with your own value.\nLeave blank to keep automatic calculation.\nThis app does not provide acute weight-cut guidance."}
                </Text>
              </View>
            )}
            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={createMut.isPending || !formCW || !formTW || !formDate}
              style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: "center",
                opacity: (createMut.isPending || !formCW || !formTW || !formDate) ? 0.5 : 1 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                {createMut.isPending ? "Saving…" : dialogMode === "edit" ? "Update Plan" : "Start Camp Plan"}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, textAlign: "center", marginTop: 10, marginBottom: 20 }}>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View>
            <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>Plan breakdown</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>How your weight cut is structured.</Text>
          </View>
          <TouchableOpacity onPress={() => setShowBreakdown(false)}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={{ backgroundColor: colors.input, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden", marginBottom: 14 }}>
            {/* Fat loss target */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Fat loss target</Text>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>{(plan.fatLossRequired ?? plan.totalToLose).toFixed(1)} kg</Text>
            </View>
            {/* Temp cut */}
            {(plan.tempCutDisplayed ?? 0) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Temporary reduction</Text>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>~{(plan.tempCutDisplayed).toFixed(1)} kg</Text>
              </View>
            )}
            {(plan.tempCutDisplayed ?? 0) === 0 && (plan.tempCut ?? 0) > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Estimated temp.</Text>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>~{(plan.tempCut).toFixed(1)} kg</Text>
              </View>
            )}
            {/* D-4 row — only within 10 days */}
            {plan.dayMinus4Target !== null && plan.daysUntil <= 10 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Target by D−4</Text>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>≤ {(plan.dayMinus4Target!).toFixed(1)} kg</Text>
              </View>
            )}
            {/* Fat-loss pace */}
            {pace && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Fat-loss pace</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <View style={{ backgroundColor: pace.color + "20", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: pace.color, fontWeight: "700", fontSize: 12 }}>{pace.label}</Text>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 3 }}>{pace.note}</Text>
                </View>
              </View>
            )}
            {/* Daily deficit */}
            {plan.suggestedDeficitKcal > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 13 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Daily deficit target</Text>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>~{Math.round(plan.suggestedDeficitKcal)} kcal</Text>
              </View>
            )}
          </View>
          {/* Weekly targets */}
          {plan.weeklyTargets?.length > 0 && (
            <View style={{ backgroundColor: colors.input, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.mutedForeground, fontWeight: "700", fontSize: 11, letterSpacing: 0.5 }}>WEEKLY WEIGHT TARGETS</Text>
              </View>
              {plan.weeklyTargets.map((wt) => (
                <View key={wt.week} style={{ flexDirection: "row", justifyContent: "space-between", padding: 11, borderBottomWidth: 1, borderBottomColor: `${colors.border}40` }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Week {wt.week}</Text>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>{wt.targetWeight.toFixed(1)} kg</Text>
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
      <Card style={styles.fightCampCard}>
        {/* Header row: Fight Camp label | status badge | edit | delete */}
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Feather name="target" size={14} color={colors.primary} />
            <Text style={styles.fightCampHeaderText}>Fight Camp</Text>
          </View>
          <View style={styles.row}>
            {statusColor && (
              <View style={{ backgroundColor: statusColor.bg, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3,
                borderWidth: 1, borderColor: statusColor.border, marginRight: 8 }}>
                <Text style={{ color: statusColor.text, fontWeight: "700", fontSize: 12, fontFamily: "Inter_700Bold" }}>{getWeightCutStatusLabel(plan)}</Text>
              </View>
            )}
            <TouchableOpacity onPress={openEdit} style={{ marginRight: 10 }}>
              <Feather name="edit-2" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              Alert.alert("Delete plan", "Remove this fight camp plan?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() },
              ]);
            }}>
              <Feather name="trash-2" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Countdown */}
        <View style={styles.fightCountdownRow}>
          <Feather name="calendar" size={21} color={colors.primary} />
          <Text style={styles.fightCountdownText}>
            {plan.daysUntil === 1 ? "1 day" : `${plan.daysUntil} days`}{" "}
            <Text style={styles.fightCountdownSub}>to fight night</Text>
          </Text>
        </View>

        {/* Inline weight logging */}
        {!hasWeightForDate && !showWeight ? (
          <TouchableOpacity
            style={styles.fightWeightCta}
            onPress={() => setShowWeight(true)}>
            <MaterialCommunityIcons name="scale-balance" size={17} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 11 }}>
              <Text style={styles.fightWeightCtaTitle}>
                {isPlanDateToday ? "Log today's weight" : "Log weight for this date"}
              </Text>
              <Text style={styles.fightWeightCtaSub}>Updates your cut trend</Text>
            </View>
            <Text style={styles.fightWeightCtaTap}>Tap →</Text>
          </TouchableOpacity>
        ) : !hasWeightForDate ? (
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
        ) : null}

        {/* 3-panel weight row */}
        <View style={styles.fightStatsRow}>
          <View style={styles.fightStatCell}>
            <Text style={styles.fightStatNumber}>{plan.currentWeight}</Text>
            <Text style={styles.fightStatLabel}>CURRENT KG</Text>
          </View>
          <View style={styles.fightStatCell}>
            <Feather name="trending-down" size={17} color={colors.primary} style={{ marginBottom: 4 }} />
            <Text style={styles.fightMiddleNumber}>{plan.totalToLose.toFixed(1)} kg to go</Text>
            <Text style={styles.fightMiddleLabel}>{plan.weeklyRate.toFixed(2)} kg/wk fat loss</Text>
          </View>
          <View style={styles.fightStatCell}>
            <Text style={styles.fightStatNumber}>{plan.targetWeight}</Text>
            <Text style={styles.fightStatLabel}>FIGHT WEIGHT</Text>
          </View>
        </View>

        {/* Pace badge row */}
        {pace && (
          <TouchableOpacity
            onPress={() => setShowBreakdown(true)}
            style={styles.fightSectionRow}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open plan breakdown"
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
              <View style={{ backgroundColor: pace.color + "20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                borderWidth: 1, borderColor: pace.color + "40" }}>
                <Text style={{ color: pace.color, fontWeight: "700", fontSize: 12, fontFamily: "Inter_700Bold" }}>{pace.label}</Text>
              </View>
              {!!pace.note && (
                <Text style={styles.fightPaceNote} numberOfLines={1}>{pace.note}</Text>
              )}
            </View>
            <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* This week's target */}
        {thisWeekTarget && (
          <View style={styles.fightSectionBlock}>
            <Text style={styles.fightInlineTarget}>
              <Text style={styles.fightTargetLabel}>THIS WEEK'S TARGET</Text>
              {"  "}
              {thisWeekTarget.targetWeight.toFixed(1)} kg
              {plan.suggestedDeficitKcal > 0 && (
                <Text style={styles.fightTargetMuted}> · ~{Math.round(plan.suggestedDeficitKcal)} kcal deficit/day</Text>
              )}
            </Text>
          </View>
        )}

        {/* Trend message */}
        {trend && (
          <View style={styles.fightTrendBlock}>
            <Feather name={trend.isUp ? "trending-up" : "zap"} size={trend.isUp ? 22 : 15}
              color={trend.isUp ? "#fb923c" : colors.primary} style={{ marginRight: 5 }} />
            <Text style={[styles.fightTrendText, { color: trend.isUp ? colors.warning : "rgba(236,238,242,0.72)" }]}>
              {trend.text}
            </Text>
          </View>
        )}

        {/* Consistency row */}
        <View style={styles.fightConsistencyRow}>
          <Text style={styles.fightConsistencyText}>
            Weight logged: <Text style={styles.fightConsistencyStrong}>{consistencyCount} of last 7 days</Text>
          </Text>
          {consistencyInfo && (
            <View style={{ backgroundColor: consistencyInfo.bg, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(135,145,163,0.55)" }}>
              <Text style={{ color: consistencyInfo.color, fontWeight: "700", fontSize: 11, fontFamily: "Inter_700Bold" }}>{consistencyInfo.label}</Text>
            </View>
          )}
        </View>

        {/* Share row */}
        <View style={styles.fightShareRow}>
          <Feather name="share" size={14} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 6 }}>Try sharing a moment</Text>
        </View>

        {/* Planner note */}
        <Text style={styles.fightPlannerNote}>
          This planner focuses on gradual fat loss. Some athletes temporarily reduce body weight before weigh-ins. Weight naturally fluctuates day to day — focus on trends.
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
  const { showToast } = useToast();

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
      showToast({ title: "Weight logged" });
    },
    onError: (err) => showToast({
      title: "Weight not logged",
      description: getErrorMessage(err),
      variant: "destructive",
    }),
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
            backgroundColor: "#0b0f16", borderRadius: 14, width: "100%", maxWidth: 400,
            borderWidth: 1.2, borderColor: "#e5e7eb", overflow: "hidden",
          }}>
            {/* Header */}
            <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 0 }}>
              <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 6, minHeight: 28 }}>
                <Text style={{ color: colors.foreground, fontSize: 17, lineHeight: 22, fontWeight: "700", fontFamily: "Inter_700Bold" }}>Start your day</Text>
                <TouchableOpacity
                  onPress={markSeen}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{ position: "absolute", right: 0, top: 0, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
                >
                  <Feather name="x" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 15, lineHeight: 22, textAlign: "center", fontFamily: "Inter_400Regular" }}>
                Complete your check-in to get accurate readiness and fuel targets
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 20, paddingTop: 18 }}>
              {/* ── SLEEP ROW ── */}
              {status.hasSleep ? (
                <View style={[gateRow, { borderColor: colors.border }]}>
                  <Feather name="moon" size={16} color={colors.primary} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 15, flex: 1, marginLeft: 12, fontWeight: "600" }}>Sleep logged</Text>
                  <Feather name="check" size={18} color={colors.success} />
                </View>
              ) : showSleepForm ? (
                <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: `${colors.primary}40`, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Feather name="moon" size={14} color={colors.primary} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 6, fontWeight: "600" }}>Hours slept</Text>
                  </View>
                  <TextInput
                    style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border,
                      borderRadius: 8, color: colors.foreground, padding: 10, fontSize: 15, marginBottom: 10 }}
                    placeholder="e.g. 7.5"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={gateSlH}
                    onChangeText={setGateSlH}
                    autoFocus
                  />
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Quality</Text>
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
                      style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center",
                        opacity: (!gateSlH || sleepMut.isPending) ? 0.5 : 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {sleepMut.isPending ? "Saving…" : "Save"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowSleepForm(false); setGateSlH(""); setGateSlQ(null); }}
                      style={{ paddingHorizontal: 14, justifyContent: "center" }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[gateRow, { borderColor: colors.border, marginBottom: 8 }]}>
                  <Feather name="moon" size={16} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontSize: 15, flex: 1, marginLeft: 12, fontWeight: "600" }}>
                    Log last night's sleep
                  </Text>
                  <TouchableOpacity onPress={() => setShowSleepForm(true)}
                    style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: 6,
                      paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Log</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── WEIGHT ROW ── */}
              {status.hasWeight ? (
                <View style={[gateRow, { borderColor: colors.border }]}>
                  <Feather name="activity" size={16} color={colors.primary} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 15, flex: 1, marginLeft: 12, fontWeight: "600" }}>Weight logged</Text>
                  <Feather name="check" size={18} color={colors.success} />
                </View>
              ) : showWeightForm ? (
                <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 12,
                  borderWidth: 1, borderColor: `${colors.primary}40`, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                    <Feather name="activity" size={14} color={colors.primary} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginLeft: 6, fontWeight: "600" }}>Morning weight (kg)</Text>
                  </View>
                  <TextInput
                    style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border,
                      borderRadius: 8, color: colors.foreground, padding: 10, fontSize: 15, marginBottom: 10 }}
                    placeholder="e.g. 77.2"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={gateWtVal}
                    onChangeText={setGateWtVal}
                    autoFocus
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => { const w = parseFloat(gateWtVal); if (!isNaN(w) && w > 0) weightMut.mutate(w); }}
                      disabled={weightMut.isPending || !gateWtVal}
                      style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center",
                        opacity: (!gateWtVal || weightMut.isPending) ? 0.5 : 1 }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                        {weightMut.isPending ? "Saving…" : "Save"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowWeightForm(false); setGateWtVal(""); }}
                      style={{ paddingHorizontal: 14, justifyContent: "center" }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={[gateRow, { borderColor: colors.border, marginBottom: 8 }]}>
                  <Feather name="activity" size={16} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontSize: 15, flex: 1, marginLeft: 12, fontWeight: "600" }}>
                    Log today's weight
                  </Text>
                  <TouchableOpacity onPress={() => setShowWeightForm(true)}
                    style={{ borderWidth: 1, borderColor: `${colors.primary}60`, borderRadius: 6,
                      paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Log</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── TRAINING ROW ── */}
              {status.hasPlannedTraining ? (
                <View style={[gateRow, { borderColor: colors.border }]}>
                  <Feather name="zap" size={16} color={colors.primary} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 15, flex: 1, marginLeft: 12, fontWeight: "600" }}>Session created</Text>
                  <Feather name="check" size={18} color={colors.success} />
                </View>
              ) : (
                <View style={[gateRow, { borderColor: colors.border }]}>
                  <Feather name="zap" size={16} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontSize: 15, flex: 1, marginLeft: 12, fontWeight: "600" }}>
                    Create today's session
                  </Text>
                  <TouchableOpacity
                    onPress={() => { markSeen(); router.push("/(tabs)/training" as any); }}
                    style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: 6,
                      paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Add</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Incomplete notice */}
              {incomplete && (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", marginTop: 16, lineHeight: 18 }}>
                  Your macro and fuel targets will be less accurate
                </Text>
              )}

              {/* Continue button */}
              <TouchableOpacity
                onPress={markSeen}
                style={{ backgroundColor: colors.primary, borderRadius: 8, borderWidth: 1.2, borderColor: "#e5e7eb", padding: 13,
                  alignItems: "center", marginTop: 16 }}>
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
  minHeight: 54,
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 10,
  borderWidth: 1,
  marginBottom: 10,
  backgroundColor: "rgba(13, 16, 23, 0.50)",
};

// ─────────────────────────────────────────
// Morning Check-In
// ─────────────────────────────────────────
function MorningCheckIn({ date }: { date: string }) {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { showToast } = useToast();
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
      qc.invalidateQueries({ queryKey: ["readiness", date] });
      qc.invalidateQueries({ queryKey: ["fuel", date] });
      setShowWeight(false); setWeightVal("");
      showToast({ title: "Weight logged — trend updated ✅" });
    },
    onError: (err) => showToast({
      title: "Weight not logged",
      description: getErrorMessage(err),
      variant: "destructive",
    }),
  });

  const restMut = useMutation({
    mutationFn: (mark: boolean) =>
      apiFetch(`/me/rest-day/${date}`, { method: mark ? "POST" : "DELETE", body: mark ? {} : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      qc.invalidateQueries({ queryKey: ["training-summary", date] });
    },
  });

  if (!status) return null;
  const trainingDone = status.hasPlannedTraining || status.isRestDay;
  const done = [status.hasSleep, status.hasWeight, trainingDone].filter(Boolean).length;
  if (done === 3) return null;

  return (
    <Card style={styles.morningCard}>
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
    <Card style={[styles.outlineCard, styles.readinessSummaryCard]}>
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
            <Feather name="check-circle" size={15} color="#ff7a00" />
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
  isRestDay = false,
}: {
  date: string;
  targets?: Targets;
  adjustedCalories?: number;
  adjustedCarbs?: number;
  fcOverride?: FCOverrideState;
  isRestDay?: boolean;
}) {
  const colors = useColors();
  const [showInfo, setShowInfo] = useState(false);
  const [showEstimateDetails, setShowEstimateDetails] = useState(false);
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

  // Re-compute isLowCarb after override (spec §9.14.3) — suppress on rest days,
  // and only ever applies on days with actual training logged. Use
  // trainingCaloriesEarned (not the derived exerciseKcal from EA math) as the
  // "training logged today" signal — the EA-derived value can be nonzero from
  // rounding/formula artifacts even with zero sessions logged.
  const bodyWeightKg = t.carbsPerKg && t.carbsPerKg > 0 ? t.targetCarbs / t.carbsPerKg : null;
  const hasTrainingLoggedToday = (t.trainingCaloriesEarned ?? 0) > 0;
  const postOverrideIsLowCarb = !isRestDay && hasTrainingLoggedToday && bodyWeightKg ? (carbs / bodyWeightKg) < 3 : false;

  const showEARow = isFightCamp && t.eaValue != null && fcOverride != null;
  const showCarbRow = isFightCamp && !isRestDay && fcOverride != null && (originallyLowCarb || postOverrideIsLowCarb);

  // EA row styling
  const eaIsWarn = (effectiveEA != null ? effectiveEA < 30 : originallyLowEA) && eaDecision !== "accepted";
  const eaIsAccepted = originallyLowEA && eaDecision === "accepted";
  const tdee = Math.round((t as any).tdee ?? Math.max(cal, cal + Math.round((t as any).suggestedDeficitKcal ?? 0)));
  const dailyDeficit = Math.max(0, Math.round((t as any).suggestedDeficitKcal ?? (tdee - cal)));

  return (
    <Card style={[styles.outlineCard, styles.dailyIntakeCard]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.dailyTitle, { color: colors.foreground, flex: 1 }]} allowFontScaling={false}>Daily Intake Estimates</Text>
        <TouchableOpacity onPress={() => setShowInfo(v => !v)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Show intake estimate guidance">
          <Feather name="info" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      {showInfo && (
        <View style={styles.intakeInfoPopover}>
          <Text style={styles.intakeInfoTitle} allowFontScaling={false}>Goal Mode: Fight Camp Fat Loss</Text>
          <Text style={styles.intakeInfoOrange} allowFontScaling={false}>
            {isRestDay ? "Rest day — target is based on NEAT only." : "Training day — target includes logged activity."}
          </Text>
          <Text style={styles.intakeInfoBody} allowFontScaling={false}>
            Training is baked into the calorie target. An EA floor of 30 kcal/kg FFM prevents under-fuelling. Macros adapt to your training load each day.
          </Text>
          <Text style={styles.intakeInfoMuted} allowFontScaling={false}>
            Daily deficit: {dailyDeficit} kcal · TDEE: {tdee} kcal
          </Text>
          <Text style={styles.intakeInfoMuted} allowFontScaling={false}>
            These are estimates only. Adjust based on trends and performance. Not medical advice.
          </Text>
        </View>
      )}
      {isFightCamp && (
        <View style={styles.intakeBadge}>
          <Text style={styles.intakeBadgeText} allowFontScaling={false}>Fight Camp</Text>
        </View>
      )}
      <Text style={[styles.dailySubtitle, { color: colors.mutedForeground }]} allowFontScaling={false}>
        {isFightCamp ? "Targets controlled by fight camp plan." : "Targets adapt to your logged training."}
      </Text>

      <View style={styles.intakeGrid}>
        {[
          { value: String(cal), label: "Calories" },
          { value: `${Math.round(t.targetProtein)}g`, label: "Protein" },
          { value: `${carbs}g`, label: "Carbs" },
          { value: `${Math.round(t.targetFat)}g`, label: "Fat" },
        ].map(item => (
          <View key={item.label} style={[styles.intakeCell, { backgroundColor: colors.secondary + "26" }]}>
            <Text style={[styles.intakeValue, { color: colors.foreground }]} allowFontScaling={false}>{item.value}</Text>
            <Text style={[styles.intakeLabel, { color: colors.mutedForeground }]} allowFontScaling={false}>{item.label}</Text>
          </View>
        ))}
      </View>

      {isFightCamp && (
        <View style={[styles.intakeCallout, { backgroundColor: colors.semantic.fightCampBg, borderColor: colors.semantic.fightCampBorder }]}>
          <View style={styles.intakeCalloutRow}>
            <Text style={styles.intakeCalloutEmoji} allowFontScaling={false}>🥊</Text>
            <Text style={styles.intakeCalloutText} allowFontScaling={false}>
              Fight Camp plan is controlling your targets. Training kcal are added back dynamically when logging activities.
            </Text>
          </View>
        </View>
      )}

      {/* EA row */}
      {showEARow && (
        <View style={[
          styles.eaRow,
          eaIsWarn
            ? { backgroundColor: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.3)", borderWidth: 1 }
            : { backgroundColor: colors.secondary + "80" },
        ]}>
          <Text style={[styles.xs, { color: eaIsWarn ? "#fb923c" : colors.mutedForeground, flex: 1 }]} allowFontScaling={false}>
            Energy Availability
          </Text>
          <Text style={[styles.xs, { color: eaIsWarn ? "#fb923c" : colors.mutedForeground, fontVariant: ["tabular-nums"] }]} allowFontScaling={false}>
            {effectiveEA ?? t.eaValue} kcal/kg FFM
          </Text>
          {eaIsAccepted && (
            <Text style={[styles.xs, { color: colors.mutedForeground, marginLeft: 4 }]} allowFontScaling={false}>· adjusted ✓</Text>
          )}
          {(eaIsWarn || eaIsAccepted) && (
            <TouchableOpacity onPress={fcOverride!.openEAModal} style={{ marginLeft: 6 }}>
              <Text style={[styles.xs, { color: "#fb923c", textDecorationLine: "underline" }]} allowFontScaling={false}>
                {eaDecision === "declined" ? "Review" : eaIsAccepted ? "Review" : "Review →"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Low carb row */}
      {showCarbRow && !postOverrideIsLowCarb && originallyLowCarb && carbDecision === "accepted" && (
        <View style={[styles.eaRow, { backgroundColor: colors.secondary + "80" }]}>
          <Text style={[styles.xs, { color: colors.mutedForeground, flex: 1 }]} allowFontScaling={false}>Carbs adjusted to 3 g/kg</Text>
          <Text style={[styles.xs, { color: colors.mutedForeground }]} allowFontScaling={false}>· adjusted ✓</Text>
          <TouchableOpacity onPress={fcOverride!.openCarbModal} style={{ marginLeft: 6 }}>
            <Text style={[styles.xs, { color: colors.mutedForeground, textDecorationLine: "underline" }]} allowFontScaling={false}>Review</Text>
          </TouchableOpacity>
        </View>
      )}
      {showCarbRow && postOverrideIsLowCarb && carbDecision !== "accepted" && (
        <View style={[styles.eaRow, { backgroundColor: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.3)", borderWidth: 1 }]}>
          <Text style={[styles.xs, { color: "#facc15", flex: 1 }]} allowFontScaling={false}>Carbs below 3 g/kg</Text>
          <TouchableOpacity onPress={fcOverride!.openCarbModal}>
            <Text style={[styles.xs, { color: "#facc15", textDecorationLine: "underline" }]} allowFontScaling={false}>
              {carbDecision === "declined" ? "Review" : "Review →"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.dailyDisclaimer, { color: colors.mutedForeground }]} allowFontScaling={false}>
        These values are estimates based on logged activity and body metrics. They are not medical or nutrition advice.
      </Text>
      <TouchableOpacity style={styles.estimateToggle} onPress={() => setShowEstimateDetails(v => !v)} activeOpacity={0.8}>
        <Feather name={showEstimateDetails ? "chevron-up" : "chevron-down"} size={17} color={colors.mutedForeground} />
        <Text style={styles.estimateToggleText} allowFontScaling={false}>How estimates are calculated</Text>
      </TouchableOpacity>
      {showEstimateDetails && (
        <Text style={styles.estimateDetailsText} allowFontScaling={false}>
          All values are estimates for personal tracking only. These are not prescriptions or medical recommendations. If you have a medical condition, eating disorder history, or are under 18, consult a qualified professional.
        </Text>
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
  const { showToast } = useToast();
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
    onMutate: () => ({
      previousAmqsScore: qc.getQueryData<AmqsScore | null>(["amqs-score", date])?.score ?? null,
    }),
    onSuccess: (_data, variables, context) => {
      qc.invalidateQueries({ queryKey: ["supplement-intakes", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
      if (!variables.taken) return;

      setTimeout(async () => {
        try {
          const nextAmqs = await apiFetch<AmqsScore>(`/me/amqs/score/${date}`);
          const oldScore = context?.previousAmqsScore;
          const delta = typeof oldScore === "number" ? nextAmqs.score - oldScore : 0;
          if (delta > 0) {
            showToast({
              title: `AMQS +${delta}`,
              description: "Supplement boosted your micronutrient score.",
              actionLabel: "See updated gaps",
              onAction: () => router.replace("/(tabs)" as any),
            });
            return;
          }
        } catch {
          // Fall through to the generic dashboard-updated toast.
        }

        showToast({
          title: "Logged — dashboard updated",
          description: "Supplement marked as taken. AMQS recalculating.",
        });
      }, 300);
    },
    onError: (err) => showToast({
      title: "Supplement not logged",
      description: getErrorMessage(err),
      variant: "destructive",
    }),
  });

  return (
    <Card style={[styles.outlineCard, styles.suppCard]}>
      <View style={styles.rowBetween}>
        <View style={styles.suppHeaderLeft}>
          <MaterialCommunityIcons name="pill" size={22} color={colors.foreground} />
          <Text style={[styles.suppTitle, { color: colors.foreground }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82} allowFontScaling={false}>
            Supplements — {displayDate}
          </Text>
        </View>
        <TouchableOpacity style={styles.suppManageBtn} onPress={() => router.push("/(tabs)/supplements" as any)}>
          <Text style={styles.suppManageText} allowFontScaling={false}>Manage</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.suppSubtitle, { color: colors.mutedForeground }]} allowFontScaling={false}>
        Scheduled for today ({takenSet.size} of {slots.length} taken)
      </Text>
      {slots.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          No supplements scheduled today. Enable reminders on your supplements to see them here.
        </Text>
      ) : (
        <>
        {slots.map(slot => {
          const key = iKey({ supplementId: slot.supplementId, stackId: slot.stackId, reminderId: slot.reminderId });
          const taken = takenSet.has(key);
          const takenGreen = "#10b981";
          const takenBorder = "rgba(16,185,129,0.55)";
          const takenBackground = "rgba(16,185,129,0.14)";
          return (
            <TouchableOpacity key={`${slot.stackId}-${slot.reminderId}-${slot.supplementId}`}
              style={[
                styles.suppRow,
                {
                  borderColor: taken ? takenBorder : "#e5e7eb",
                  backgroundColor: taken ? takenBackground : "transparent",
                },
              ]}
              onPress={() => toggleMut.mutate({ supplementId: slot.supplementId, stackId: slot.stackId, reminderId: slot.reminderId, taken: !taken })}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.suppItemTitle,
                    {
                      color: taken ? colors.mutedForeground : colors.foreground,
                      opacity: taken ? 0.85 : 1,
                      textDecorationLine: taken ? "line-through" : "none",
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  allowFontScaling={false}
                >
                  {slot.supplementName}
                  {slot.doseAmount != null && slot.doseUnit && (
                    <Text style={{ color: colors.mutedForeground, fontWeight: "500", textDecorationLine: taken ? "line-through" : "none" }}> ({slot.doseAmount} {slot.doseUnit})</Text>
                  )}
                </Text>
                {/* Sub-line: "StackName at HH:MM" for stack slots, "at HH:MM" for direct reminders (§23.6) */}
                <Text style={[styles.suppItemMeta, { color: colors.mutedForeground, opacity: taken ? 0.9 : 1 }]} numberOfLines={1} allowFontScaling={false}>
                  {slot.stackName ? `${slot.stackName} at ${slot.time}` : `at ${slot.time}`}
                </Text>
              </View>
              <View style={[styles.suppCheck, { borderColor: "#e5e7eb", backgroundColor: taken ? takenGreen : "transparent" }]}>
                <Feather name={taken ? "check" : "plus"} size={taken ? 18 : 16} color={taken ? "#ffffff" : colors.foreground} />
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.suppFooter} allowFontScaling={false}>
          Personal tracking only. Not medical advice.
        </Text>
        </>
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
  const qc = useQueryClient();
  const displayDate = format(new Date(date + "T12:00:00"), "MMM d");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualKcal, setManualKcal] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const { data: sessions = [] } = useQuery<WorkoutSession[]>({
    queryKey: ["sessions", date],
    queryFn: () => apiFetch(`/workouts/sessions?start=${date}&end=${date}`),
  });

  const manualBurnMut = useMutation({
    mutationFn: () => {
      const caloriesBurned = Math.round(parseFloat(manualKcal));
      if (!Number.isFinite(caloriesBurned) || caloriesBurned < 1) throw new Error("Enter calories burned.");
      return apiFetch("/me/training/manual-burn", {
        method: "POST",
        body: { caloriesBurned, date, label: manualLabel.trim() || "Manual entry" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      qc.invalidateQueries({ queryKey: ["training-summary", date] });
      setManualOpen(false);
      setManualKcal("");
      setManualLabel("");
    },
    onError: (err: any) => Alert.alert("Manual training not logged", err?.message ?? "Please try again."),
  });

  return (
    <Card style={[styles.outlineCard, styles.trainingCard]}>
      <View style={styles.trainingHeader}>
        <View style={[styles.row, { flex: 1, minWidth: 0 }]}>
          <MaterialCommunityIcons name="dumbbell" size={18} color={colors.foreground} />
          <Text style={[styles.trainingTitle, { color: colors.foreground }]}>Training — {displayDate}</Text>
        </View>
          <View style={styles.trainingHeaderActions}>
            <TouchableOpacity style={styles.trainingGhostBtn} onPress={() => setManualOpen(true)}>
            <Feather name="activity" size={16} color={colors.foreground} />
            <Text style={styles.trainingGhostText}>Manual</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.trainingGhostBtn} onPress={() => router.push({ pathname: "/(tabs)/training" as any, params: { date } })}>
            <MaterialCommunityIcons name="dumbbell" size={16} color={colors.foreground} />
            <Text style={styles.trainingGhostText}>Log</Text>
          </TouchableOpacity>
        </View>
      </View>
      {sessions.length === 0 ? (
        <View style={styles.trainingEmpty}>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, alignSelf: "flex-start" }]}>No workouts logged</Text>
          <MaterialCommunityIcons name="dumbbell" size={36} color="rgba(135,145,163,0.18)" />
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, textAlign: "center" }]}>No training logged for this day.</Text>
          <TouchableOpacity style={styles.trainingPlanBtn} onPress={() => router.push({ pathname: "/(tabs)/training" as any, params: { date } })}>
            <MaterialCommunityIcons name="dumbbell" size={18} color={colors.primary} />
            <Text style={styles.trainingPlanText}>Plan training</Text>
          </TouchableOpacity>
        </View>
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
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.alertCard, { backgroundColor: colors.card, borderColor: "#e5e7eb" }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Manual training</Text>
              <TouchableOpacity onPress={() => setManualOpen(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 8 }]}>
              Log calories burned without creating a structured session.
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, marginTop: 14 }]}
              placeholder="Calories burned"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={manualKcal}
              onChangeText={setManualKcal}
            />
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.secondary, borderColor: colors.border, marginTop: 10 }]}
              placeholder="Label, e.g. Pads"
              placeholderTextColor={colors.mutedForeground}
              value={manualLabel}
              onChangeText={setManualLabel}
              maxLength={50}
            />
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 14 }]} onPress={() => manualBurnMut.mutate()} disabled={manualBurnMut.isPending}>
              {manualBurnMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Log manual burn</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

// ─────────────────────────────────────────
// AMQS Score Card (dashboard) — spec §9.17.7
// ─────────────────────────────────────────
function AmqsCard({ date }: { date: string }) {
  const colors = useColors();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data: amqs } = useQuery<AmqsScore | null>({
    queryKey: ["amqs-score", date],
    queryFn: async () => {
      try {
        return await apiFetch<AmqsScore>(`/me/amqs/score/${date}`);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
          return null;
        }
        throw err;
      }
    },
    enabled: isAuthenticated,
    retry: false,
  });
  const { data: trend } = useQuery<AmqsTrend | null>({
    queryKey: ["amqs-trend", date],
    queryFn: async () => {
      try {
        return await apiFetch<AmqsTrend>(`/me/amqs/trend/${date}`);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
          return null;
        }
        throw err;
      }
    },
    enabled: isAuthenticated && !!amqs,
    retry: false,
  });

  const hasFoodToday = !!amqs && amqs.score > 0;
  const hasSupplementsToday = (amqs?.coverageStats?.totalTakenSupplements ?? 0) > 0;
  const isEmptyState = !amqs || (!hasFoodToday && !hasSupplementsToday);

  if (!amqs) return null;

  const tierColor = AMQS_TIER_COLOR[amqs.tier] ?? "#94a3b8";
  const layer2TierColor = amqs.layer2Tier ? AMQS_TIER_COLOR[amqs.layer2Tier] ?? "#94a3b8" : "#94a3b8";
  const dashboardGaps = amqs.topGaps.slice(0, 3);
  const microGoals = dashboardGaps.filter(g => g.suggestion).slice(0, 3);

  return (
    <Card style={{ borderColor: tierColor + "30" }}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: colors.fonts.sansSb }]}>
              Micronutrient Quality
            </Text>
            <Text style={[styles.xxs, { color: colors.mutedForeground, letterSpacing: 0.5 }]}>ATHLETE SCORE (AMQS)</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/amqs" as any)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Open micronutrient quality details"
          >
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {isEmptyState ? (
          <>
            <View style={[styles.rowBetween, { marginTop: 10 }]}>
              <Text style={{ fontSize: 28, fontWeight: "800", color: colors.mutedForeground, fontFamily: colors.fonts.mono }}>—</Text>
              <View style={[styles.badgePill, { backgroundColor: "#94a3b830" }]}>
                <Text style={{ fontSize: 11, color: "#94a3b8", fontWeight: "700" }}>Provisional</Text>
              </View>
            </View>
            <Text style={[styles.xs, { color: colors.mutedForeground, marginTop: 8, fontStyle: "italic" }]}>
              Example — updates after your first log
            </Text>
            {[
              { label: "Vitamin D", pct: 15 },
              { label: "Magnesium", pct: 32 },
              { label: "Omega-3", pct: 8 },
            ].map(g => (
              <View key={g.label} style={[styles.rowBetween, { marginTop: 6, opacity: 0.3 }]}>
                <Text style={[styles.xs, { color: colors.foreground }]}>{g.label}</Text>
                <Text style={[styles.xs, { color: "#fb923c" }]}>{g.pct}%</Text>
              </View>
            ))}
          </>
        ) : (
          <>
            <View style={styles.amqsScoreGrid}>
              <View style={styles.amqsScoreCell}>
                <Text style={[styles.amqsScoreCaption, { color: colors.mutedForeground }]}>General Score</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.amqsScoreValue, { color: tierColor, fontFamily: colors.fonts.mono }]}>{amqs.score}</Text>
                  <View style={[styles.badgePill, { backgroundColor: tierColor + "22", borderColor: tierColor + "44", borderWidth: 1 }]}>
                    <Text style={{ fontSize: 11, color: tierColor, fontWeight: "700" }}>{amqs.tier}</Text>
                  </View>
                </View>
              </View>
              {amqs.layer2Score != null && (
                <View style={styles.amqsScoreCell}>
                  <Text style={[styles.amqsScoreCaption, { color: colors.mutedForeground }]}>Performance Score</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.amqsScoreValueSmall, { color: layer2TierColor, fontFamily: colors.fonts.mono }]}>{amqs.layer2Score}</Text>
                    <View style={[styles.badgePill, { backgroundColor: layer2TierColor + "22", borderColor: layer2TierColor + "44", borderWidth: 1 }]}>
                      <Text style={{ fontSize: 11, color: layer2TierColor, fontWeight: "700" }}>{amqs.layer2Tier}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {amqs.allMet ? (
              <View style={[styles.rowBetween, { marginTop: 10, backgroundColor: "#10b98118", padding: 8, borderRadius: 8 }]}>
                <Feather name="shield" size={13} color="#10b981" />
                <Text style={{ fontSize: 12, color: "#10b981", flex: 1, marginLeft: 6 }}>Baseline adequacy covered</Text>
              </View>
            ) : (
              <View style={styles.amqsGapList}>
                {dashboardGaps.map((g, index) => {
                  const percent = amqsGapPercent(g);
                  const fillColor = index === 0 ? colors.primary : "rgba(148,163,184,0.45)";
                  return (
                    <View key={g.microKey} style={styles.amqsGapBlock}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.xs, { color: colors.foreground, fontWeight: "700" }]}>{g.label}</Text>
                        <Text style={[styles.xs, { color: colors.mutedForeground }]}>
                          {percent}% of target
                        </Text>
                      </View>
                      <View style={styles.amqsGapTrack}>
                        <View style={[styles.amqsGapFill, { width: `${percent}%` as any, backgroundColor: fillColor }]} />
                      </View>
                      {!!g.suggestion && (
                        <Text style={[styles.xxs, { color: colors.mutedForeground }]}>Try: {g.suggestion}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {microGoals.length > 0 && (
              <View style={styles.amqsMicroGoalList}>
                <Text style={[styles.xxs, { color: colors.mutedForeground, fontWeight: "800", marginBottom: 4 }]}>Micro-goals</Text>
                {microGoals.map(g => (
                  <Text key={g.microKey} style={[styles.xxs, { color: colors.mutedForeground, marginTop: 3 }]}>
                    <Text style={{ color: colors.primary, fontWeight: "800" }}>+{amqsGapPointEstimate(g)}</Text>
                    {" "}if you add <Text style={{ color: colors.foreground, fontWeight: "700" }}>{g.suggestion}</Text> ({g.label})
                  </Text>
                ))}
              </View>
            )}

            <Text style={[styles.xxs, { color: colors.mutedForeground, marginTop: 12, fontStyle: "italic", lineHeight: 16 }]}>
              General nutrition targets — not medical advice. Blood tests, diagnosed deficiencies, or a registered dietitian override these figures.
            </Text>
          </>
        )}
    </Card>
  );
}

function AmqsSparkline({ scores, color }: { scores: { date: string; score: number }[]; color: string }) {
  const W = 300, H = 40;
  const max = Math.max(...scores.map(s => s.score), 1);
  const min = Math.min(...scores.map(s => s.score), 0);
  const rng = (max - min) || 1;
  const points = scores.map((s, i) => {
    const x = scores.length < 2 ? W / 2 : (i / (scores.length - 1)) * W;
    const y = H - ((s.score - min) / rng) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <View style={{ marginTop: 10, height: H }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

// ─────────────────────────────────────────
// Weight Trend
// ─────────────────────────────────────────
function WeightTrend({ date }: { date: string }) {
  const colors = useColors();
  const start = format(subWeeks(new Date(date + "T12:00:00"), 4), "yyyy-MM-dd");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { data: weights = [] } = useQuery<WeightEntry[]>({
    queryKey: ["weights-range", start, date],
    queryFn: () => apiFetch(`/me/weights/range?start=${start}&end=${date}`),
  });

  const last7 = [...weights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).reverse();
  const minW = last7.length ? Math.min(...last7.map(w => w.weight)) : 0;
  const maxW = last7.length ? Math.max(...last7.map(w => w.weight)) : 1;
  const rng = (maxW - minW) || 1;

  const SVG_W = 300, SVG_H = 240;
  const PAD = { t: 18, r: 10, b: 38, l: 44 };
  const cW = SVG_W - PAD.l - PAD.r;
  const cH = SVG_H - PAD.t - PAD.b;

  function xOf(i: number) {
    return PAD.l + (last7.length < 2 ? cW / 2 : (i / (last7.length - 1)) * cW);
  }
  function yOf(w: number) {
    return PAD.t + cH - ((w - minW) / rng) * cH;
  }

  const chartPoints = last7.map((e, i) => ({ x: xOf(i), y: yOf(e.weight) }));
  const pts = chartPoints.map(p => `${p.x},${p.y}`).join(" ");
  const smoothPath = chartPoints.reduce((path, point, index, points) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const midX = (prev.x + point.x) / 2;
    return `${path} Q ${prev.x} ${prev.y} ${midX} ${(prev.y + point.y) / 2} T ${point.x} ${point.y}`;
  }, "");
  const areaPts = `${PAD.l},${PAD.t + cH} ${pts} ${xOf(last7.length - 1)},${PAD.t + cH}`;
  const activeIndex = selectedIndex;
  const active = activeIndex != null ? last7[activeIndex] : null;
  const activeX = activeIndex != null ? xOf(activeIndex) : 0;
  const activeY = active ? yOf(active.weight) : 0;
  const tooltipW = 108;
  const tooltipH = 52;
  const tooltipX = Math.max(PAD.l + 2, Math.min(activeX - tooltipW - 12, SVG_W - PAD.r - tooltipW));
  const tooltipY = Math.max(PAD.t + 8, activeY - tooltipH / 2);

  useEffect(() => {
    if (last7.length >= 2) {
      setSelectedIndex(current => (current != null && current < last7.length ? current : last7.length - 1));
    } else {
      setSelectedIndex(null);
    }
  }, [date, last7.length]);

  return (
    <Card style={styles.chartCard}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontSize: 24 }]}>Weight Trend</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: 4 }]}>Last 7 recorded entries</Text>
        </View>
        <View style={[styles.iconTile, { backgroundColor: colors.secondary }]}>
          <MaterialCommunityIcons name="scale-balance" size={26} color={colors.mutedForeground} />
        </View>
      </View>
      {last7.length < 2 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>
          Record more weight data to see trends.
        </Text>
      ) : (
        <>
        <View style={{ marginTop: 8, height: SVG_H }}>
          <Svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} pointerEvents="none">
            {[0, 0.5, 1].map(pct => {
              const y = PAD.t + pct * cH;
              const val = (maxW - pct * rng).toFixed(1);
              return (
                <React.Fragment key={String(pct)}>
                  <SvgLine x1={PAD.l} y1={y} x2={SVG_W - PAD.r} y2={y}
                    stroke={colors.border} strokeWidth={1} strokeDasharray="3,3" />
                  <SvgText x={PAD.l - 5} y={y + 4} fontSize={9} fill={colors.mutedForeground} textAnchor="end">{val}</SvgText>
                </React.Fragment>
              );
            })}
            {last7.map((e, i) => (
              (i === 0 || i === Math.floor(last7.length / 2) || i === last7.length - 1) ? (
                <SvgText key={e.date} x={xOf(i)} y={SVG_H - 8} fontSize={11} fill={colors.mutedForeground} textAnchor="middle">
                  {format(new Date(e.date + "T12:00:00"), "MMM d")}
                </SvgText>
              ) : null
            ))}
            <SvgPolygon points={areaPts} fill="rgba(255,122,0,0.12)" />
            <SvgPath d={smoothPath} fill="none" stroke="#ff7a00" strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round" />
            {last7.map((e, i) => (
              <SvgCircle key={e.date} cx={xOf(i)} cy={yOf(e.weight)} r={3.5}
                fill="#ff7a00" stroke="#0f1117" strokeWidth={1.5} />
            ))}
            {active && activeIndex != null && (
              <>
                <SvgLine x1={activeX} y1={PAD.t} x2={activeX} y2={PAD.t + cH}
                  stroke="#e5e7eb" strokeWidth={1.2} />
                <SvgCircle cx={activeX} cy={activeY} r={5}
                  fill="#ff7a00" stroke="#f6f8fb" strokeWidth={2} />
                <SvgRect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx={7}
                  fill="#151922" stroke="#242a36" strokeWidth={1} />
                <SvgText x={tooltipX + 10} y={tooltipY + 20} fontSize={13} fill={colors.mutedForeground}>
                  {format(new Date(active.date + "T12:00:00"), "MMM d")}
                </SvgText>
                <SvgText x={tooltipX + 10} y={tooltipY + 42} fontSize={13} fill={colors.foreground}>
                  weight : {active.weight}
                </SvgText>
              </>
            )}
          </Svg>
        </View>
        <View style={styles.chartSelectorRow}>
          {last7.map((e, i) => {
            const isSelected = i === selectedIndex;
            return (
            <TouchableOpacity
              key={`${e.date}-selector`}
              activeOpacity={0.8}
              onPress={() => setSelectedIndex(i)}
              style={[
                styles.chartSelectorChip,
                isSelected && styles.chartSelectorChipActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Show weight for ${format(new Date(e.date + "T12:00:00"), "MMM d")}`}
            >
              <Text style={[styles.chartSelectorText, isSelected && styles.chartSelectorTextActive]}>
                {format(new Date(e.date + "T12:00:00"), "MMM d")}
              </Text>
            </TouchableOpacity>
            );
          })}
        </View>
        </>
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
// Client-side name matching: tries exact → "target contains ingredient name" strategies.
function findIngredientAutoMatch(name: string): { index: number; ingName: string } | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const target = norm(name);
  // Exact
  let idx = INGREDIENTS_DATA.findIndex(ing => norm(ing.name) === target);
  if (idx >= 0) return { index: idx, ingName: INGREDIENTS_DATA[idx].name };
  // Target string contains the full ingredient name (e.g. "Cottage Cheese Tesco" ⊇ "Cottage Cheese")
  idx = INGREDIENTS_DATA.findIndex(ing => target.includes(norm(ing.name)));
  if (idx >= 0) return { index: idx, ingName: INGREDIENTS_DATA[idx].name };
  return null;
}

function MealConfirmView({ food, grams, onGramsChange, onConfirm, onBack, isPending }: {
  food: NormalizedFood; grams: string; onGramsChange: (g: string) => void;
  onConfirm: (ingredientIndex?: number) => void; onBack: () => void; isPending: boolean;
}) {
  const colors = useColors();
  const unit = getCoreFoodUnit(food.name);
  const [entryMode, setEntryMode] = useState<"count" | "grams">(unit ? "count" : "grams");
  const [count, setCount] = useState(unit?.defaultCount ?? 1);
  const [size, setSize] = useState<UnitSize>(unit?.defaultSize ?? "medium");

  // Mapping state — seed from prop first, then try client-side auto-match
  const initMap = React.useMemo(() => {
    if (food.ingredientIndex != null) return { index: food.ingredientIndex, ingName: INGREDIENTS_DATA[food.ingredientIndex]?.name ?? "" };
    return findIngredientAutoMatch(food.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.name, food.ingredientIndex]);
  const [mapIngredient, setMapIngredient] = useState<{ index: number; ingName: string } | null>(initMap);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapSearch, setMapSearch] = useState("");

  // Re-seed when food changes (user taps back → picks different food)
  React.useEffect(() => {
    const m = food.ingredientIndex != null
      ? { index: food.ingredientIndex, ingName: INGREDIENTS_DATA[food.ingredientIndex]?.name ?? "" }
      : findIngredientAutoMatch(food.name);
    setMapIngredient(m);
    setShowMapPicker(false);
    setMapSearch("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.name]);

  React.useEffect(() => {
    if (unit && entryMode === "count") {
      onGramsChange(String(computeUnitGrams(unit, count, size)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, size, entryMode]);

  React.useEffect(() => {
    if (unit) { setCount(unit.defaultCount); setSize(unit.defaultSize ?? "medium"); setEntryMode("count"); }
    else { setEntryMode("grams"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.name]);

  const g = parseFloat(grams) || 100;
  const r = g / 100;
  const cal = Math.round(food.caloriesPer100g * r);
  const prot = rd1(food.proteinPer100g * r);
  const carbs = rd1(food.carbsPer100g * r);
  const fat = rd1(food.fatPer100g * r);
  const fibre = rd1(food.fibrePer100g * r);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Product header: image + name/brand/change-selection */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {food.imageUrl ? (
          <Image source={{ uri: food.imageUrl }}
            style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: "#1a1e28" }} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }} numberOfLines={2}>{food.name}</Text>
          {food.brand ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{food.brand}</Text> : null}
          <TouchableOpacity onPress={onBack} style={{ marginTop: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>Change selection</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Amount header + Count/Grams toggle */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "#eceef2", fontSize: 16, fontWeight: "700" }}>Amount</Text>
        {unit && (
          <View style={{ flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#1a1e28" }}>
            {(["count", "grams"] as const).map(mode => (
              <TouchableOpacity key={mode}
                onPress={() => {
                  setEntryMode(mode);
                  if (mode === "grams" && unit) onGramsChange(String(computeUnitGrams(unit, count, size)));
                }}
                style={{ paddingHorizontal: 16, paddingVertical: 7, backgroundColor: entryMode === mode ? "#ff7a00" : "#181c26" }}>
                <Text style={{ color: entryMode === mode ? "#fff" : "#6b7280", fontWeight: "700", fontSize: 13 }}>
                  {mode === "count" ? "Count" : "Grams"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {entryMode === "count" && unit ? (
        <View style={{ gap: 12 }}>
          {unit.supportsSize && unit.gramsBySize && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600" }}>Size</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["small", "medium", "large"] as UnitSize[]).map(s => (
                  <TouchableOpacity key={s} onPress={() => setSize(s)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center",
                      borderWidth: 1, borderColor: s === size ? colors.primary : colors.border,
                      backgroundColor: s === size ? "rgba(255,122,0,0.15)" : "#181c26" }}>
                    <Text style={{ color: s === size ? colors.foreground : colors.mutedForeground, fontWeight: "700", fontSize: 13 }}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                    <Text style={{ color: s === size ? `${colors.primary}99` : "#4b5563", fontSize: 10, marginTop: 2 }}>
                      {unit.gramsBySize![s]}g
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
            {unit.unitLabel}s
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <TouchableOpacity onPress={() => setCount(c => Math.max(1, c - 1))}
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#eceef2", fontSize: 28, fontWeight: "300", lineHeight: 30 }}>−</Text>
            </TouchableOpacity>
            <Text style={{ color: "#eceef2", fontSize: 32, fontWeight: "800", minWidth: 40, textAlign: "center" }}>{count}</Text>
            <TouchableOpacity onPress={() => setCount(c => c + 1)}
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#ff7a00", fontSize: 28, fontWeight: "300", lineHeight: 30 }}>+</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>≈{g}g total</Text>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <TextInput
            style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
              backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 18, color: "#eceef2" }}
            value={grams} onChangeText={onGramsChange} keyboardType="numeric" selectTextOnFocus
          />
          {[50, 100, 150, 200].map(q => (
            <TouchableOpacity key={q} onPress={() => onGramsChange(String(q))}
              style={{ height: 48, paddingHorizontal: 10, borderRadius: 8, alignItems: "center",
                justifyContent: "center", borderWidth: 1, borderColor: "#1a1e28", backgroundColor: "#181c26" }}>
              <Text style={{ color: "#eceef2", fontSize: 12, fontWeight: "600" }}>{q}g</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Nutrition per 100g */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: "#6b7280", fontSize: 13 }}>Nutrition per 100g</Text>
        <Text style={{ color: "#ff7a00", fontSize: 22, fontWeight: "800" }}>{cal} kcal</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: "#13161d",
        borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28", padding: 14 }}>
        {[
          { l: "Prot", v: prot, green: false },
          { l: "Carb", v: carbs, green: false },
          { l: "Fat", v: fat, green: false },
          { l: "Fib", v: fibre, green: true },
        ].map(s => (
          <View key={s.l} style={{ alignItems: "center" }}>
            <Text style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>{s.l}</Text>
            <Text style={{ color: s.green ? "#10b981" : "#eceef2", fontSize: 15, fontWeight: "700" }}>{s.v}g</Text>
          </View>
        ))}
      </View>

      {/* Micros Source (for AMQS) */}
      <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
        backgroundColor: "#13161d", padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "#6b7280", fontSize: 12 }}>Micros Source (for AMQS)</Text>
          <TouchableOpacity onPress={() => { setShowMapPicker(p => !p); setMapSearch(""); }}>
            <Text style={{ color: "#ff7a00", fontSize: 12, fontWeight: "600" }}>
              {showMapPicker ? "Done" : "Change"}
            </Text>
          </TouchableOpacity>
        </View>

        {showMapPicker ? (
          /* Picker panel */
          <View style={{ gap: 8 }}>
            <TextInput
              style={{ height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#2a2e3a",
                backgroundColor: "#181c26", paddingHorizontal: 12, fontSize: 14, color: "#eceef2" }}
              placeholder="Search ingredients…" placeholderTextColor="#6b7280"
              value={mapSearch} onChangeText={setMapSearch} autoFocus
            />
            {mapSearch.length >= 2 && (
              <View style={{ borderRadius: 8, borderWidth: 1, borderColor: "#1a1e28", overflow: "hidden" }}>
                {INGREDIENTS_DATA.filter(ing =>
                  ing.name.toLowerCase().includes(mapSearch.toLowerCase())
                ).slice(0, 10).map((ing, i, arr) => (
                  <TouchableOpacity key={i}
                    onPress={() => {
                      setMapIngredient({ index: INGREDIENTS_DATA.indexOf(ing), ingName: ing.name });
                      setShowMapPicker(false); setMapSearch("");
                    }}
                    style={{ paddingHorizontal: 12, paddingVertical: 10,
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: "#1a1e28",
                      backgroundColor: "#13161d" }}>
                    <Text style={{ color: "#eceef2", fontSize: 13 }}>{ing.name}</Text>
                  </TouchableOpacity>
                ))}
                {INGREDIENTS_DATA.filter(ing => ing.name.toLowerCase().includes(mapSearch.toLowerCase())).length === 0 && (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: "#4b5563", fontSize: 13 }}>No matches</Text>
                  </View>
                )}
              </View>
            )}
            {mapIngredient && (
              <TouchableOpacity onPress={() => { setMapIngredient(null); setShowMapPicker(false); }}
                style={{ alignItems: "center", paddingVertical: 4 }}>
                <Text style={{ color: "#4b5563", fontSize: 12 }}>Skip micros (log macros only)</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : mapIngredient ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="check" size={14} color="#10b981" />
              <Text style={{ color: "#10b981", fontSize: 13 }}>Mapped to: </Text>
              <Text style={{ color: "#ff7a00", fontSize: 13, fontWeight: "700" }}>{mapIngredient.ingName}</Text>
            </View>
            <Text style={{ color: "#4b5563", fontSize: 12 }}>Mapped automatically</Text>
          </View>
        ) : (
          <Text style={{ color: "#4b5563", fontSize: 12 }}>No micronutrient mapping available</Text>
        )}
      </View>

      <TouchableOpacity onPress={() => onConfirm(mapIngredient?.index)} disabled={isPending}
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
        backgroundColor: "#181c26", borderColor: "#ff7a00" }}>
        <Feather name="search" size={18} color="#6b7280" />
        <TextInput style={{ flex: 1, color: "#eceef2", fontSize: 15, marginLeft: 8 }}
          placeholder="Search foods (e.g. chicken breast, rice)" placeholderTextColor="#6b7280"
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
            ? (
              <View style={{ alignItems: "center", paddingTop: 64, gap: 10 }}>
                <Feather name="search" size={48} color="#2a2e3a" />
                <Text style={{ color: "#6b7280", fontSize: 14, textAlign: "center" }}>Search the Open Food Facts database</Text>
                <Text style={{ color: "#4b5563", fontSize: 12, textAlign: "center" }}>Type at least 2 characters to search</Text>
              </View>
            )
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

  // Determine whether stored grams fits an exact count/size combination.
  // Returns the best match or null if the stored value doesn't align with any unit.
  function findSizeMatch(u: NonNullable<typeof unit>): { size: UnitSize; count: number } | null {
    if (!u.supportsSize || !u.gramsBySize) return null;
    for (const sKey of (["small", "medium", "large"] as UnitSize[])) {
      const g = u.gramsBySize[sKey];
      if (!g) continue;
      const cnt = baseGrams / g;
      const rounded = Math.round(cnt);
      if (rounded > 0 && Math.abs(cnt - rounded) < 0.12) return { size: sKey, count: rounded };
    }
    return null;
  }
  function findCountMatch(u: NonNullable<typeof unit>): number | null {
    if (u.supportsSize || !u.gramsPerUnit) return null;
    const cnt = baseGrams / u.gramsPerUnit;
    const rounded = Math.round(cnt);
    return rounded > 0 && Math.abs(cnt - rounded) < 0.12 ? rounded : null;
  }

  const sizeMatch = unit ? findSizeMatch(unit) : null;
  const countMatch = unit && !unit.supportsSize ? findCountMatch(unit) : null;
  const initAmountMode: "count" | "grams" = (sizeMatch || countMatch) ? "count" : "grams";
  const initCount = sizeMatch ? sizeMatch.count : (countMatch ?? 1);
  const initSize: UnitSize = sizeMatch ? sizeMatch.size : (unit?.defaultSize ?? "medium");

  const [amountMode, setAmountMode] = useState<"count" | "grams">(initAmountMode);
  const [count, setCount] = useState(initCount);
  const [size, setSize] = useState<UnitSize>(initSize);
  // Track first render so the useEffect below doesn't overwrite stored grams on mount
  const isFirstRender = React.useRef(true);
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

  // In count mode, sync grams + macros whenever count/size changes (skip mount)
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
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
function getCurrentMealType(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

function MealsSection({ date, openAddFood, onAddFoodOpened }: { date: string; openAddFood?: boolean; onAddFoodOpened?: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [modal, setModal] = useState(false);
  const [mealType, setMealType] = useState<string>(getCurrentMealType());
  const submittedSnackIndicesRef = React.useRef<number[]>([]);
  const [snackSlot, setSnackSlot] = useState<"new" | number>("new");
  const [snackSlotOpen, setSnackSlotOpen] = useState(false);
  const previousMealTypeRef = React.useRef(mealType);
  const [activeTab, setActiveTab] = useState<TabId>("search");
  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);
  const [grams, setGrams] = useState("100");
  const [mealDropdownOpen, setMealDropdownOpen] = useState(false);

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
  const [wfSelectedFood, setWfSelectedFood] = useState<NormalizedFood | null>(null);
  const [wfEntryMode, setWfEntryMode] = useState<"count" | "grams">("count");
  const [wfCount, setWfCount] = useState(1);
  const [wfSize, setWfSize] = useState<UnitSize>("medium");
  const [wfGrams, setWfGrams] = useState("100");
  const [barcodeResult, setBarcodeResult] = useState<NormalizedFood | null>(null);
  const [barcodeRaw, setBarcodeRaw] = useState<any>(null);
  const [barcodeLastCode, setBarcodeLastCode] = useState("");
  // "auto" = high-confidence auto-applied, "user" = user selected, "skipped" = user skipped, null = needs input
  const [barcodeMapState, setBarcodeMapState] = useState<"auto" | "user" | "skipped" | null>(null);
  const [barcodeMapIngredient, setBarcodeMapIngredient] = useState<{ index: number; name: string } | null>(null);
  const [barcodeMapSearch, setBarcodeMapSearch] = useState("");
  const [barcodeMapSaving, setBarcodeMapSaving] = useState(false);
  const [barcodeGrams, setBarcodeGrams] = useState("100");
  const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);

  useEffect(() => {
    if (openAddFood) { setModal(true); onAddFoodOpened?.(); }
  }, [openAddFood]);

  useEffect(() => {
    const previousMealType = previousMealTypeRef.current;
    const switchedToSnack = previousMealType !== "snack" && mealType === "snack";

    if (switchedToSnack) {
      setSnackSlot("new");
      setSnackSlotOpen(true);
      setMealDropdownOpen(false);
    } else if (previousMealType === "snack" && mealType !== "snack") {
      setSnackSlotOpen(false);
    }

    previousMealTypeRef.current = mealType;
  }, [mealType]);

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
    setWholeSearch(""); setWfSelectedFood(null); setWfEntryMode("count"); setWfCount(1); setWfSize("medium"); setWfGrams("100");
    setBarcodeResult(null); setBarcodeRaw(null); setBarcodeLastCode(""); setBarcodeMapState(null);
    setBarcodeMapIngredient(null); setBarcodeMapSearch(""); setBarcodeGrams("100"); setShowBarcodeCamera(false);
    setMealDropdownOpen(false);
    setSnackSlot("new"); setSnackSlotOpen(false);
  }

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/food/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["food", date] }),
  });

  const addMut = useMutation({
    mutationFn: (d: any) => apiFetch("/food", { method: "POST", body: d }),
    onMutate: () => ({
      previousAmqs: qc.getQueryData<AmqsScore | null>(["amqs-score", date]),
    }),
    onSuccess: (_, variables, context) => {
      const si = (variables as any).snackIndex;
      if (typeof si === "number" && !submittedSnackIndicesRef.current.includes(si)) {
        submittedSnackIndicesRef.current.push(si);
      }
      qc.invalidateQueries({ queryKey: ["food", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
      closeModal();

      const name = String((variables as any).name ?? "Food");
      const now = Date.now();
      if (now - lastAmqsToastTime < AMQS_TOAST_DEBOUNCE_MS) {
        showToast({
          title: "Logged — dashboard updated",
          description: `${name} added.`,
        });
        return;
      }

      lastAmqsToastTime = now;
      setTimeout(async () => {
        try {
          const nextAmqs = await apiFetch<AmqsScore>(`/me/amqs/score/${date}`);
          const oldScore = context?.previousAmqs?.score;
          const delta = typeof oldScore === "number" ? nextAmqs.score - oldScore : 0;
          if (delta > 0) {
            showToast({
              title: `AMQS +${delta}`,
              description: `${name} boosted your micronutrient score.`,
              actionLabel: "See updated gaps",
              onAction: () => router.push("/amqs" as any),
            });
            return;
          }
        } catch {
          // Fall through to the generic dashboard-updated toast.
        }

        showToast({
          title: "Logged — dashboard updated",
          description: `${name} added. AMQS recalculating.`,
        });
      }, 300);
    },
    onError: (err: any) => {
      showToast({
        title: "Failed to add food",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    },
  });

  const searchVersionRef = React.useRef(0);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback((q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const version = ++searchVersionRef.current;
      setSearching(true);
      try {
        const r = await apiFetch<any[]>(`/foods/search?q=${encodeURIComponent(q.trim())}`);
        if (version === searchVersionRef.current) setResults(Array.isArray(r) ? r.slice(0, 20) : []);
      } catch {
        if (version === searchVersionRef.current) setResults([]);
      } finally {
        if (version === searchVersionRef.current) setSearching(false);
      }
    }, 350);
  }, []);

  async function lookupBarcode(overrideCode?: string) {
    const code = (overrideCode ?? barcodeCode).trim();
    if (!code) return;
    setBarcodeLoading(true); setBarcodeError("");
    setBarcodeResult(null); setBarcodeRaw(null); setBarcodeLastCode(code);
    setBarcodeMapState(null); setBarcodeMapIngredient(null); setBarcodeMapSearch("");
    try {
      const result = await apiFetch<any>(`/food/barcode/${code}`);
      if (result?.found && result?.off) {
        // Server response: { found, barcode, off, mapping, suggestions, computedDefaults }
        const { off, mapping, suggestions } = result;
        const food: NormalizedFood = {
          name: off.name,
          brand: off.brand ?? undefined,
          caloriesPer100g: off.macros_per_100g?.kcal ?? 0,
          proteinPer100g: off.macros_per_100g?.protein ?? 0,
          carbsPer100g: off.macros_per_100g?.carbs ?? 0,
          fatPer100g: off.macros_per_100g?.fat ?? 0,
          fibrePer100g: off.macros_per_100g?.fibre ?? 0,
          sourceType: "off",
          offBarcode: code,
          imageUrl: off.image_url ?? undefined,
        };
        setBarcodeRaw(result);
        setBarcodeGrams("100");
        if (mapping) {
          // Already verified server-side mapping
          food.ingredientIndex = mapping.ingredientIndex;
          setBarcodeMapIngredient({ index: mapping.ingredientIndex, name: mapping.ingredientName });
          setBarcodeMapState(mapping.verifiedByUser ? "user" : "auto");
        } else if (suggestions?.best?.confidence === "high") {
          // Auto-apply high-confidence match
          food.ingredientIndex = suggestions.best.ingredientIndex;
          setBarcodeMapIngredient({ index: suggestions.best.ingredientIndex, name: suggestions.best.ingredientName });
          setBarcodeMapState("auto");
        }
        // medium/low/none → barcodeMapState stays null (needs user input)
        setBarcodeResult(food);
      } else if (result?.found && result?.custom) {
        // Custom food from app's own DB
        const c = result.custom;
        const m = c.macros_per_100g ?? {};
        const food: NormalizedFood = {
          name: c.name, brand: c.brand ?? undefined,
          caloriesPer100g: m.kcal ?? 0, proteinPer100g: m.protein ?? 0,
          carbsPer100g: m.carbs ?? 0, fatPer100g: m.fat ?? 0, fibrePer100g: m.fibre ?? 0,
          sourceType: "off", offBarcode: code,
        };
        setBarcodeResult(food);
        setBarcodeGrams(c.servingSizeG ? String(c.servingSizeG) : "100");
      } else {
        setBarcodeError("No food found for this barcode.");
        setCameraScanned(false);
      }
    } catch {
      // API failed — fall back to direct OFF fetch
      try {
        const offResp = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`
        );
        const offData = await offResp.json();
        if (offData?.status === 1 && offData?.product) {
          const p = offData.product;
          const n = p.nutriments ?? {};
          const kcal = n["energy-kcal_100g"] ?? (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0);
          setBarcodeResult({
            name: p.product_name_en || p.product_name || p.abbreviated_product_name || "Unknown product",
            brand: p.brands || undefined,
            caloriesPer100g: kcal, proteinPer100g: n.proteins_100g ?? 0,
            carbsPer100g: n.carbohydrates_100g ?? 0, fatPer100g: n.fat_100g ?? 0,
            fibrePer100g: n.fiber_100g ?? n.fibers_100g ?? 0,
            sourceType: "off", offBarcode: code,
            imageUrl: p.image_front_thumb_url || p.image_thumb_url || p.image_url || undefined,
          });
          setBarcodeGrams("100");
        } else {
          setBarcodeError("No food found for this barcode.");
          setCameraScanned(false);
        }
      } catch (err: any) {
        setBarcodeError(err?.message ?? "Barcode lookup failed");
        setCameraScanned(false);
      }
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function saveMapping(ingredientIndex: number, ingredientName: string) {
    setBarcodeMapSaving(true);
    try {
      await apiFetch(`/food/barcode/${barcodeLastCode}/map`, {
        method: "POST",
        body: {
          ingredientIndex,
          offName: barcodeRaw?.off?.name,
          offBrand: barcodeRaw?.off?.brand,
          verifiedByUser: true,
        },
      });
    } catch { /* silent — still apply locally */ }
    // Apply mapping to current result regardless of save success
    setBarcodeMapIngredient({ index: ingredientIndex, name: ingredientName });
    setBarcodeMapState("user");
    setBarcodeMapSearch("");
    if (barcodeResult) setBarcodeResult({ ...barcodeResult, ingredientIndex });
    setBarcodeMapSaving(false);
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
    const snackIdx = (() => {
      if (mealType !== "snack") return undefined;
      if (snackSlot !== "new") return snackSlot as number;
      const allIdxs = [...entries.filter((e: any) => e.meal === "snack").map((e: any) => e.snackIndex ?? 0), ...submittedSnackIndicesRef.current];
      return allIdxs.length > 0 ? Math.max(...allIdxs) + 1 : 0;
    })();
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
    const snackIdx = (() => {
      if (mealType !== "snack") return undefined;
      if (snackSlot !== "new") return snackSlot as number;
      const allIdxs = [...entries.filter((e: any) => e.meal === "snack").map((e: any) => e.snackIndex ?? 0), ...submittedSnackIndicesRef.current];
      return allIdxs.length > 0 ? Math.max(...allIdxs) + 1 : 0;
    })();
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

  function duplicateFoodEntry(e: FoodEntry) {
    addMut.mutate({
      userId: user!.id,
      name: e.name,
      calories: Math.round(e.calories || 0),
      protein: Math.round(e.protein || 0),
      carbs: Math.round(e.carbs || 0),
      fat: Math.round(e.fat || 0),
      fibre: Math.round(e.fibre || 0),
      grams: Math.round(e.grams || 100),
      meal: e.meal,
      date,
      sourceType: "manual",
      macroSource: "ingredient",
      microSource: "none",
      enteredBasis: "cooked",
    });
  }

  return (
    <Card style={[styles.outlineCard, styles.mealsCard]}>
      <View style={[styles.rowBetween, { gap: 8 }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, flexShrink: 1 }]}>Today's Meals</Text>
        <TouchableOpacity style={styles.savedMealsBtn} onPress={() => Alert.alert("Saved Meals", "Saved meal templates are managed from the food logging flow.")}>
          <Feather name="book-open" size={16} color={colors.foreground} />
          <Text style={styles.savedMealsText} numberOfLines={1}>Saved Meals</Text>
        </TouchableOpacity>
      </View>

      {grouped.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No food logged for this date.</Text>
      ) : (
        grouped.map(g => {
          const mealTotal = g.items.reduce((sum, item) => sum + (item.calories || 0), 0);
          const mealProtein = g.items.reduce((sum, item) => sum + (item.protein || 0), 0);
          const mealCarbs = g.items.reduce((sum, item) => sum + (item.carbs || 0), 0);
          const mealFat = g.items.reduce((sum, item) => sum + (item.fat || 0), 0);
          const mealFibre = g.items.reduce((sum, item) => sum + (item.fibre || 0), 0);
          return (
            <View key={g.type} style={styles.mealGroup}>
              <View style={styles.mealHeader}>
                <View style={styles.mealTitleStack}>
                  <View style={styles.row}>
                    <Feather name={mealIcon[g.type] ?? "utensils"} size={18} color={colors.mutedForeground} />
                    <Text style={styles.mealName}>{g.type}</Text>
                    <View style={styles.mealCountBadge}>
                      <Text style={styles.mealCountText}>{g.items.length}</Text>
                    </View>
                  </View>
                    <Text style={styles.mealKcal} numberOfLines={1}>{Math.round(mealTotal)} kcal</Text>
                </View>
                <View style={styles.mealHeaderIcons}>
                  <Feather name="bookmark" size={20} color={colors.mutedForeground} />
                  <Feather name="copy" size={20} color={colors.mutedForeground} />
                </View>
              </View>
              <Text style={styles.mealMacroLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                P:{Math.round(mealProtein)}g · C:{Math.round(mealCarbs)}g · F:{Math.round(mealFat)}g · Fi:{Math.round(mealFibre)}g
              </Text>
              {g.items.map(e => (
                <View key={e.id} style={[styles.foodRow, styles.mealFoodRow, { borderColor: "#e5e7eb" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodItemName} numberOfLines={1} ellipsizeMode="tail">
                      {e.name}{e.grams ? ` (${e.grams}g)` : ""}
                    </Text>
                    <Text style={styles.foodItemMacros} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                      {Math.round(e.calories)} kcal · P:{Math.round(e.protein)}g · C:{Math.round(e.carbs)}g · F:{Math.round(e.fat)}g
                      {e.fibre ? ` · Fi:${Math.round(e.fibre)}g` : ""}
                    </Text>
                  </View>
                  <View style={styles.foodActions}>
                    <TouchableOpacity onPress={() => duplicateFoodEntry(e)} style={styles.foodActionBtn}>
                      <Feather name="copy" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingEntry(e)} style={styles.foodActionBtn}>
                      <Feather name="edit-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteMut.mutate(e.id)} style={styles.foodActionBtn}>
                      <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          );
        })
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117", borderWidth: 1.2, borderColor: "#e5e7eb" }}>
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            paddingHorizontal: 24, paddingVertical: 22, borderBottomWidth: 1.2, borderBottomColor: "#e5e7eb" }}>
            <Text style={{ color: "#eceef2", fontSize: 18, fontWeight: "700" }}>Add Food</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <TouchableOpacity onPress={closeModal}>
                <Text style={{ color: "#ff7a00", fontSize: 15, fontWeight: "700" }}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeModal}><Feather name="x" size={22} color="#6b7280" /></TouchableOpacity>
            </View>
          </View>

          {/* Meal selector — two dropdowns when snack selected */}
          {(() => {
            const existingSnackIndices = [...new Set(entries.filter((e: any) => e.meal === "snack").map((e: any) => e.snackIndex ?? 0))].sort((a: number, b: number) => a - b);
            const allSnackIdxs = [...existingSnackIndices, ...submittedSnackIndicesRef.current.filter(i => !existingSnackIndices.includes(i))].sort((a: number, b: number) => a - b);
            const nextSnackNum = allSnackIdxs.length > 0 ? Math.max(...allSnackIdxs) + 1 : 0;
            const snackSlotLabel = snackSlot === "new" ? `New Snack #${nextSnackNum}` : `Snack #${snackSlot}`;
            return (
              <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 18, borderBottomWidth: 1.2, borderBottomColor: "#e5e7eb", zIndex: 10 }}>
                <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: "600", letterSpacing: 0.4 }}>Add to meal</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  {/* Meal type picker */}
                  <View style={{ flex: 1, zIndex: mealDropdownOpen ? 110 : 1 }}>
                    <TouchableOpacity onPress={() => { setMealDropdownOpen(v => !v); setSnackSlotOpen(false); }}
                      style={[styles.mealDropdownTrigger, { borderColor: mealType === 'snack' ? colors.primary : '#1a1e28' }]}>
                      <Feather name={mealIcon[mealType] as any} size={15} color={mealType === "snack" ? "#ff7a00" : "#6b7280"} style={{ marginRight: 8 }} />
                      <Text style={{ flex: 1, color: "#eceef2", fontSize: 14, fontWeight: "600", textTransform: "capitalize" }}>{mealType}</Text>
                      <Feather name={mealDropdownOpen ? "chevron-up" : "chevron-down"} size={15} color="#6b7280" />
                    </TouchableOpacity>
                    {mealDropdownOpen && (
                      <View style={{ position: "absolute", top: 46, left: 0, right: 0, backgroundColor: "#1e2232",
                        borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28", overflow: "hidden", zIndex: 200,
                        shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, elevation: 10 }}>
                        {MEAL_TYPES.map((mt, i) => (
                          <TouchableOpacity key={mt} onPress={() => {
                            setMealType(mt);
                            setMealDropdownOpen(false);
                            setSnackSlot("new");
                            setSnackSlotOpen(mt === "snack");
                          }}
                            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
                              backgroundColor: mt === mealType ? "#ff7a0014" : "transparent",
                              borderBottomWidth: i < MEAL_TYPES.length - 1 ? 1 : 0, borderBottomColor: "#1a1e28" }}>
                            <Feather name={mealIcon[mt] as any} size={14} color={mt === mealType ? "#ff7a00" : "#6b7280"} style={{ marginRight: 10 }} />
                            <Text style={{ flex: 1, color: mt === mealType ? "#ff7a00" : "#eceef2", fontSize: 14, fontWeight: "600", textTransform: "capitalize" }}>{mt}</Text>
                            {mt === mealType && <Feather name="check" size={14} color="#ff7a00" />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Snack slot picker — only when snack selected */}
                  {mealType === 'snack' && (
                    <View style={{ flex: 1, zIndex: snackSlotOpen ? 110 : 1 }}>
                      <TouchableOpacity onPress={() => { setSnackSlotOpen(v => !v); setMealDropdownOpen(false); }}
                        style={styles.mealDropdownTrigger}>
                        <Text style={{ flex: 1, color: "#eceef2", fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{snackSlotLabel}</Text>
                        <Feather name={snackSlotOpen ? "chevron-up" : "chevron-down"} size={15} color="#6b7280" />
                      </TouchableOpacity>
                      {snackSlotOpen && (
                        <View style={{ position: "absolute", top: 46, left: 0, right: 0, backgroundColor: "#1e2232",
                          borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28", overflow: "hidden", zIndex: 200,
                          shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, elevation: 10 }}>
                          {/* New slot option */}
                          <TouchableOpacity onPress={() => { setSnackSlot("new"); setSnackSlotOpen(false); }}
                            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
                              backgroundColor: snackSlot === "new" ? "#ff7a0014" : "transparent",
                              borderBottomWidth: allSnackIdxs.length > 0 ? 1 : 0, borderBottomColor: "#1a1e28" }}>
                            <Text style={{ flex: 1, color: snackSlot === "new" ? "#ff7a00" : "#eceef2", fontSize: 13, fontWeight: "600" }}>New Snack #{nextSnackNum}</Text>
                            {snackSlot === "new" && <Feather name="check" size={13} color="#ff7a00" />}
                          </TouchableOpacity>
                          {/* Existing snack slots */}
                          {allSnackIdxs.map((idx: number, i: number) => (
                            <TouchableOpacity key={idx} onPress={() => { setSnackSlot(idx); setSnackSlotOpen(false); }}
                              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
                                backgroundColor: snackSlot === idx ? "#ff7a0014" : "transparent",
                                borderBottomWidth: i < allSnackIdxs.length - 1 ? 1 : 0, borderBottomColor: "#1a1e28" }}>
                              <Text style={{ flex: 1, color: snackSlot === idx ? "#ff7a00" : "#eceef2", fontSize: 13, fontWeight: "600" }}>Snack #{idx}</Text>
                              {snackSlot === idx && <Feather name="check" size={13} color="#ff7a00" />}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Tab bar — segmented control */}
          <View style={{ flexDirection: "row", marginHorizontal: 24, marginTop: 16, marginBottom: 8,
            backgroundColor: "#181c26", borderRadius: 10, padding: 3 }}>
            {MODAL_TABS.map(tab => (
              <TouchableOpacity key={tab.id} onPress={() => { setActiveTab(tab.id); setSelectedFood(null); setWfSelectedFood(null); setMealDropdownOpen(false); }}
                style={{ flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 8,
                  backgroundColor: activeTab === tab.id ? "#2a2e3e" : "transparent" }}>
                <Text style={{ color: activeTab === tab.id ? "#eceef2" : "#6b7280", fontSize: 11, fontWeight: "700" }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          {selectedFood ? (
            <MealConfirmView
              food={selectedFood} grams={grams} onGramsChange={setGrams}
              onConfirm={(ingredientIndex) => addMut.mutate(buildPayload(
                ingredientIndex != null ? { ...selectedFood, ingredientIndex } : selectedFood,
                grams
              ))}
              onBack={() => setSelectedFood(null)}
              isPending={addMut.isPending}
            />
          ) : (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
              {activeTab === "search" && (
                <MealSearchTab query={searchQ} onQueryChange={doSearch} results={results}
                  searching={searching}
                  onSelect={item => { setSelectedFood(normalizeFood(item, "off")); setGrams("100"); }} />
              )}
              {activeTab === "wholefood" && (
                <View style={{ flex: 1 }}>
                  {/* Search field — always visible */}
                  <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: "#eceef2", fontWeight: "700", marginBottom: 8 }}>Search Ingredient</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9,
                      borderRadius: 10, borderWidth: 1.2, backgroundColor: "#0f1117", borderColor: "#e5e7eb" }}>
                      <Feather name="search" size={15} color="#6b7280" />
                      <TextInput style={{ flex: 1, color: "#eceef2", fontSize: 14, marginLeft: 8 }}
                        placeholder="Start typing (e.g. Chicken)..." placeholderTextColor="#6b7280"
                        value={wholeSearch}
                        onChangeText={t => { setWholeSearch(t); setWfSelectedFood(null); }} />
                      {(wholeSearch.length > 0 || wfSelectedFood) && (
                        <TouchableOpacity onPress={() => { setWholeSearch(""); setWfSelectedFood(null); }}>
                          <Feather name="x" size={14} color="#6b7280" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={{ height: 10 }} />
                  </View>

                  {wfSelectedFood ? (() => {
                    const wfUnit = getCoreFoodUnit(wfSelectedFood.name);
                    const wfG = parseFloat(wfGrams) || 100;
                    const wfR = wfG / 100;
                    const wfCal = Math.round(wfSelectedFood.caloriesPer100g * wfR);
                    const wfProt = rd1(wfSelectedFood.proteinPer100g * wfR);
                    const wfCarbs = rd1(wfSelectedFood.carbsPer100g * wfR);
                    const wfFat = rd1(wfSelectedFood.fatPer100g * wfR);
                    const wfFib = rd1(wfSelectedFood.fibrePer100g * wfR);
                    return (
                      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
                        {/* Amount + toggle */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ color: "#eceef2", fontSize: 16, fontWeight: "700" }}>Amount</Text>
                          {wfUnit && (
                            <View style={{ flexDirection: "row", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#1a1e28" }}>
                              {(["count", "grams"] as const).map(mode => (
                                <TouchableOpacity key={mode} onPress={() => {
                                  setWfEntryMode(mode);
                                  if (mode === "grams" && wfUnit) {
                                    setWfGrams(String(computeUnitGrams(wfUnit, wfCount, wfSize)));
                                  }
                                }}
                                  style={{ paddingHorizontal: 16, paddingVertical: 7, backgroundColor: wfEntryMode === mode ? "#ff7a00" : "#181c26" }}>
                                  <Text style={{ color: wfEntryMode === mode ? "#fff" : "#6b7280", fontWeight: "700", fontSize: 13 }}>
                                    {mode === "count" ? "Count" : "Grams"}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>

                        {wfEntryMode === "count" && wfUnit ? (
                          <View style={{ gap: 12 }}>
                            {wfUnit.supportsSize && wfUnit.gramsBySize && (
                              <View style={{ gap: 6 }}>
                                <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600" }}>Size</Text>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                  {(["small", "medium", "large"] as UnitSize[]).map(s => (
                                    <TouchableOpacity key={s} onPress={() => {
                                      setWfSize(s);
                                      setWfGrams(String(computeUnitGrams(wfUnit, wfCount, s)));
                                    }}
                                      style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center",
                                        borderWidth: 1,
                                        borderColor: s === wfSize ? "#ff7a00" : "#1a1e28",
                                        backgroundColor: s === wfSize ? "rgba(255,122,0,0.15)" : "#181c26" }}>
                                      <Text style={{ color: s === wfSize ? "#eceef2" : "#6b7280", fontWeight: "700", fontSize: 13 }}>
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                      </Text>
                                      <Text style={{ color: s === wfSize ? "#ff7a0099" : "#4b5563", fontSize: 10, marginTop: 2 }}>
                                        {wfUnit.gramsBySize![s]}g
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            )}
                            <Text style={{ color: "#6b7280", fontSize: 12, fontWeight: "600" }}>
                              {wfUnit.unitLabel.charAt(0).toUpperCase() + wfUnit.unitLabel.slice(1)}s
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                              <TouchableOpacity onPress={() => {
                                const n = Math.max(1, wfCount - 1);
                                setWfCount(n);
                                setWfGrams(String(computeUnitGrams(wfUnit, n, wfSize)));
                              }} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ color: "#eceef2", fontSize: 28, fontWeight: "300", lineHeight: 30 }}>−</Text>
                              </TouchableOpacity>
                              <Text style={{ color: "#eceef2", fontSize: 32, fontWeight: "800", minWidth: 40, textAlign: "center" }}>{wfCount}</Text>
                              <TouchableOpacity onPress={() => {
                                const n = wfCount + 1;
                                setWfCount(n);
                                setWfGrams(String(computeUnitGrams(wfUnit, n, wfSize)));
                              }} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ color: "#ff7a00", fontSize: 28, fontWeight: "300", lineHeight: 30 }}>+</Text>
                              </TouchableOpacity>
                              <Text style={{ color: "#6b7280", fontSize: 13 }}>≈{wfGrams}g total</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                            <TextInput
                              style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
                                backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 18, color: "#eceef2" }}
                              value={wfGrams} onChangeText={setWfGrams} keyboardType="numeric" selectTextOnFocus
                            />
                            {[50, 100, 150, 200].map(q => (
                              <TouchableOpacity key={q} onPress={() => setWfGrams(String(q))}
                                style={{ height: 48, paddingHorizontal: 10, borderRadius: 8, alignItems: "center",
                                  justifyContent: "center", borderWidth: 1, borderColor: "#1a1e28", backgroundColor: "#181c26" }}>
                                <Text style={{ color: "#eceef2", fontSize: 12, fontWeight: "600" }}>{q}g</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                        {/* Estimated Nutrition */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ color: "#eceef2", fontSize: 15, fontWeight: "700" }}>Estimated Nutrition</Text>
                          <Text style={{ color: "#ff7a00", fontSize: 22, fontWeight: "800" }}>{wfCal} kcal</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: "#13161d",
                          borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28", padding: 14 }}>
                          {[
                            { l: "Prot", v: wfProt, green: false },
                            { l: "Carb", v: wfCarbs, green: false },
                            { l: "Fat", v: wfFat, green: false },
                            { l: "Fib", v: wfFib, green: true },
                          ].map(s => (
                            <View key={s.l} style={{ alignItems: "center" }}>
                              <Text style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>{s.l}</Text>
                              <Text style={{ color: s.green ? "#10b981" : "#eceef2", fontSize: 15, fontWeight: "700" }}>{s.v}g</Text>
                            </View>
                          ))}
                        </View>

                        <TouchableOpacity
                          onPress={() => addMut.mutate(buildPayload(wfSelectedFood!, wfGrams))}
                          disabled={addMut.isPending}
                          style={{ backgroundColor: "#ff7a00", height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                          {addMut.isPending
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Food</Text>}
                        </TouchableOpacity>
                      </ScrollView>
                    );
                  })() : (
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
                            onPress={() => {
                              const unit = getCoreFoodUnit(wf.name);
                              const initGrams = unit
                                ? String(computeUnitGrams(unit, unit.defaultCount, unit.defaultSize ?? "medium"))
                                : String(serving);
                              setWfSelectedFood(wf);
                              setWfEntryMode(unit ? "count" : "grams");
                              setWfCount(unit?.defaultCount ?? 1);
                              setWfSize(unit?.defaultSize ?? "medium");
                              setWfGrams(initGrams);
                              setWholeSearch(wf.name);
                            }}
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
                  )}
                </View>
              )}
              {activeTab === "barcode" && (
                <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
                  {/* Barcode input row */}
                  <View>
                    <Text style={{ color: "#eceef2", fontSize: 13, fontWeight: "700", marginBottom: 8 }}>Barcode</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TextInput
                        style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
                          backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 15, color: "#eceef2" }}
                        placeholder="e.g. 5000112548167" placeholderTextColor="#6b7280"
                        value={barcodeCode}
                        onChangeText={t => { setBarcodeCode(t); setCameraScanned(false); setBarcodeError(""); setBarcodeResult(null); }}
                        keyboardType="number-pad" returnKeyType="search" onSubmitEditing={() => lookupBarcode()}
                      />
                      <TouchableOpacity onPress={() => lookupBarcode()} disabled={barcodeLoading || !barcodeCode.trim()}
                        style={{ height: 48, paddingHorizontal: 20, borderRadius: 10, alignItems: "center",
                          justifyContent: "center", backgroundColor: barcodeCode.trim() ? "#ff7a00" : "#181c26" }}>
                        {barcodeLoading
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: barcodeCode.trim() ? "#fff" : "#6b7280", fontWeight: "700" }}>Lookup</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Scan Barcode button */}
                  <TouchableOpacity
                    onPress={() => {
                      if (!cameraPermission?.granted) { requestCameraPermission(); }
                      else { setShowBarcodeCamera(v => !v); }
                    }}
                    style={{ height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center",
                      borderWidth: 1, borderColor: "#eceef2", backgroundColor: "transparent" }}>
                    <Text style={{ color: "#eceef2", fontWeight: "700" }}>
                      {showBarcodeCamera ? "Hide Camera" : "Scan Barcode"}
                    </Text>
                  </TouchableOpacity>

                  {/* Show Scanner Debug toggle */}
                  <TouchableOpacity onPress={() => setShowBarcodeCamera(v => !v)} style={{ alignSelf: "flex-start", marginTop: -6 }}>
                    <Text style={{ color: "#6b7280", fontSize: 12 }}>
                      {showBarcodeCamera ? "Hide Scanner Debug" : "Show Scanner Debug"}
                    </Text>
                  </TouchableOpacity>

                  {/* Camera view */}
                  {showBarcodeCamera && (
                    <View style={{ height: 240, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
                      <CameraView
                        style={StyleSheet.absoluteFillObject}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] }}
                        onBarcodeScanned={cameraScanned ? undefined : handleBarcodeScanned}
                      />
                      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                        <View style={{ flexDirection: "row", height: 120 }}>
                          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                          <View style={{ width: 200, borderWidth: 2, borderColor: "#ff7a00", borderRadius: 4 }}>
                            <View style={{ position: "absolute", top: -2, left: -2, width: 18, height: 18, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                            <View style={{ position: "absolute", top: -2, right: -2, width: 18, height: 18, borderTopWidth: 3, borderRightWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                            <View style={{ position: "absolute", bottom: -2, left: -2, width: 18, height: 18, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                            <View style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderBottomWidth: 3, borderRightWidth: 3, borderColor: "#ff7a00", borderRadius: 3 }} />
                          </View>
                          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                        </View>
                        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
                      </View>
                      {(cameraScanned || barcodeLoading) ? (
                        <View style={{ position: "absolute", bottom: 12, left: 0, right: 0, alignItems: "center" }}>
                          <View style={{ backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <ActivityIndicator size="small" color="#ff7a00" />
                            <Text style={{ color: "#eceef2", fontSize: 12 }}>Looking up barcode…</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={{ position: "absolute", bottom: 12, left: 0, right: 0, alignItems: "center" }}>
                          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Point at any food barcode</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Error */}
                  {!!barcodeError && (
                    <View style={{ backgroundColor: "#f8717122", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#f8717144" }}>
                      <Text style={{ color: "#f87171", fontSize: 14 }}>{barcodeError}</Text>
                    </View>
                  )}

                  {/* Inline result card */}
                  {barcodeResult && (() => {
                    const bcCalPer100 = Math.round(barcodeResult.caloriesPer100g);
                    return (
                      <View style={{ gap: 12 }}>
                        <View style={{ height: 1, backgroundColor: "#1a1e28" }} />

                        {/* Product header */}
                        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                          {barcodeResult.imageUrl ? (
                            <Image source={{ uri: barcodeResult.imageUrl }}
                              style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: "#1a1e28" }} />
                          ) : (
                            <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: "#1a1e28",
                              alignItems: "center", justifyContent: "center" }}>
                              <Feather name="package" size={24} color="#6b7280" />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: "#eceef2", fontSize: 15, fontWeight: "700" }}>{barcodeResult.name}</Text>
                            {barcodeResult.brand
                              ? <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{barcodeResult.brand}</Text>
                              : null}
                          </View>
                        </View>

                        {/* Amount input */}
                        <Text style={{ color: "#eceef2", fontSize: 13, fontWeight: "600" }}>Amount (grams)</Text>
                        <TextInput
                          style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
                            backgroundColor: "#181c26", paddingHorizontal: 14, fontSize: 18, color: "#eceef2" }}
                          value={barcodeGrams} onChangeText={setBarcodeGrams} keyboardType="numeric" selectTextOnFocus
                        />
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {[50, 100, 150, 200].map(q => (
                            <TouchableOpacity key={q} onPress={() => setBarcodeGrams(String(q))}
                              style={{ flex: 1, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center",
                                borderWidth: 1, borderColor: "#1a1e28", backgroundColor: "#181c26" }}>
                              <Text style={{ color: "#eceef2", fontSize: 13, fontWeight: "600" }}>{q}g</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* Nutrition per 100g */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <Text style={{ color: "#6b7280", fontSize: 13 }}>Nutrition per 100g</Text>
                          <Text style={{ color: "#ff7a00", fontSize: 18, fontWeight: "800" }}>{bcCalPer100} kcal</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: "#13161d",
                          borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28", padding: 14 }}>
                          {[
                            { l: "Prot", v: rd1(barcodeResult.proteinPer100g), green: false },
                            { l: "Carb", v: rd1(barcodeResult.carbsPer100g), green: false },
                            { l: "Fat", v: rd1(barcodeResult.fatPer100g), green: false },
                            { l: "Fib", v: rd1(barcodeResult.fibrePer100g), green: true },
                          ].map(s => (
                            <View key={s.l} style={{ alignItems: "center" }}>
                              <Text style={{ color: "#6b7280", fontSize: 10, marginBottom: 2 }}>{s.l}</Text>
                              <Text style={{ color: s.green ? "#10b981" : "#eceef2", fontSize: 14, fontWeight: "700" }}>{s.v}g</Text>
                            </View>
                          ))}
                        </View>

                        {/* Micros Source — 3 states: mapped / skipped / unmapped */}
                        <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
                          backgroundColor: "#13161d", padding: 14, gap: 10 }}>
                          {/* Header row */}
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: "#6b7280", fontSize: 12 }}>Micros Source (for AMQS)</Text>
                            {barcodeMapState === "auto" || barcodeMapState === "user" ? (
                              <TouchableOpacity onPress={() => { setBarcodeMapState(null); setBarcodeMapIngredient(null); setBarcodeMapSearch(""); }}>
                                <Text style={{ color: "#ff7a00", fontSize: 12, fontWeight: "600" }}>Change</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          {/* State 1: Mapped (auto or user-selected) */}
                          {(barcodeMapState === "auto" || barcodeMapState === "user") && barcodeMapIngredient ? (
                            <View style={{ gap: 4 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Feather name="check" size={14} color="#10b981" />
                                <Text style={{ color: "#10b981", fontSize: 13 }}>Mapped to: </Text>
                                <Text style={{ color: "#ff7a00", fontSize: 13, fontWeight: "700" }}>{barcodeMapIngredient.name}</Text>
                              </View>
                              <Text style={{ color: "#4b5563", fontSize: 12 }}>
                                {barcodeMapState === "auto" ? "Mapped automatically" : "Mapped by you"}
                              </Text>
                            </View>
                          ) : barcodeMapState === "skipped" ? (
                            /* State 2: Skipped */
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Text style={{ color: "#4b5563", fontSize: 13, fontStyle: "italic", flex: 1 }}>Skipped (macros only)</Text>
                              <TouchableOpacity onPress={() => setBarcodeMapState(null)}>
                                <Text style={{ color: "#ff7a00", fontSize: 13, fontWeight: "600" }}>Enable micros</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            /* State 3: Unmapped — show suggestion chips + live search */
                            <View style={{ gap: 10 }}>
                              {/* Suggestion chips (up to 3 from suggestions.top) */}
                              {barcodeRaw?.suggestions?.top?.slice(0, 3).map((s: any, i: number) => {
                                const chipColor = s.confidence === "high" ? "#10b981" : s.confidence === "medium" ? "#f59e0b" : "#4b5563";
                                return (
                                  <TouchableOpacity key={i}
                                    onPress={() => saveMapping(s.ingredientIndex, s.ingredientName)}
                                    disabled={barcodeMapSaving}
                                    style={{ borderRadius: 8, borderWidth: 1, borderColor: chipColor + "55",
                                      backgroundColor: chipColor + "11", padding: 10, gap: 2 }}>
                                    <Text style={{ color: "#eceef2", fontSize: 13, fontWeight: "700" }}>{s.ingredientName}</Text>
                                    {(s.confidence === "medium" || s.confidence === "low") && s.reasons?.length > 0 && (
                                      <Text style={{ color: "#6b7280", fontSize: 11 }}>{s.reasons.slice(0, 2).join(" · ")}</Text>
                                    )}
                                    <Text style={{ color: chipColor, fontSize: 10, fontWeight: "600", textTransform: "uppercase", marginTop: 2 }}>
                                      {s.confidence} confidence
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}

                              {/* Live ingredient search */}
                              <TextInput
                                style={{ height: 40, borderRadius: 8, borderWidth: 1, borderColor: "#2a2e3a",
                                  backgroundColor: "#181c26", paddingHorizontal: 12, fontSize: 14, color: "#eceef2" }}
                                placeholder="Search ingredients…" placeholderTextColor="#6b7280"
                                value={barcodeMapSearch} onChangeText={setBarcodeMapSearch}
                              />
                              {barcodeMapSearch.length >= 2 && (
                                <View style={{ borderRadius: 8, borderWidth: 1, borderColor: "#1a1e28", overflow: "hidden" }}>
                                  {INGREDIENTS_DATA.filter(ing =>
                                    ing.name.toLowerCase().includes(barcodeMapSearch.toLowerCase())
                                  ).slice(0, 10).map((ing, i) => (
                                    <TouchableOpacity key={i}
                                      onPress={() => saveMapping(INGREDIENTS_DATA.indexOf(ing), ing.name)}
                                      disabled={barcodeMapSaving}
                                      style={{ paddingHorizontal: 12, paddingVertical: 10,
                                        borderBottomWidth: i < 9 ? 1 : 0, borderBottomColor: "#1a1e28",
                                        backgroundColor: "#13161d" }}>
                                      <Text style={{ color: "#eceef2", fontSize: 13 }}>{ing.name}</Text>
                                    </TouchableOpacity>
                                  ))}
                                  {INGREDIENTS_DATA.filter(ing =>
                                    ing.name.toLowerCase().includes(barcodeMapSearch.toLowerCase())
                                  ).length === 0 && (
                                    <View style={{ padding: 12 }}>
                                      <Text style={{ color: "#4b5563", fontSize: 13 }}>No matches</Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              {/* Skip link */}
                              <TouchableOpacity onPress={() => { setBarcodeMapState("skipped"); setBarcodeMapSearch(""); }}
                                style={{ alignItems: "center", paddingVertical: 4 }}>
                                <Text style={{ color: "#4b5563", fontSize: 12 }}>Skip micros (log macros only)</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Add to Log */}
                        <TouchableOpacity
                          onPress={() => addMut.mutate(buildPayload(barcodeResult!, barcodeGrams))}
                          disabled={addMut.isPending}
                          style={{ backgroundColor: "#ff7a00", height: 54, borderRadius: 12,
                            alignItems: "center", justifyContent: "center" }}>
                          {addMut.isPending
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add to Log</Text>}
                        </TouchableOpacity>
                      </View>
                    );
                  })()}
                </ScrollView>
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
            </KeyboardAvoidingView>
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
  const { user } = useAuth();
  const { data: morning } = useQuery<MorningStatus>({
    queryKey: ["morning-status", date],
    queryFn: () => apiFetch(`/me/morning-status/${date}`),
  });
  const displayedWeight = morning?.weightLog?.weight ?? user?.currentWeight;

  return (
    <Card>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Current Weight</Text>
      {displayedWeight ? (
        <Text style={[styles.heroNum, { color: colors.foreground }]}>
          {displayedWeight}
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}> kg</Text>
        </Text>
      ) : (
        <Text style={[styles.heroNum, { color: colors.foreground }]}>—<Text style={[styles.heroSub, { color: colors.mutedForeground }]}> kg</Text></Text>
      )}
      <Text style={[styles.empty, { color: colors.mutedForeground }]}>
        {morning?.weightLog ? "Weight recorded today" : "No weight recorded today"}
      </Text>
      <View style={[styles.callout, { backgroundColor: "rgba(255, 122, 0, 0.10)", borderColor: "rgba(255, 122, 0, 0.28)", marginTop: 26 }]}>
        <Text style={[styles.sm, { color: colors.mutedForeground, lineHeight: 24 }]}>
          Weight naturally fluctuates day to day (water, salt, sleep, carbs). Focus on trends over time, not individual readings.
        </Text>
      </View>
    </Card>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [updateWeightModal, setUpdateWeightModal] = useState(false);
  const [weightVal, setWeightVal] = useState("");
  const [quickLogVisible, setQuickLogVisible] = useState(false);
  const [addFoodOpen, setAddFoodOpen] = useState(false);

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isToday = selectedDate === todayDate;
  const displayDate = format(new Date(selectedDate + "T12:00:00"), "d MMM yyyy");
  const sportLabel = user?.mainSport ?? user?.sport ?? null;

  const { data: foodEntries = [] } = useQuery<FoodEntry[]>({
    queryKey: ["food", selectedDate],
    queryFn: () => apiFetch(`/me/food/${selectedDate}`),
  });
  const { data: targets } = useQuery<Targets>({
    queryKey: ["targets", selectedDate],
    queryFn: () => apiFetch(`/me/targets/effective?date=${selectedDate}`),
  });

  const isFightCamp = targets?.mode === "fight_camp";

  // morning-status for isRestDay — same key as child components so no extra network call
  const { data: morningStatusForRestDay } = useQuery<MorningStatus>({
    queryKey: ["morning-status", selectedDate],
    queryFn: () => apiFetch(`/me/morning-status/${selectedDate}`),
    enabled: !!user?.id,
  });

  // Spec §9.14 / §9.11: isLowCarb must not fire on rest days, and only ever
  // applies on days with actual training logged (trainingCaloriesEarned > 0).
  // Enforced client-side too (not just trusted from the server) so a stale
  // or day-agnostic server flag can never surface a carb-floor warning on a
  // day with no session logged.
  const isRestDay = morningStatusForRestDay?.isRestDay ?? false;
  const hasTrainingLoggedToday = (targets?.trainingCaloriesEarned ?? 0) > 0;
  const effectiveIsLowCarb = (targets?.isLowCarb ?? false) && !isRestDay && hasTrainingLoggedToday;

  const fcOverride = useFightCampOverride({
    userId: user?.id,
    date: selectedDate,
    planId: targets?.planId,
    planFightDate: targets?.planFightDate,
    planTargetWeight: targets?.planTargetWeight,
    isLowEA: targets?.isLowEA ?? false,
    isLowCarb: effectiveIsLowCarb,
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
      showToast({
        title: "Performance note",
        description: targets.performanceCarbWarning ?? "",
      });
      fcOverride.markPerfToastShown();
    }, 1500);
    return () => clearTimeout(timer);
  }, [isFightCamp, selectedDate, targets?.isBelowPerformanceCarb, targets?.performanceCarbWarning, fcOverride.shouldShowPerfToast, showToast]);

  // Compute adjusted targets (spec §9.14.3 fight-camp, §9.15.5 standard)
  const adjustedCalories = (() => {
    if (isFightCamp) {
      // Fight camp: server bakes training in; apply consent override on top
      return fcOverride.overrideCalories ?? targets?.adjustedCalories ?? targets?.targetCalories ?? 2000;
    }
    // Standard: client adds training credit on top of server base (§9.15.5)
    // trainingCaloriesEarned is already provided by targets/effective
    const baseCalories = targets?.targetCalories ?? 2000;
    const goal = user?.goal ?? "maintenance";
    const creditPct: Record<string, number> = { fat_loss: 0.5, maintenance: 0.75, weight_gain: 1.0 };
    const pct = creditPct[goal] ?? 0.75;
    const trainingKcal = targets?.trainingCaloriesEarned ?? 0;
    let cal = baseCalories + Math.round(trainingKcal * pct);
    // Fat-loss cap: deficit ≤ 1% BW/week (§9.15.5)
    if (goal === "fat_loss" && user?.currentWeight) {
      const maxDailyDeficit = Math.round((0.01 * user.currentWeight * 7700) / 7);
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
      showToast({ title: "Weight saved" });
    },
    onError: (err) => showToast({
      title: "Weight not logged",
      description: getErrorMessage(err),
      variant: "destructive",
    }),
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
      <AppLogoHeader />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollPad}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEventThrottle={16}
        bounces
      >
        {/* Morning Check-In Gate ("Start your day" modal) */}
        {isToday && <MorningCheckInGate date={selectedDate} />}

        {/* Fight Camp Hero */}
        <FightCampHero date={selectedDate} />

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
          isRestDay={isRestDay}
        />

        {/* Date Navigation */}
        <View style={styles.webDateRow}>
          <TouchableOpacity style={[styles.dateSquareBtn, { borderColor: "#e5e7eb" }]}
            onPress={() => setSelectedDate(format(subDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.dateCenter, { borderColor: colors.border }]}>
            <Feather name="calendar" size={20} color={colors.mutedForeground} />
            <Text style={[styles.dateNavText, { color: colors.foreground }]}>{displayDate}</Text>
          </View>
          <TouchableOpacity style={[styles.dateSquareBtn, { borderColor: "#e5e7eb" }]}
            onPress={() => setSelectedDate(format(addDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-right" size={22} color={colors.foreground} />
          </TouchableOpacity>
          {!isToday && (
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => setSelectedDate(todayDate)}
              accessibilityRole="button"
              accessibilityLabel="Jump to today"
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "transparent", borderColor: "#e5e7eb" }]}
            onPress={() => setUpdateWeightModal(true)}>
            <MaterialCommunityIcons name="scale-balance" size={16} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>Update Weight</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: "#e5e7eb" }]}
            onPress={() => setAddFoodOpen(true)}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={16} color="#fff" />
            <Text style={[styles.actionBtnText, { color: "#fff" }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>Add Food</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "transparent", borderColor: "#e5e7eb" }]}
            onPress={() => setQuickLogVisible(true)}>
            <MaterialCommunityIcons name="auto-fix" size={16} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>Quick Log</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "transparent", borderColor: "#e5e7eb" }]}
            onPress={() => setQuickLogVisible(true)}>
            <Feather name="edit-2" size={16} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>Update Summary</Text>
          </TouchableOpacity>
        </View>

        {/* Greeting */}
        <View>
          <View style={[styles.row, { flexWrap: "wrap", gap: 12 }]}>
            <Text style={[styles.greeting, { color: colors.foreground }]}>Hello, {user?.username ?? "there"}</Text>
            {sportLabel ? <SportIdentityPill label={sportLabel} /> : null}
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: 6 }]}>Here is your daily nutrition summary.</Text>
        </View>

        {/* Macro Cards */}
        <View style={styles.macroGrid}>
          <MacroCard label="Calories" value={totals.calories} unit=" kcal" target={effectiveTargetCalories} color={colors.primary} icon="fire" />
          <MacroCard label="Protein" value={totals.protein} unit="g" target={t.targetProtein} color="#3b82f6" icon="food-steak" />
          <MacroCard label="Carbs" value={totals.carbs} unit="g" target={effectiveTargetCarbs} color="#f59e0b" icon="barley" />
          <MacroCard label="Fat" value={totals.fat} unit="g" target={t.targetFat} color="#facc15" icon="water-percent" />
          <MacroCard label="Fibre" value={totals.fibre} unit="g" target={30} color="#10b981" icon="leaf" />
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
        <MealsSection date={selectedDate} openAddFood={addFoodOpen} onAddFoodOpened={() => setAddFoodOpen(false)} />

        {/* Current Weight */}
        <CurrentWeightCard date={selectedDate} />

        {/* Feedback Card */}
        <Card style={styles.outlineCard}>
          <View style={styles.row}>
            <Feather name="message-square" size={28} color={colors.foreground} />
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginLeft: 14, flex: 1 }]}>Beta Feedback</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground, marginTop: 8 }]}>
            Help us improve PRFMR by sharing your thoughts
          </Text>
          <TouchableOpacity style={[styles.feedbackButton, { borderColor: "#e5e7eb" }]}>
            <Feather name="message-square" size={22} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Send Feedback</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: 100 }} />
      </KeyboardAwareScrollView>

      {/* Floating Action Button — Add Food */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: Platform.OS === "ios" ? Math.max(112, insets.bottom + 86) : 90,
          right: 20,
          width: 56,
          height: 56,
          zIndex: 100,
          elevation: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => setAddFoodOpen(true)}
          style={{
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
      </View>

      {/* Quick Log Modal */}
      {quickLogVisible && (
        <QuickLogModal
          visible
          onClose={() => setQuickLogVisible(false)}
          date={selectedDate}
        />
      )}

      {/* Update Weight Modal */}
      {updateWeightModal && (
      <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={() => setUpdateWeightModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
          <View style={[styles.rowBetween, { marginBottom: 16 }]}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 18 }}>Update Weight</Text>
            <TouchableOpacity onPress={() => setUpdateWeightModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.input, marginBottom: 12 }]}
            placeholder="Weight in kg (e.g. 72.5)" placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad" value={weightVal} onChangeText={setWeightVal} autoFocus />
          <TouchableOpacity style={[styles.fullBtn, { backgroundColor: colors.primary, opacity: weightVal ? 1 : 0.4 }]}
            disabled={!weightVal || weightMut.isPending}
            onPress={() => { const w = parseFloat(weightVal); if (!isNaN(w) && w > 0) weightMut.mutate(w); }}>
            {weightMut.isPending ? <ActivityIndicator color={colors.foreground} size="small" /> : <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>Save</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
      )}

      {/* EA Modal — owned by DashboardScreen so state updates show immediately */}
      {isFightCamp && targets && fcOverride.eaModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={fcOverride.closeEAModal}>
          <View style={styles.lowEaOverlay}>
            <View style={styles.lowEaSheet}>
              <View style={styles.lowEaCard}>
                <TouchableOpacity
                  style={styles.lowEaClose}
                  onPress={fcOverride.closeEAModal}
                  activeOpacity={0.7}
                  hitSlop={16}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Feather name="x" size={24} color="#d7dbe4" />
                </TouchableOpacity>
                <Text style={styles.lowEaTitle} allowFontScaling={false}>Low energy availability</Text>
                <Text style={styles.lowEaBody} allowFontScaling={false}>
                  Your current intake appears to be below the level typically used to support recovery and performance
                  {" "}{"(<"}30 kcal/kg FFM).{"\n\n"}
                  Increasing your intake may help improve energy levels, training quality, and recovery.
                  This may slightly slow weight loss, but can better support performance.{"\n\n"}
                  This is general performance guidance, not medical advice.
                </Text>
                <View style={styles.lowEaStats}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.lowEaMeta} allowFontScaling={false}>Current EA</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.lowEaValue} allowFontScaling={false}>
                        {targets.eaValue} kcal/kg FFM
                      </Text>
                      <Text style={styles.lowEaSubvalue} allowFontScaling={false}>
                        {targets.adjustedCalories || targets.targetCalories} kcal/day
                      </Text>
                    </View>
                  </View>
                  <View style={styles.lowEaStatRow}>
                    <Text style={[styles.lowEaMeta, styles.lowEaMetaGrow]} allowFontScaling={false}>Calories needed for EA 30</Text>
                    <Text style={styles.lowEaOrangeValue} allowFontScaling={false}>
                      {targets.eaRecommendedCalories} kcal
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.lowEaPrimaryBtn} onPress={fcOverride.acceptEA}>
                  <Text style={styles.lowEaPrimaryText} allowFontScaling={false}>
                    Adjust target to {targets.eaRecommendedCalories} kcal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.lowEaOutlineBtn} onPress={fcOverride.declineEA}>
                  <Text style={styles.lowEaOutlineText} allowFontScaling={false}>Keep current plan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Carb Modal */}
      {isFightCamp && targets && fcOverride.carbModalOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={fcOverride.closeCarbModal}>
          <View style={styles.modalOverlay}>
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
          </View>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, borderBottomWidth: 1 },
  logo: { fontSize: 18, fontWeight: "900", letterSpacing: 3 },
  dashboardListPad: { paddingBottom: 0 },
  scrollPad: { padding: 16, gap: 16, paddingBottom: 120 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#181d28",
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  outlineCard: { borderColor: "#e5e7eb", borderWidth: 1.2, padding: 17 },
  morningCard: { borderColor: "rgba(255, 122, 0, 0.35)", backgroundColor: "rgba(255, 122, 0, 0.045)", borderWidth: 1.3, padding: 17 },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  xs: { fontSize: 10, fontWeight: "400", fontFamily: "Inter_400Regular" },
  xxs: { fontSize: 9, fontWeight: "400", fontFamily: "Inter_400Regular" },
  badgePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start" },
  sm: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  sectionSubtitle: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  disclaimer: { fontSize: 11, lineHeight: 17, fontStyle: "italic", fontFamily: "Inter_400Regular", marginTop: 15 },
  empty: { fontSize: 12, lineHeight: 17, marginTop: 8, fontFamily: "Inter_400Regular" },
  heroNum: { fontSize: 31, fontWeight: "700", marginVertical: 7, fontFamily: "JetBrainsMono_700Bold" },
  heroSub: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  fightCampCard: { padding: 17, borderColor: "rgba(229,231,235,0.50)" },
  fightCampHeaderText: { color: "#eceef2", marginLeft: 7, fontSize: 12, lineHeight: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  fightCountdownRow: { flexDirection: "row", alignItems: "center", marginTop: 17, paddingVertical: 4, gap: 8 },
  fightCountdownText: { color: "#eceef2", fontSize: 26, lineHeight: 31, fontWeight: "800", fontFamily: "Inter_700Bold" },
  fightCountdownSub: { color: "#8791a3", fontSize: 12, lineHeight: 15, fontWeight: "500", fontFamily: "Inter_500Medium" },
  fightWeightCta: { flexDirection: "row", alignItems: "center", marginTop: 14, borderRadius: 9, padding: 10, borderWidth: 1, borderColor: "rgba(255,122,0,0.30)", backgroundColor: "rgba(255,122,0,0.05)" },
  fightWeightCtaTitle: { color: "#eceef2", fontSize: 12, lineHeight: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  fightWeightCtaSub: { color: "#8791a3", fontSize: 10, lineHeight: 14, fontFamily: "Inter_400Regular", marginTop: 1 },
  fightWeightCtaTap: { color: "#ff7a00", fontSize: 10, lineHeight: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  fightStatsRow: { flexDirection: "row", alignItems: "center", marginTop: 15, gap: 12 },
  fightStatCell: { flex: 1, alignItems: "center", justifyContent: "center", minWidth: 0 },
  fightStatNumber: { color: "#eceef2", fontSize: 20, lineHeight: 26, fontWeight: "800", fontFamily: "JetBrainsMono_700Bold" },
  fightStatLabel: { color: "#8791a3", fontSize: 9, lineHeight: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginTop: 3 },
  fightMiddleNumber: { color: "#eceef2", fontSize: 12, lineHeight: 15, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center" },
  fightMiddleLabel: { color: "#8791a3", fontSize: 9, lineHeight: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 1 },
  fightSectionRow: { marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(135,145,163,0.16)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fightPaceNote: { color: "rgba(251,146,60,0.78)", fontSize: 9, lineHeight: 12, fontFamily: "Inter_400Regular", marginLeft: 9, flex: 1 },
  fightSectionBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(135,145,163,0.16)" },
  fightInlineTarget: { color: "#eceef2", fontSize: 12, lineHeight: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  fightTargetLabel: { color: "rgba(236,238,242,0.78)", fontSize: 9, lineHeight: 12, letterSpacing: 0.4, fontWeight: "700", fontFamily: "Inter_700Bold" },
  fightTargetMuted: { color: "#8791a3", fontWeight: "400", fontFamily: "Inter_400Regular" },
  fightTrendBlock: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(135,145,163,0.16)", flexDirection: "row", alignItems: "center" },
  fightTrendText: { fontSize: 12, lineHeight: 16, fontWeight: "700", fontFamily: "Inter_700Bold", flex: 1 },
  fightConsistencyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 },
  fightConsistencyText: { color: "#8791a3", fontSize: 11, lineHeight: 15, fontFamily: "Inter_400Regular", flex: 1 },
  fightConsistencyStrong: { color: "#eceef2", fontWeight: "700", fontFamily: "Inter_700Bold" },
  fightShareRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 15, opacity: 0.38 },
  fightPlannerNote: { color: "rgba(135,145,163,0.60)", fontSize: 9, lineHeight: 14, fontStyle: "italic", fontFamily: "Inter_400Regular", marginTop: 14 },
  weightRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginVertical: 7, justifyContent: "space-around" },
  weightNum: { fontSize: 20, fontWeight: "700", fontFamily: "JetBrainsMono_700Bold" },
  thisWeek: { borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginTop: 7 },
  logWeightRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginTop: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginTop: 7, gap: 10 },
  checkIcon: { width: 31, height: 31, borderRadius: 7, borderWidth: 1, borderColor: "#181d28", alignItems: "center", justifyContent: "center" },
  expandBox: { borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginTop: 7 },
  qBtn: { alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "#181d28", paddingVertical: 9 },
  input: { borderRadius: 8, borderWidth: 1, borderColor: "#181d28", padding: 10, fontSize: 12 },
  btnSm: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  ciRow: { flexDirection: "row", gap: 8 },
  ciBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)", paddingVertical: 10, gap: 4 },
  ciSummaryCol: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)", paddingVertical: 14, paddingHorizontal: 7 },
  fullBtn: { borderRadius: 12, padding: 12, alignItems: "center" },
  macroRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  readinessSummaryCard: { width: "94%", alignSelf: "center", paddingVertical: 15 },
  dailyIntakeCard: { padding: 18, paddingBottom: 30 },
  dailyTitle: { fontSize: 26, lineHeight: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  dailySubtitle: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 3 },
  intakeBadge: { alignSelf: "flex-start", borderWidth: 1, borderColor: "rgba(255, 122, 0, 0.58)", backgroundColor: "rgba(255, 122, 0, 0.11)", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, marginTop: 7 },
  intakeBadgeText: { color: "#ff7a00", fontSize: 11, lineHeight: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  intakeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 10 },
  intakeCell: { width: "48.5%", minHeight: 64, borderRadius: 8, alignItems: "center", justifyContent: "center", padding: 7 },
  intakeValue: { fontSize: 24, lineHeight: 29, fontWeight: "900", fontFamily: "Inter_700Bold" },
  intakeLabel: { fontSize: 10, marginTop: 1, letterSpacing: 0, fontFamily: "Inter_600SemiBold" },
  callout: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 },
  intakeCallout: { borderWidth: 1, borderRadius: 9, padding: 10, marginTop: 11 },
  intakeCalloutRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  intakeCalloutIcon: { width: 20, height: 20, marginTop: 1 },
  intakeCalloutEmoji: { fontSize: 18, lineHeight: 22, marginTop: 0 },
  intakeCalloutText: { flex: 1, color: "#f6b56b", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  dailyDisclaimer: { fontSize: 11, lineHeight: 16, fontStyle: "italic", fontFamily: "Inter_400Regular", marginTop: 10 },
  estimateToggle: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  estimateToggleText: { color: "#8791a3", fontSize: 13, lineHeight: 18, marginLeft: 8, fontFamily: "Inter_600SemiBold" },
  estimateDetailsText: { color: "#8791a3", fontSize: 12, lineHeight: 18, fontStyle: "italic", fontFamily: "Inter_400Regular", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(135,145,163,0.13)" },
  intakeInfoPopover: { position: "absolute", top: 48, left: 24, right: 72, zIndex: 30, elevation: 30, borderWidth: 1.2, borderColor: "#e5e7eb", borderRadius: 7, backgroundColor: "#151922", padding: 14 },
  intakeInfoTitle: { color: "#f6f8fb", fontSize: 13, lineHeight: 18, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 8 },
  intakeInfoOrange: { color: "#ff7a00", fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium", marginBottom: 8 },
  intakeInfoBody: { color: "#f6f8fb", fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular", marginBottom: 8 },
  intakeInfoMuted: { color: "#8791a3", fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", marginTop: 4 },
  iconTile: { width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  eaRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, marginTop: 7, gap: 7 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 20 },
  alertCard: { width: "100%", maxWidth: 380, borderRadius: 16, borderWidth: 1, borderColor: "#181d28", padding: 20 },
  lowEaOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center", paddingHorizontal: 0 },
  lowEaSheet: { width: "100%" },
  lowEaCard: {
    width: "100%",
    borderRadius: 0,
    borderWidth: 1.3,
    borderColor: "#e5e7eb",
    backgroundColor: "#0b0f16",
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
  },
  lowEaClose: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 20,
  },
  lowEaTitle: { color: "#f6f8fb", fontSize: 20, lineHeight: 25, fontWeight: "700", textAlign: "center", fontFamily: "Inter_700Bold", marginBottom: 16 },
  lowEaBody: { color: "#8791a3", fontSize: 14, lineHeight: 20, textAlign: "center", fontFamily: "Inter_400Regular", marginBottom: 20 },
  lowEaStats: { gap: 12, marginBottom: 20 },
  lowEaStatRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  lowEaMeta: { color: "#8791a3", fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  lowEaMetaGrow: { flex: 1 },
  lowEaValue: { color: "#f6f8fb", fontSize: 14, lineHeight: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  lowEaSubvalue: { color: "#8791a3", fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
  lowEaOrangeValue: { color: "#ff7a00", fontSize: 15, lineHeight: 20, fontWeight: "700", fontFamily: "Inter_700Bold", flexShrink: 0 },
  lowEaPrimaryBtn: { borderRadius: 7, borderWidth: 1.2, borderColor: "#f6f8fb", paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", backgroundColor: "#ff6b00", marginBottom: 10 },
  lowEaPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15, lineHeight: 20, textAlign: "center", fontFamily: "Inter_700Bold" },
  lowEaOutlineBtn: { borderRadius: 7, borderWidth: 1.2, borderColor: "#e5e7eb", paddingVertical: 11, paddingHorizontal: 16, alignItems: "center" },
  lowEaOutlineText: { color: "#f6f8fb", fontWeight: "600", fontSize: 15, lineHeight: 20, textAlign: "center", fontFamily: "Inter_600SemiBold" },
  primaryBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", backgroundColor: "#ff7a00" },
  outlineBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", borderWidth: 1, borderColor: "#181d28" },
  macroGrid: { gap: 9 },
  macroCard: { width: "100%", minHeight: 109, paddingHorizontal: 19, paddingVertical: 17, borderRadius: 12, borderWidth: 1, borderLeftWidth: 5, borderColor: "#181d28" },
  macroEmoji: { fontSize: 12, marginRight: 5 },
  macroLabel: { fontSize: 11, fontWeight: "700", fontFamily: "Inter_700Bold" },
  macroValue: { fontSize: 24, lineHeight: 29, fontWeight: "700", marginTop: 12, marginBottom: 8, fontFamily: "JetBrainsMono_700Bold" },
  macroUnit: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  macroMeta: { fontSize: 10, marginBottom: 6, fontFamily: "Inter_500Medium" },
  progressBg: { height: 6, borderRadius: 4, backgroundColor: "#1c2230", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 4 },
  suppCard: { padding: 20 },
  suppHeaderLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", marginRight: 10 },
  suppTitle: { flex: 1, marginLeft: 10, fontSize: 22, lineHeight: 27, fontWeight: "700", fontFamily: "Inter_700Bold" },
  suppManageBtn: { flexShrink: 0, paddingLeft: 8, paddingVertical: 4 },
  suppManageText: { color: "#f6f8fb", fontSize: 13, lineHeight: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  suppSubtitle: { fontSize: 14, lineHeight: 19, fontFamily: "Inter_400Regular", marginTop: 8, marginBottom: 6 },
  suppRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#181d28", paddingHorizontal: 14, paddingVertical: 10, marginTop: 10, gap: 12 },
  suppItemTitle: { fontSize: 13, lineHeight: 17, fontWeight: "500", fontFamily: "Inter_500Medium" },
  suppItemMeta: { fontSize: 12, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 1 },
  suppCheck: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: "#181d28", alignItems: "center", justifyContent: "center" },
  suppFooter: { color: "#8791a3", fontSize: 12, lineHeight: 17, fontStyle: "italic", fontFamily: "Inter_400Regular", marginTop: 16 },
  trainingCard: { padding: 15 },
  trainingHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  trainingTitle: { fontSize: 19, lineHeight: 22, fontWeight: "700", fontFamily: "Inter_700Bold", marginLeft: 10, flexShrink: 1 },
  trainingHeaderActions: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 5, flexShrink: 0 },
  trainingGhostBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 2 },
  trainingGhostText: { color: "#f6f8fb", fontSize: 11, lineHeight: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  trainingEmpty: { minHeight: 128, alignItems: "center", justifyContent: "center", gap: 9 },
  trainingPlanBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
  trainingPlanText: { color: "#ff7a00", fontSize: 11, lineHeight: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  chartCard: { borderColor: "#e5e7eb", borderWidth: 1.2, padding: 17 },
  chartSelectorRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 5 },
  chartSelectorChip: { borderRadius: 999, borderWidth: 1, borderColor: "#242a36", paddingHorizontal: 7, paddingVertical: 3 },
  chartSelectorChipActive: { borderColor: "#ff7a00", backgroundColor: "rgba(255,122,0,0.10)" },
  chartSelectorText: { color: "#8791a3", fontSize: 9, lineHeight: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  chartSelectorTextActive: { color: "#ff7a00" },
  mealsCard: { padding: 15 },
  savedMealsBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.2, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, flexShrink: 0 },
  savedMealsText: { color: "#f6f8fb", fontSize: 11, lineHeight: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  mealGroup: { marginTop: 15 },
  mealHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  mealTitleStack: { flex: 1, minWidth: 0 },
  mealName: { color: "#8791a3", fontSize: 14, lineHeight: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginLeft: 7, textTransform: "capitalize" },
  mealCountBadge: { marginLeft: 7, minWidth: 19, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(31,37,50,0.85)" },
  mealCountText: { color: "#f6f8fb", fontSize: 9, lineHeight: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  mealKcal: { color: "#8791a3", fontSize: 10, lineHeight: 14, fontFamily: "JetBrainsMono_700Bold", marginTop: 6, marginLeft: 22 },
  mealHeaderIcons: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 3 },
  mealMacroLine: { color: "#596274", fontSize: 10, lineHeight: 14, fontFamily: "JetBrainsMono_700Bold", marginTop: 1, marginBottom: 8, marginLeft: 22 },
  mealFoodRow: { paddingHorizontal: 10, paddingVertical: 8, marginTop: 7 },
  foodItemName: { color: "#f6f8fb", fontSize: 13, lineHeight: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  foodItemMacros: { color: "#8791a3", fontSize: 9, lineHeight: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  foodActions: { flexDirection: "row", alignItems: "center", gap: 7, marginLeft: 7 },
  foodActionBtn: { padding: 3 },
  sessionItem: { borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginTop: 7 },
  wEntry: { flexDirection: "row", alignItems: "center" },
  wBar: { height: 5, borderRadius: 3 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, borderColor: "#181d28", paddingVertical: 9, paddingHorizontal: 7 },
  webDateRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateSquareBtn: { width: 36, height: 36, borderRadius: 7, borderWidth: 1.2, alignItems: "center", justifyContent: "center" },
  dateCenter: { flex: 1, minHeight: 37, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  dateNavBtn: { padding: 7 },
  dateNavText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  todayBtn: { minHeight: 37, justifyContent: "center", paddingHorizontal: 7 },
  todayBtnText: { color: "#eceef2", fontSize: 12, lineHeight: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 9, justifyContent: "center" },
  actionBtn: { width: "44%", height: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1.2, borderColor: "#181d28", paddingHorizontal: 10, paddingVertical: 0, overflow: "hidden" },
  actionBtnWide: { flex: 1, minWidth: "48.5%" },
  actionBtnText: { fontSize: 10, lineHeight: 12, fontWeight: "700", fontFamily: "Inter_700Bold", marginLeft: 6, textAlign: "center", flexShrink: 1 },
  feedbackButton: { marginTop: 14, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderWidth: 1.2, borderRadius: 8, paddingHorizontal: 15, paddingVertical: 10 },
  amqsScoreGrid: { flexDirection: "row", gap: 12, marginTop: 14 },
  amqsScoreCell: { flex: 1, minWidth: 0 },
  amqsScoreCaption: { fontSize: 10, lineHeight: 14, fontFamily: "Inter_500Medium", marginBottom: 3 },
  amqsScoreValue: { fontSize: 32, lineHeight: 37, fontWeight: "800" },
  amqsScoreValueSmall: { fontSize: 26, lineHeight: 31, fontWeight: "800" },
  amqsGapList: { gap: 9, marginTop: 14 },
  amqsGapBlock: { gap: 4 },
  amqsGapTrack: { height: 5, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  amqsGapFill: { height: "100%", borderRadius: 5 },
  amqsMicroGoalList: { marginTop: 12 },
  sportPill: { flexDirection: "row", alignItems: "center", borderWidth: 1.2, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  sportIcon: { width: 20, height: 20, tintColor: "#fff" },
  greeting: { fontSize: 26, lineHeight: 31, fontWeight: "700", marginTop: 3, fontFamily: "Inter_700Bold" },
  foodRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginTop: 5, gap: 9 },
  mealTypeChip: { borderRadius: 10, borderWidth: 1, borderColor: "#181d28", paddingHorizontal: 12, paddingVertical: 7, marginRight: 7 },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginBottom: 9 },
  searchResult: { borderRadius: 12, borderWidth: 1, borderColor: "#181d28", padding: 10, marginBottom: 7 },
});
