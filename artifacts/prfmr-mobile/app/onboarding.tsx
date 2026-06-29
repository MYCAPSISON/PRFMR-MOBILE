import React, { useState } from "react";
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

// ── Wizard state ──────────────────────────────────────────────
interface WizardData {
  displayName: string;
  gender: "male" | "female" | "";
  mainSport: string[];        // multi-select; send first as mainSport
  experienceLevel: string;
  age: string;
  height: string;
  currentWeight: string;
  goal: string;
  // Survey
  surveyCutExperience: string;
  surveyCutOutcome: string;
  surveyCalorieKnowledge: string;
  surveyUnderfueling: string;
  surveyTrainingLoadTracking: string;
  surveyMicroKnowledge: string;
  surveyEnergyScore: string;
  surveyMainProblems: string[];
  activityLevel: string;
  surveyPerformance: string;
  // Optional extras
  bodyFatPct: string;
  weightClass: string;
  // Fight camp
  hasFightCamp: boolean | null;
  fightDate: string;
  targetFightWeight: string;
  weighInTiming: string;
}

const INIT: WizardData = {
  displayName: "", gender: "", mainSport: [], experienceLevel: "",
  age: "", height: "", currentWeight: "", goal: "",
  surveyCutExperience: "", surveyCutOutcome: "", surveyCalorieKnowledge: "",
  surveyUnderfueling: "", surveyTrainingLoadTracking: "", surveyMicroKnowledge: "",
  surveyEnergyScore: "", surveyMainProblems: [], activityLevel: "", surveyPerformance: "",
  bodyFatPct: "", weightClass: "",
  hasFightCamp: null, fightDate: "", targetFightWeight: "", weighInTiming: "",
};

// ── Options ───────────────────────────────────────────────────
const SPORTS = [
  "MMA", "Boxing", "Muay Thai", "Wrestling",
  "BJJ", "Kickboxing", "Judo", "Karate", "Other",
];

const EXPERIENCE = [
  { key: "beginner",     label: "Amateur",      sub: "< 1 year competing" },
  { key: "intermediate", label: "Semi-Pro",     sub: "1–4 years" },
  { key: "advanced",     label: "Professional", sub: "4+ years / pro" },
];

const GOALS = [
  { key: "fat_loss",    label: "Cut weight",    sub: "Lose body fat for a fight / general" },
  { key: "maintenance", label: "Maintain",      sub: "Stay at current weight" },
  { key: "weight_gain", label: "Build muscle",  sub: "Add lean mass in off-season" },
];

const ACTIVITY = [
  { key: "sedentary",         label: "Sedentary",          sub: "Desk job, little exercise" },
  { key: "lightly_active",    label: "Lightly active",     sub: "1–3 training days/week" },
  { key: "moderately_active", label: "Moderately active",  sub: "3–5 days/week" },
  { key: "very_active",       label: "Very active",        sub: "6–7 days/week" },
  { key: "extra_active",      label: "Twice daily",        sub: "High-performance training" },
];

const CUT_EXP = [
  { key: "never",     label: "Never cut weight" },
  { key: "once",      label: "Once or twice" },
  { key: "few",       label: "A few times" },
  { key: "regularly", label: "Every fight" },
];

const CUT_OUTCOME = [
  { key: "missed",    label: "Missed weight" },
  { key: "struggled", label: "Made it but struggled" },
  { key: "fine",      label: "Made it fine" },
  { key: "easy",      label: "Comfortable cut" },
  { key: "na",        label: "N/A — never cut" },
];

const CAL_KNOWLEDGE = [
  { key: "none",    label: "No idea",      sub: "I don't track" },
  { key: "vague",   label: "Rough idea",   sub: "I estimate loosely" },
  { key: "decent",  label: "Pretty good",  sub: "I track sometimes" },
  { key: "precise", label: "Very precise", sub: "I track consistently" },
];

