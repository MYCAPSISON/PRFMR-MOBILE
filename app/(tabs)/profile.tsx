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

function sportIconFor(mainSport: string) {
  const lower = mainSport.toLowerCase();
  if (lower.includes("muay thai")) return SPORT_ICONS["muay thai"];
  if (lower.includes("kickbox")) return SPORT_ICONS.kickboxing;
  if (lower.includes("boxing") || lower.includes("boxer")) return SPORT_ICONS.boxing;
  if (lower.includes("wrest")) return SPORT_ICONS.wrestling;
  if (lower.includes("bjj")) return SPORT_ICONS.bjj;
  if (lower.includes("mma")) return SPORT_ICONS.mma;
  return SPORT_ICONS.traditional;
}

function SportBadge({ mainSport, size = "sm" }: { mainSport: string; size?: "sm" | "md" }) {
  const lower = mainSport.toLowerCase();
  const level = lower.startsWith("pro ") ? "pro" : lower.startsWith("amateur ") ? "amateur" : "custom";
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
      <Image
        source={sportIconFor(mainSport)}
        style={{ width: isMd ? 20 : 16, height: isMd ? 20 : 16, tintColor: "#fff", opacity: 0.9 }}
        resizeMode="contain"
      />
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
  const { user: authUser, logout } = useAuth();
  const qc = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

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

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => logout() },
    ]);
  };

  if (isLoading || !user) {
    return (
      <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
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

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
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
              <Text style={[s.cardTitle, { color: colors.foreground }]}>Current{"\n"}Metrics</Text>
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
            <TouchableOpacity style={{ padding: 6 }}>
              <Feather name="edit-2" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 18 }}>
            {mainSport ? <SportBadge mainSport={mainSport} size="md" /> : <Text style={[s.sm, { color: colors.mutedForeground }]}>No sport set</Text>}
          </View>
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
  scrollPad: { padding: 16, gap: 18, paddingBottom: 120 },
  card: { borderRadius: 12, borderWidth: 1.5, padding: 26 },
  cardTitle: { fontSize: 28, lineHeight: 32, fontWeight: "800", fontFamily: "SpaceGrotesk_700Bold" },
  cardDescription: { fontSize: 17, lineHeight: 24, marginTop: 6, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { flexDirection: "row", alignItems: "center", borderRadius: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  lg: { fontSize: 18, fontWeight: "800" },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingVertical: 10 },
  metricBox: { gap: 8 },
  metricLabel: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  metricValue: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 24 },
  targetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 26 },
  targetCell: { width: "47%", minHeight: 86, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  targetValue: { fontSize: 25, fontWeight: "800", fontFamily: "JetBrainsMono_700Bold" },
  targetLabel: { fontSize: 14, marginTop: 4, fontFamily: "Inter_400Regular" },
  avatar: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  profileHeader: { flexDirection: "row", gap: 20, alignItems: "center", paddingVertical: 22, borderBottomWidth: 1.5 },
  profileName: { fontSize: 30, lineHeight: 36, fontWeight: "800", fontFamily: "SpaceGrotesk_700Bold" },
  profileMeta: { fontSize: 18, lineHeight: 25, textTransform: "capitalize", fontFamily: "Inter_400Regular" },
  cameraPill: { position: "absolute", right: -2, bottom: -2, width: 54, height: 34, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  sportBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1.5 },
  outlineButton: { minHeight: 44, borderRadius: 9, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outlineButtonText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  pushBox: { borderRadius: 10, flexDirection: "row", gap: 16, padding: 18, marginTop: 20 },
  pushText: { fontSize: 15, lineHeight: 23, fontFamily: "Inter_400Regular" },
  recalculateBtn: { alignSelf: "flex-end", minHeight: 48, borderRadius: 9, borderWidth: 1.5, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, padding: 14 },
  inlineInput: { borderRadius: 6, borderWidth: 1, padding: 6, fontSize: 13, width: 80 },
  btnTiny: { borderRadius: 6, padding: 6, alignItems: "center", justifyContent: "center" },
});
