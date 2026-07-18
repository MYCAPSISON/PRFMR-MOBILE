import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: SW, height: SH } = Dimensions.get("window");
const BG = "#0a0a0a";
const PRIMARY = "#F97316";

// ─────────────────────────────────────────────────────────────
// Splash geometry (image 863 × 1665, contain mode)
// ─────────────────────────────────────────────────────────────
const IMG_RATIO = 863 / 1665;
let splashW: number, splashH: number, splashOffX = 0, splashOffY = 0;
if (SW / SH <= IMG_RATIO) {
  // Width-constrained
  splashW = SW;
  splashH = SW / IMG_RATIO;
  splashOffY = (SH - splashH) / 2;
} else {
  // Height-constrained
  splashH = SH;
  splashW = SH * IMG_RATIO;
  splashOffX = (SW - splashW) / 2;
}
// Overlay aligns with baked-in button (image-relative %: bottom 1.8%, h 5.7%, left/right 2.3%)
const SPLASH_BTN = {
  bottom: splashOffY + splashH * 0.018,
  height: splashH * 0.057,
  left:   splashOffX + splashW * 0.023,
  right:  splashOffX + splashW * 0.023,
};

// ─────────────────────────────────────────────────────────────
// Wizard state
// ─────────────────────────────────────────────────────────────
interface WizardData {
  firstName: string;
  sports: string[];
  primarySport: string;
  competitionLevel: string;
  age: string;
  gender: string;
  height: string;
  currentWeight: string;
  surveyCutExperience: string;
  surveyCutOutcome: string;
  surveyCalorieKnowledge: string;
  surveyUnderfueling: string;
  surveyTrainingLoadTracking: string;
  surveyMicroKnowledge: string;
  surveyEnergyScore: number;
  surveyPerformance: string;
  surveyMainProblems: string[];
  demoTargetWeight: string;
  demoFightDate: string;
  demoWeighInTiming: "same_day" | "day_before";
  nonFightPrepMode: string;
  bodyFatPct: string;
  surveyStarRating: number;
  surveyCommitment: string;
  demoSleepHours: number;
  demoEnergyLevel: number;
}
const INIT: WizardData = {
  firstName: "", sports: [], primarySport: "", competitionLevel: "",
  age: "", gender: "", height: "", currentWeight: "",
  surveyCutExperience: "", surveyCutOutcome: "", surveyCalorieKnowledge: "",
  surveyUnderfueling: "", surveyTrainingLoadTracking: "", surveyMicroKnowledge: "",
  surveyEnergyScore: 5, surveyPerformance: "", surveyMainProblems: [],
  demoTargetWeight: "", demoFightDate: "", demoWeighInTiming: "same_day",
  nonFightPrepMode: "", bodyFatPct: "", surveyStarRating: 0, surveyCommitment: "",
  demoSleepHours: 7, demoEnergyLevel: 3,
};

// ─────────────────────────────────────────────────────────────
// Weight-cut calculation engine (mirrors shared/weight-cut.ts)
// ─────────────────────────────────────────────────────────────
interface WeightCutPlanResult {
  totalToLose: number; weeksUntil: number; daysUntil: number;
  fatLossRequired: number; tempCut: number;
  requiredWeeklyRate: number; requiredWeeklyRatePct: number;
  recommendedWeeklyRate: number; suggestedDeficitKcal: number;
  predictedDayMinus4Weight?: number; predictedWeekMinus1Weight?: number;
  status: "on_track" | "aggressive" | "very_aggressive" | "unrealistic" | "complete" | "past_date";
  statusLabel: string;
  weeklyTargets: Array<{ week: number; targetWeight: number }>;
}

function calculateWeightCutPlan(
  currentWeight: number, targetWeight: number, fightDateStr: string,
  weighInTiming: "same_day" | "day_before" = "same_day",
  manualTempReductionKg?: number | null,
): WeightCutPlanResult {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fight = new Date(fightDateStr + "T00:00:00");
  const daysUntil = Math.round((fight.getTime() - today.getTime()) / 86400000);
  const weeksUntil = Math.round((daysUntil / 7) * 10) / 10;
  const totalToLose = Math.round((currentWeight - targetWeight) * 10) / 10;

  const base = { totalToLose, weeksUntil, daysUntil, weeklyTargets: [] as Array<{ week: number; targetWeight: number }> };
  if (daysUntil <= 0) return { ...base, fatLossRequired: 0, tempCut: 0, requiredWeeklyRate: 0, requiredWeeklyRatePct: 0, recommendedWeeklyRate: 0, suggestedDeficitKcal: 0, status: "past_date", statusLabel: "Fight date has passed" };
  if (totalToLose <= 0) return { ...base, totalToLose: 0, fatLossRequired: 0, tempCut: 0, requiredWeeklyRate: 0, requiredWeeklyRatePct: 0, recommendedWeeklyRate: 0, suggestedDeficitKcal: 0, status: "complete", statusLabel: "Already at or below target" };

  let preFinal: number;
  const acuteDays = weighInTiming === "same_day" ? 4 : 7;
  if (weighInTiming === "same_day") {
    preFinal = manualTempReductionKg
      ? targetWeight + Math.min(manualTempReductionKg, targetWeight * 0.02)
      : targetWeight / 0.99;
  } else {
    preFinal = manualTempReductionKg
      ? targetWeight + Math.min(manualTempReductionKg, targetWeight * 0.10)
      : targetWeight / 0.94;
  }

  const weeksForFatLoss = Math.max(0.5, (daysUntil - acuteDays) / 7);
  const fatLossRequired = Math.max(0, Math.round((currentWeight - preFinal) * 10) / 10);
  const tempCut         = Math.max(0, Math.round((preFinal - targetWeight) * 10) / 10);
  const requiredWeeklyRate    = fatLossRequired / weeksForFatLoss;
  const requiredWeeklyRatePct = Math.round((requiredWeeklyRate / currentWeight) * 1000) / 10;
  const recommendedWeeklyRate = Math.min(requiredWeeklyRate, currentWeight * 0.01);
  const suggestedDeficitKcal  = Math.round(recommendedWeeklyRate * 7700 / 7);

  let status: WeightCutPlanResult["status"];
  let statusLabel: string;
  if (requiredWeeklyRatePct <= 0.5)       { status = "on_track";        statusLabel = "Steady pace"; }
  else if (requiredWeeklyRatePct <= 1.0)  { status = "on_track";        statusLabel = "On track"; }
  else if (requiredWeeklyRatePct <= 1.5)  { status = "aggressive";      statusLabel = "Quite aggressive — consider extending timeline"; }
  else if (requiredWeeklyRatePct <= 2.0)  { status = "very_aggressive"; statusLabel = "Very aggressive — adjust target or date"; }
  else                                     { status = "unrealistic";     statusLabel = "Timeline too tight — adjust target or date"; }

  const numWeeks = Math.ceil(weeksForFatLoss);
  const weeklyTargets: Array<{ week: number; targetWeight: number }> = [];
  for (let w = numWeeks; w >= 1; w--) {
    const projected = currentWeight - recommendedWeeklyRate * (numWeeks - w + 1);
    weeklyTargets.push({ week: w, targetWeight: Math.max(preFinal, Math.round(projected * 10) / 10) });
  }

  return {
    totalToLose, weeksUntil, daysUntil, fatLossRequired, tempCut,
    requiredWeeklyRate: Math.round(requiredWeeklyRate * 100) / 100,
    requiredWeeklyRatePct,
    recommendedWeeklyRate: Math.round(recommendedWeeklyRate * 100) / 100,
    suggestedDeficitKcal, status, statusLabel, weeklyTargets,
    ...(weighInTiming === "same_day" ? { predictedDayMinus4Weight: Math.round(preFinal * 10) / 10 } : { predictedWeekMinus1Weight: Math.round(preFinal * 10) / 10 }),
  };
}

