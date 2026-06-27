import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const { width: SCREEN_W } = Dimensions.get("window");

// ─────────────────────────────────────────
// Wizard data shape
// ─────────────────────────────────────────
interface WizardData {
  // Step 1 – Sport
  sport: string;
  // Step 2 – Weight class
  weightClass: string;
  // Step 3 – Body stats
  weight: string;
  height: string;
  age: string;
  sex: "male" | "female" | "";
  // Step 4 – Activity level
  activityLevel: string;
  // Step 5 – Goal
  goalType: string;
  // Step 6 – Body fat %
  bodyFatPct: string;
  // Step 7 – Fight camp?
  hasFightCamp: boolean | null;
  // Steps 8-10 – Fight camp details
  fightDate: string;
  targetFightWeight: string;
  fightWeightClass: string;
  // Step 11 – Display name
  displayName: string;
}

const INITIAL: WizardData = {
  sport: "", weightClass: "", weight: "", height: "", age: "", sex: "",
  activityLevel: "", goalType: "", bodyFatPct: "",
  hasFightCamp: null, fightDate: "", targetFightWeight: "", fightWeightClass: "",
  displayName: "",
};

const SPORTS = [
  { key: "mma",          label: "MMA" },
  { key: "boxing",       label: "Boxing" },
  { key: "muay_thai",    label: "Muay Thai" },
  { key: "wrestling",    label: "Wrestling" },
  { key: "bjj",          label: "BJJ" },
  { key: "kickboxing",   label: "Kickboxing" },
  { key: "judo",         label: "Judo" },
  { key: "karate",       label: "Karate" },
  { key: "other",        label: "Other" },
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
  { key: "fat_loss",     label: "Fat Loss",     sub: "Lose body fat" },
  { key: "muscle_gain",  label: "Muscle Gain",  sub: "Build lean mass" },
  { key: "maintenance",  label: "Maintenance",  sub: "Stay at current weight" },
  { key: "performance",  label: "Performance",  sub: "Optimise athletic output" },
  { key: "weight_cut",   label: "Weight Cut",   sub: "Cut to fight weight" },
];

const TOTAL_STEPS = 12; // 0=splash, 1..11 = data steps

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  const colors = useColors();
  return (
    <View style={s.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[
          s.dot,
          { backgroundColor: i < step ? colors.primary : i === step ? colors.primary : colors.border },
          i === step && s.dotActive,
        ]} />
      ))}
    </View>
  );
}

