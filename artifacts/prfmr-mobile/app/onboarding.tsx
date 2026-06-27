import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: SCREEN_W } = Dimensions.get("window");

// ─── Wizard data shape ───────────────────────────────────────
interface WizardData {
  // Profile
  gender: "male" | "female" | "";
  age: string;
  height: string;
  currentWeight: string;
  activityLevel: string;
  goal: string;
  experienceLevel: string;
  mainSport: string;
  weightClass: string;
  bodyFatPct: string;
  // Fight camp
  hasFightCamp: boolean | null;
  fightDate: string;
  targetFightWeight: string;
  weighInTiming: string;
  // Survey
  surveyCutExperience: string;
  surveyCutOutcome: string;
  surveyCalorieKnowledge: string;
  surveyUnderfueling: string;
  surveyTrainingLoadTracking: string;
  surveyMicroKnowledge: string;
  surveyEnergyScore: string;
  surveyPerformance: string;
  surveyMainProblems: string[];
  surveyCommitment: string;
  surveyStarRating: string;
}

const INITIAL: WizardData = {
  gender: "", age: "", height: "", currentWeight: "",
  activityLevel: "", goal: "", experienceLevel: "",
  mainSport: "", weightClass: "", bodyFatPct: "",
  hasFightCamp: null, fightDate: "", targetFightWeight: "", weighInTiming: "",
  surveyCutExperience: "", surveyCutOutcome: "", surveyCalorieKnowledge: "",
  surveyUnderfueling: "", surveyTrainingLoadTracking: "", surveyMicroKnowledge: "",
  surveyEnergyScore: "", surveyPerformance: "",
  surveyMainProblems: [], surveyCommitment: "", surveyStarRating: "",
};

// ─── Option lists ─────────────────────────────────────────────
const SPORTS = [
  { key: "mma", label: "MMA" }, { key: "boxing", label: "Boxing" },
  { key: "muay_thai", label: "Muay Thai" }, { key: "wrestling", label: "Wrestling" },
  { key: "bjj", label: "BJJ" }, { key: "kickboxing", label: "Kickboxing" },
  { key: "judo", label: "Judo" }, { key: "karate", label: "Karate" },
  { key: "other", label: "Other" },
];

const WEIGHT_CLASSES = [
  "Strawweight", "Flyweight", "Bantamweight", "Featherweight",
  "Lightweight", "Welterweight", "Middleweight", "Light Heavyweight",
  "Heavyweight", "Super Heavyweight",
];

const ACTIVITY_LEVELS = [
  { key: "sedentary",         label: "Sedentary",          sub: "Little or no exercise" },
  { key: "lightly_active",    label: "Lightly Active",     sub: "1–3 days/week" },
  { key: "moderately_active", label: "Moderately Active",  sub: "3–5 days/week" },
  { key: "very_active",       label: "Very Active",        sub: "6–7 days/week" },
  { key: "extra_active",      label: "Extra Active",       sub: "Twice daily training" },
];

const GOALS = [
  { key: "fat_loss",    label: "Fat Loss",    sub: "Lose body fat" },
  { key: "maintenance", label: "Maintenance", sub: "Stay at current weight" },
  { key: "weight_gain", label: "Weight Gain", sub: "Build lean mass" },
];

const EXPERIENCE_LEVELS = [
  { key: "beginner",     label: "Beginner",     sub: "< 1 year competing" },
  { key: "intermediate", label: "Intermediate", sub: "1–4 years" },
  { key: "advanced",     label: "Advanced",     sub: "4+ years / pro" },
];

const CUT_EXPERIENCE = [
  { key: "never",      label: "Never cut weight" },
  { key: "once",       label: "Cut once or twice" },
  { key: "few",        label: "A few times" },
  { key: "regularly",  label: "Regularly" },
];

const CUT_OUTCOMES = [
  { key: "missed",     label: "Missed weight" },
  { key: "struggled",  label: "Made it but struggled" },
  { key: "fine",       label: "Made it fine" },
  { key: "easy",       label: "Comfortable cut" },
  { key: "na",         label: "N/A" },
];