// ─────────────────────────────────────────────────────────────
// Sports list — wrestling uses local user-supplied photo
// ─────────────────────────────────────────────────────────────
const SPORTS: Array<{ value: string; label: string; uri?: string; local?: boolean }> = [
  { value: "Boxing",                  label: "Boxing",                  uri: "https://images.pexels.com/photos/6699106/pexels-photo-6699106.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "MMA",                     label: "MMA",                     uri: "https://images.pexels.com/photos/5616798/pexels-photo-5616798.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "Muay Thai",               label: "Muay Thai",               uri: "https://images.pexels.com/photos/11045334/pexels-photo-11045334.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "Kickboxing",              label: "Kickboxing",              uri: "https://images.pexels.com/photos/13808098/pexels-photo-13808098.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "BJJ",                     label: "BJJ",                     uri: "https://images.pexels.com/photos/8611381/pexels-photo-8611381.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "Wrestling",               label: "Wrestling",               local: true },
  { value: "Traditional martial arts",label: "Traditional martial arts",uri: "https://images.pexels.com/photos/7045666/pexels-photo-7045666.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
];

const SPORT_ICONS: Record<string, any> = {
  boxing: require("@/assets/sport-icons/boxing.png"),
  mma: require("@/assets/sport-icons/mma.png"),
  "muay-thai": require("@/assets/sport-icons/muay-thai.png"),
  kickboxing: require("@/assets/sport-icons/kickboxing.png"),
  bjj: require("@/assets/sport-icons/bjj.png"),
  wrestling: require("@/assets/sport-icons/wrestling.png"),
  traditional: require("@/assets/sport-icons/traditional.png"),
};
function sportIcon(sport: string) {
  const s = sport.toLowerCase();
  if (s.includes("boxer") || s.includes("boxing")) return SPORT_ICONS["boxing"];
  if (s.includes("mma"))                            return SPORT_ICONS["mma"];
  if (s.includes("muay"))                           return SPORT_ICONS["muay-thai"];
  if (s.includes("kick"))                           return SPORT_ICONS["kickboxing"];
  if (s.includes("bjj") || s.includes("jiu"))       return SPORT_ICONS["bjj"];
  if (s.includes("wrest"))                          return SPORT_ICONS["wrestling"];
  if (s.includes("martial") || s.includes("traditional")) return SPORT_ICONS["traditional"];
  return undefined;
}

function SportBadgePreview({ level, sport }: { level: string; sport: string }) {
  const icon = sportIcon(sport);
  return (
    <View style={s5.badgeRow}>
      {icon ? <Image source={icon} style={s5.badgeIcon} /> : null}
      <Text style={s5.badgeTxt}>{level} {sport}</Text>
    </View>
  );
}

const PROBLEMS_MAP: Record<string, string> = {
  weight_class:  "Wrong weight class",
  calories:      "Calories & macros confusion",
  micronutrients:"Micronutrients",
  training_load: "Training load",
  fight_camp:    "Planning fight camp",
};
const COMMITMENT_LABELS: Record<string, string> = {
  extreme:     "Extremely committed",
  very:        "Very committed",
  somewhat:    "Somewhat committed",
  just_trying: "Just trying it",
};

function derivedGoal(d: WizardData): string {
  return d.nonFightPrepMode || "fat_loss";
}
function mapExperience(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("pro"))               return "advanced";
  if (l.includes("semi") || l.includes("inter")) return "intermediate";
  return "beginner";
}
function readinessScore(hours: number, energy: number) {
  const s = hours >= 8 ? 1 : hours >= 7 ? 0.8 : hours >= 6 ? 0.5 : 0.25;
  return Math.round((s * 0.5 + ((energy - 1) / 4) * 0.5) * 100);
}

// ─────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────
function OptionBtn({ label, selected, onPress, checkBox }: {
  label: string; selected: boolean; onPress: () => void; checkBox?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress}
      style={[ob.btn, selected ? ob.sel : ob.unsel]}>
      {checkBox && (
        <View style={[ob.cb, selected && ob.cbSel]}>
          {selected && <Feather name="check" size={10} color="#fff" />}
        </View>
      )}
      <Text style={[ob.label, { color: selected ? "#fff" : "#a1a1aa" }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const ob = StyleSheet.create({
  btn:  { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 16, marginBottom: 10 },
  unsel:{ backgroundColor: "rgba(39,39,42,0.6)" },
  sel:  { backgroundColor: "rgba(249,115,22,0.15)", borderWidth: 1, borderColor: "rgba(249,115,22,0.5)" },
  label:{ fontSize: 15, fontWeight: "500", flex: 1, fontFamily: "Inter_500Medium" },
  cb:   { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  cbSel:{ backgroundColor: PRIMARY, borderColor: PRIMARY },
});

function Heading({ text }: { text: string }) {
  return <Text style={typ.h}>{text}</Text>;
}
function Sub({ text }: { text: string }) {
  return <Text style={typ.s}>{text}</Text>;
}
const typ = StyleSheet.create({
  h: { fontSize: 26, fontWeight: "700", color: "#fff", lineHeight: 32, marginBottom: 8, fontFamily: "Inter_700Bold" },
  s: { fontSize: 14, color: "#71717a", lineHeight: 21, marginBottom: 20, fontFamily: "Inter_400Regular" },
});

function StyledInput({ placeholder, value, onChange, keyboardType, testID, autoFocus }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; testID?: string; autoFocus?: boolean;
}) {
  return (
    <TextInput
      style={inp.i}
      placeholder={placeholder} placeholderTextColor="#52525b"
      value={value} onChangeText={onChange}
      keyboardType={keyboardType} testID={testID} autoFocus={autoFocus}
    />
  );
}
const inp = StyleSheet.create({
  i: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b", color: "#fff", paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
});

function FieldLabel({ text }: { text: string }) {
  return <Text style={{ color: "#a1a1aa", fontSize: 11, fontWeight: "600", letterSpacing: 0.7, marginBottom: 8, fontFamily: "Inter_600SemiBold" }}>{text}</Text>;
}

function InfoDot({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 7, marginRight: 12 }} />
      <Text style={{ color: "#d4d4d8", fontSize: 14, flex: 1, lineHeight: 21, fontFamily: "Inter_400Regular" }}>{text}</Text>
    </View>
  );
}
function CheckRow({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 10 }}>
      <Feather name="check" size={15} color={PRIMARY} style={{ marginRight: 10, marginTop: 2 }} />
      <Text style={{ color: "#d4d4d8", fontSize: 14, flex: 1, lineHeight: 21, fontFamily: "Inter_400Regular" }}>{text}</Text>
    </View>
  );
}
function ItemCard({ children }: { children: React.ReactNode }) {
  return <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.5)", padding: 14, marginBottom: 10 }}>{children}</View>;
}
function PrimaryBox({ text }: { text: string }) {
  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.05)", padding: 14, marginTop: 12 }}>
      <Text style={{ color: PRIMARY, fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" }}>{text}</Text>
    </View>
  );
}

function ctaLabel(step: number) {
  if (step === 1) return "Yeah, that's me →";
  if (step === 2) return "Continue →";
  if (step === 17) return "Let's build your plan →";
  if (step === 28) return "Build my plan →";
  if (step === 30 || step === 31 || step === 32) return "Continue →";
  if (step === 33) return "Start tracking →";
  return "Next →";
}

