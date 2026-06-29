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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: SW, height: SH } = Dimensions.get("window");

const BG = "#0a0a0a";
const PRIMARY = "#F97316";

// ─────────────────────────────────────────────────────────────
// Wizard state
// ─────────────────────────────────────────────────────────────
interface WizardData {
  firstName: string;
  sports: string[];           // multi-select
  primarySport: string;       // selected when >1
  competitionLevel: string;
  age: string;
  gender: string;
  height: string;
  currentWeight: string;
  // Surveys
  surveyCutExperience: string;
  surveyCutOutcome: string;
  surveyCalorieKnowledge: string;
  surveyUnderfueling: string;
  surveyTrainingLoadTracking: string;
  surveyMicroKnowledge: string;
  surveyEnergyScore: number;
  surveyPerformance: string;
  surveyMainProblems: string[];
  // Fight camp
  demoTargetWeight: string;
  demoFightDate: string;
  demoWeighInTiming: "same_day" | "day_before";
  demoManualTempReduction: string;
  nonFightPrepMode: string;   // 'fat_loss'|'maintenance'|'weight_gain'|''
  // Post-submit
  bodyFatPct: string;
  surveyStarRating: number;
  surveyCommitment: string;
  // Morning demo
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
  demoManualTempReduction: "", nonFightPrepMode: "",
  bodyFatPct: "", surveyStarRating: 0, surveyCommitment: "",
  demoSleepHours: 7, demoEnergyLevel: 3,
};