const CALORIE_KNOWLEDGE = [
  { key: "none",    label: "No idea",          sub: "I don't track" },
  { key: "vague",   label: "Rough idea",       sub: "I estimate loosely" },
  { key: "decent",  label: "Pretty good",      sub: "I track sometimes" },
  { key: "precise", label: "Very precise",     sub: "I track consistently" },
];

const UNDERFUELING = [
  { key: "never",      label: "Never" },
  { key: "sometimes",  label: "Sometimes" },
  { key: "often",      label: "Often" },
  { key: "always",     label: "Always" },
];

const LOAD_TRACKING = [
  { key: "never",    label: "Never" },
  { key: "loosely",  label: "Loosely" },
  { key: "somewhat", label: "Somewhat" },
  { key: "closely",  label: "Closely" },
];

const MICRO_KNOWLEDGE = [
  { key: "none",    label: "None",    sub: "Vitamins? What?" },
  { key: "basic",   label: "Basic",   sub: "I know the basics" },
  { key: "decent",  label: "Decent",  sub: "I pay attention" },
  { key: "strong",  label: "Strong",  sub: "I track micros" },
];

const ENERGY_SCORES = ["1","2","3","4","5","6","7","8","9","10"].map(v => ({ key: v, label: v }));

const PERFORMANCE_OPTIONS = [
  { key: "declining",   label: "Declining" },
  { key: "inconsistent",label: "Inconsistent" },
  { key: "stable",      label: "Stable" },
  { key: "improving",   label: "Improving" },
];

const MAIN_PROBLEMS = [
  "Losing muscle while cutting", "Low energy during training",
  "Making weight in time", "Poor sleep / recovery",
  "Inconsistent nutrition", "Poor micronutrient intake",
  "Undereating on hard days", "Overeating on rest days",
  "No structured plan", "Not knowing my targets",
];

const COMMITMENT = [
  { key: "casual",  label: "Casual",  sub: "I'll track when convenient" },
  { key: "serious", label: "Serious", sub: "I'll track most days" },
  { key: "elite",   label: "Elite",   sub: "I'll track everything" },
];

const STARS = ["1","2","3","4","5"].map(v => ({ key: v, label: "★".repeat(Number(v)) }));

// Steps (excluding splash=0):
// 1  gender
// 2  age + height
// 3  current weight
// 4  activity level
// 5  goal
// 6  experience level
// 7  sport
// 8  survey: cut experience
// 9  survey: cut outcome
// 10 survey: calorie knowledge
// 11 survey: underfueling
// 12 survey: load tracking
// 13 survey: micro knowledge
// 14 survey: energy score
// 15 survey: performance
// 16 survey: main problems
// 17 survey: commitment
// 18 survey: star rating
// 19 body fat %
// 20 weight class
// 21 fight camp Y/N
// 22 fight date (conditional)
// 23 target fight weight (conditional)
// 24 review + submit
const TOTAL_STEPS = 25; // 0 + 24 data steps

// ─── Sub-components ───────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, step / total));
  return (
    <View style={[s.progressTrack, { backgroundColor: colors.muted }]}>
      <View style={[s.progressFill, { backgroundColor: colors.primary, width: `${pct * 100}%` }]} />
    </View>
  );
}