function ChipGrid({ options, selected, onSelect }: {
  options: { key: string; label: string; sub?: string }[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={s.chipGrid}>
      {options.map(o => {
        const active = selected === o.key;
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

// ─────────────────────────────────────────
// Main Onboarding Wizard
// ─────────────────────────────────────────
export default function OnboardingScreen() {
  const colors = useColors();
  const { user, refreshUser } = useAuth() as any;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setData(prev => ({ ...prev, [k]: v }));
  }

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS - 1)); }
  function back() { setStep(s => Math.max(s - 1, 0)); }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        sport: data.sport || undefined,
        weightClass: data.weightClass || undefined,
        activityLevel: data.activityLevel || undefined,
        goalType: data.goalType || undefined,
        displayName: data.displayName || undefined,
      };
      if (data.weight) payload.weight = parseFloat(data.weight);
      if (data.height) payload.height = parseFloat(data.height);
      if (data.age) payload.age = parseInt(data.age);
      if (data.sex) payload.sex = data.sex;
      if (data.bodyFatPct) payload.bodyFatPct = parseFloat(data.bodyFatPct) / 100;
      if (data.hasFightCamp && data.fightDate) {
        payload.fightDate = data.fightDate;
        if (data.targetFightWeight) payload.targetFightWeight = parseFloat(data.targetFightWeight);
        if (data.fightWeightClass) payload.fightWeightClass = data.fightWeightClass;
      }
      await apiFetch("/user/me", { method: "PATCH", body: payload });
      if (refreshUser) await refreshUser();
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  // ── Step 0: Splash ────────────────────────
  if (step === 0) {
    return (
      <ImageBackground
        source={require("@/assets/onboarding-splash-bg.jpeg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.72)" }]} />
        <SafeAreaView style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 48 }} edges={["top", "bottom"]}>
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
              Let's set up your performance profile. It takes about 2 minutes and unlocks personalised nutrition targets, training insights, and micronutrient tracking.
            </Text>
            <TouchableOpacity
              style={[s.splashBtn, { backgroundColor: colors.primary }]}
              onPress={next}
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

  // ── Steps 1–11: Data entry ─────────────────
  const dataStep = step - 1; // 0-indexed among data steps

  function canContinue(): boolean {
    switch (dataStep) {
      case 0: return !!data.sport;
      case 1: return !!data.weight && !!data.height && !!data.age && !!data.sex;
      case 2: return !!data.activityLevel;
      case 3: return !!data.goalType;
      case 4: return true; // weight class optional
      case 5: return true; // body fat optional
      case 6: return data.hasFightCamp !== null;
      case 7: // fight date — skip if no fight camp
        return data.hasFightCamp === false || !!data.fightDate;
      case 8: return true; // fight target weight optional
      case 9: return true; // display name optional
      case 10: return true; // review
      default: return true;
    }
  }

  const isLastStep = dataStep === 10;
  const skipFightCamp = data.hasFightCamp === false;

  // Navigate past fight-camp steps if user said "No"
  function handleNext() {
    if (dataStep === 6 && skipFightCamp) {
      setStep(step + 3); // skip fight date, target weight
    } else {
      next();
    }
  }
  function handleBack() {
    if (dataStep === 9 && skipFightCamp) {
      setStep(step - 3);
    } else {
      back();
    }
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={[s.topBar, { borderBottomColor: colors.border }]}>
        {step > 1 ? (
          <TouchableOpacity onPress={handleBack} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <ProgressDots step={dataStep} total={11} />
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={s.backBtn}>
          <Text style={[s.skipText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} keyboardShouldPersistTaps="handled">

          {/* Step 1: Sport */}
          {dataStep === 0 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                What's your sport?
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                We'll tailor your nutrition targets to your discipline.
              </Text>
              <ChipGrid
                options={SPORTS}
                selected={data.sport}
                onSelect={v => set("sport", v)}
              />
            </>
          )}

          {/* Step 2: Body stats */}
          {dataStep === 1 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Your body stats
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Used to calculate your TDEE and personalised macros.
              </Text>
              <StepInput label="WEIGHT (kg)" value={data.weight} onChange={v => set("weight", v)} placeholder="e.g. 75" keyboardType="decimal-pad" />
              <StepInput label="HEIGHT (cm)" value={data.height} onChange={v => set("height", v)} placeholder="e.g. 178" keyboardType="decimal-pad" />
              <StepInput label="AGE" value={data.age} onChange={v => set("age", v)} placeholder="e.g. 26" keyboardType="number-pad" />
              <Text style={[s.fieldLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb, marginBottom: 8 }]}>SEX</Text>
              <ChipGrid
                options={[{ key: "male", label: "Male" }, { key: "female", label: "Female" }]}
                selected={data.sex}
                onSelect={v => set("sex", v as "male" | "female")}
              />
            </>
          )}

          {/* Step 3: Activity level */}
          {dataStep === 2 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Activity level
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                On a typical week, how active are you?
              </Text>
              <ChipGrid
                options={ACTIVITY_LEVELS}
                selected={data.activityLevel}
                onSelect={v => set("activityLevel", v)}
              />
            </>
          )}

          {/* Step 4: Goal */}
          {dataStep === 3 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Primary goal
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                This shapes your calorie and macro targets.
              </Text>
              <ChipGrid
                options={GOALS}
                selected={data.goalType}
                onSelect={v => set("goalType", v)}
              />
            </>
          )}

          {/* Step 5: Weight class */}
          {dataStep === 4 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Weight class
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Optional — helps track cut targets.
              </Text>
              <ChipGrid
                options={WEIGHT_CLASSES.map(w => ({ key: w, label: w }))}
                selected={data.weightClass}
                onSelect={v => set("weightClass", v)}
              />
            </>
          )}

          {/* Step 6: Body fat % */}
          {dataStep === 5 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Body fat %
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Optional — enables energy availability tracking (EA). Useful for weight-cut planning.
              </Text>
              <StepInput label="BODY FAT %" value={data.bodyFatPct} onChange={v => set("bodyFatPct", v)} placeholder="e.g. 12" keyboardType="decimal-pad" />
            </>
          )}

          {/* Step 7: Fight camp? */}
          {dataStep === 6 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Do you have a fight coming up?
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                We'll activate Fight Camp mode with automated weight-cut and carb-cycling targets.
              </Text>
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

          {/* Step 8: Fight date */}
          {dataStep === 7 && !skipFightCamp && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Fight date
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Enter your scheduled fight date (YYYY-MM-DD).
              </Text>
              <StepInput label="FIGHT DATE" value={data.fightDate} onChange={v => set("fightDate", v)} placeholder="2025-03-15" />
            </>
          )}

          {/* Step 9: Target fight weight */}
          {dataStep === 8 && !skipFightCamp && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                Target fight weight
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                The weight class limit you need to make. We'll calculate your cut trajectory automatically.
              </Text>
              <StepInput label="TARGET WEIGHT (kg)" value={data.targetFightWeight} onChange={v => set("targetFightWeight", v)} placeholder="e.g. 70" keyboardType="decimal-pad" />
              <View style={[s.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="info" size={14} color={colors.mutedForeground} />
                <Text style={[s.infoText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                  We recommend a maximum cut of 5–8% body weight.
                </Text>
              </View>
            </>
          )}

          {/* Step 10: Display name */}
          {dataStep === 9 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                What should we call you?
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Optional — shown in the app header.
              </Text>
              <StepInput label="DISPLAY NAME" value={data.displayName} onChange={v => set("displayName", v)} placeholder="e.g. Jake" />
            </>
          )}

          {/* Step 11: Review & submit */}
          {dataStep === 10 && (
            <>
              <Text style={[s.stepTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
                All set!
              </Text>
              <Text style={[s.stepSub, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Here's your profile summary. You can edit any of these later in Profile.
              </Text>
              {[
                { label: "Sport",          value: data.sport || "—" },
                { label: "Weight",         value: data.weight ? `${data.weight} kg` : "—" },
                { label: "Height",         value: data.height ? `${data.height} cm` : "—" },
                { label: "Age",            value: data.age || "—" },
                { label: "Sex",            value: data.sex || "—" },
                { label: "Activity",       value: data.activityLevel || "—" },
                { label: "Goal",           value: data.goalType || "—" },
                { label: "Weight class",   value: data.weightClass || "—" },
                { label: "Body fat",       value: data.bodyFatPct ? `${data.bodyFatPct}%` : "—" },
                { label: "Fight camp",     value: data.hasFightCamp === true ? `Yes — ${data.fightDate || "TBD"}` : "No" },
                { label: "Display name",   value: data.displayName || "—" },
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 36 },
  skipText: { fontSize: 14 },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 20, height: 6 },
  scrollPad: { padding: 24, paddingBottom: 40 },
  stepTitle: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  stepSub: { fontSize: 15, lineHeight: 22, marginBottom: 24, opacity: 0.8 },
  chipGrid: { gap: 10 },
  chip: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 15, fontWeight: "600" },
  chipSub: { fontSize: 12, marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 9,
    fontSize: 15,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  infoText: { fontSize: 13, flex: 1, lineHeight: 18 },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  reviewLabel: { fontSize: 13 },
  reviewValue: { fontSize: 14, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  continueBtn: {
    flexDirection: "row",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  continueBtnText: { fontSize: 16, fontWeight: "700" },
  // Splash styles
  splashTitle: { fontSize: 32, fontWeight: "800", marginBottom: 14 },
  splashSub: { fontSize: 16, lineHeight: 24, marginBottom: 36 },
  splashBtn: {
    flexDirection: "row",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    gap: 10,
  },
  splashBtnText: { fontSize: 18, fontWeight: "700" },
});