// ─────────────────────────────────────────────────────────────
// Lookup tables (exact from spec)
// ─────────────────────────────────────────────────────────────
const SPORTS: Array<{ value: string; label: string; uri?: string; local?: boolean }> = [
  { value: "Boxing",      label: "Boxing",      uri: "https://images.pexels.com/photos/6699106/pexels-photo-6699106.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "MMA",         label: "MMA",         uri: "https://images.pexels.com/photos/5616798/pexels-photo-5616798.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "Muay Thai",   label: "Muay Thai",   uri: "https://images.pexels.com/photos/11045334/pexels-photo-11045334.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "Kickboxing",  label: "Kickboxing",  uri: "https://images.pexels.com/photos/13808098/pexels-photo-13808098.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "BJJ",         label: "BJJ",         uri: "https://images.pexels.com/photos/8611381/pexels-photo-8611381.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
  { value: "Wrestling",   label: "Wrestling",   local: true },
  { value: "Traditional martial arts", label: "Traditional martial arts", uri: "https://images.pexels.com/photos/7045666/pexels-photo-7045666.jpeg?auto=compress&cs=tinysrgb&w=400&h=200&fit=crop" },
];

const SPORT_ICONS: Record<string, any> = {
  boxing: require("@/assets/boxing.png"),
  mma: require("@/assets/mma.png"),
  "muay-thai": require("@/assets/muay-thai.png"),
  kickboxing: require("@/assets/kickboxing.png"),
  bjj: require("@/assets/bjj.png"),
  wrestling: require("@/assets/wrestling.png"),
  traditional: require("@/assets/traditional.png"),
};

function sportIcon(sport: string) {
  const s = sport.toLowerCase();
  if (s.includes("boxing") || s.includes("boxer")) return SPORT_ICONS["boxing"];
  if (s.includes("mma")) return SPORT_ICONS["mma"];
  if (s.includes("muay")) return SPORT_ICONS["muay-thai"];
  if (s.includes("kick")) return SPORT_ICONS["kickboxing"];
  if (s.includes("bjj") || s.includes("jiu")) return SPORT_ICONS["bjj"];
  if (s.includes("wrest")) return SPORT_ICONS["wrestling"];
  if (s.includes("martial") || s.includes("traditional") || s.includes("karate")) return SPORT_ICONS["traditional"];
  return SPORT_ICONS["mma"];
}

const PROBLEMS_MAP: Record<string, string> = {
  weight_class: "Wrong weight class",
  calories: "Calories & macros confusion",
  micronutrients: "Micronutrients",
  training_load: "Training load",
  fight_camp: "Planning fight camp",
};

const COMMITMENT_LABELS: Record<string, string> = {
  extreme:     "Extremely committed",
  very:        "Very committed",
  somewhat:    "Somewhat committed",
  just_trying: "Just trying it",
};

// Goal derived from nonFightPrepMode or fight camp
function derivedGoal(d: WizardData): string {
  if (d.nonFightPrepMode) return d.nonFightPrepMode;
  if (d.demoFightDate && d.demoTargetWeight) return "fat_loss";
  return "fat_loss";
}

// experienceLevel from competitionLevel
function experienceLevel(level: string): string {
  const l = level.toLowerCase();
  if (l.includes("pro")) return "advanced";
  if (l.includes("semi") || l.includes("inter")) return "intermediate";
  return "beginner";
}

// activityLevel default (not collected in this spec's steps)
const DEFAULT_ACTIVITY = "moderately_active";

// Morning check-in readiness score
function readinessScore(hours: number, energy: number) {
  const sleepScore = hours >= 8 ? 1 : hours >= 7 ? 0.8 : hours >= 6 ? 0.5 : 0.25;
  const energyScore = (energy - 1) / 4;
  return Math.round((sleepScore * 0.5 + energyScore * 0.5) * 100);
}

// ─────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────
function OptionBtn({ label, selected, onPress, checkBox }: {
  label: string; selected: boolean; onPress: () => void; checkBox?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        ob.btn,
        selected ? ob.selected : ob.unselected,
      ]}
    >
      {checkBox && (
        <View style={[ob.checkbox, selected && ob.checkboxSelected]}>
          {selected && <Feather name="check" size={10} color="#fff" />}
        </View>
      )}
      <Text style={[ob.label, { color: selected ? "#fff" : "#a1a1aa" }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const ob = StyleSheet.create({
  btn:             { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 16, marginBottom: 10 },
  unselected:      { backgroundColor: "rgba(39,39,42,0.6)" },
  selected:        { backgroundColor: "rgba(249,115,22,0.15)", borderWidth: 1, borderColor: "rgba(249,115,22,0.5)" },
  label:           { fontSize: 15, fontWeight: "500", flex: 1 },
  checkbox:        { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  checkboxSelected:{ backgroundColor: PRIMARY, borderColor: PRIMARY },
});

function StepCard({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

function Heading({ text }: { text: string }) {
  return <Text style={hd.h}>{text}</Text>;
}
function SubHeading({ text }: { text: string }) {
  return <Text style={hd.s}>{text}</Text>;
}
const hd = StyleSheet.create({
  h: { fontSize: 26, fontWeight: "700", color: "#fff", lineHeight: 32, marginBottom: 8, fontFamily: "SpaceGrotesk_700Bold" },
  s: { fontSize: 14, color: "#71717a", lineHeight: 21, marginBottom: 20, fontFamily: "Inter_400Regular" },
});

function StyledInput({ placeholder, value, onChange, keyboardType, testID, autoFocus }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; testID?: string; autoFocus?: boolean;
}) {
  return (
    <TextInput
      style={inp.i}
      placeholder={placeholder}
      placeholderTextColor="#52525b"
      value={value}
      onChangeText={onChange}
      keyboardType={keyboardType}
      testID={testID}
      autoFocus={autoFocus}
    />
  );
}
const inp = StyleSheet.create({
  i: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b", color: "#fff", paddingHorizontal: 16, fontSize: 16, fontFamily: "Inter_400Regular" },
});

function InfoRow({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  return (
    <View style={ir.row}>
      <View style={ir.dot}><View style={ir.inner} /></View>
      <Text style={ir.text}>{text}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  dot:   { width: 22, height: 22, alignItems: "center", justifyContent: "center", marginRight: 10 },
  inner: { width: 7, height: 7, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 2 },
  text:  { color: "#d4d4d8", fontSize: 14, flex: 1, lineHeight: 21, fontFamily: "Inter_400Regular" },
});

function CheckRow({ text }: { text: string }) {
  return (
    <View style={cr.row}>
      <Feather name="check" size={15} color={PRIMARY} style={{ marginRight: 10, marginTop: 2 }} />
      <Text style={cr.text}>{text}</Text>
    </View>
  );
}
const cr = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  text: { color: "#d4d4d8", fontSize: 14, flex: 1, lineHeight: 21, fontFamily: "Inter_400Regular" },
});

function ItemCard({ children }: { children: React.ReactNode }) {
  return <View style={icard.c}>{children}</View>;
}
const icard = StyleSheet.create({ c: { borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.5)", padding: 14, marginBottom: 10 } });

function PrimaryCallout({ text }: { text: string }) {
  return (
    <View style={pc.box}>
      <Text style={pc.text}>{text}</Text>
    </View>
  );
}
const pc = StyleSheet.create({
  box:  { borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.05)", padding: 14, marginTop: 12 },
  text: { color: PRIMARY, fontSize: 13, fontStyle: "italic", fontFamily: "Inter_400Regular", lineHeight: 20 },
});

// ─────────────────────────────────────────────────────────────
// CTA label by step
// ─────────────────────────────────────────────────────────────
function ctaLabel(step: number): string {
  if (step === 1) return "Yeah, that's me →";
  if (step === 2) return "Continue →";
  if (step === 17) return "Let's build your plan →";
  if (step === 28) return "Build my plan →";
  if (step === 30 || step === 31 || step === 32) return "Continue →";
  if (step === 33) return "Start tracking →";
  return "Next →";
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { refetchUser } = useAuth();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<WizardData>(INIT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
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
  const skipCutChart = !!d.nonFightPrepMode; // step 23 skipped

  function canProceed(): boolean {
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
    let next = step + 1;
    // Skip cut chart if nonFightPrepMode
    if (step === 22 && skipCutChart) next = 24;
    setStep(next);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  }
  function retreat() {
    let prev = step - 1;
    if (step === 24 && skipCutChart) prev = 22;
    setStep(Math.max(prev, 1));
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: false }), 50);
  }

  // Submission at step 29
  const doSubmit = useCallback(async () => {
    if (submitted || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        gender: d.gender || undefined,
        age: d.age ? parseInt(d.age) : undefined,
        height: d.height ? parseFloat(d.height) : undefined,
        currentWeight: d.currentWeight ? parseFloat(d.currentWeight) : undefined,
        activityLevel: DEFAULT_ACTIVITY,
        goal: derivedGoal(d),
        experienceLevel: experienceLevel(d.competitionLevel),
        mainSport: mainSport || undefined,
        surveyCutExperience: d.surveyCutExperience || undefined,
        surveyCutOutcome: d.surveyCutOutcome || undefined,
        surveyCalorieKnowledge: d.surveyCalorieKnowledge || undefined,
        surveyUnderfueling: d.surveyUnderfueling || undefined,
        surveyTrainingLoadTracking: d.surveyTrainingLoadTracking || undefined,
        surveyMicroKnowledge: d.surveyMicroKnowledge || undefined,
        surveyEnergyScore: String(d.surveyEnergyScore),
        surveyPerformance: d.surveyPerformance || undefined,
        surveyMainProblems: d.surveyMainProblems.length > 0 ? d.surveyMainProblems : undefined,
        surveyStarRating: d.surveyStarRating || undefined,
        surveyCommitment: d.surveyCommitment || undefined,
      };
      if (d.bodyFatPct) payload.bodyFatPct = parseFloat(d.bodyFatPct) / 100;
      if (!d.nonFightPrepMode && d.demoFightDate) {
        payload.fightDate = d.demoFightDate;
        if (d.demoTargetWeight) payload.targetFightWeight = parseFloat(d.demoTargetWeight);
        payload.weighInTiming = d.demoWeighInTiming;
        if (d.demoManualTempReduction) payload.manualTempReductionKg = parseFloat(d.demoManualTempReduction);
      }
      await apiFetch("/user/me/onboard", { method: "POST", body: payload });
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
    if (step === 29 && !submitted && !submitting) {
      doSubmit();
    }
  }, [step, doSubmit, submitted, submitting]);

  // ── Step 0: Splash ──────────────────────────────────────────
  if (step === 0) {
    const imgW = Math.min(SW, (SH * 863) / 1665);
    const imgH = SH;
    const offsetX = (SW - imgW) / 2;
    // Transparent button overlay on baked-in button (image-relative percentages)
    const btnBottom = imgH * 0.018;
    const btnHeight = imgH * 0.057;
    const btnLeft  = offsetX + imgW * 0.023;
    const btnRight = offsetX + imgW * 0.023;
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Image
          source={require("@/assets/onboarding-splash.jpeg")}
          style={{ position: "absolute", width: imgW, height: imgH, left: offsetX, top: 0 }}
          resizeMode="stretch"
        />
        <Pressable
          testID="button-splash-cta"
          onPress={() => setStep(1)}
          accessibilityLabel="Let's build your plan"
          style={{ position: "absolute", bottom: btnBottom, height: btnHeight, left: btnLeft, right: btnRight, backgroundColor: "transparent" }}
        />
      </View>
    );
  }

  // ── Step 29: Loading ─────────────────────────────────────────
  if (step === 29) {
    return (
      <View style={[loadStyles.root, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        {submitting && (
          <View style={{ marginTop: 32, gap: 16 }}>
            {["Calculating targets", "Adjusting for training", "Optimising nutrition"].map(t => (
              <View key={t} style={loadStyles.row}>
                <Feather name="check-circle" size={16} color={PRIMARY} />
                <Text style={loadStyles.text}>{t}</Text>
              </View>
            ))}
          </View>
        )}
        {submitError && (
          <View style={loadStyles.errBox}>
            <Text style={loadStyles.errText}>{submitError}</Text>
            <TouchableOpacity onPress={doSubmit} style={loadStyles.retry}>
              <Text style={loadStyles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Steps 1-33: Shell ────────────────────────────────────────
  const hideBack = step <= 1;
  const isLast   = step === 33;
  const ready    = canProceed();

  const readiness = readinessScore(d.demoSleepHours, d.demoEnergyLevel);
  const readinessLabel =
    readiness >= 80 ? "Excellent" : readiness >= 60 ? "Good" : readiness >= 40 ? "Fair" : "Low";
  const readinessColor =
    readiness >= 80 ? "#4ade80" : readiness >= 60 ? PRIMARY : readiness >= 40 ? "#facc15" : "#ef4444";

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Progress bar */}
      <View style={shell.progressTrack}>
        <View style={[shell.progressFill, { width: `${(step / 33) * 100}%` }]} />
      </View>
      {/* Logo strip */}
      <View style={[shell.logoStrip, { paddingTop: insets.top }]}>
        <Image source={require("@/assets/logo-main.png")} style={shell.logo} resizeMode="contain" />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={shell.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Step 1: Problem Statement ─────────────────── */}
          {step === 1 && <StepCard>
            <Heading text="Be honest." />
            <SubHeading text="Are you struggling to:" />
            <ItemCard><InfoRow icon="circle" text="Plan your weight cut safely?" /></ItemCard>
            <ItemCard><InfoRow icon="circle" text="Know how much to eat?" /></ItemCard>
            <ItemCard><InfoRow icon="circle" text="Balance training and recovery?" /></ItemCard>
          </StepCard>}

          {/* ── Step 2: Solution ──────────────────────────── */}
          {step === 2 && <StepCard>
            <Heading text="This is where it changes." />
            <SubHeading text="PRFMR is your fight camp system." />
            <CheckRow text="Plans your weight cut safely" />
            <CheckRow text="Adjusts calories based on training" />
            <CheckRow text="Tracks your performance & recovery" />
            <CheckRow text="Ensures your nutrition actually fuels output" />
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.05)", padding: 16, marginTop: 12 }}>
              <Text style={{ color: "#d4d4d8", fontSize: 14, fontStyle: "italic", fontFamily: "Inter_400Regular", lineHeight: 21 }}>
                "You don't need to guess. You need a system."
              </Text>
            </View>
          </StepCard>}

          {/* ── Step 3: First Name ────────────────────────── */}
          {step === 3 && <StepCard>
            <Heading text="What's your name?" />
            <SubHeading text="We'll personalise your experience." />
            <StyledInput placeholder="First name" value={d.firstName} onChange={v => set("firstName", v)} testID="input-name" autoFocus />
          </StepCard>}

          {/* ── Step 4: Sport Selection ───────────────────── */}
          {step === 4 && <StepCard>
            <Heading text="What sport do you compete in?" />
            <SubHeading text="Select all that apply." />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SPORTS.map((sp, idx) => {
                const isSelected = d.sports.includes(sp.value);
                const isLast7 = idx === 6;
                return (
                  <TouchableOpacity
                    key={sp.value}
                    testID={`button-sport-${sp.value.toLowerCase().replace(/ /g, "-")}`}
                    onPress={() => toggleSport(sp.value)}
                    style={[
                      spc.card,
                      { width: isLast7 ? "100%" : "48%" },
                      isSelected ? spc.selected : spc.unselected,
                    ]}
                  >
                    <Image
                      source={sp.local ? require("@/assets/wrestling-action.jpg") : { uri: sp.uri }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                    <View style={[spc.overlay, isSelected && spc.overlaySelected]} />
                    {isSelected && (
                      <View style={spc.checkBadge}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
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
          </StepCard>}

          {/* ── Step 5: Competition Level ─────────────────── */}
          {step === 5 && <StepCard>
            <Heading text="What level do you compete at?" />
            <SubHeading text="This shapes your nutrition targets." />
            {d.sports.length > 1 && (
              <>
                <Text style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 10, fontFamily: "Inter_400Regular" }}>What's your main sport right now?</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  {d.sports.map(sp => (
                    <TouchableOpacity key={sp} onPress={() => set("primarySport", sp)}
                      style={[s5.pill, d.primarySport === sp && s5.pillSel]}>
                      <Text style={[s5.pillText, d.primarySport === sp && { color: PRIMARY }]}>{sp}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={{ color: "#a1a1aa", fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 10, fontFamily: "Inter_600SemiBold" }}>COMPETITION LEVEL</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              {["Amateur", "Pro"].map(l => (
                <TouchableOpacity key={l} onPress={() => set("competitionLevel", l)}
                  style={[s5.pill, { flex: 1 }, d.competitionLevel === l && s5.pillSel]}>
                  <Text style={[s5.pillText, d.competitionLevel === l && { color: PRIMARY }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <StyledInput placeholder="Or type your own… (e.g. Semi-pro, White collar)" value={d.competitionLevel === "Amateur" || d.competitionLevel === "Pro" ? "" : d.competitionLevel} onChange={v => set("competitionLevel", v)} testID="input-competition-level" />
            {d.competitionLevel && mainSport && (
              <View style={s5.badge}>
                <Text style={s5.badgeLabel}>Your sport identity badge</Text>
                <View style={s5.badgeInner}>
                  <Image source={sportIcon(mainSport)} style={s5.badgeIcon} />
                  <Text style={s5.badgeText}>{d.competitionLevel} {mainSport}</Text>
                </View>
                <Text style={s5.badgeSub}>Shown on your dashboard and profile</Text>
              </View>
            )}
          </StepCard>}
          {(() => { const s5 = StyleSheet.create({ pill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b", alignItems: "center" }, pillSel: { borderColor: PRIMARY, backgroundColor: "rgba(249,115,22,0.1)" }, pillText: { color: "#a1a1aa", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" }, badge: { marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.3)", padding: 16, alignItems: "center", gap: 8 }, badgeLabel: { color: "#71717a", fontSize: 11, fontFamily: "Inter_400Regular" }, badgeInner: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a" }, badgeIcon: { width: 20, height: 20, tintColor: "#fff", opacity: 0.9 }, badgeText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" }, badgeSub: { color: "#52525b", fontSize: 10, fontFamily: "Inter_400Regular" } }); return null; })()}

          {/* ── Step 6: Age ───────────────────────────────── */}
          {step === 6 && <StepCard>
            <Heading text="How old are you?" />
            <SubHeading text="Used to calculate your metabolic baseline." />
            <StyledInput placeholder="Age (years)" value={d.age} onChange={v => set("age", v)} keyboardType="number-pad" testID="input-age" autoFocus />
          </StepCard>}

          {/* ── Step 7: Gender ────────────────────────────── */}
          {step === 7 && <StepCard>
            <Heading text="What's your gender?" />
            <SubHeading text="Affects your calorie and protein calculations." />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[{ v: "male", l: "Male" }, { v: "female", l: "Female" }, { v: "other", l: "Other" }, { v: "prefer_not", l: "Prefer not to say" }].map(o => (
                <TouchableOpacity key={o.v} onPress={() => set("gender", o.v)}
                  style={[g7.btn, d.gender === o.v && g7.sel]}>
                  <Text style={[g7.label, d.gender === o.v && { color: "#fff" }]}>{o.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </StepCard>}

          {/* ── Step 8: Height ────────────────────────────── */}
          {step === 8 && <StepCard>
            <Heading text="What is your height?" />
            <SubHeading text="In centimetres." />
            <StyledInput placeholder="e.g. 175" value={d.height} onChange={v => set("height", v)} keyboardType="decimal-pad" testID="input-height" autoFocus />
            <Text style={{ color: "#52525b", fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>5′9″ = 175 cm · 6′0″ = 183 cm</Text>
          </StepCard>}

          {/* ── Step 9: Current Weight ────────────────────── */}
          {step === 9 && <StepCard>
            <Heading text="What's your current weight?" />
            <SubHeading text="In kilograms. Morning weight if possible." />
            <StyledInput placeholder="e.g. 72.5" value={d.currentWeight} onChange={v => set("currentWeight", v)} keyboardType="decimal-pad" testID="input-weight" autoFocus />
          </StepCard>}

          {/* ── Step 10: Cut Experience ───────────────────── */}
          {step === 10 && <StepCard>
            <Heading text="How many cuts have you done?" />
            {[{ v: "none", l: "First time" }, { v: "1-2", l: "1–2" }, { v: "3-5", l: "3–5" }, { v: "5+", l: "5+" }].map(o => (
              <OptionBtn key={o.v} label={o.l} selected={d.surveyCutExperience === o.v} onPress={() => set("surveyCutExperience", o.v)} />
            ))}
          </StepCard>}

          {/* ── Step 11: Cut Outcome ──────────────────────── */}
          {step === 11 && <StepCard>
            <Heading text="Did they go to plan?" />
            {[{ v: "yes", l: "Yes" }, { v: "low_energy", l: "Sometimes felt low energy" }, { v: "missed_weight", l: "Missed weight once or twice" }, { v: "reduced_strength", l: "Felt reduced strength" }, { v: "all", l: "All of the above" }].map(o => (
              <OptionBtn key={o.v} label={o.l} selected={d.surveyCutOutcome === o.v} onPress={() => set("surveyCutOutcome", o.v)} />
            ))}
          </StepCard>}

          {/* ── Step 12: Calorie Knowledge ────────────────── */}
          {step === 12 && <StepCard>
            <Heading text="Do you know how to adjust calories to training?" />
            {[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }, { v: "guess", l: "I guess" }, { v: "nutritionist", l: "I use a nutritionist" }].map(o => (
              <OptionBtn key={o.v} label={o.l} selected={d.surveyCalorieKnowledge === o.v} onPress={() => set("surveyCalorieKnowledge", o.v)} />
            ))}
          </StepCard>}

          {/* ── Step 13: Underfueling ─────────────────────── */}
          {step === 13 && <StepCard>
            <Heading text="Do you ever feel under-fuelled?" />
            {[{ v: "training", l: "Yes, in training" }, { v: "fights", l: "Yes, in fights" }, { v: "both", l: "Both" }, { v: "not_really", l: "Not really" }].map(o => (
              <OptionBtn key={o.v} label={o.l} selected={d.surveyUnderfueling === o.v} onPress={() => set("surveyUnderfueling", o.v)} />
            ))}
          </StepCard>}

          {/* ── Step 14: Training Load ────────────────────── */}
          {step === 14 && <StepCard>
            <Heading text="Do you track your training load?" />
            {[{ v: "yes", l: "Yes" }, { v: "no", l: "No" }, { v: "feel", l: "I go by feel" }].map(o => (
              <OptionBtn key={o.v} label={o.l} selected={d.surveyTrainingLoadTracking === o.v} onPress={() => set("surveyTrainingLoadTracking", o.v)} />
            ))}
          </StepCard>}

          {/* ── Step 15: Micro Knowledge ──────────────────── */}
          {step === 15 && <StepCard>
            <Heading text="Do you know which micronutrients matter?" />
            {[{ v: "no_idea", l: "No idea" }, { v: "not_really", l: "Not really" }, { v: "yes", l: "Yes" }].map(o => (
              <OptionBtn key={o.v} label={o.l} selected={d.surveyMicroKnowledge === o.v} onPress={() => set("surveyMicroKnowledge", o.v)} />
            ))}
          </StepCard>}

          {/* ── Step 16: Bombshell Stats ──────────────────── */}
          {step === 16 && <StepCard>
            <Heading text="This isn't random." />
            <SubHeading text="Most fighters aren't underperforming by accident." />
            {[{ stat: "65%", desc: "of fighters have had a failed weight cut" }, { stat: "~90%", desc: "aren't fueling training properly" }, { stat: "Most", desc: "are missing key micronutrients consistently" }].map(item => (
              <View key={item.stat} style={[s16.card]}>
                <Text style={s16.stat}>{item.stat}</Text>
                <Text style={s16.desc}>{item.desc}</Text>
              </View>
            ))}
            <Text style={s16.footer}>And training? Still managed by guesswork — not data.</Text>
          </StepCard>}

          {/* ── Step 17: Aspiration ───────────────────────── */}
          {step === 17 && <StepCard>
            <Heading text="You don't have to fight like this." />
            <SubHeading text="Imagine:" />
            {["Feeling strong every session", "Never missing weight", "Performing at your peak"].map(t => (
              <View key={t} style={[s17.visionCard]}>
                <Feather name="check" size={16} color={PRIMARY} />
                <Text style={s17.visionText}>{t}</Text>
              </View>
            ))}
          </StepCard>}

          {/* ── Step 18: Energy Score Slider ──────────────── */}
          {step === 18 && <StepCard>
            <Heading text="How's your energy during a cut?" />
            <SubHeading text="Rate 1 (exhausted) to 10 (bulletproof)." />
            <View style={s18.scoreWrap}>
              <Text style={s18.scoreNum}>{d.surveyEnergyScore}</Text>
              <Text style={s18.scoreOf}> / 10</Text>
            </View>
            {/* Emoji row as proxy slider */}
            <View style={s18.emojiRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <TouchableOpacity key={n} onPress={() => set("surveyEnergyScore", n)}
                  style={[s18.emojiBtn, d.surveyEnergyScore === n && s18.emojiBtnSel]}>
                  <Text style={s18.emojiN}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s18.labels}>
              <Text style={s18.labelText}>Exhausted</Text>
              <Text style={s18.labelText}>Bulletproof</Text>
            </View>
          </StepCard>}

          {/* ── Step 19: Performance ──────────────────────── */}
          {step === 19 && <StepCard>
            <Heading text="Your last performance?" />
            {[{ v: "terrible", l: "Terrible" }, { v: "could_be_better", l: "Could be better" }, { v: "good", l: "Good" }, { v: "excellent", l: "Excellent" }].map(o => (
              <OptionBtn key={o.v} label={o.l} selected={d.surveyPerformance === o.v} onPress={() => set("surveyPerformance", o.v)} />
            ))}
          </StepCard>}

          {/* ── Step 20: Problems Multi-Select ───────────────*/}
          {step === 20 && <StepCard>
            <Heading text="What's holding you back?" />
            <SubHeading text="Select all that apply." />
            {Object.entries(PROBLEMS_MAP).map(([v, l]) => (
              <OptionBtn key={v} label={l} selected={d.surveyMainProblems.includes(v)} onPress={() => toggleProblem(v)} checkBox />
            ))}
          </StepCard>}

          {/* ── Step 21: Personal Validation ─────────────── */}
          {step === 21 && <StepCard>
            <Heading text="You're not alone." />
            <SubHeading text="Most fighters struggle with:" />
            {d.surveyMainProblems.length === 0
              ? <ItemCard><Text style={{ color: "#d4d4d8", fontFamily: "Inter_400Regular" }}>Every aspect of nutrition and performance.</Text></ItemCard>
              : d.surveyMainProblems.map(v => (
                <View key={v} style={[s21.row]}>
                  <Feather name="chevron-right" size={16} color={PRIMARY} />
                  <Text style={s21.text}>{PROBLEMS_MAP[v]}</Text>
                </View>
              ))
            }
            <View style={s21.callout}>
              <Text style={s21.calloutText}>PRFMR is built to fix exactly this.</Text>
            </View>
          </StepCard>}

          {/* ── Step 22: Fight Camp Planner ───────────────── */}
          {step === 22 && <StepCard>
            <Heading text="Build your fight camp plan." />
            <SubHeading text="Enter your details — PRFMR calculates the exact cut." />
            <View style={s22.inputCard}>
              <View style={s22.roRow}>
                <Text style={s22.roLabel}>Current weight</Text>
                <Text style={s22.roVal}>{d.currentWeight || "—"} kg</Text>
              </View>
              <Text style={s22.fieldLabel}>Target weight (kg)</Text>
              <StyledInput placeholder={`e.g. ${d.currentWeight ? (parseFloat(d.currentWeight) - 2).toFixed(1) : "68"}`} value={d.demoTargetWeight} onChange={v => set("demoTargetWeight", v)} keyboardType="decimal-pad" testID="input-demo-target-weight" />
              {d.demoTargetWeight && parseFloat(d.demoTargetWeight) >= parseFloat(d.currentWeight) && (
                <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4, fontFamily: "Inter_400Regular" }}>Must be less than your current weight.</Text>
              )}
              <Text style={[s22.fieldLabel, { marginTop: 14 }]}>Fight date</Text>
              <StyledInput placeholder="YYYY-MM-DD" value={d.demoFightDate} onChange={v => set("demoFightDate", v)} testID="input-demo-fight-date" />
              <Text style={[s22.fieldLabel, { marginTop: 14 }]}>Weigh-in timing</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {[{ v: "same_day" as const, l: "Same day" }, { v: "day_before" as const, l: "Day before" }].map(o => (
                  <TouchableOpacity key={o.v} onPress={() => set("demoWeighInTiming", o.v)}
                    style={[s22.timingBtn, d.demoWeighInTiming === o.v && s22.timingBtnSel]}>
                    <Text style={[s22.timingText, d.demoWeighInTiming === o.v && { color: "#fff" }]}>{o.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s22.divider} />
            <Text style={s22.altText}>Not currently in fight prep — or not focused on losing weight right now?</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {[{ v: "fat_loss", l: "General fat loss" }, { v: "maintenance", l: "Maintenance" }, { v: "weight_gain", l: "Weight gain" }].map(o => (
                <TouchableOpacity key={o.v} onPress={() => set("nonFightPrepMode", d.nonFightPrepMode === o.v ? "" : o.v)}
                  style={[s22.pill, d.nonFightPrepMode === o.v && s22.pillSel]}>
                  <Text style={[s22.pillText, d.nonFightPrepMode === o.v && { color: "#fff" }]}>{o.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {d.nonFightPrepMode === "maintenance" && <Text style={s22.modeText}>You'll start in Maintenance mode. You can switch to Fight Camp anytime from your dashboard once you have a fight booked.</Text>}
            {d.nonFightPrepMode === "weight_gain" && <Text style={s22.modeText}>You'll start in Weight Gain mode — calories set above TDEE to support muscle building. You can switch to Fight Camp anytime from your dashboard.</Text>}
            {d.nonFightPrepMode === "fat_loss" && <Text style={s22.modeText}>You'll start in General Fat Loss mode. You can switch to Fight Camp anytime from your dashboard once you have a fight booked.</Text>}
          </StepCard>}

          {/* ── Step 23: Projected Cut Chart ─────────────── */}
          {step === 23 && <StepCard>
            <Heading text="Your projected cut." />
            <SubHeading text="Based on the plan you just built." />
            {/* Simplified SVG-style bar chart */}
            {(() => {
              const cw = parseFloat(d.currentWeight) || 80;
              const tw = parseFloat(d.demoTargetWeight) || cw - 5;
              const drop = cw - tw;
              const weeks = d.demoFightDate ? Math.max(1, Math.round((new Date(d.demoFightDate).getTime() - Date.now()) / 604800000)) : 8;
              const points = [cw, cw - drop * 0.33, cw - drop * 0.66, tw];
              const labels = ["Today", `Wk ${Math.round(weeks * 0.33)}`, `Wk ${Math.round(weeks * 0.66)}`, "Fight"];
              const minW = tw, range = drop || 1;
              const toH = (w: number) => Math.round(((w - minW) / range) * 68 + 14);
              return (
                <View>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6, marginBottom: 8 }}>
                    {points.map((w, i) => {
                      const h = toH(w);
                      const isLast_ = i === points.length - 1;
                      return (
                        <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                          <Text style={{ color: isLast_ ? PRIMARY : "#71717a", fontSize: 10, marginBottom: 3, fontFamily: "Inter_400Regular" }}>{w.toFixed(1)}</Text>
                          <View style={{ height: h, width: "80%", borderRadius: 4, backgroundColor: isLast_ ? "rgba(249,115,22,0.4)" : "rgba(249,115,22,0.15)" }} />
                          <Text style={{ color: "#52525b", fontSize: 9, marginTop: 4, fontFamily: "Inter_400Regular" }}>{labels[i]}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    <View style={s23.stat}><Text style={s23.statVal}>−{drop.toFixed(1)} kg</Text><Text style={s23.statLabel}>Projected loss</Text></View>
                    <View style={s23.stat}><Text style={s23.statVal}>{(drop / weeks).toFixed(2)} kg</Text><Text style={s23.statLabel}>Per week (fat loss phase)</Text></View>
                  </View>
                </View>
              );
            })()}
          </StepCard>}

          {/* ── Step 24: Morning Check-In Demo ────────────── */}
          {step === 24 && <StepCard>
            <Heading text="Your morning check-in." />
            <SubHeading text="Takes 10 seconds. Drives your whole day." />
            <Text style={s24.sectionLabel}>🌙  Sleep</Text>
            <Text style={[s24.sliderVal, { color: d.demoSleepHours >= 8 ? PRIMARY : "#71717a" }]}>{d.demoSleepHours} hrs</Text>
            <View style={s24.sliderRow}>
              {Array.from({ length: 13 }, (_, i) => 4 + i * 0.5).map(v => (
                <TouchableOpacity key={v} onPress={() => set("demoSleepHours", v)}
                  style={[s24.tick, d.demoSleepHours === v && s24.tickSel, { width: `${100 / 13}%` }]} />
              ))}
            </View>
            <View style={s24.sliderLabels}>
              <Text style={s24.sliderLabel}>4 hrs</Text>
              <Text style={s24.sliderLabel}>10 hrs</Text>
            </View>
            <Text style={[s24.sectionLabel, { marginTop: 20 }]}>⚡  Energy level</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {(["😫", "😕", "😐", "🙂", "⚡"] as const).map((e, i) => (
                <TouchableOpacity key={e} testID={`button-demo-energy-${i + 1}`} onPress={() => set("demoEnergyLevel", i + 1)}
                  style={[s24.emoji, d.demoEnergyLevel === i + 1 && s24.emojiSel]}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s24.scoreCard]}>
              <View>
                <Text style={s24.scoreCardLabel}>Session Readiness</Text>
                <Text style={[s24.scoreCardStatus, { color: readinessColor }]}>{readinessLabel}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s24.scoreCardNum, { color: readinessColor }]}>{readiness}</Text>
                <Text style={s24.scoreCardOf}>/ 100</Text>
              </View>
            </View>
          </StepCard>}

          {/* ── Step 25: Food Log Demo (simplified) ──────── */}
          {step === 25 && <StepCard>
            <Heading text="Log your meals." />
            <SubHeading text="4 ways to add food — whatever works for you." />
            {[{ icon: "search" as const, title: "Search", desc: "Search our database of 900k+ foods" }, { icon: "package" as const, title: "Whole Foods", desc: "Ingredient-level micro tracking" }, { icon: "camera" as const, title: "Barcode", desc: "Scan any product in seconds" }, { icon: "edit-2" as const, title: "Custom", desc: "Add your own meal or recipe" }].map(t => (
              <View key={t.title} style={[s25.tabCard]}>
                <View style={s25.tabIcon}><Feather name={t.icon} size={18} color={PRIMARY} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s25.tabTitle}>{t.title}</Text>
                  <Text style={s25.tabDesc}>{t.desc}</Text>
                </View>
              </View>
            ))}
          </StepCard>}

          {/* ── Step 26: First Win ────────────────────────── */}
          {step === 26 && <StepCard>
            <Heading text="You're already winning." />
            <SubHeading text="Most fighters never even get this far." />
            <View style={{ borderRadius: 16, overflow: "hidden", height: 180 }}>
              <Image source={require("@/assets/fighter_real_1.jpg")} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", padding: 16 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" }}>Day 1 · Let's go.</Text>
              </View>
            </View>
          </StepCard>}

          {/* ── Step 27: Star Rating ──────────────────────── */}
          {step === 27 && <StepCard>
            <Heading text="How useful does this look?" />
            <SubHeading text="Rate your first impression." />
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => set("surveyStarRating", n)}>
                  <Feather name="star" size={36} color={n <= d.surveyStarRating ? PRIMARY : "#3f3f46"} />
                </TouchableOpacity>
              ))}
            </View>
            {d.surveyStarRating > 0 && (
              <Text style={{ color: "#71717a", fontSize: 13, textAlign: "center", marginTop: 12, fontFamily: "Inter_400Regular" }}>
                {d.surveyStarRating >= 4 ? "Thanks! 🙌 That means a lot." : d.surveyStarRating === 3 ? "Fair enough — we'll keep improving." : "Noted. We'll work harder for you."}
              </Text>
            )}
          </StepCard>}

          {/* ── Step 28: Body Fat % ───────────────────────── */}
          {step === 28 && <StepCard>
            <Heading text="Body fat percentage" />
            <SubHeading text="Optional — enables Energy Availability tracking. Leave blank if unknown." />
            <StyledInput placeholder="e.g. 14" value={d.bodyFatPct} onChange={v => set("bodyFatPct", v)} keyboardType="decimal-pad" autoFocus />
            <Text style={{ color: "#52525b", fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>Caliper, DEXA, or bio-impedance measurement. You can add this later from Profile.</Text>
          </StepCard>}

          {/* ── Step 30: Plan Result ──────────────────────── */}
          {step === 30 && <StepCard>
            <Heading text="Your plan is ready." />
            <SubHeading text="Targets calculated from your profile. You can update these anytime in Profile." />
            {[
              { l: "Sport", v: mainSport || "—" },
              { l: "Level", v: d.competitionLevel || "—" },
              { l: "Current weight", v: d.currentWeight ? `${d.currentWeight} kg` : "—" },
              { l: "Goal", v: d.nonFightPrepMode ? PROBLEMS_MAP[d.nonFightPrepMode] || d.nonFightPrepMode : d.demoFightDate ? "Fight Prep" : "Fat Loss" },
              { l: "Fight date", v: d.demoFightDate || (d.nonFightPrepMode ? "Not set" : "—") },
            ].map(row => (
              <View key={row.l} style={[s30.row]}>
                <Text style={s30.label}>{row.l}</Text>
                <Text style={s30.val}>{row.v}</Text>
              </View>
            ))}
            <View style={[s30.cta]}>
              <Feather name="check-circle" size={18} color={PRIMARY} />
              <Text style={s30.ctaText}>Nutrition targets are live on your dashboard.</Text>
            </View>
          </StepCard>}

          {/* ── Step 31: Commitment ───────────────────────── */}
          {step === 31 && <StepCard>
            <Heading text="How committed are you?" />
            <SubHeading text="Be honest — it shapes how we'll push you." />
            {Object.entries(COMMITMENT_LABELS).map(([v, l]) => (
              <OptionBtn key={v} label={l} selected={d.surveyCommitment === v} onPress={() => set("surveyCommitment", v)} />
            ))}
          </StepCard>}

          {/* ── Step 32: Motivational Push ────────────────── */}
          {step === 32 && <StepCard>
            {(d.surveyCommitment === "extreme" || d.surveyCommitment === "very") ? (
              <>
                <Heading text="Good." />
                <SubHeading text="This is exactly how top athletes operate." />
                <View style={[s32.callout]}>
                  <Text style={s32.calloutText}>Data-driven. Consistent. Accountable. That's the standard PRFMR is built for.</Text>
                </View>
              </>
            ) : (
              <>
                <Heading text="Then understand this." />
                {[{ stat: "Only ~10%", desc: "of athletes fuel properly." }, { stat: "Most", desc: "never reach their potential." }].map(item => (
                  <View key={item.stat} style={s32.statCard}>
                    <View style={s32.dot} />
                    <View>
                      <Text style={s32.statNum}>{item.stat}</Text>
                      <Text style={s32.statDesc}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
                <Text style={s32.decide}>You decide where you sit.</Text>
              </>
            )}
          </StepCard>}

          {/* ── Step 33: Final Snapshot ───────────────────── */}
          {step === 33 && <StepCard>
            <Heading text="Your starting point." />
            <SubHeading text="You now have structure." />
            <View style={[s33.card]}>
              {[
                { l: "Current weight", v: d.currentWeight ? `${d.currentWeight} kg` : "—" },
                { l: "Goal", v: d.nonFightPrepMode ? d.nonFightPrepMode.replace("_", " ") : "Make Weight" },
                { l: "Status", v: "Active", orange: true },
              ].map(row => (
                <View key={row.l} style={s33.row}>
                  <Text style={s33.label}>{row.l}</Text>
                  <Text style={[s33.val, row.orange && { color: PRIMARY }]}>{row.v}</Text>
                </View>
              ))}
            </View>
            <View style={s33.streakCard}>
              <Text style={s33.streakEmoji}>🔥</Text>
              <Text style={s33.streakTitle}>Day 1 · Streak: 1</Text>
              <Text style={s33.streakSub}>Your first streak starts now.</Text>
            </View>
            <Text style={s33.disclaimer}>Most fighters never get this far. This app provides educational estimates only and does not offer medical or nutritional advice.</Text>
          </StepCard>}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom nav */}
      <View style={[navBar.wrap, { paddingBottom: insets.bottom + 8, borderTopColor: "rgba(255,255,255,0.05)" }]}>
        {hideBack
          ? <View style={{ width: 80 }} />
          : <TouchableOpacity onPress={retreat} style={navBar.back}>
              <Text style={navBar.backText}>Back</Text>
            </TouchableOpacity>
        }
        <TouchableOpacity
          onPress={isLast ? () => router.replace("/(tabs)") : advance}
          disabled={!ready}
          style={[navBar.next, !ready && navBar.nextDisabled]}
        >
          {step === 33 && <Feather name="grid" size={16} color="#fff" style={{ marginRight: 6 }} />}
          <Text style={navBar.nextText}>{ctaLabel(step)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline StyleSheets for individual steps
// ─────────────────────────────────────────────────────────────
const shell = StyleSheet.create({
  progressTrack: { height: 1, backgroundColor: "rgba(255,255,255,0.05)" },
  progressFill:  { height: 1, backgroundColor: PRIMARY },
  logoStrip:     { paddingHorizontal: 20, paddingBottom: 12 },
  logo:          { height: 34, width: 120, marginTop: 8 },
  scroll:        { padding: 20, paddingBottom: 40 },
});

const navBar = StyleSheet.create({
  wrap:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  back:         { paddingHorizontal: 16, paddingVertical: 10 },
  backText:     { color: "#71717a", fontSize: 15, fontFamily: "Inter_400Regular" },
  next:         { flexDirection: "row", alignItems: "center", backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  nextDisabled: { backgroundColor: "#27272a" },
  nextText:     { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});

const spc = StyleSheet.create({
  card:         { height: 96, borderRadius: 12, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  selected:     { borderColor: PRIMARY },
  unselected:   { borderColor: "transparent" },
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  overlaySelected: { backgroundColor: "rgba(0,0,0,0.45)" },
  checkBadge:   { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  label:        { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center", paddingHorizontal: 6, fontFamily: "SpaceGrotesk_700Bold" },
});

const g7 = StyleSheet.create({
  btn:   { width: "48%", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.6)" },
  sel:   { borderColor: PRIMARY, backgroundColor: "rgba(249,115,22,0.15)" },
  label: { color: "#a1a1aa", fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
});

const s5 = StyleSheet.create({
  pill:      { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b", alignItems: "center" },
  pillSel:   { borderColor: PRIMARY, backgroundColor: "rgba(249,115,22,0.1)" },
  pillText:  { color: "#a1a1aa", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  badge:     { marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.3)", padding: 16, alignItems: "center", gap: 8 },
  badgeLabel:{ color: "#71717a", fontSize: 11, fontFamily: "Inter_400Regular" },
  badgeInner:{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a" },
  badgeIcon: { width: 20, height: 20, tintColor: "#fff", opacity: 0.9 },
  badgeText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  badgeSub:  { color: "#52525b", fontSize: 10, fontFamily: "Inter_400Regular" },
});

const s16 = StyleSheet.create({
  card:   { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 10, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.4)", padding: 14, marginBottom: 10 },
  stat:   { fontSize: 22, fontWeight: "700", color: PRIMARY, fontFamily: "SpaceGrotesk_700Bold", minWidth: 48 },
  desc:   { flex: 1, color: "#a1a1aa", fontSize: 13, fontFamily: "Inter_400Regular" },
  footer: { color: "#52525b", fontSize: 13, marginTop: 8, fontStyle: "italic", fontFamily: "Inter_400Regular" },
});

const s17 = StyleSheet.create({
  visionCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(249,115,22,0.15)", backgroundColor: "rgba(249,115,22,0.05)", padding: 14, marginBottom: 10 },
  visionText: { color: "#d4d4d8", fontSize: 14, fontFamily: "Inter_400Regular" },
});

const s18 = StyleSheet.create({
  scoreWrap:  { flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: 24 },
  scoreNum:   { fontSize: 72, fontWeight: "700", color: PRIMARY, fontFamily: "SpaceGrotesk_700Bold" },
  scoreOf:    { fontSize: 24, color: "#71717a", fontFamily: "Inter_400Regular" },
  emojiRow:   { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  emojiBtn:   { width: "18%", aspectRatio: 1, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(39,39,42,0.6)" },
  emojiBtnSel:{ backgroundColor: "rgba(249,115,22,0.15)", borderWidth: 1, borderColor: "rgba(249,115,22,0.5)" },
  emojiN:     { color: "#a1a1aa", fontSize: 16, fontWeight: "600" },
  labels:     { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  labelText:  { color: "#52525b", fontSize: 12, fontFamily: "Inter_400Regular" },
});

const s21 = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(39,39,42,0.4)", borderRadius: 10, padding: 14, marginBottom: 8 },
  text:       { color: "#d4d4d8", fontSize: 14, fontFamily: "Inter_400Regular" },
  callout:    { borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)", backgroundColor: "rgba(249,115,22,0.05)", padding: 14, marginTop: 12 },
  calloutText:{ color: PRIMARY, fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});

const s22 = StyleSheet.create({
  inputCard:   { borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.3)", padding: 16, marginBottom: 16, gap: 10 },
  roRow:       { flexDirection: "row", justifyContent: "space-between" },
  roLabel:     { color: "#71717a", fontSize: 13, fontFamily: "Inter_400Regular" },
  roVal:       { color: "#d4d4d8", fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  fieldLabel:  { color: "#a1a1aa", fontSize: 11, fontWeight: "600", letterSpacing: 0.7, fontFamily: "Inter_600SemiBold" },
  timingBtn:   { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#27272a", alignItems: "center" },
  timingBtnSel:{ backgroundColor: PRIMARY, borderColor: PRIMARY },
  timingText:  { color: "#a1a1aa", fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium" },
  divider:     { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 16 },
  altText:     { color: "#71717a", fontSize: 13, fontFamily: "Inter_400Regular" },
  pill:        { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b" },
  pillSel:     { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillText:    { color: "#a1a1aa", fontSize: 13, fontFamily: "Inter_400Regular" },
  modeText:    { color: "#71717a", fontSize: 12, marginTop: 10, lineHeight: 18, fontFamily: "Inter_400Regular" },
});

const s23 = StyleSheet.create({
  stat:      { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.4)", padding: 12 },
  statVal:   { color: "#fff", fontSize: 18, fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" },
  statLabel: { color: "#71717a", fontSize: 11, marginTop: 2, fontFamily: "Inter_400Regular" },
});

const s24 = StyleSheet.create({
  sectionLabel: { color: "#a1a1aa", fontSize: 13, fontWeight: "600", marginBottom: 8, fontFamily: "Inter_600SemiBold" },
  sliderVal:    { fontSize: 16, fontWeight: "700", marginBottom: 8, fontFamily: "Inter_700Bold" },
  sliderRow:    { flexDirection: "row", alignItems: "center", height: 32, gap: 3 },
  tick:         { height: 24, borderRadius: 2, backgroundColor: "rgba(39,39,42,0.6)", borderWidth: 1, borderColor: "#27272a" },
  tickSel:      { backgroundColor: PRIMARY, borderColor: PRIMARY },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  sliderLabel:  { color: "#52525b", fontSize: 11, fontFamily: "Inter_400Regular" },
  emoji:        { flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(39,39,42,0.6)", opacity: 0.5 },
  emojiSel:     { borderWidth: 1, borderColor: "rgba(249,115,22,0.5)", backgroundColor: "rgba(249,115,22,0.15)", opacity: 1 },
  scoreCard:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.2)", padding: 16, marginTop: 20 },
  scoreCardLabel: { color: "#71717a", fontSize: 11, fontFamily: "Inter_400Regular" },
  scoreCardStatus:{ fontSize: 17, fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" },
  scoreCardNum: { fontSize: 40, fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" },
  scoreCardOf:  { color: "#52525b", fontSize: 13, fontFamily: "Inter_400Regular" },
});

const s25 = StyleSheet.create({
  tabCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.4)", padding: 14, marginBottom: 10 },
  tabIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.1)", alignItems: "center", justifyContent: "center" },
  tabTitle:{ color: "#fff", fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  tabDesc: { color: "#71717a", fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
});

const s30 = StyleSheet.create({
  row:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  label:  { color: "#71717a", fontSize: 14, fontFamily: "Inter_400Regular" },
  val:    { color: "#d4d4d8", fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  cta:    { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)", backgroundColor: "rgba(249,115,22,0.05)", padding: 14, marginTop: 16 },
  ctaText:{ color: PRIMARY, fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});

const s32 = StyleSheet.create({
  callout:     { borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.05)", padding: 16 },
  calloutText: { color: "#d4d4d8", fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular" },
  statCard:    { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "rgba(39,39,42,0.5)", borderRadius: 10, padding: 14, marginBottom: 10 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 6 },
  statNum:     { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" },
  statDesc:    { color: "#a1a1aa", fontSize: 13, fontFamily: "Inter_400Regular" },
  decide:      { color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 12, fontFamily: "Inter_600SemiBold" },
});

const s33 = StyleSheet.create({
  card:       { borderRadius: 12, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.3)", overflow: "hidden", marginBottom: 16 },
  row:        { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  label:      { color: "#71717a", fontSize: 14, fontFamily: "Inter_400Regular" },
  val:        { color: "#d4d4d8", fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  streakCard: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)", backgroundColor: "rgba(249,115,22,0.05)", padding: 20, alignItems: "center", marginBottom: 16 },
  streakEmoji:{ fontSize: 32, marginBottom: 6 },
  streakTitle:{ color: "#fff", fontSize: 17, fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" },
  streakSub:  { color: "#71717a", fontSize: 13, marginTop: 4, fontFamily: "Inter_400Regular" },
  disclaimer: { color: "#52525b", fontSize: 11, textAlign: "center", lineHeight: 17, fontFamily: "Inter_400Regular" },
});

const loadStyles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  row:       { flexDirection: "row", alignItems: "center", gap: 10 },
  text:      { color: "#d4d4d8", fontSize: 14, fontFamily: "Inter_400Regular" },
  errBox:    { marginTop: 24, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center" },
  errText:   { color: "#ef4444", fontSize: 13, textAlign: "center", fontFamily: "Inter_400Regular" },
  retry:     { marginTop: 12, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: PRIMARY, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