function ChipGrid({ options, selected, onSelect, multi = false }: {
  options: { key: string; label: string; sub?: string }[];
  selected: string | string[];
  onSelect: (k: string) => void;
  multi?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={s.chipGrid}>
      {options.map(o => {
        const active = multi
          ? (selected as string[]).includes(o.key)
          : selected === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onSelect(o.key)}
            style={[
              s.chip,
              { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + "18" : colors.card },
            ]}
          >
            <Text style={[s.chipLabel, { color: active ? colors.primary : colors.foreground, fontFamily: colors.fonts.sansMd }]}>
              {o.label}
            </Text>
            {o.sub && (
              <Text style={[s.chipSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                {o.sub}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StepInput({ label, value, onChange, placeholder, keyboardType = "default" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; keyboardType?: any;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>{label}</Text>
      <TextInput
        style={[s.input, { borderColor: colors.border, backgroundColor: colors.secondary, color: colors.foreground, fontFamily: colors.fonts.sans }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
      />
    </View>
  );
}

// ─── Main wizard ──────────────────────────────────────────────
export default function OnboardingScreen() {
  const colors = useColors();
  const { refetchUser } = useAuth();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setData(prev => ({ ...prev, [k]: v }));
  }

  function toggleProblem(val: string) {
    setData(prev => ({
      ...prev,
      surveyMainProblems: prev.surveyMainProblems.includes(val)
        ? prev.surveyMainProblems.filter(x => x !== val)
        : [...prev.surveyMainProblems, val],
    }));
  }

  const dataStep = step - 1; // 0-indexed data step
  const skipFightCamp = data.hasFightCamp === false;
  const isLastStep = dataStep === 23;

  function canContinue(): boolean {
    switch (dataStep) {
      case 0:  return !!data.gender;
      case 1:  return !!data.age && !!data.height;
      case 2:  return !!data.currentWeight;
      case 3:  return !!data.activityLevel;
      case 4:  return !!data.goal;
      case 5:  return !!data.experienceLevel;
      case 6:  return !!data.mainSport;
      case 7:  return !!data.surveyCutExperience;
      case 8:  return !!data.surveyCutOutcome;
      case 9:  return !!data.surveyCalorieKnowledge;
      case 10: return !!data.surveyUnderfueling;
      case 11: return !!data.surveyTrainingLoadTracking;
      case 12: return !!data.surveyMicroKnowledge;
      case 13: return !!data.surveyEnergyScore;
      case 14: return !!data.surveyPerformance;
      case 15: return data.surveyMainProblems.length > 0;
      case 16: return !!data.surveyCommitment;
      case 17: return !!data.surveyStarRating;
      case 18: return true; // body fat optional
      case 19: return true; // weight class optional
      case 20: return data.hasFightCamp !== null;
      case 21: return skipFightCamp || !!data.fightDate;
      case 22: return true; // target weight optional
      case 23: return true; // review
      default: return true;
    }
  }

  function handleNext() {
    // Skip fight-camp detail steps if user said no
    if (dataStep === 20 && skipFightCamp) {
      setStep(step + 3);
    } else {
      setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
    }
  }

  function handleBack() {
    if (dataStep === 23 && skipFightCamp) {
      setStep(step - 3);
    } else {
      setStep(s => Math.max(s - 1, 0));
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        gender: data.gender || undefined,
        age: data.age ? parseInt(data.age) : undefined,
        height: data.height ? parseFloat(data.height) : undefined,
        currentWeight: data.currentWeight ? parseFloat(data.currentWeight) : undefined,
        activityLevel: data.activityLevel || undefined,
        goal: data.goal || undefined,
        experienceLevel: data.experienceLevel || undefined,
        mainSport: data.mainSport || undefined,
        weightClass: data.weightClass || undefined,
        bodyFatPct: data.bodyFatPct ? parseFloat(data.bodyFatPct) / 100 : undefined,
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
        surveyCommitment: data.surveyCommitment || undefined,
        surveyStarRating: data.surveyStarRating || undefined,
      };
      // Fight camp
      if (data.hasFightCamp && data.fightDate) {
        payload.fightDate = data.fightDate;
        if (data.targetFightWeight) payload.targetFightWeight = parseFloat(data.targetFightWeight);
        if (data.weighInTiming) payload.weighInTiming = data.weighInTiming;
      }

      await apiFetch("/user/me/onboard", { method: "POST", body: payload });
      await refetchUser();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // ── Step 0: Splash ──────────────────────────────────────────
  if (step === 0) {
    return (
      <ImageBackground
        source={require("@/assets/onboarding-splash-bg.jpeg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.68)" }]} />
        <SafeAreaView style={{ flex: 1, justifyContent: "flex-end", paddingBottom: "4%" }} edges={["top", "bottom"]}>
          <View style={{ paddingHorizontal: 28 }}>
            <Image
              source={require("@/assets/logo-main.png")}
              style={{ width: 160, height: 44, marginBottom: 20 }}
              resizeMode="contain"
            />
            <Text style={[s.splashTitle, { color: "#fff", fontFamily: colors.fonts.display }]}>
              Welcome to PRFMR
            </Text>
            <Text style={[s.splashSub, { color: "rgba(255,255,255,0.65)", fontFamily: colors.fonts.sans }]}>
              Let's set up your performance profile. Takes ~2 minutes and unlocks personalised nutrition targets, training insights, and micronutrient tracking.
            </Text>
            <TouchableOpacity
              style={[s.splashBtn, { backgroundColor: colors.primary }]}
              onPress={() => setStep(1)}
              testID="button-splash-cta"
            >
              <Text style={[s.splashBtnText, { color: "#fff", fontFamily: colors.fonts.sansBd }]}>
                Get Started
              </Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // ── Steps 1–24: Data entry ──────────────────────────────────
  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={[s.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={s.navBtn}>
          <Feather name="arrow-left" size={20} color={step > 1 ? colors.foreground : "transparent"} />
        </TouchableOpacity>
        <ProgressBar step={dataStep} total={24} />
        <View style={s.navBtn} />
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} keyboardShouldPersistTaps="handled">

          {/* Step 1: Gender */}
          {dataStep === 0 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Biological sex</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Used for BMR calculation.</Text>
              <ChipGrid
                options={[{ key: "male", label: "Male" }, { key: "female", label: "Female" }]}
                selected={data.gender}
                onSelect={v => set("gender", v as "male" | "female")}
              />
            </>
          )}

          {/* Step 2: Age + Height */}
          {dataStep === 1 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Age & height</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Used to calculate your TDEE and personalised macros.</Text>
              <StepInput label="AGE" value={data.age} onChange={v => set("age", v)} placeholder="e.g. 26" keyboardType="number-pad" />
              <StepInput label="HEIGHT (cm)" value={data.height} onChange={v => set("height", v)} placeholder="e.g. 178" keyboardType="decimal-pad" />
            </>
          )}

          {/* Step 3: Current weight */}
          {dataStep === 2 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Current weight</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Your morning scale weight in kg.</Text>
              <StepInput label="WEIGHT (kg)" value={data.currentWeight} onChange={v => set("currentWeight", v)} placeholder="e.g. 75" keyboardType="decimal-pad" />
            </>
          )}

          {/* Step 4: Activity level */}
          {dataStep === 3 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Activity level</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>On a typical week, how active are you?</Text>
              <ChipGrid options={ACTIVITY_LEVELS} selected={data.activityLevel} onSelect={v => set("activityLevel", v)} />
            </>
          )}

          {/* Step 5: Goal */}
          {dataStep === 4 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Primary goal</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>This shapes your calorie and macro targets.</Text>
              <ChipGrid options={GOALS} selected={data.goal} onSelect={v => set("goal", v)} />
            </>
          )}

          {/* Step 6: Experience level */}
          {dataStep === 5 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Experience level</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How long have you been competing?</Text>
              <ChipGrid options={EXPERIENCE_LEVELS} selected={data.experienceLevel} onSelect={v => set("experienceLevel", v)} />
            </>
          )}

          {/* Step 7: Sport */}
          {dataStep === 6 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Your sport</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>We'll tailor your nutrition targets to your discipline.</Text>
              <ChipGrid options={SPORTS} selected={data.mainSport} onSelect={v => set("mainSport", v)} />
            </>
          )}

          {/* Step 8: Cut experience */}
          {dataStep === 7 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 1 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Weight cut experience</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How often have you cut weight for competition?</Text>
              <ChipGrid options={CUT_EXPERIENCE} selected={data.surveyCutExperience} onSelect={v => set("surveyCutExperience", v)} />
            </>
          )}

          {/* Step 9: Cut outcome */}
          {dataStep === 8 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 2 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Cut outcomes</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How did your most recent cut go?</Text>
              <ChipGrid options={CUT_OUTCOMES} selected={data.surveyCutOutcome} onSelect={v => set("surveyCutOutcome", v)} />
            </>
          )}

          {/* Step 10: Calorie knowledge */}
          {dataStep === 9 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 3 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Calorie awareness</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How well do you know your daily calorie intake?</Text>
              <ChipGrid options={CALORIE_KNOWLEDGE} selected={data.surveyCalorieKnowledge} onSelect={v => set("surveyCalorieKnowledge", v)} />
            </>
          )}

          {/* Step 11: Underfueling */}
          {dataStep === 10 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 4 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Underfueling</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How often do you feel underfueled during training?</Text>
              <ChipGrid options={UNDERFUELING} selected={data.surveyUnderfueling} onSelect={v => set("surveyUnderfueling", v)} />
            </>
          )}

          {/* Step 12: Load tracking */}
          {dataStep === 11 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 5 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Training load tracking</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How closely do you track your training volume and intensity?</Text>
              <ChipGrid options={LOAD_TRACKING} selected={data.surveyTrainingLoadTracking} onSelect={v => set("surveyTrainingLoadTracking", v)} />
            </>
          )}

          {/* Step 13: Micro knowledge */}
          {dataStep === 12 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 6 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Micronutrient knowledge</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How much do you know about your vitamin and mineral intake?</Text>
              <ChipGrid options={MICRO_KNOWLEDGE} selected={data.surveyMicroKnowledge} onSelect={v => set("surveyMicroKnowledge", v)} />
            </>
          )}

          {/* Step 14: Energy score */}
          {dataStep === 13 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 7 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Energy levels</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Rate your average daily energy levels (1 = exhausted, 10 = peak).</Text>
              <ChipGrid options={ENERGY_SCORES} selected={data.surveyEnergyScore} onSelect={v => set("surveyEnergyScore", v)} />
            </>
          )}

          {/* Step 15: Performance */}
          {dataStep === 14 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 8 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Athletic performance</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How has your performance been trending?</Text>
              <ChipGrid options={PERFORMANCE_OPTIONS} selected={data.surveyPerformance} onSelect={v => set("surveyPerformance", v)} />
            </>
          )}

          {/* Step 16: Main problems */}
          {dataStep === 15 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 9 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Main challenges</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Select all that apply.</Text>
              <ChipGrid
                options={MAIN_PROBLEMS.map(p => ({ key: p, label: p }))}
                selected={data.surveyMainProblems}
                onSelect={toggleProblem}
                multi
              />
            </>
          )}

          {/* Step 17: Commitment */}
          {dataStep === 16 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 10 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Commitment level</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>How consistently will you track your nutrition?</Text>
              <ChipGrid options={COMMITMENT} selected={data.surveyCommitment} onSelect={v => set("surveyCommitment", v)} />
            </>
          )}

          {/* Step 18: Star rating */}
          {dataStep === 17 && (
            <>
              <Text style={[s.surveyLabel, { color: colors.primary, fontFamily: colors.fonts.sansSb }]}>SURVEY · 11 OF 11</Text>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>How important is nutrition to you?</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>1 star = not important, 5 stars = critical to performance.</Text>
              <ChipGrid options={STARS} selected={data.surveyStarRating} onSelect={v => set("surveyStarRating", v)} />
            </>
          )}

          {/* Step 19: Body fat % */}
          {dataStep === 18 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Body fat %</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Optional — enables energy availability tracking. Useful for weight-cut planning.</Text>
              <StepInput label="BODY FAT %" value={data.bodyFatPct} onChange={v => set("bodyFatPct", v)} placeholder="e.g. 12" keyboardType="decimal-pad" />
            </>
          )}

          {/* Step 20: Weight class */}
          {dataStep === 19 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Weight class</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Optional — helps track cut targets.</Text>
              <ChipGrid options={WEIGHT_CLASSES.map(w => ({ key: w, label: w }))} selected={data.weightClass} onSelect={v => set("weightClass", v)} />
            </>
          )}

          {/* Step 21: Fight camp Y/N */}
          {dataStep === 20 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Fight coming up?</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>We'll activate Fight Camp mode with automated weight-cut and carb-cycling targets.</Text>
              <ChipGrid
                options={[
                  { key: "yes", label: "Yes — I have a fight date", sub: "Activate Fight Camp mode" },
                  { key: "no",  label: "Not right now",             sub: "You can enable it later in Profile" },
                ]}
                selected={data.hasFightCamp === true ? "yes" : data.hasFightCamp === false ? "no" : ""}
                onSelect={v => set("hasFightCamp", v === "yes")}
              />
            </>
          )}

          {/* Step 22: Fight date (conditional) */}
          {dataStep === 21 && !skipFightCamp && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Fight date</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Enter your scheduled fight date.</Text>
              <StepInput label="FIGHT DATE (YYYY-MM-DD)" value={data.fightDate} onChange={v => set("fightDate", v)} placeholder="2025-06-14" />
            </>
          )}

          {/* Step 23: Target fight weight (conditional) */}
          {dataStep === 22 && !skipFightCamp && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Target fight weight</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>The weight class limit you need to make.</Text>
              <StepInput label="TARGET WEIGHT (kg)" value={data.targetFightWeight} onChange={v => set("targetFightWeight", v)} placeholder="e.g. 70" keyboardType="decimal-pad" />
              <ChipGrid
                options={[
                  { key: "same_day",   label: "Same day",    sub: "Weigh in on fight day" },
                  { key: "day_before", label: "Day before",  sub: "24h to rehydrate" },
                ]}
                selected={data.weighInTiming}
                onSelect={v => set("weighInTiming", v)}
              />
              <View style={[s.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="info" size={14} color={colors.mutedForeground} />
                <Text style={[s.infoText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                  We recommend a maximum cut of 5–8% body weight.
                </Text>
              </View>
            </>
          )}

          {/* Step 24: Review + submit */}
          {dataStep === 23 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>All set!</Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Your profile summary. Targets are calculated on the server — you can update any of these in Profile later.
              </Text>
              {[
                { label: "Sex",          value: data.gender || "—" },
                { label: "Age",          value: data.age || "—" },
                { label: "Height",       value: data.height ? `${data.height} cm` : "—" },
                { label: "Weight",       value: data.currentWeight ? `${data.currentWeight} kg` : "—" },
                { label: "Activity",     value: data.activityLevel || "—" },
                { label: "Goal",         value: data.goal || "—" },
                { label: "Experience",   value: data.experienceLevel || "—" },
                { label: "Sport",        value: data.mainSport || "—" },
                { label: "Weight class", value: data.weightClass || "—" },
                { label: "Body fat",     value: data.bodyFatPct ? `${data.bodyFatPct}%` : "—" },
                { label: "Fight camp",   value: data.hasFightCamp === true ? `Yes — ${data.fightDate || "TBD"}` : "No" },
              ].map(row => (
                <View key={row.label} style={[s.reviewRow, { borderColor: colors.border }]}>
                  <Text style={[s.reviewLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>{row.label}</Text>
                  <Text style={[s.reviewValue, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]}>{row.value}</Text>
                </View>
              ))}
              {error && (
                <View style={[s.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "40" }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[{ color: colors.destructive, fontSize: 13, flex: 1, fontFamily: colors.fonts.sans }]}>{error}</Text>
                </View>
              )}
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom CTA */}
      <View style={[s.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[s.continueBtn, { backgroundColor: canContinue() ? colors.primary : colors.muted, opacity: submitting ? 0.7 : 1 }]}
          onPress={isLastStep ? submit : handleNext}
          disabled={submitting || !canContinue()}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[s.continueBtnText, { color: "#fff", fontFamily: colors.fonts.sansBd }]}>
              {isLastStep ? "Complete Setup" : "Continue"}
            </Text>
          )}
          {!submitting && !isLastStep && <Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 6 }} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  navBtn: { width: 36, alignItems: "center" },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },
  scrollPad: { padding: 20, paddingBottom: 40 },
  surveyLabel: { fontSize: 11, letterSpacing: 1, fontWeight: "600", marginBottom: 6 },
  stepTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8, lineHeight: 30 },
  stepSub: { fontSize: 14, lineHeight: 20, marginBottom: 20, opacity: 0.75 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: {
    height: 50, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, fontSize: 16,
  },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, minWidth: (SCREEN_W - 60) / 2 },
  chipLabel: { fontSize: 14, fontWeight: "600" },
  chipSub: { fontSize: 12, marginTop: 3 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 12 },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1 },
  reviewLabel: { fontSize: 14 },
  reviewValue: { fontSize: 14, fontWeight: "500" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, marginTop: 16 },
  bottomBar: { padding: 16, borderTopWidth: 1 },
  continueBtn: { height: 52, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  continueBtnText: { fontSize: 16, fontWeight: "700" },
  splashTitle: { fontSize: 28, fontWeight: "700", marginBottom: 12 },
  splashSub: { fontSize: 15, lineHeight: 22, marginBottom: 32 },
  splashBtn: { height: 54, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  splashBtnText: { fontSize: 17, fontWeight: "700" },
});