// ─────────────────────────────────────────────────────────────
// Module-level styles referenced before render
// ─────────────────────────────────────────────────────────────
const loadSt = StyleSheet.create({
  root:     { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  row:      { flexDirection: "row", alignItems: "center", gap: 10 },
  text:     { color: "#d4d4d8", fontSize: 14, fontFamily: "Inter_400Regular" },
  errBox:   { marginTop: 24, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center" },
  errText:  { color: "#ef4444", fontSize: 13, textAlign: "center", fontFamily: "Inter_400Regular" },
  retry:    { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: PRIMARY, borderRadius: 8 },
  retryTxt: { color: "#fff", fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { refetchUser } = useAuth();
  const [step, setStep]           = useState(0);
  const [d, setD]                 = useState<WizardData>(INIT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function set<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setD(p => ({ ...p, [k]: v }));
  }
  function toggleSport(s: string) {
    setD(p => ({
      ...p,
      sports: p.sports.includes(s) ? p.sports.filter(x => x !== s) : [...p.sports, s],
      primarySport: p.sports.length === 0 ? s : p.primarySport,
    }));
  }
  function toggleProblem(v: string) {
    setD(p => ({
      ...p,
      surveyMainProblems: p.surveyMainProblems.includes(v)
        ? p.surveyMainProblems.filter(x => x !== v)
        : [...p.surveyMainProblems, v],
    }));
  }

  const mainSport = d.sports.length === 1 ? d.sports[0] : d.primarySport || d.sports[0] || "";
  const skipCutChart = !!d.nonFightPrepMode;

  function canProceed() {
    switch (step) {
      case 3:  return d.firstName.trim().length > 0;
      case 4:  return d.sports.length > 0;
      case 5:  return d.competitionLevel.trim().length > 0 && (d.sports.length <= 1 || !!d.primarySport);
      case 6:  return parseInt(d.age) >= 15;
      case 7:  return !!d.gender;
      case 8:  return parseFloat(d.height) >= 100;
      case 9:  return parseFloat(d.currentWeight) > 30;
      case 10: return !!d.surveyCutExperience;
      case 11: return !!d.surveyCutOutcome;
      case 12: return !!d.surveyCalorieKnowledge;
      case 13: return !!d.surveyUnderfueling;
      case 14: return !!d.surveyTrainingLoadTracking;
      case 15: return !!d.surveyMicroKnowledge;
      case 19: return !!d.surveyPerformance;
      case 20: return d.surveyMainProblems.length > 0;
      case 22: return (!!d.demoFightDate && !!d.demoTargetWeight && parseFloat(d.demoTargetWeight) < parseFloat(d.currentWeight)) || !!d.nonFightPrepMode;
      case 27: return d.surveyStarRating > 0;
      case 31: return !!d.surveyCommitment;
      default: return true;
    }
  }

  function advance() {
    const next = (step === 22 && skipCutChart) ? 24 : step + 1;
    setStep(next);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  }
  function retreat() {
    const prev = (step === 24 && skipCutChart) ? 22 : step - 1;
    setStep(Math.max(prev, 1));
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  }

  // ── Submission at step 29 ─────────────────────────────────
  const doSubmit = useCallback(async () => {
    if (submitted || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Server requires gender to be "male" | "female" (no null/undefined
      // default is sanitised server-side, unlike age/height/weight). Users
      // who picked "Other" or "Prefer not to say" still need a valid value
      // sent, so we fall back to "male" for the BMR calculation in that case.
      const validGender = (d.gender === "male" || d.gender === "female") ? d.gender : "male";

      const payload: Record<string, unknown> = {
        gender:           validGender,
        age:              d.age ? parseInt(d.age) : undefined,
        height:           d.height ? parseFloat(d.height) : undefined,
        currentWeight:    d.currentWeight ? parseFloat(d.currentWeight) : undefined,
        activityLevel:    "moderate",
        goal:             derivedGoal(d),
        experienceLevel:  mapExperience(d.competitionLevel),
        mainSport:        mainSport || undefined,
        surveyCutExperience:        d.surveyCutExperience || undefined,
        surveyCutOutcome:           d.surveyCutOutcome || undefined,
        surveyCalorieKnowledge:     d.surveyCalorieKnowledge || undefined,
        surveyUnderfueling:         d.surveyUnderfueling || undefined,
        surveyTrainingLoadTracking: d.surveyTrainingLoadTracking || undefined,
        surveyMicroKnowledge:       d.surveyMicroKnowledge || undefined,
        surveyEnergyScore:          d.surveyEnergyScore,
        surveyPerformance:          d.surveyPerformance || undefined,
        surveyMainProblems:         d.surveyMainProblems.length > 0 ? d.surveyMainProblems : undefined,
        surveyStarRating:           d.surveyStarRating || undefined,
        surveyCommitment:           d.surveyCommitment || undefined,
      };

      if (__DEV__) {
        console.log("[onboard] Submitting payload:", JSON.stringify(payload, null, 2));
      }
      await apiFetch("/user/me/onboard", { method: "POST", body: payload });

      // Fight camp — separate endpoint per spec (POST /me/weight-cut)
      if (!d.nonFightPrepMode && d.demoFightDate && d.demoTargetWeight) {
        try {
          await apiFetch("/me/weight-cut", {
            method: "POST",
            body: {
              currentWeight:        parseFloat(d.currentWeight),
              targetWeight:         parseFloat(d.demoTargetWeight),
              fightDate:            d.demoFightDate,
              weighInTiming:        d.demoWeighInTiming,
              manualTempReductionKg: null,
            },
          });
        } catch { /* non-critical — user can set fight camp later from dashboard */ }
      }

      // Body fat — separate endpoint (PATCH /me/body-composition)
      if (d.bodyFatPct) {
        try {
          await apiFetch("/me/body-composition", {
            method: "PATCH",
            body: { bodyFatPct: parseFloat(d.bodyFatPct) / 100 },
          });
        } catch { /* non-critical */ }
      }

      setSubmitted(true);
      await refetchUser();
      setStep(30);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [d, submitted, submitting, mainSport]);

  useEffect(() => {
    if (step === 29 && !submitted && !submitting) doSubmit();
  }, [step, doSubmit, submitted, submitting]);

  // ── Step 0: Splash ──────────────────────────────────────────
  if (step === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Image
          source={require("@/assets/onboarding-splash.jpeg")}
          style={{ position: "absolute", width: splashW, height: splashH, left: splashOffX, top: splashOffY }}
          resizeMode="stretch"
        />
        <Pressable
          testID="button-splash-cta"
          onPress={() => setStep(1)}
          accessibilityLabel="Let's build your plan"
          style={{ position: "absolute", bottom: SPLASH_BTN.bottom, height: SPLASH_BTN.height, left: SPLASH_BTN.left, right: SPLASH_BTN.right }}
        />
      </View>
    );
  }

  // ── Step 29: Loading ─────────────────────────────────────────
  if (step === 29) {
    return (
      <View style={[loadSt.root, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        {submitting && (
          <View style={{ marginTop: 32, gap: 16 }}>
            {["Calculating targets", "Adjusting for training", "Optimising nutrition"].map(t => (
              <View key={t} style={loadSt.row}>
                <Feather name="check-circle" size={16} color={PRIMARY} />
                <Text style={loadSt.text}>{t}</Text>
              </View>
            ))}
          </View>
        )}
        {submitError && (
          <View style={loadSt.errBox}>
            <Text style={loadSt.errText}>{submitError}</Text>
            <TouchableOpacity onPress={doSubmit} style={loadSt.retry}>
              <Text style={loadSt.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Steps 1–33: Shell ─────────────────────────────────────────
  const hideBack = step <= 1;
  const isLast   = step === 33;
  const ready    = canProceed();
  const readiness      = readinessScore(d.demoSleepHours, d.demoEnergyLevel);
  const readinessLabel = readiness >= 80 ? "Excellent" : readiness >= 60 ? "Good" : readiness >= 40 ? "Fair" : "Low";
  const readinessColor = readiness >= 80 ? "#4ade80" : readiness >= 60 ? PRIMARY : readiness >= 40 ? "#facc15" : "#ef4444";

  // Target weight error
  const targetWeightError = d.demoTargetWeight && d.currentWeight &&
    parseFloat(d.demoTargetWeight) >= parseFloat(d.currentWeight);

  return (
    // KAV wraps everything including the bottom nav so it all shifts up with keyboard
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Progress bar */}
      <View style={sh.progressTrack}>
        <View style={[sh.progressFill, { width: `${(step / 33) * 100}%` as any }]} />
      </View>
      {/* Logo strip */}
      <View style={[sh.logoStrip, { paddingTop: insets.top }]}>
        <Image source={require("@/assets/logo-main.png")} style={sh.logo} resizeMode="contain" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={sh.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── Step 1 ── */}
        {step === 1 && <>
          <Heading text="Be honest." />
          <Sub text="Are you struggling to:" />
          <ItemCard><InfoDot text="Plan your weight cut safely?" /></ItemCard>
          <ItemCard><InfoDot text="Know how much to eat?" /></ItemCard>
          <ItemCard><InfoDot text="Balance training and recovery?" /></ItemCard>
        </>}

        {/* ── Step 2 ── */}
        {step === 2 && <>
          <Heading text="This is where it changes." />
          <Sub text="PRFMR is your fight camp system." />
          <CheckRow text="Plans your weight cut safely" />
          <CheckRow text="Adjusts calories based on training" />
          <CheckRow text="Tracks your performance & recovery" />
          <CheckRow text="Ensures your nutrition actually fuels output" />
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.05)", padding: 16, marginTop: 12 }}>
            <Text style={{ color: "#d4d4d8", fontSize: 14, fontStyle: "italic", fontFamily: "Inter_400Regular", lineHeight: 21 }}>
              "You don't need to guess. You need a system."
            </Text>
          </View>
        </>}

        {/* ── Step 3 ── */}
        {step === 3 && <>
          <Heading text="What's your name?" />
          <Sub text="We'll personalise your experience." />
          <StyledInput placeholder="First name" value={d.firstName} onChange={v => set("firstName", v)} testID="input-name" autoFocus />
        </>}

        {/* ── Step 4: Sport ── */}
        {step === 4 && <>
          <Heading text="What sport do you compete in?" />
          <Sub text="Select all that apply." />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SPORTS.map((sp, idx) => {
              const sel = d.sports.includes(sp.value);
              const full = idx === 6;
              return (
                <TouchableOpacity key={sp.value}
                  testID={`button-sport-${sp.value.toLowerCase().replace(/ /g, "-")}`}
                  onPress={() => toggleSport(sp.value)}
                  style={[spc.card, { width: full ? "100%" : "48%" }, sel ? spc.sel : spc.unsel]}>
                  <Image source={sp.local ? require("@/assets/wrestling-photo.jpg") : { uri: sp.uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <View style={[spc.overlay, sel && spc.overlaySelected]} />
                  {sel && <View style={spc.checkBadge}><Feather name="check" size={10} color="#fff" /></View>}
                  <Text style={spc.label}>{sp.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {d.sports.length > 0 && (
            <Text style={{ color: "#71717a", fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>
              {d.sports.length === 1 ? `Selected: ${d.sports[0]}` : `${d.sports.length} sports selected`}
            </Text>
          )}
        </>}

        {/* ── Step 5: Competition level ── */}
        {step === 5 && <>
          <Heading text="What level do you compete at?" />
          <Sub text="This shapes your nutrition targets." />
          {d.sports.length > 1 && <>
            <Text style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 10, fontFamily: "Inter_400Regular" }}>What's your main sport right now?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {d.sports.map(sp => (
                <TouchableOpacity key={sp} onPress={() => set("primarySport", sp)}
                  style={[s5.pill, d.primarySport === sp && s5.pillSel]}>
                  <Text style={[s5.pillTxt, d.primarySport === sp && { color: PRIMARY }]}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}
          <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 10, fontFamily: "Inter_600SemiBold" }}>COMPETITION LEVEL</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            {["Amateur", "Pro"].map(l => (
              <TouchableOpacity key={l} onPress={() => set("competitionLevel", l)}
                style={[s5.pill, { flex: 1 }, d.competitionLevel === l && s5.pillSel]}>
                <Text style={[s5.pillTxt, d.competitionLevel === l && { color: PRIMARY }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <StyledInput
            placeholder="Or type your own… (e.g. Semi-pro, White collar)"
            value={(d.competitionLevel === "Amateur" || d.competitionLevel === "Pro") ? "" : d.competitionLevel}
            onChange={v => set("competitionLevel", v)}
            testID="input-competition-level"
          />
          {d.competitionLevel && mainSport && (
            <View style={s5.badge}>
              <Text style={s5.badgeLbl}>Your sport identity badge</Text>
              <SportBadgePreview level={d.competitionLevel} sport={mainSport} />
              <Text style={s5.badgeSub}>Shown on your dashboard and profile</Text>
            </View>
          )}
        </>}

        {/* ── Step 6: Age ── */}
        {step === 6 && <>
          <Heading text="How old are you?" />
          <Sub text="Used to calculate your metabolic baseline." />
          <StyledInput placeholder="Age (years)" value={d.age} onChange={v => set("age", v)} keyboardType="number-pad" testID="input-age" autoFocus />
        </>}

        {/* ── Step 7: Gender ── */}
        {step === 7 && <>
          <Heading text="What's your gender?" />
          <Sub text="Affects your calorie and protein calculations." />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "other", l: "Other" }, { v: "prefer_not", l: "Prefer not to say" }].map(o => (
              <TouchableOpacity key={o.v} onPress={() => set("gender", o.v)}
                style={[g7.btn, d.gender === o.v && g7.sel]}>
                <Text style={[g7.lbl, d.gender === o.v && { color: "#fff" }]}>{o.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {(d.gender === "other" || d.gender === "prefer_not") && (
            <Text style={{ color: "#52525b", fontSize: 12, marginTop: 10, fontFamily: "Inter_400Regular" }}>
              We'll use a neutral BMR estimate for your targets.
            </Text>
          )}
        </>}

        {/* ── Step 8: Height ── */}
        {step === 8 && <>
          <Heading text="What is your height?" />
          <Sub text="In centimetres." />
          <StyledInput placeholder="e.g. 175" value={d.height} onChange={v => set("height", v)} keyboardType="decimal-pad" testID="input-height" autoFocus />
          <Text style={{ color: "#52525b", fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>5′9″ = 175 cm · 6′0″ = 183 cm</Text>
        </>}

        {/* ── Step 9: Weight ── */}
        {step === 9 && <>
          <Heading text="What's your current weight?" />
          <Sub text="In kilograms. Morning weight if possible." />
          <StyledInput placeholder="e.g. 72.5" value={d.currentWeight} onChange={v => set("currentWeight", v)} keyboardType="decimal-pad" testID="input-weight" autoFocus />
        </>}

        {/* ── Step 10–15: Survey ── */}
        {step === 10 && <>
          <Heading text="How many cuts have you done?" />
          {[{ v: "none", l: "First time" }, { v: "1-2", l: "1–2" }, { v: "3-5", l: "3–5" }, { v: "5+", l: "5+" }].map(o => (
            <OptionBtn key={o.v} label={o.l} selected={d.surveyCutExperience === o.v} onPress={() => set("surveyCutExperience", o.v)} />
          ))}
        </>}

        {step === 11 && <>
          <Heading text="Did they go to plan?" />
          {[{ v: "yes", l: "Yes" }, { v: "low_energy", l: "Sometimes felt low energy" }, { v: "missed_weight", l: "Missed weight once or twice" }, { v: "reduced_strength", l: "Felt reduced strength" }, { v: "all", l: "All of the above" }].map(o => (
            <OptionBtn key={o.v} label={o.l} selected={d.surveyCutOutcome === o.v} onPress={() => set("surveyCutOutcome", o.v)} />
          ))}
        </>}

        {step === 12 && <>
          <Heading text="Do you know how to adjust calories to training?" />
          {[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }, { v: "guess", l: "I guess" }, { v: "nutritionist", l: "I use a nutritionist" }].map(o => (
            <OptionBtn key={o.v} label={o.l} selected={d.surveyCalorieKnowledge === o.v} onPress={() => set("surveyCalorieKnowledge", o.v)} />
          ))}
        </>}

        {step === 13 && <>
          <Heading text="Do you ever feel under-fuelled?" />
          {[{ v: "training", l: "Yes, in training" }, { v: "fights", l: "Yes, in fights" }, { v: "both", l: "Both" }, { v: "not_really", l: "Not really" }].map(o => (
            <OptionBtn key={o.v} label={o.l} selected={d.surveyUnderfueling === o.v} onPress={() => set("surveyUnderfueling", o.v)} />
          ))}
        </>}

        {step === 14 && <>
          <Heading text="Do you track your training load?" />
          {[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }, { v: "feel", l: "I go by feel" }].map(o => (
            <OptionBtn key={o.v} label={o.l} selected={d.surveyTrainingLoadTracking === o.v} onPress={() => set("surveyTrainingLoadTracking", o.v)} />
          ))}
        </>}

        {step === 15 && <>
          <Heading text="Do you know which micronutrients matter?" />
          {[{ v: "no_idea", l: "No idea" }, { v: "not_really", l: "Not really" }, { v: "yes", l: "Yes" }].map(o => (
            <OptionBtn key={o.v} label={o.l} selected={d.surveyMicroKnowledge === o.v} onPress={() => set("surveyMicroKnowledge", o.v)} />
          ))}
        </>}

        {/* ── Step 16: Bombshell stats ── */}
        {step === 16 && <>
          <Heading text={d.firstName ? `${d.firstName}, this isn't random.` : "This isn't random."} />
          <Sub text="Most fighters aren't underperforming by accident." />
          {[{ stat: "65%", desc: "of fighters have had a failed weight cut" }, { stat: "~90%", desc: "aren't fueling training properly" }, { stat: "Most", desc: "are missing key micronutrients consistently" }].map(item => (
            <View key={item.stat} style={s16.card}>
              <Text style={s16.stat}>{item.stat}</Text>
              <Text style={s16.desc}>{item.desc}</Text>
            </View>
          ))}
          <Text style={s16.footer}>And training? Still managed by guesswork — not data.</Text>
        </>}

        {/* ── Step 17: Aspiration ── */}
        {step === 17 && <>
          <Heading text="You don't have to fight like this." />
          <Sub text="Imagine:" />
          {["Feeling strong every session", "Never missing weight", "Performing at your peak"].map(t => (
            <View key={t} style={s17.row}>
              <Feather name="check" size={16} color={PRIMARY} />
              <Text style={s17.txt}>{t}</Text>
            </View>
          ))}
        </>}

        {/* ── Step 18: Energy score ── */}
        {step === 18 && <>
          <Heading text="How's your energy during a cut?" />
          <Sub text="Rate 1 (exhausted) to 10 (bulletproof)." />
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: 24 }}>
            <Text style={{ fontSize: 72, fontWeight: "700", color: PRIMARY, fontFamily: "Inter_700Bold" }}>{d.surveyEnergyScore}</Text>
            <Text style={{ fontSize: 24, color: "#71717a", fontFamily: "Inter_400Regular" }}> / 10</Text>
          </View>
          {[[1,2,3,4,5],[6,7,8,9,10]].map((row, ri) => (
            <View key={ri} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
              {row.map(n => (
                <TouchableOpacity key={n} onPress={() => set("surveyEnergyScore", n)}
                  style={[s18.btn, d.surveyEnergyScore === n && s18.btnSel, { flex: 1 }]}>
                  <Text style={[s18.num, d.surveyEnergyScore === n && { color: PRIMARY }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: "#52525b", fontSize: 12, fontFamily: "Inter_400Regular" }}>Exhausted</Text>
            <Text style={{ color: "#52525b", fontSize: 12, fontFamily: "Inter_400Regular" }}>Bulletproof</Text>
          </View>
        </>}

        {/* ── Step 19: Performance ── */}
        {step === 19 && <>
          <Heading text="Your last performance?" />
          {[{ v: "terrible", l: "Terrible" }, { v: "could_be_better", l: "Could be better" }, { v: "good", l: "Good" }, { v: "excellent", l: "Excellent" }].map(o => (
            <OptionBtn key={o.v} label={o.l} selected={d.surveyPerformance === o.v} onPress={() => set("surveyPerformance", o.v)} />
          ))}
        </>}

        {/* ── Step 20: Problems ── */}
        {step === 20 && <>
          <Heading text="What's holding you back?" />
          <Sub text="Select all that apply." />
          {Object.entries(PROBLEMS_MAP).map(([v, l]) => (
            <OptionBtn key={v} label={l} selected={d.surveyMainProblems.includes(v)} onPress={() => toggleProblem(v)} checkBox />
          ))}
        </>}

        {/* ── Step 21: Reflection ── */}
        {step === 21 && <>
          <Heading text="You're not alone." />
          <Sub text="Most fighters struggle with:" />
          {d.surveyMainProblems.length === 0
            ? <ItemCard><Text style={{ color: "#d4d4d8", fontFamily: "Inter_400Regular" }}>Every aspect of nutrition and performance.</Text></ItemCard>
            : d.surveyMainProblems.map(v => (
              <View key={v} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(39,39,42,0.4)", borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <Feather name="chevron-right" size={16} color={PRIMARY} />
                <Text style={{ color: "#d4d4d8", fontSize: 14, fontFamily: "Inter_400Regular" }}>{PROBLEMS_MAP[v]}</Text>
              </View>
            ))
          }
          <PrimaryBox text="PRFMR is built to fix exactly this." />
        </>}

        {/* ── Step 22: Fight camp planner ── */}
        {step === 22 && (() => {
          const cw = parseFloat(d.currentWeight) || 0;
          const tw = parseFloat(d.demoTargetWeight) || 0;
          const planValid = !d.nonFightPrepMode && !!d.demoFightDate && tw > 0 && tw < cw;
          const plan: WeightCutPlanResult | null = planValid
            ? calculateWeightCutPlan(cw, tw, d.demoFightDate, d.demoWeighInTiming)
            : null;
          const statusColors: Record<string, { text: string; border: string; bg: string }> = {
            on_track:       { text: "#4ade80", border: "rgba(74,222,128,0.3)",  bg: "rgba(74,222,128,0.05)" },
            aggressive:     { text: "#facc15", border: "rgba(250,204,21,0.3)",  bg: "rgba(250,204,21,0.05)" },
            very_aggressive:{ text: PRIMARY,   border: "rgba(249,115,22,0.3)",  bg: "rgba(249,115,22,0.05)" },
            unrealistic:    { text: "#ef4444", border: "rgba(239,68,68,0.3)",   bg: "rgba(239,68,68,0.05)" },
            complete:       { text: "#71717a", border: "#27272a",               bg: "rgba(39,39,42,0.3)" },
            past_date:      { text: "#71717a", border: "#27272a",               bg: "rgba(39,39,42,0.3)" },
          };
          return <>
            <Heading text="Build your fight camp plan." />
            <Sub text="Enter your details — PRFMR calculates the exact cut." />
            <View style={s22.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#71717a", fontSize: 13, fontFamily: "Inter_400Regular" }}>Current weight</Text>
                <Text style={{ color: "#d4d4d8", fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" }}>{d.currentWeight || "—"} kg</Text>
              </View>
              <FieldLabel text="TARGET WEIGHT (kg)" />
              <StyledInput
                placeholder={cw ? `e.g. ${(cw - 2).toFixed(1)}` : "e.g. 68"}
                value={d.demoTargetWeight}
                onChange={v => set("demoTargetWeight", v)}
                keyboardType="decimal-pad"
                testID="input-demo-target-weight"
              />
              {d.demoTargetWeight && tw >= cw && cw > 0 && (
                <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontFamily: "Inter_400Regular" }}>Must be less than your current weight.</Text>
              )}

              <FieldLabel text="FIGHT DATE" />
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[inp.i, { justifyContent: "center" }]}>
                <Text style={{ color: d.demoFightDate ? "#fff" : "#52525b", fontSize: 16, fontFamily: "Inter_400Regular" }}>
                  {d.demoFightDate ? new Date(d.demoFightDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Select fight date"}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={d.demoFightDate ? new Date(d.demoFightDate + "T00:00:00") : new Date(Date.now() + 30 * 86400000)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date(Date.now() + 7 * 86400000)}
                  themeVariant="dark"
                  onChange={(_, date) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (date) set("demoFightDate", date.toISOString().split("T")[0]);
                  }}
                />
              )}
              {Platform.OS === "ios" && showDatePicker && (
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 14 }}>
                  <Text style={{ color: PRIMARY, fontWeight: "600", fontFamily: "Inter_600SemiBold" }}>Done</Text>
                </TouchableOpacity>
              )}

              <FieldLabel text="WEIGH-IN TIMING" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[{ v: "same_day" as const, l: "Same day" }, { v: "day_before" as const, l: "Day before" }].map(o => (
                  <TouchableOpacity key={o.v} onPress={() => set("demoWeighInTiming", o.v)}
                    style={[s22.timing, d.demoWeighInTiming === o.v && s22.timingSel]}>
                    <Text style={[s22.timingTxt, d.demoWeighInTiming === o.v && { color: "#fff" }]}>{o.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Live calculation result card */}
            {plan ? (() => {
              const sc = statusColors[plan.status] ?? statusColors.on_track;
              const preFinalLabel = plan.predictedDayMinus4Weight !== undefined ? "T−4 target (bodyweight)" : "T−7 target (bodyweight)";
              const preFinalValue = (plan.predictedDayMinus4Weight ?? plan.predictedWeekMinus1Weight ?? 0).toFixed(1);
              return (
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {/* Status badge */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, borderColor: sc.border, backgroundColor: sc.bg, padding: 12 }}>
                    <Feather name="trending-down" size={18} color={sc.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: sc.text, fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" }}>{plan.statusLabel}</Text>
                      <Text style={{ color: "#71717a", fontSize: 11, marginTop: 2, fontFamily: "Inter_400Regular" }}>
                        {plan.requiredWeeklyRatePct.toFixed(1)}% BW/week required{plan.status !== "on_track" ? " — safe ceiling is 1%" : ""}
                      </Text>
                    </View>
                  </View>
                  {/* Stats 2×3 grid */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { v: `${plan.totalToLose.toFixed(1)} kg`,           l: "total to lose" },
                      { v: `${plan.weeksUntil.toFixed(1)} wks`,           l: "until fight" },
                      { v: `${plan.fatLossRequired.toFixed(1)} kg`,        l: "fat loss phase" },
                      { v: plan.tempCut > 0 ? `${plan.tempCut.toFixed(1)} kg` : "minimal", l: "temp cut (fluids)" },
                      { v: `${plan.recommendedWeeklyRate.toFixed(2)} kg/wk`, l: "safe weekly rate" },
                      { v: `−${plan.suggestedDeficitKcal} kcal`,           l: "daily deficit" },
                    ].map(cell => (
                      <View key={cell.l} style={{ width: "31%", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(39,39,42,0.4)", padding: 10, alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" }}>{cell.v}</Text>
                        <Text style={{ color: "#71717a", fontSize: 10, marginTop: 2, textAlign: "center", fontFamily: "Inter_400Regular" }}>{cell.l}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Pre-final target row */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(39,39,42,0.2)", paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Text style={{ color: "#71717a", fontSize: 12, fontFamily: "Inter_400Regular" }}>{preFinalLabel}</Text>
                    <Text style={{ color: "#d4d4d8", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" }}>{preFinalValue} kg</Text>
                  </View>
                  {/* Warning for aggressive/unrealistic */}
                  {(plan.status === "aggressive" || plan.status === "very_aggressive" || plan.status === "unrealistic") && (
                    <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "rgba(234,179,8,0.3)", backgroundColor: "rgba(234,179,8,0.05)", padding: 12 }}>
                      <Text style={{ color: "rgba(253,224,71,0.8)", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
                        {plan.status === "unrealistic"
                          ? "⚠️ This timeline is very tight. Moving your fight date or adjusting your target weight will give PRFMR more time to work with."
                          : "⚠️ Your pace is above the safe 1% BW/week threshold. PRFMR will cap your daily deficit to protect performance — you may need more time or a slightly higher target weight."}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })() : !d.nonFightPrepMode && (
              <Text style={{ color: "#52525b", fontSize: 12, textAlign: "center", marginBottom: 16, fontFamily: "Inter_400Regular" }}>
                Enter your target weight and fight date to build your plan.
              </Text>
            )}

            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 8 }} />
            <Text style={{ color: "#71717a", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 }}>
              Not currently in fight prep — or not focused on losing weight right now?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[{ v: "fat_loss", l: "General fat loss" }, { v: "maintenance", l: "Maintenance" }, { v: "weight_gain", l: "Weight gain" }].map(o => (
                <TouchableOpacity key={o.v} onPress={() => set("nonFightPrepMode", d.nonFightPrepMode === o.v ? "" : o.v)}
                  style={[s22.pill, d.nonFightPrepMode === o.v && s22.pillSel]}>
                  <Text style={[s22.pillTxt, d.nonFightPrepMode === o.v && { color: "#fff" }]}>{o.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {d.nonFightPrepMode === "maintenance"  && <Text style={s22.modeNote}>You'll start in Maintenance mode. You can switch to Fight Camp anytime from your dashboard once you have a fight booked.</Text>}
            {d.nonFightPrepMode === "weight_gain"  && <Text style={s22.modeNote}>You'll start in Weight Gain mode — calories set above TDEE to support muscle building. You can switch to Fight Camp anytime.</Text>}
            {d.nonFightPrepMode === "fat_loss"     && <Text style={s22.modeNote}>You'll start in General Fat Loss mode. You can switch to Fight Camp anytime from your dashboard.</Text>}
          </>;
        })()}

        {/* ── Step 23: Projected cut chart ── */}
        {step === 23 && (() => {
          const cw = parseFloat(d.currentWeight) || 80;
          const tw = parseFloat(d.demoTargetWeight) || cw - 5;
          const plan = calculateWeightCutPlan(cw, tw, d.demoFightDate || new Date(Date.now() + 56 * 86400000).toISOString().split("T")[0], d.demoWeighInTiming);
          // Build trend: today + up to 4 evenly-sampled interior points (forward order) + fight
          const targets = plan.weeklyTargets;
          const interior: Array<{ weight: number; label: string }> = [];
          if (targets.length > 0) {
            const maxPts = Math.min(4, targets.length);
            const step_ = Math.max(1, Math.floor(targets.length / maxPts));
            for (let i = 0; i < targets.length && interior.length < maxPts; i += step_) {
              const t = targets[i];
              interior.push({ weight: t.targetWeight, label: `Wk ${t.week}` });
            }
          }
          const trend = [
            { weight: cw, label: "Today" },
            ...interior,
            { weight: tw, label: "Fight" },
          ];
          const minW = tw;
          const range = Math.max(cw - tw, 0.1);
          const toBarH = (w: number) => Math.round(((w - minW) / range) * 68 + 14);
          return <>
            <Heading text="Your projected cut." />
            <Sub text="Based on the plan you just built." />
            <View style={{ flexDirection: "row", alignItems: "flex-end", height: 140, gap: 5, marginBottom: 8 }}>
              {trend.map((pt, i) => {
                const h = toBarH(pt.weight);
                const last = i === trend.length - 1;
                return (
                  <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                    <Text style={{ color: last ? PRIMARY : "#71717a", fontSize: 10, marginBottom: 3, fontFamily: "Inter_400Regular" }}>{pt.weight.toFixed(1)}</Text>
                    <View style={{ height: `${h}%` as any, width: "80%", borderRadius: 4, backgroundColor: last ? "rgba(249,115,22,0.4)" : "rgba(249,115,22,0.15)" }} />
                    <Text style={{ color: "#52525b", fontSize: 9, marginTop: 4, fontFamily: "Inter_400Regular" }}>{pt.label}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <View style={s23.stat}><Text style={s23.statVal}>−{plan.totalToLose.toFixed(1)} kg</Text><Text style={s23.statLbl}>Projected loss</Text></View>
              <View style={s23.stat}><Text style={s23.statVal}>{plan.recommendedWeeklyRate.toFixed(2)} kg</Text><Text style={s23.statLbl}>Per week (fat loss phase)</Text></View>
            </View>
          </>;
        })()}

        {/* ── Step 24: Morning check-in demo ── */}
        {step === 24 && <>
          <Heading text="Your morning check-in." />
          <Sub text="Takes 10 seconds. Drives your whole day." />
          <Text style={s24.lbl}>🌙  Sleep</Text>
          <Text style={[s24.sliderVal, { color: d.demoSleepHours >= 8 ? PRIMARY : "#71717a" }]}>{d.demoSleepHours} hrs</Text>
          <View style={{ flexDirection: "row", gap: 3, marginBottom: 4 }}>
            {Array.from({ length: 13 }, (_, i) => 4 + i * 0.5).map(v => (
              <TouchableOpacity key={v} onPress={() => set("demoSleepHours", v)}
                style={[s24.tick, d.demoSleepHours === v && s24.tickSel, { flex: 1, height: 28 }]} />
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
            <Text style={{ color: "#52525b", fontSize: 11, fontFamily: "Inter_400Regular" }}>4 hrs</Text>
            <Text style={{ color: "#52525b", fontSize: 11, fontFamily: "Inter_400Regular" }}>10 hrs</Text>
          </View>
          <Text style={s24.lbl}>⚡  Energy level</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 20 }}>
            {(["😫", "😕", "😐", "🙂", "⚡"] as const).map((e, i) => (
              <TouchableOpacity key={e} testID={`button-demo-energy-${i + 1}`} onPress={() => set("demoEnergyLevel", i + 1)}
                style={[s24.emoji, d.demoEnergyLevel === i + 1 && s24.emojiSel]}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s24.scoreCard}>
            <View><Text style={s24.scoreLbl}>Session Readiness</Text><Text style={[s24.scoreStatus, { color: readinessColor }]}>{readinessLabel}</Text></View>
            <View style={{ alignItems: "flex-end" }}><Text style={[s24.scoreNum, { color: readinessColor }]}>{readiness}</Text><Text style={{ color: "#52525b", fontSize: 13, fontFamily: "Inter_400Regular" }}>/ 100</Text></View>
          </View>
        </>}

        {/* ── Step 25: Food log demo ── */}
        {step === 25 && <>
          <Heading text="Log your meals." />
          <Sub text="4 ways to add food — whatever works for you." />
          {[{ icon: "search" as const, title: "Search", desc: "Search our database of 900k+ foods" }, { icon: "package" as const, title: "Whole Foods", desc: "Ingredient-level micro tracking" }, { icon: "camera" as const, title: "Barcode", desc: "Scan any product in seconds" }, { icon: "edit-2" as const, title: "Custom", desc: "Add your own meal or recipe" }].map(t => (
            <View key={t.title} style={s25.row}>
              <View style={s25.icon}><Feather name={t.icon} size={18} color={PRIMARY} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s25.title}>{t.title}</Text>
                <Text style={s25.desc}>{t.desc}</Text>
              </View>
            </View>
          ))}
        </>}

        {/* ── Step 26: First win ── */}
        {step === 26 && <>
          <Heading text="You're already winning." />
          <Sub text="Most fighters never even get this far." />
          <View style={{ borderRadius: 16, overflow: "hidden", height: 220, marginBottom: 16 }}>
            <Image source={require("@/assets/fight_action_1.jpg")} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" }} />
            <View style={{ flex: 1, justifyContent: "flex-end", padding: 20 }}>
              <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, fontFamily: "Inter_700Bold", marginBottom: 4 }}>DAY 1</Text>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" }}>Let's go.</Text>
            </View>
          </View>
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.05)", padding: 16 }}>
            <Text style={{ color: "#d4d4d8", fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular" }}>
              You've just done what most fighters never bother with — understanding what your body actually needs.
            </Text>
          </View>
        </>}

        {/* ── Step 27: Star rating ── */}
        {step === 27 && <>
          <Heading text="How useful does this look?" />
          <Sub text="Rate your first impression." />
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => set("surveyStarRating", n)}>
                <Feather name="star" size={40} color={n <= d.surveyStarRating ? PRIMARY : "#3f3f46"} />
              </TouchableOpacity>
            ))}
          </View>
          {d.surveyStarRating > 0 && (
            <Text style={{ color: "#71717a", fontSize: 13, textAlign: "center", marginTop: 14, fontFamily: "Inter_400Regular" }}>
              {d.surveyStarRating >= 4 ? "Thanks! 🙌 That means a lot." : d.surveyStarRating === 3 ? "Fair enough — we'll keep improving." : "Noted. We'll work harder for you."}
            </Text>
          )}
        </>}

        {/* ── Step 28: Body fat % ── */}
        {step === 28 && <>
          <Heading text="Body fat percentage" />
          <Sub text="Optional — enables Energy Availability tracking. Leave blank if unknown." />
          <StyledInput placeholder="e.g. 14" value={d.bodyFatPct} onChange={v => set("bodyFatPct", v)} keyboardType="decimal-pad" autoFocus />
          <Text style={{ color: "#52525b", fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>Caliper, DEXA, or bio-impedance measurement. You can add this later from Profile.</Text>
        </>}

        {/* ── Step 30: Plan result ── */}
        {step === 30 && <>
          <Heading text="Your plan is ready." />
          <Sub text="Targets calculated from your profile. Update anytime in Profile." />
          {[
            { l: "Sport",          v: mainSport || "—" },
            { l: "Level",          v: d.competitionLevel || "—" },
            { l: "Current weight", v: d.currentWeight ? `${d.currentWeight} kg` : "—" },
            { l: "Goal",           v: d.nonFightPrepMode ? d.nonFightPrepMode.replace("_", " ") : d.demoFightDate ? "Fight prep" : "Fat loss" },
            { l: "Fight date",     v: d.demoFightDate || (d.nonFightPrepMode ? "Not set" : "—") },
          ].map(row => (
            <View key={row.l} style={s30.row}>
              <Text style={s30.lbl}>{row.l}</Text>
              <Text style={s30.val}>{row.v}</Text>
            </View>
          ))}
          <View style={s30.ctaBanner}>
            <Feather name="check-circle" size={18} color={PRIMARY} />
            <Text style={s30.ctaTxt}>Nutrition targets are live on your dashboard.</Text>
          </View>
        </>}

        {/* ── Step 31: Commitment ── */}
        {step === 31 && <>
          <Heading text="How committed are you?" />
          <Sub text="Be honest — it shapes how we'll push you." />
          {Object.entries(COMMITMENT_LABELS).map(([v, l]) => (
            <OptionBtn key={v} label={l} selected={d.surveyCommitment === v} onPress={() => set("surveyCommitment", v)} />
          ))}
        </>}

        {/* ── Step 32: Motivational push ── */}
        {step === 32 && (
          (d.surveyCommitment === "extreme" || d.surveyCommitment === "very") ? <>
            <Heading text="Good." />
            <Sub text="This is exactly how top athletes operate." />
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.05)", padding: 16 }}>
              <Text style={{ color: "#d4d4d8", fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular" }}>
                Data-driven. Consistent. Accountable. That's the standard PRFMR is built for.
              </Text>
            </View>
          </> : <>
            <Heading text="Then understand this." />
            {[{ stat: "Only ~10%", desc: "of athletes fuel properly." }, { stat: "Most", desc: "never reach their potential." }].map(item => (
              <View key={item.stat} style={s32.card}>
                <View style={s32.dot} />
                <View><Text style={s32.statNum}>{item.stat}</Text><Text style={s32.statDesc}>{item.desc}</Text></View>
              </View>
            ))}
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 12, fontFamily: "Inter_600SemiBold" }}>You decide where you sit.</Text>
          </>
        )}

        {/* ── Step 33: Final snapshot ── */}
        {step === 33 && <>
          <Heading text="Your starting point." />
          <Sub text="You now have structure." />
          <View style={s33.card}>
            {[
              { l: "Current weight", v: d.currentWeight ? `${d.currentWeight} kg` : "—" },
              { l: "Goal",           v: d.nonFightPrepMode ? d.nonFightPrepMode.replace("_", " ") : "Make Weight" },
              { l: "Status",         v: "Active", orange: true },
            ].map(row => (
              <View key={row.l} style={s33.row}>
                <Text style={s33.lbl}>{row.l}</Text>
                <Text style={[s33.val, (row as any).orange && { color: PRIMARY }]}>{row.v}</Text>
              </View>
            ))}
          </View>
          {/* Streak card — clean, minimal */}
          <View style={s33.streak}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🔥</Text>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 4 }}>Day 1 · Streak: 1</Text>
            <Text style={{ color: "#71717a", fontSize: 13, fontFamily: "Inter_400Regular" }}>Your first streak starts now.</Text>
          </View>
          <Text style={{ color: "#52525b", fontSize: 11, textAlign: "center", lineHeight: 17, fontFamily: "Inter_400Regular", marginTop: 12 }}>
            Most fighters never get this far. This app provides educational estimates only and does not offer medical or nutritional advice.
          </Text>
        </>}

        {/* Scroll spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom nav — inside KAV so it lifts with keyboard */}
      <View style={[nav.wrap, { paddingBottom: insets.bottom + 8, borderTopColor: "rgba(255,255,255,0.05)" }]}>
        {hideBack
          ? <View style={{ width: 80 }} />
          : <TouchableOpacity onPress={retreat} style={nav.back}><Text style={nav.backTxt}>Back</Text></TouchableOpacity>
        }
        <TouchableOpacity
          onPress={isLast ? () => router.replace("/(tabs)") : advance}
          disabled={!ready}
          style={[nav.next, !ready && nav.nextOff]}
        >
          {step === 33 && <Feather name="grid" size={16} color="#fff" style={{ marginRight: 6 }} />}
          <Text style={nav.nextTxt}>{ctaLabel(step)}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────
// StyleSheets
// ─────────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  progressTrack:{ height: 1, backgroundColor: "rgba(255,255,255,0.05)" },
  progressFill: { height: 1, backgroundColor: PRIMARY },
  logoStrip:    { paddingHorizontal: 20, paddingBottom: 12 },
  logo:         { height: 39, width: 134, marginTop: 8 },
  scroll:       { padding: 20, paddingBottom: 16 },
});
const nav = StyleSheet.create({
  wrap:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  back:    { paddingHorizontal: 16, paddingVertical: 10 },
  backTxt: { color: "#71717a", fontSize: 15, fontFamily: "Inter_400Regular" },
  next:    { flexDirection: "row", alignItems: "center", backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14 },
  nextOff: { backgroundColor: "#27272a" },
  nextTxt: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
const spc = StyleSheet.create({
  card:          { height: 96, borderRadius: 12, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  unsel:         { borderColor: "transparent" },
  sel:           { borderColor: PRIMARY },
  overlay:       { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  overlaySelected:{ backgroundColor: "rgba(0,0,0,0.4)" },
  checkBadge:    { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  label:         { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center", paddingHorizontal: 6, fontFamily: "Inter_700Bold" },
});
const g7 = StyleSheet.create({
  btn: { width: "48%", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.6)" },
  sel: { borderColor: PRIMARY, backgroundColor: "rgba(249,115,22,0.15)" },
  lbl: { color: "#a1a1aa", fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
});
const s5 = StyleSheet.create({
  pill:    { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b", alignItems: "center" },
  pillSel: { borderColor: PRIMARY, backgroundColor: "rgba(249,115,22,0.1)" },
  pillTxt: { color: "#a1a1aa", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  badge:   { marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.3)", padding: 16, alignItems: "center", gap: 8 },
  badgeLbl:{ color: "#71717a", fontSize: 11, fontFamily: "Inter_400Regular" },
  badgeRow:{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a" },
  badgeIcon:{ width: 20, height: 20, tintColor: "#fff", opacity: 0.9 },
  badgeTxt: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  badgeSub: { color: "#52525b", fontSize: 10, fontFamily: "Inter_400Regular" },
});
const s16 = StyleSheet.create({
  card:  { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 10, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.4)", padding: 14, marginBottom: 10 },
  stat:  { fontSize: 22, fontWeight: "700", color: PRIMARY, fontFamily: "Inter_700Bold", minWidth: 52 },
  desc:  { flex: 1, color: "#a1a1aa", fontSize: 13, fontFamily: "Inter_400Regular" },
  footer:{ color: "#52525b", fontSize: 13, marginTop: 8, fontStyle: "italic", fontFamily: "Inter_400Regular" },
});
const s17 = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(249,115,22,0.15)", backgroundColor: "rgba(249,115,22,0.05)", padding: 14, marginBottom: 10 },
  txt: { color: "#d4d4d8", fontSize: 14, fontFamily: "Inter_400Regular" },
});
const s18 = StyleSheet.create({
  btn:    { aspectRatio: 1, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(39,39,42,0.6)" },
  btnSel: { backgroundColor: "rgba(249,115,22,0.15)", borderWidth: 1, borderColor: "rgba(249,115,22,0.5)" },
  num:    { color: "#a1a1aa", fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
const s22 = StyleSheet.create({
  card:     { borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.3)", padding: 16, marginBottom: 16, gap: 10 },
  timing:   { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#27272a", alignItems: "center" },
  timingSel:{ backgroundColor: PRIMARY, borderColor: PRIMARY },
  timingTxt:{ color: "#a1a1aa", fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium" },
  pill:     { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b" },
  pillSel:  { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillTxt:  { color: "#a1a1aa", fontSize: 13, fontFamily: "Inter_400Regular" },
  modeNote: { color: "#71717a", fontSize: 12, marginTop: 10, lineHeight: 18, fontFamily: "Inter_400Regular" },
});
const s23 = StyleSheet.create({
  stat:   { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.4)", padding: 12 },
  statVal:{ color: "#fff", fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLbl:{ color: "#71717a", fontSize: 11, marginTop: 2, fontFamily: "Inter_400Regular" },
});
const s24 = StyleSheet.create({
  lbl:       { color: "#a1a1aa", fontSize: 13, fontWeight: "600", marginBottom: 8, fontFamily: "Inter_600SemiBold" },
  sliderVal: { fontSize: 16, fontWeight: "700", marginBottom: 8, fontFamily: "Inter_700Bold" },
  tick:      { borderRadius: 2, backgroundColor: "rgba(39,39,42,0.6)", borderWidth: 1, borderColor: "#27272a" },
  tickSel:   { backgroundColor: PRIMARY, borderColor: PRIMARY },
  emoji:     { flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(39,39,42,0.6)", opacity: 0.5 },
  emojiSel:  { borderWidth: 1, borderColor: "rgba(249,115,22,0.5)", backgroundColor: "rgba(249,115,22,0.15)", opacity: 1 },
  scoreCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.2)", padding: 16, marginTop: 4 },
  scoreLbl:  { color: "#71717a", fontSize: 11, fontFamily: "Inter_400Regular" },
  scoreStatus:{ fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  scoreNum:  { fontSize: 40, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
const s25 = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.4)", padding: 14, marginBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.1)", alignItems: "center", justifyContent: "center" },
  title:{ color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  desc: { color: "#71717a", fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
});
const s30 = StyleSheet.create({
  row:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  lbl:      { color: "#71717a", fontSize: 14, fontFamily: "Inter_400Regular" },
  val:      { color: "#d4d4d8", fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  ctaBanner:{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)", backgroundColor: "rgba(249,115,22,0.05)", padding: 14, marginTop: 16 },
  ctaTxt:   { color: PRIMARY, fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
const s32 = StyleSheet.create({
  card:    { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "rgba(39,39,42,0.5)", borderRadius: 10, padding: 14, marginBottom: 10 },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 6 },
  statNum: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statDesc:{ color: "#a1a1aa", fontSize: 13, fontFamily: "Inter_400Regular" },
});
const s33 = StyleSheet.create({
  card:  { borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.3)", overflow: "hidden", marginBottom: 16 },
  row:   { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  lbl:   { color: "#71717a", fontSize: 14, fontFamily: "Inter_400Regular" },
  val:   { color: "#d4d4d8", fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  streak:{ borderRadius: 16, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)", backgroundColor: "rgba(249,115,22,0.05)", padding: 28, alignItems: "center" },
});