const UNDERFUEL = [
  { key: "never",     label: "Never" },
  { key: "sometimes", label: "Sometimes" },
  { key: "often",     label: "Often" },
  { key: "always",    label: "Almost always" },
];

const LOAD_TRACK = [
  { key: "never",    label: "Never" },
  { key: "loosely",  label: "Loosely" },
  { key: "somewhat", label: "Somewhat" },
  { key: "closely",  label: "Closely" },
];

const MICRO_KNOW = [
  { key: "none",   label: "None",   sub: "What's a micronutrient?" },
  { key: "basic",  label: "Basic",  sub: "I know the basics" },
  { key: "decent", label: "Decent", sub: "I pay attention" },
  { key: "strong", label: "Strong", sub: "I actively track micros" },
];

const PROBLEMS = [
  "Losing muscle while cutting",
  "Low energy during training",
  "Making weight on time",
  "Poor sleep / recovery",
  "Inconsistent nutrition",
  "Poor micronutrient intake",
  "Undereating on hard days",
  "Overeating on rest days",
  "No structured plan",
  "Not knowing my targets",
];

const PERFORMANCE = [
  { key: "declining",    label: "Declining" },
  { key: "inconsistent", label: "Inconsistent" },
  { key: "stable",       label: "Stable" },
  { key: "improving",    label: "Improving" },
];

// ── Step constants (0 = splash) ───────────────────────────────
// 0  splash
// 1  welcome
// 2  first name
// 3  gender
// 4  sport (multi-select)
// 5  experience level
// 6  age
// 7  height
// 8  current weight
// 9  goal
// 10 cut experience
// 11 cut outcome
// 12 calorie knowledge
// 13 underfueling
// 14 load tracking
// 15 micro knowledge
// 16 energy score
// 17 problems (multi-select)
// 18 activity level
// 19 performance
// 20 body fat %
// 21 fight camp Y/N
// 22 fight camp details (conditional)
// 23 review + submit
const TOTAL = 24;

