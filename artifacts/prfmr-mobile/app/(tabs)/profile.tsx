import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { format } from "date-fns";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface UserProfile {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  weight: number | null;
  height: number | null;
  age: number | null;
  sport: string | null;
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
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current?.toString() ?? "");

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
        onPress={() => { const n = parseFloat(val); if (!isNaN(n)) { onSave(n / 100); setEditing(false); } }}>
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

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>Profile</Text>
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Identity Card */}
        <Card>
          <View style={[s.row, { alignItems: "flex-start", gap: 14 }]}>
            <Avatar username={user.username} />
            <View style={{ flex: 1 }}>
              <Text style={[s.lg, { color: colors.foreground }]}>{displayName}</Text>
              <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 2 }]}>@{user.username}</Text>
              <View style={[s.row, { marginTop: 8, flexWrap: "wrap", gap: 6 }]}>
                {user.activityLevel && (
                  <View style={[s.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[s.xs, { color: colors.mutedForeground }]}>
                      {ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel}
                    </Text>
                  </View>
                )}
                {user.goalType && (
                  <View style={[s.badge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[s.xs, { color: colors.mutedForeground }]}>
                      {GOAL_LABELS[user.goalType] ?? user.goalType}
                    </Text>
                  </View>
                )}
                {fightCampActive && (
                  <View style={[s.badge, { backgroundColor: "rgba(255,122,0,0.1)", borderColor: "rgba(255,122,0,0.3)" }]}>
                    <Feather name="target" size={10} color={colors.primary} />
                    <Text style={[s.xs, { color: colors.primary, marginLeft: 4, fontWeight: "700" }]}>
                      Fight Camp · {weightCutPlan!.daysUntil}d
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Card>

        {/* Current Metrics */}
        <Card>
          <Text style={[s.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Current Metrics</Text>
          <MetricRow label="Height" value={user.height ? `${user.height} cm` : null} />
          <MetricRow label="Weight" value={user.weight ? `${user.weight} kg` : null} />
          <MetricRow label="Age" value={user.age} />
          <MetricRow label="Activity Level" value={user.activityLevel ? ACTIVITY_LABELS[user.activityLevel] : null} />
          <View style={[s.metricRow, { borderColor: colors.border }]}>
            <Text style={[s.xs, { color: colors.mutedForeground }]}>Body Fat %</Text>
            <BodyFatEditor
              current={user.bodyFatPct}
              onSave={(v) => bodyFatMut.mutate(v)}
            />
          </View>
          {user.sport && <MetricRow label="Sport" value={user.sport} />}
          {user.weightClass && <MetricRow label="Weight Class" value={user.weightClass} />}
        </Card>

        {/* Nutrition Targets */}
        {targets && (
          <Card>
            <Text style={[s.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Nutrition Targets</Text>
            <MacroRow label="Calories" value={targets.adjustedCalories || targets.targetCalories} unit="kcal" color={colors.primary} />
            <MacroRow label="Protein" value={targets.targetProtein} unit="g" color="#93c5fd" />
            <MacroRow label="Carbs" value={targets.targetCarbs} unit="g" color="#f59e0b" />
            <MacroRow label="Fat" value={targets.targetFat} unit="g" color="#facc15" />
          </Card>
        )}

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

        {/* Account */}
        <Card>
          <Text style={[s.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Account</Text>
          <MetricRow label="Email" value={user.email} />
          <MetricRow label="Username" value={`@${user.username}`} />
        </Card>

        {/* Sign Out */}
        <TouchableOpacity
          style={[s.signOutBtn, { borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.06)" }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={16} color="#f87171" />
          <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 14, marginLeft: 8 }}>Sign Out</Text>
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
  scrollPad: { padding: 12, gap: 10 },
  card: { borderRadius: 9, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center" },
  badge: { flexDirection: "row", alignItems: "center", borderRadius: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  lg: { fontSize: 18, fontWeight: "800" },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingVertical: 10 },
  avatar: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, padding: 14 },
  inlineInput: { borderRadius: 6, borderWidth: 1, padding: 6, fontSize: 13, width: 80 },
  btnTiny: { borderRadius: 6, padding: 6, alignItems: "center", justifyContent: "center" },
});
