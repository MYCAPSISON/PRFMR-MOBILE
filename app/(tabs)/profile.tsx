import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";
import { useToast } from "@/components/AppToast";
import { AppLogoHeader } from "@/components/AppLogoHeader";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface UserProfile {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  currentWeight: number | null;
  height: number | null;
  age: number | null;
  sport: string | null;
  mainSport?: string | null;
  experienceLevel?: string | null;
  weightClass: string | null;
  activityLevel: string | null;
  goalType: string | null;
  bodyFatPct: number | null;
  photoUrl: string | null;
}

interface Targets {
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  adjustedCalories: number;
}

interface WeightCutPlan {
  daysUntil: number;
  targetWeight: number;
  fightDate: string;
}

// ─────────────────────────────────────────
// UI Primitives
// ─────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const colors = useColors();
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

function MetricRow({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  const colors = useColors();
  return (
    <View style={[s.metricRow, { borderColor: colors.border }]}>
      <Text style={[s.xs, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.sm, { color: colors.foreground, fontWeight: "700" }]}>
        {value ?? "—"}{unit && value ? ` ${unit}` : ""}
      </Text>
    </View>
  );
}

function MacroRow({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[s.metricRow, { borderColor: colors.border }]}>
      <Text style={[s.xs, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.sm, { fontWeight: "700", color }]}>{Math.round(value)} {unit}</Text>
    </View>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  const colors = useColors();
  return (
    <View style={s.metricBox}>
      <Text style={[s.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[s.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function TargetCell({ label, value }: { label: string; value: string | number }) {
  const colors = useColors();
  return (
    <View style={[s.targetCell, { backgroundColor: colors.secondary }]}>
      <Text style={[s.targetValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[s.targetLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const SPORT_ICONS: Record<string, any> = {
  boxing: require("@/assets/sport-icons/boxing.png"),
  mma: require("@/assets/sport-icons/mma.png"),
  "muay thai": require("@/assets/sport-icons/muay-thai.png"),
  kickboxing: require("@/assets/sport-icons/kickboxing.png"),
  bjj: require("@/assets/sport-icons/bjj.png"),
  wrestling: require("@/assets/sport-icons/wrestling.png"),
  traditional: require("@/assets/sport-icons/traditional.png"),
};

type SportLevelPreset = "Amateur" | "Pro" | "Custom";

const PROFILE_SPORTS = [
  { v: "Boxing", display: "Boxer" },
  { v: "MMA", display: "MMA" },
  { v: "Muay Thai", display: "Muay Thai" },
  { v: "Kickboxing", display: "Kickboxer" },
  { v: "BJJ", display: "BJJ" },
  { v: "Wrestling", display: "Wrestler" },
  { v: "Traditional martial arts", display: "Martial Artist" },
];

function kebab(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildProfileMainSport(level: string, sport: string) {
  const display = PROFILE_SPORTS.find((item) => item.v === sport)?.display ?? sport;
  return `${level} ${display}`.trim();
}

function parseProfileMainSport(value: string | null | undefined): {
  levelPreset: SportLevelPreset;
  customLevelText: string;
  sportPick: string;
} {
  const empty = { levelPreset: "Amateur" as SportLevelPreset, customLevelText: "", sportPick: "" };
  if (!value?.trim()) return empty;

  const raw = value.trim();
  const lower = raw.toLowerCase();
  const sport = PROFILE_SPORTS.find((item) =>
    lower.includes(item.display.toLowerCase()) || lower.includes(item.v.toLowerCase())
  );

  if (lower.startsWith("pro ")) {
    return { levelPreset: "Pro", customLevelText: "", sportPick: sport?.v ?? "" };
  }
  if (lower.startsWith("amateur ")) {
    return { levelPreset: "Amateur", customLevelText: "", sportPick: sport?.v ?? "" };
  }

  let customLevelText = raw;
  if (sport) {
    const candidates = [sport.display, sport.v].map((candidate) => candidate.toLowerCase());
    const match = candidates.find((candidate) => lower.lastIndexOf(candidate) >= 0);
    if (match) customLevelText = raw.slice(0, lower.lastIndexOf(match)).trim();
  }

  return { levelPreset: "Custom", customLevelText, sportPick: sport?.v ?? "" };
}

function sportIconFor(mainSport: string) {
  const lower = mainSport.toLowerCase();
  if (lower.includes("muay thai")) return SPORT_ICONS["muay thai"];
  if (lower.includes("kickbox")) return SPORT_ICONS.kickboxing;
  if (lower.includes("boxer") || lower.includes("boxing")) return SPORT_ICONS.boxing;
  if (lower.includes("wrest")) return SPORT_ICONS.wrestling;
  if (lower.includes("bjj") || lower.includes("jiu")) return SPORT_ICONS.bjj;
  if (lower.includes("mma")) return SPORT_ICONS.mma;
  if (lower.includes("martial") || lower.includes("traditional")) return SPORT_ICONS.traditional;
  return undefined;
}

function SportBadge({ mainSport, size = "sm" }: { mainSport: string; size?: "sm" | "md" }) {
  const lower = mainSport.toLowerCase();
  const level = lower.startsWith("pro ") ? "pro" : lower.startsWith("amateur ") ? "amateur" : "custom";
  const icon = sportIconFor(mainSport);
  const scheme = level === "pro"
    ? { bg: "rgba(245,158,11,0.22)", border: "rgba(251,191,36,0.50)", text: "#fcd34d" }
    : level === "amateur"
      ? { bg: "rgba(255,122,0,0.15)", border: "rgba(255,122,0,0.30)", text: "#ff7a00" }
      : { bg: "rgba(148,163,184,0.18)", border: "rgba(203,213,225,0.40)", text: "#e2e8f0" };
  const isMd = size === "md";
  return (
    <View style={[s.sportBadge, {
      backgroundColor: scheme.bg,
      borderColor: scheme.border,
      paddingHorizontal: isMd ? 14 : 10,
      paddingVertical: isMd ? 7 : 5,
      gap: isMd ? 7 : 6,
    }]} testID="badge-main-sport">
      {icon ? (
        <Image
          source={icon}
          style={{ width: isMd ? 20 : 16, height: isMd ? 20 : 16, tintColor: "#fff", opacity: 0.9 }}
          resizeMode="contain"
        />
      ) : null}
      <Text style={{ color: scheme.text, fontWeight: "700", fontSize: isMd ? 13 : 11, fontFamily: "Inter_700Bold" }}>
        {mainSport}
      </Text>
    </View>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  lightly_active: "Lightly Active",
  moderately_active: "Moderately Active",
  very_active: "Very Active",
  extra_active: "Extra Active",
};

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  performance: "Performance",
  weight_cut: "Weight Cut",
};

// ─────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────
function Avatar({ username, size = 72 }: { username: string; size?: number }) {
  const colors = useColors();
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: "rgba(255,122,0,0.15)", borderColor: "rgba(255,122,0,0.3)" }]}>
      <Text style={{ color: colors.primary, fontSize: size * 0.36, fontWeight: "800" }}>{initials}</Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Body Fat Editor
// ─────────────────────────────────────────
function BodyFatEditor({ current, onSave }: { current: number | null; onSave: (v: number) => void }) {
  const colors = useColors();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current != null ? String(Math.round(current * 100)) : "");

  if (!editing) {
    return (
      <TouchableOpacity style={s.row} onPress={() => { setVal(current?.toString() ?? ""); setEditing(true); }}>
        <Text style={[s.sm, { color: colors.foreground, fontWeight: "700" }]}>
          {current != null ? `${Math.round(current * 100)}%` : "—"}
        </Text>
        <Feather name="edit-2" size={12} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={s.row}>
      <TextInput
        style={[s.inlineInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
        placeholder="%"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
        value={val}
        onChangeText={setVal}
        autoFocus
      />
      <TouchableOpacity style={[s.btnTiny, { backgroundColor: colors.primary, marginLeft: 6 }]}
        onPress={() => {
          const n = parseFloat(val);
          if (isNaN(n) || n < 3 || n > 55) {
            showToast({ title: "Enter a value between 3 and 55", variant: "destructive" });
            return;
          }
          onSave(n / 100);
          setEditing(false);
        }}>
        <Feather name="check" size={12} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity style={[s.btnTiny, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, marginLeft: 4 }]}
        onPress={() => setEditing(false)}>
        <Feather name="x" size={12} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function ProfileScreen() {
  const colors = useColors();
  const { user: authUser, logout, refetchUser } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [isEditingSport, setIsEditingSport] = useState(false);
  const [sportPick, setSportPick] = useState("");
  const [levelPreset, setLevelPreset] = useState<SportLevelPreset>("Amateur");
  const [customLevelText, setCustomLevelText] = useState("");
  const levelPick = levelPreset === "Custom" ? customLevelText.trim() : levelPreset;

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ["user-me"],
    queryFn: () => apiFetch("/user/me"),
  });

  const { data: targets } = useQuery<Targets>({
    queryKey: ["targets", today],
    queryFn: () => apiFetch(`/me/targets/effective?date=${today}`),
  });

  const { data: weightCutPlan } = useQuery<WeightCutPlan | null>({
    queryKey: ["weight-cut"],
    queryFn: () => apiFetch<WeightCutPlan | null>("/me/weight-cut").catch(() => null),
    retry: false,
  });

  const bodyFatMut = useMutation({
    mutationFn: (bodyFatPct: number) =>
      apiFetch("/me/body-composition", { method: "PATCH", body: { bodyFatPct } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-me"] }),
  });

  const sportMut = useMutation({
    mutationFn: (mainSport: string | null) =>
      apiFetch<UserProfile>("/me/sport", { method: "PATCH", body: { mainSport } }),
    onSuccess: (updated, mainSport) => {
      qc.setQueryData(["user-me"], updated);
      qc.invalidateQueries({ queryKey: ["user-me"] });
      void refetchUser();
      setIsEditingSport(false);
      showToast({ title: mainSport ? "Sport identity updated" : "Sport badge removed" });
    },
    onError: () => showToast({ title: "Failed to save", variant: "destructive" }),
  });

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  if (isLoading || !user) {
    return (
      <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
        <AppLogoHeader />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const displayName = user.displayName || user.username;
  const fightCampActive = weightCutPlan && weightCutPlan.daysUntil > 0;
  const mainSport = user.mainSport ?? user.sport ?? null;
  const levelText = user.experienceLevel ?? user.activityLevel ?? "advanced";
  const goalText = (user.goalType ?? "maintenance").replace(/_/g, " ");
  const selectedSportLabel = PROFILE_SPORTS.find((item) => item.v === sportPick)?.display ?? sportPick;
  const sportPreview = sportPick && levelPick ? buildProfileMainSport(levelPick, sportPick) : "";

  const openSportEditor = () => {
    const parsed = parseProfileMainSport(mainSport);
    setLevelPreset(parsed.levelPreset);
    setCustomLevelText(parsed.customLevelText);
    setSportPick(parsed.sportPick);
    setIsEditingSport(true);
  };

  const saveSport = () => {
    if (!sportPick || !levelPick) {
      showToast({ title: "Choose a level and sport first", variant: "destructive" });
      return;
    }
    sportMut.mutate(buildProfileMainSport(levelPick, sportPick));
  };

  const removeSport = () => sportMut.mutate(null);

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <AppLogoHeader />
      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={[s.profileHeader, { borderBottomColor: "#e5e7eb" }]}>
          <View style={{ position: "relative" }}>
            <Avatar username={user.username} size={86} />
            <View style={[s.cameraPill, { backgroundColor: colors.primary, borderColor: "#fff" }]}>
              <Feather name="camera" size={18} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.row}>
              <Text style={[s.profileName, { color: colors.foreground }]}>{displayName}</Text>
              <TouchableOpacity style={{ padding: 8 }}>
                <Feather name="edit-2" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={[s.profileMeta, { color: colors.mutedForeground }]}>
              {levelText.replace(/_/g, " ")} • {goalText}
            </Text>
            {mainSport && <View style={{ marginTop: 10 }}><SportBadge mainSport={mainSport} size="sm" /></View>}
          </View>
        </View>

        {/* Current Metrics */}
        <Card>
          <View style={[s.rowBetween, { alignItems: "flex-start", marginBottom: 20 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Current Metrics</Text>
              <Text style={[s.cardDescription, { color: colors.mutedForeground }]}>Based on your latest update</Text>
            </View>
            <TouchableOpacity style={[s.outlineButton, { borderColor: "#e5e7eb" }]}>
              <MaterialCommunityIcons name="scale-balance" size={22} color={colors.foreground} />
              <Text style={[s.outlineButtonText, { color: colors.foreground }]}>Update Weight</Text>
            </TouchableOpacity>
          </View>
          <View style={s.metricsGrid}>
            <MetricBox label="Height" value={user.height ? `${user.height} cm` : "—"} />
            <MetricBox label="Weight" value={user.currentWeight ? `${user.currentWeight} kg` : "—"} />
            <MetricBox label="Age" value={user.age ?? "—"} />
            <MetricBox label="Activity" value={user.activityLevel ? ACTIVITY_LABELS[user.activityLevel] : "—"} />
          </View>
          <View style={{ marginTop: 18 }}>
            <Text style={[s.metricLabel, { color: colors.mutedForeground }]}>Body Fat % <Text style={{ opacity: 0.65 }}>(used for EA scoring)</Text></Text>
            <BodyFatEditor current={user.bodyFatPct} onSave={(v) => bodyFatMut.mutate(v)} />
          </View>
        </Card>

        <Card>
          <View style={[s.rowBetween, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <View style={s.row}>
                <Feather name="shield" size={20} color={colors.primary} />
                <Text style={[s.cardTitle, { color: colors.foreground, marginLeft: 10 }]}>Sport Identity</Text>
              </View>
              <Text style={[s.cardDescription, { color: colors.mutedForeground }]}>Your badge shown on the dashboard and profile</Text>
            </View>
            <TouchableOpacity style={{ padding: 6 }} onPress={openSportEditor} testID="button-edit-sport">
              <Feather name="edit-2" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {!isEditingSport ? (
            <View style={{ marginTop: 18 }}>
              {mainSport ? (
                <SportBadge mainSport={mainSport} size="md" />
              ) : (
                <View style={{ gap: 12 }}>
                  <Text style={[s.sm, { color: colors.mutedForeground }]}>No sport set</Text>
                  <TouchableOpacity
                    style={[s.setSportButton, { borderColor: "#e5e7eb" }]}
                    onPress={openSportEditor}
                    testID="button-set-sport"
                  >
                    <Feather name="plus" size={16} color={colors.foreground} />
                    <Text style={[s.outlineButtonText, { color: colors.foreground }]}>Set sport badge</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={s.sportEditor}>
              <Text style={[s.editorLabel, { color: colors.mutedForeground }]}>Competition level</Text>
              <View style={s.levelRow}>
                {(["Amateur", "Pro", "Custom"] as SportLevelPreset[]).map((level) => {
                  const active = levelPreset === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      testID={`button-level-${level.toLowerCase()}`}
                      style={[
                        s.levelPill,
                        {
                          backgroundColor: active ? "rgba(255,122,0,0.16)" : colors.secondary,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setLevelPreset(level)}
                    >
                      <Text style={[s.levelPillText, { color: active ? colors.primary : colors.foreground }]}>
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {levelPreset === "Custom" && (
                <TextInput
                  testID="input-custom-level"
                  value={customLevelText}
                  onChangeText={setCustomLevelText}
                  placeholder="e.g. Semi-pro, White collar, Hobbyist..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    s.customLevelInput,
                    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary },
                  ]}
                />
              )}

              <Text style={[s.editorLabel, { color: colors.mutedForeground }]}>Sport</Text>
              <View style={s.sportGrid}>
                {PROFILE_SPORTS.map((sport) => {
                  const active = sportPick === sport.v;
                  const previewName = buildProfileMainSport(levelPick || "Amateur", sport.v);
                  const icon = sportIconFor(previewName);
                  return (
                    <TouchableOpacity
                      key={sport.v}
                      testID={`button-sport-pick-${kebab(sport.v)}`}
                      style={[
                        s.sportPick,
                        {
                          backgroundColor: active ? "rgba(255,122,0,0.14)" : colors.secondary,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSportPick(sport.v)}
                    >
                      {icon ? (
                        <Image source={icon} style={s.sportPickIcon} resizeMode="contain" />
                      ) : (
                        <Feather name="activity" size={18} color={colors.foreground} />
                      )}
                      <Text style={[s.sportPickText, { color: colors.foreground }]} numberOfLines={1}>
                        {sport.v}
                      </Text>
                      {active && <Feather name="check" size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {sportPreview ? (
                <View style={[s.previewBox, { backgroundColor: colors.secondary }]}>
                  <Text style={[s.editorLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
                    Preview
                  </Text>
                  <SportBadge mainSport={sportPreview} size="md" />
                  <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 8 }]}>
                    This will show as {selectedSportLabel ? `${levelPick} ${selectedSportLabel}` : sportPreview}.
                  </Text>
                </View>
              ) : null}

              <View style={s.editorActions}>
                <TouchableOpacity
                  testID="button-save-sport"
                  disabled={sportMut.isPending || !sportPick || !levelPick}
                  style={[
                    s.primaryAction,
                    { backgroundColor: colors.primary, opacity: sportMut.isPending || !sportPick || !levelPick ? 0.45 : 1 },
                  ]}
                  onPress={saveSport}
                >
                  {sportMut.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryActionText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="button-cancel-sport"
                  style={[s.ghostAction, { borderColor: "#e5e7eb" }]}
                  onPress={() => setIsEditingSport(false)}
                  disabled={sportMut.isPending}
                >
                  <Text style={[s.ghostActionText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                {mainSport ? (
                  <TouchableOpacity
                    testID="button-remove-sport"
                    style={[s.removeAction, { borderColor: "rgba(239,68,68,0.55)" }]}
                    onPress={removeSport}
                    disabled={sportMut.isPending}
                  >
                    <Feather name="trash-2" size={15} color="#ef4444" />
                    <Text style={s.removeActionText}>Remove badge</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        </Card>

        {/* Nutrition Targets */}
        {targets && (
          <Card>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Nutrition Targets</Text>
            <Text style={[s.cardDescription, { color: colors.mutedForeground }]}>Calculated daily goals</Text>
            <View style={s.targetGrid}>
              <TargetCell label="Calories" value={Math.round(targets.adjustedCalories || targets.targetCalories)} />
              <TargetCell label="Protein" value={`${Math.round(targets.targetProtein)}g`} />
              <TargetCell label="Carbs" value={`${Math.round(targets.targetCarbs)}g`} />
              <TargetCell label="Fat" value={`${Math.round(targets.targetFat)}g`} />
            </View>
          </Card>
        )}

        <Card>
          <View style={s.row}>
            <Feather name="bell" size={26} color={colors.foreground} />
            <Text style={[s.cardTitle, { color: colors.foreground, marginLeft: 12 }]}>Push Notifications</Text>
          </View>
          <Text style={[s.cardDescription, { color: colors.mutedForeground }]}>Receive reminders for supplements and workouts on your device</Text>
          <View style={[s.pushBox, { backgroundColor: colors.secondary }]}>
            <Feather name="smartphone" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.sm, { color: colors.foreground, fontWeight: "700" }]}>Install PRFMR to enable notifications</Text>
              <Text style={[s.pushText, { color: colors.mutedForeground }]}>
                iOS requires the app to be installed on your home screen. Follow these steps:{"\n\n"}
                Tap the Share button in Safari{"\n"}
                1. Scroll down and tap "Add to Home Screen"{"\n"}
                2. Open PRFMR from your home screen{"\n"}
                3. Return here to enable notifications
              </Text>
            </View>
          </View>
          <Text style={[s.pushText, { color: colors.mutedForeground, marginTop: 12 }]}>Requires iOS 16.4 or later.</Text>
        </Card>

        {/* Fight Camp */}
        {fightCampActive && weightCutPlan && (
          <Card style={{ borderColor: "rgba(255,122,0,0.2)" }}>
            <View style={[s.row, { marginBottom: 8 }]}>
              <Feather name="target" size={15} color={colors.primary} />
              <Text style={[s.cardTitle, { color: colors.foreground, marginLeft: 8 }]}>Fight Camp</Text>
            </View>
            <MetricRow label="Fight Date" value={format(new Date(weightCutPlan.fightDate + "T12:00:00"), "d MMM yyyy")} />
            <MetricRow label="Days Until" value={`${weightCutPlan.daysUntil} days`} />
            <MetricRow label="Fight Weight" value={`${weightCutPlan.targetWeight} kg`} />
          </Card>
        )}

        <TouchableOpacity style={[s.recalculateBtn, { borderColor: "#e5e7eb" }]}>
          <Feather name="settings" size={18} color={colors.foreground} />
          <Text style={[s.outlineButtonText, { color: colors.foreground }]}>Recalculate Goals</Text>
        </TouchableOpacity>

        <Text style={[s.xs, { color: colors.mutedForeground, textAlign: "center", marginTop: 8 }]}>
          PRFMR · Combat Sports Performance
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  pageTitle: { fontSize: 20, fontWeight: "800" },
  scrollPad: { padding: 16, gap: 15, paddingBottom: 120 },
  card: { borderRadius: 12, borderWidth: 1.5, padding: 22 },
  cardTitle: { fontSize: 24, lineHeight: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  cardDescription: { fontSize: 14, lineHeight: 20, marginTop: 5, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { flexDirection: "row", alignItems: "center", borderRadius: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  lg: { fontSize: 18, fontWeight: "800" },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingVertical: 9 },
  metricBox: { width: "48%", gap: 7 },
  metricLabel: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  metricValue: { fontSize: 19, fontWeight: "700", fontFamily: "Inter_700Bold" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 20 },
  targetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 22 },
  targetCell: { width: "47%", minHeight: 73, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  targetValue: { fontSize: 21, fontWeight: "800", fontFamily: "JetBrainsMono_700Bold" },
  targetLabel: { fontSize: 12, marginTop: 4, fontFamily: "Inter_400Regular" },
  avatar: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  profileHeader: { flexDirection: "row", gap: 17, alignItems: "center", paddingVertical: 19, borderBottomWidth: 1.5 },
  profileName: { fontSize: 25, lineHeight: 31, fontWeight: "800", fontFamily: "Inter_700Bold" },
  profileMeta: { fontSize: 15, lineHeight: 21, textTransform: "capitalize", fontFamily: "Inter_400Regular" },
  cameraPill: { position: "absolute", right: -2, bottom: -2, width: 46, height: 29, borderRadius: 15, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  sportBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1.5 },
  setSportButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  sportEditor: { marginTop: 17, gap: 12 },
  editorLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0,
    fontFamily: "Inter_700Bold",
  },
  levelRow: { flexDirection: "row", gap: 7 },
  levelPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  levelPillText: { fontSize: 13, fontWeight: "800", fontFamily: "Inter_700Bold" },
  customLevelInput: {
    minHeight: 38,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  sportPick: {
    width: "48%",
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sportPickIcon: { width: 16, height: 16, tintColor: "#fff", opacity: 0.9 },
  sportPickText: { flex: 1, fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold" },
  previewBox: { borderRadius: 10, padding: 12 },
  editorActions: { gap: 9, marginTop: 2 },
  primaryAction: { minHeight: 39, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  primaryActionText: { color: "#fff", fontSize: 14, fontWeight: "800", fontFamily: "Inter_700Bold" },
  ghostAction: {
    minHeight: 37,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostActionText: { fontSize: 13, fontWeight: "700", fontFamily: "Inter_700Bold" },
  removeAction: {
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  removeActionText: { color: "#ef4444", fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  outlineButton: { minHeight: 37, borderRadius: 9, borderWidth: 1.5, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  outlineButtonText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  pushBox: { borderRadius: 10, flexDirection: "row", gap: 14, padding: 15, marginTop: 17 },
  pushText: { fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular" },
  recalculateBtn: { alignSelf: "flex-end", minHeight: 41, borderRadius: 9, borderWidth: 1.5, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, padding: 14 },
  inlineInput: { borderRadius: 6, borderWidth: 1, padding: 6, fontSize: 13, width: 80 },
  btnTiny: { borderRadius: 6, padding: 6, alignItems: "center", justifyContent: "center" },
});