// ── Shared components ─────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  const colors = useColors();
  const pct = Math.max(0, step / (TOTAL - 1));
  return (
    <View style={[pb.track, { backgroundColor: colors.muted }]}>
      <View style={[pb.fill, { backgroundColor: colors.primary, width: `${pct * 100}%` }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  fill:  { height: 3, borderRadius: 2 },
});

function OptionBtn({
  label, sub, selected, onPress,
}: { label: string; sub?: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        oc.btn,
        {
          backgroundColor: selected ? colors.secondary : colors.secondary,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 1.5 : 1,
        },
      ]}
    >
      <View style={oc.row}>
        {selected && <View style={[oc.dot, { backgroundColor: colors.primary }]} />}
        <Text style={[oc.label, { color: selected ? colors.primary : colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {label}
        </Text>
      </View>
      {sub && <Text style={[oc.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sub}</Text>}
    </TouchableOpacity>
  );
}
const oc = StyleSheet.create({
  btn:   { borderRadius: 12, padding: 16, marginBottom: 10 },
  row:   { flexDirection: "row", alignItems: "center" },
  dot:   { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  label: { fontSize: 15, fontWeight: "600" },
  sub:   { fontSize: 13, marginTop: 4 },
});

function TagChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        tc.chip,
        {
          backgroundColor: selected ? colors.primary + "20" : colors.secondary,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[tc.label, { color: selected ? colors.primary : colors.foreground, fontFamily: "Inter_500Medium" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
const tc = StyleSheet.create({
  chip:  { borderRadius: 20, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 16, margin: 4 },
  label: { fontSize: 13, fontWeight: "500" },
});

function FieldInput({ label, value, onChange, placeholder, keyboard = "default", hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: any; hint?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[fi.label, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
      <TextInput
        style={[fi.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboard}
      />
      {hint && <Text style={[fi.hint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{hint}</Text>}
    </View>
  );
}
const fi = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: { height: 52, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12, fontSize: 16 },
  hint:  { fontSize: 12, marginTop: 6 },
});

function StepHeader({ title, sub, tag }: { title: string; sub?: string; tag?: string }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 24 }}>
      {tag && <Text style={[sh.tag, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>{tag}</Text>}
      <Text style={[sh.title, { color: colors.foreground, fontFamily: "SpaceGrotesk_700Bold" }]}>{title}</Text>
      {sub && <Text style={[sh.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{sub}</Text>}
    </View>
  );
}
const sh = StyleSheet.create({
  tag:   { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: "700", lineHeight: 32, marginBottom: 8 },
  sub:   { fontSize: 14, lineHeight: 21 },
});

// ── Main ──────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { refetchUser } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INIT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setData(p => ({ ...p, [k]: v }));
  }
  function toggleSport(s: string) {
    setData(p => ({
      ...p,
      mainSport: p.mainSport.includes(s) ? p.mainSport.filter(x => x !== s) : [...p.mainSport, s],
    }));
  }
  function toggleProblem(s: string) {
    setData(p => ({
      ...p,
      surveyMainProblems: p.surveyMainProblems.includes(s)
        ? p.surveyMainProblems.filter(x => x !== s)
        : [...p.surveyMainProblems, s],
    }));
  }

  const noFightCamp = data.hasFightCamp === false;
  const isLast = step === TOTAL - 1;

  function canProceed(): boolean {
    switch (step) {
      case 0: return true;
      case 1: return true; // welcome
      case 2: return true; // name optional
      case 3: return !!data.gender;
      case 4: return data.mainSport.length > 0;
      case 5: return !!data.experienceLevel;
      case 6: return !!data.age;
      case 7: return !!data.height;
      case 8: return !!data.currentWeight;
      case 9: return !!data.goal;
      case 10: return !!data.surveyCutExperience;
      case 11: return !!data.surveyCutOutcome;
      case 12: return !!data.surveyCalorieKnowledge;
      case 13: return !!data.surveyUnderfueling;
      case 14: return !!data.surveyTrainingLoadTracking;
      case 15: return !!data.surveyMicroKnowledge;
      case 16: return !!data.surveyEnergyScore;
      case 17: return data.surveyMainProblems.length > 0;
      case 18: return !!data.activityLevel;
      case 19: return !!data.surveyPerformance;
      case 20: return true; // body fat optional
      case 21: return data.hasFightCamp !== null;
      case 22: return noFightCamp || !!data.fightDate;
      case 23: return true; // review
      default: return true;
    }
  }

  function advance() {
    // After fight camp Y/N: if No, skip details step
    if (step === 21 && noFightCamp) { setStep(23); return; }
    setStep(s => Math.min(s + 1, TOTAL - 1));
  }
  function retreat() {
    // If on review and no fight camp, skip back over fight details
    if (step === 23 && noFightCamp) { setStep(21); return; }
    setStep(s => Math.max(s - 1, 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        gender: data.gender || undefined,
        age: data.age ? parseInt(data.age) : undefined,
        height: data.height ? parseFloat(data.height) : undefined,
        currentWeight: data.currentWeight ? parseFloat(data.currentWeight) : undefined,
        activityLevel: data.activityLevel || undefined,
        goal: data.goal || undefined,
        experienceLevel: data.experienceLevel || undefined,
        mainSport: data.mainSport[0] || undefined,
        bodyFatPct: data.bodyFatPct ? parseFloat(data.bodyFatPct) / 100 : undefined,
        weightClass: data.weightClass || undefined,
        // Survey
        surveyCutExperience: data.surveyCutExperience || undefined,
        surveyCutOutcome: data.surveyCutOutcome || undefined,
        surveyCalorieKnowledge: data.surveyCalorieKnowledge || undefined,
        surveyUnderfueling: data.surveyUnderfueling || undefined,
        surveyTrainingLoadTracking: data.surveyTrainingLoadTracking || undefined,
        surveyMicroKnowledge: data.surveyMicroKnowledge || undefined,
        surveyEnergyScore: data.surveyEnergyScore || undefined,
        surveyPerformance: data.surveyPerformance || undefined,
        surveyMainProblems: data.surveyMainProblems.length > 0 ? data.surveyMainProblems : undefined,
      };
      if (data.hasFightCamp && data.fightDate) {
        payload.fightDate = data.fightDate;
        if (data.targetFightWeight) payload.targetFightWeight = parseFloat(data.targetFightWeight);
        if (data.weighInTiming) payload.weighInTiming = data.weighInTiming;
      }
      await apiFetch("/user/me/onboard", { method: "POST", body: payload });
      await refetchUser();
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // ── STEP 0: Splash ──────────────────────────────────────────
  if (step === 0) {
    return (
      <View style={{ flex: 1 }}>
        <Image
          source={require("@/assets/onboarding-splash.jpeg")}
          style={{ flex: 1, width: "100%" }}
          resizeMode="cover"
        />
        {/* Transparent button overlaid on the "Let's build your plan" button area */}
        <Pressable
          onPress={() => setStep(1)}
          testID="button-splash-cta"
          style={{
            position: "absolute",
            bottom: insets.bottom + 16,
            left: 20,
            right: 20,
            height: 56,
            // completely transparent — the button UI is baked into the image
          }}
          accessibilityLabel="Let's build your plan"
          accessibilityRole="button"
        />
      </View>
    );
  }

  // ── STEPS 1-23 ──────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={[s.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={retreat} style={s.navBtn} disabled={step <= 1}>
          <Feather name="arrow-left" size={20} color={step > 1 ? colors.foreground : "transparent"} />
        </TouchableOpacity>
        <ProgressBar step={step} />
        <View style={[s.navBtn, { alignItems: "flex-end" }]}>
          <Text style={[s.stepCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {step}/{TOTAL - 1}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={s.flex} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Step 1: Welcome ────────────────────────────── */}
          {step === 1 && (
            <>
              <StepHeader
                title={"Yeah, that's me →"}
                sub="PRFMR is built for athletes who take making weight and performing seriously. Let's build your plan."
              />
              <View style={[s.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {[
                  { icon: "target",    text: "Personalised calorie & macro targets" },
                  { icon: "zap",       text: "Training-adjusted daily nutrition" },
                  { icon: "activity",  text: "Micronutrient performance scoring (AMQS)" },
                  { icon: "calendar",  text: "Fight camp weight-cut planning" },
                  { icon: "bar-chart", text: "Training load tracking & warnings" },
                ].map(f => (
                  <View key={f.icon} style={s.featureRow}>
                    <View style={[s.featureIcon, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name={f.icon as any} size={16} color={colors.primary} />
                    </View>
                    <Text style={[s.featureText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{f.text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Step 2: First name ─────────────────────────── */}
          {step === 2 && (
            <>
              <StepHeader title="What's your name?" sub="Optional — used to personalise your dashboard." />
              <FieldInput
                label="FIRST NAME OR NICKNAME"
                value={data.displayName}
                onChange={v => set("displayName", v)}
                placeholder="e.g. Jake"
              />
            </>
          )}

          {/* ── Step 3: Gender ─────────────────────────────── */}
          {step === 3 && (
            <>
              <StepHeader title="Biological sex" sub="Used to calculate your basal metabolic rate (BMR)." />
              <OptionBtn label="Male"   selected={data.gender === "male"}   onPress={() => set("gender", "male")} />
              <OptionBtn label="Female" selected={data.gender === "female"} onPress={() => set("gender", "female")} />
            </>
          )}

          {/* ── Step 4: Sport ──────────────────────────────── */}
          {step === 4 && (
            <>
              <StepHeader title="Your sport" sub="Select all that apply. We'll tailor your nutrition to your discipline." />
              <View style={s.tagWrap}>
                {SPORTS.map(s_ => (
                  <TagChip key={s_} label={s_} selected={data.mainSport.includes(s_)} onPress={() => toggleSport(s_)} />
                ))}
              </View>
            </>
          )}

          {/* ── Step 5: Experience ─────────────────────────── */}
          {step === 5 && (
            <>
              <StepHeader title="Competition level" sub="How long have you been competing?" />
              {EXPERIENCE.map(o => (
                <OptionBtn key={o.key} label={o.label} sub={o.sub} selected={data.experienceLevel === o.key} onPress={() => set("experienceLevel", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 6: Age ────────────────────────────────── */}
          {step === 6 && (
            <>
              <StepHeader title="How old are you?" sub="Used with your height and weight to calculate TDEE." />
              <FieldInput label="AGE" value={data.age} onChange={v => set("age", v)} placeholder="e.g. 26" keyboard="number-pad" />
            </>
          )}

          {/* ── Step 7: Height ─────────────────────────────── */}
          {step === 7 && (
            <>
              <StepHeader title="Your height" sub="In centimetres." />
              <FieldInput label="HEIGHT (cm)" value={data.height} onChange={v => set("height", v)} placeholder="e.g. 178" keyboard="decimal-pad" />
            </>
          )}

          {/* ── Step 8: Current weight ─────────────────────── */}
          {step === 8 && (
            <>
              <StepHeader title="Current weight" sub="Your morning scale weight in kg. This is your starting point." />
              <FieldInput label="WEIGHT (kg)" value={data.currentWeight} onChange={v => set("currentWeight", v)} placeholder="e.g. 80.5" keyboard="decimal-pad" />
            </>
          )}

          {/* ── Step 9: Goal ───────────────────────────────── */}
          {step === 9 && (
            <>
              <StepHeader title="Primary goal" sub="This shapes your calorie and macro targets." />
              {GOALS.map(o => (
                <OptionBtn key={o.key} label={o.label} sub={o.sub} selected={data.goal === o.key} onPress={() => set("goal", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 10: Cut experience ────────────────────── */}
          {step === 10 && (
            <>
              <StepHeader tag="SURVEY · 1 OF 8" title="Weight cut experience" sub="How often have you cut weight for competition?" />
              {CUT_EXP.map(o => (
                <OptionBtn key={o.key} label={o.label} selected={data.surveyCutExperience === o.key} onPress={() => set("surveyCutExperience", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 11: Cut outcome ───────────────────────── */}
          {step === 11 && (
            <>
              <StepHeader tag="SURVEY · 2 OF 8" title="Your last cut" sub="How did your most recent weight cut go?" />
              {CUT_OUTCOME.map(o => (
                <OptionBtn key={o.key} label={o.label} selected={data.surveyCutOutcome === o.key} onPress={() => set("surveyCutOutcome", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 12: Calorie knowledge ─────────────────── */}
          {step === 12 && (
            <>
              <StepHeader tag="SURVEY · 3 OF 8" title="Calorie awareness" sub="How well do you know your daily intake?" />
              {CAL_KNOWLEDGE.map(o => (
                <OptionBtn key={o.key} label={o.label} sub={o.sub} selected={data.surveyCalorieKnowledge === o.key} onPress={() => set("surveyCalorieKnowledge", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 13: Underfueling ──────────────────────── */}
          {step === 13 && (
            <>
              <StepHeader tag="SURVEY · 4 OF 8" title="Underfueling" sub="How often do you feel underfueled during training?" />
              {UNDERFUEL.map(o => (
                <OptionBtn key={o.key} label={o.label} selected={data.surveyUnderfueling === o.key} onPress={() => set("surveyUnderfueling", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 14: Load tracking ─────────────────────── */}
          {step === 14 && (
            <>
              <StepHeader tag="SURVEY · 5 OF 8" title="Training load tracking" sub="How closely do you track your volume and intensity?" />
              {LOAD_TRACK.map(o => (
                <OptionBtn key={o.key} label={o.label} selected={data.surveyTrainingLoadTracking === o.key} onPress={() => set("surveyTrainingLoadTracking", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 15: Micro knowledge ───────────────────── */}
          {step === 15 && (
            <>
              <StepHeader tag="SURVEY · 6 OF 8" title="Micronutrient knowledge" sub="How much do you know about your vitamin and mineral intake?" />
              {MICRO_KNOW.map(o => (
                <OptionBtn key={o.key} label={o.label} sub={o.sub} selected={data.surveyMicroKnowledge === o.key} onPress={() => set("surveyMicroKnowledge", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 16: Energy score ──────────────────────── */}
          {step === 16 && (
            <>
              <StepHeader tag="SURVEY · 7 OF 8" title="Daily energy levels" sub="Rate your average energy on a typical training day (1 = exhausted, 10 = peak)." />
              <View style={s.tagWrap}>
                {["1","2","3","4","5","6","7","8","9","10"].map(n => (
                  <TagChip key={n} label={n} selected={data.surveyEnergyScore === n} onPress={() => set("surveyEnergyScore", n)} />
                ))}
              </View>
            </>
          )}

          {/* ── Step 17: Problems ──────────────────────────── */}
          {step === 17 && (
            <>
              <StepHeader tag="SURVEY · 8 OF 8" title="What are your main challenges?" sub="Select all that apply." />
              <View style={s.tagWrap}>
                {PROBLEMS.map(p => (
                  <TagChip key={p} label={p} selected={data.surveyMainProblems.includes(p)} onPress={() => toggleProblem(p)} />
                ))}
              </View>
            </>
          )}

          {/* ── Step 18: Activity level ────────────────────── */}
          {step === 18 && (
            <>
              <StepHeader title="Activity level" sub="Outside of sport-specific training, how active are you on a typical week?" />
              {ACTIVITY.map(o => (
                <OptionBtn key={o.key} label={o.label} sub={o.sub} selected={data.activityLevel === o.key} onPress={() => set("activityLevel", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 19: Performance ───────────────────────── */}
          {step === 19 && (
            <>
              <StepHeader title="Athletic performance" sub="How has your performance been trending in recent months?" />
              {PERFORMANCE.map(o => (
                <OptionBtn key={o.key} label={o.label} selected={data.surveyPerformance === o.key} onPress={() => set("surveyPerformance", o.key)} />
              ))}
            </>
          )}

          {/* ── Step 20: Body fat % ────────────────────────── */}
          {step === 20 && (
            <>
              <StepHeader title="Body fat %" sub="Optional — enables energy availability tracking. Leave blank if you don't know." />
              <FieldInput label="BODY FAT %" value={data.bodyFatPct} onChange={v => set("bodyFatPct", v)} placeholder="e.g. 14" keyboard="decimal-pad" hint="Caliper, DEXA, or bio-impedance measurement." />
            </>
          )}

          {/* ── Step 21: Fight camp Y/N ────────────────────── */}
          {step === 21 && (
            <>
              <StepHeader title="Do you have a fight coming up?" sub="Activates Fight Camp mode — automated weight-cut planning and carb cycling." />
              <OptionBtn label="Yes — I have a fight date" sub="Set up weight-cut planning" selected={data.hasFightCamp === true}  onPress={() => set("hasFightCamp", true)} />
              <OptionBtn label="Not right now"             sub="You can enable this later in Profile" selected={data.hasFightCamp === false} onPress={() => set("hasFightCamp", false)} />
            </>
          )}

          {/* ── Step 22: Fight camp details (conditional) ──── */}
          {step === 22 && (
            <>
              <StepHeader title="Fight camp setup" sub="Enter your fight details to generate a safe, personalised cut plan." />
              <FieldInput label="FIGHT DATE (YYYY-MM-DD)" value={data.fightDate} onChange={v => set("fightDate", v)} placeholder="e.g. 2025-09-20" />
              <FieldInput label="TARGET FIGHT WEIGHT (kg)" value={data.targetFightWeight} onChange={v => set("targetFightWeight", v)} placeholder="e.g. 70" keyboard="decimal-pad" />
              <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>WEIGH-IN TIMING</Text>
              <OptionBtn label="Same day"   sub="Weigh in on fight day"           selected={data.weighInTiming === "same_day"}   onPress={() => set("weighInTiming", "same_day")} />
              <OptionBtn label="Day before" sub="24 hours to rehydrate"           selected={data.weighInTiming === "day_before"} onPress={() => set("weighInTiming", "day_before")} />
              <View style={[s.infoBox, { backgroundColor: colors.muted + "40", borderColor: colors.border }]}>
                <Feather name="info" size={14} color={colors.mutedForeground} />
                <Text style={[s.infoText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  We recommend a maximum cut of 5–8% body weight for safe performance.
                </Text>
              </View>
            </>
          )}

          {/* ── Step 23: Review + submit ───────────────────── */}
          {step === 23 && (
            <>
              <StepHeader title="All set!" sub="Your profile is ready. Targets are calculated server-side — you can update these anytime in Profile." />
              {[
                { label: "Gender",         value: data.gender || "—" },
                { label: "Age",            value: data.age || "—" },
                { label: "Height",         value: data.height ? `${data.height} cm` : "—" },
                { label: "Weight",         value: data.currentWeight ? `${data.currentWeight} kg` : "—" },
                { label: "Activity",       value: data.activityLevel || "—" },
                { label: "Goal",           value: data.goal || "—" },
                { label: "Sport",          value: data.mainSport.join(", ") || "—" },
                { label: "Experience",     value: data.experienceLevel || "—" },
                { label: "Body fat",       value: data.bodyFatPct ? `${data.bodyFatPct}%` : "—" },
                { label: "Fight camp",     value: data.hasFightCamp ? `Yes — ${data.fightDate || "TBD"}` : "No" },
              ].map(row => (
                <View key={row.label} style={[s.reviewRow, { borderBottomColor: colors.border }]}>
                  <Text style={[s.reviewLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{row.label}</Text>
                  <Text style={[s.reviewValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{row.value}</Text>
                </View>
              ))}
              {error && (
                <View style={[s.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[s.errorText, { color: colors.destructive, fontFamily: "Inter_400Regular" }]}>{error}</Text>
                </View>
              )}
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom CTA */}
      <View style={[s.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            s.cta,
            {
              backgroundColor: canProceed() ? colors.primary : colors.muted,
              opacity: submitting ? 0.7 : 1,
            },
          ]}
          onPress={isLast ? submit : advance}
          disabled={submitting || !canProceed()}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={[s.ctaText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                {isLast ? "Complete Setup" : step === 1 ? "Let's go →" : "Continue"}
              </Text>
              {!isLast && step !== 1 && <Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 6 }} />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },
  flex:       { flex: 1 },
  topBar:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  navBtn:     { width: 36 },
  stepCount:  { fontSize: 12 },
  scroll:     { padding: 20, paddingBottom: 32 },
  tagWrap:    { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  featureCard:{ borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  featureIcon:{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureText:{ fontSize: 14, fontWeight: "500", flex: 1 },
  reviewRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1 },
  reviewLabel:{ fontSize: 14 },
  reviewValue:{ fontSize: 14, fontWeight: "500" },
  errorBox:   { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 16 },
  errorText:  { fontSize: 13, flex: 1, lineHeight: 18 },
  infoBox:    { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  infoText:   { fontSize: 13, flex: 1, lineHeight: 18 },
  bottomBar:  { padding: 16, paddingBottom: 8, borderTopWidth: 1 },
  cta:        { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaText:    { fontSize: 16, fontWeight: "700" },
});
