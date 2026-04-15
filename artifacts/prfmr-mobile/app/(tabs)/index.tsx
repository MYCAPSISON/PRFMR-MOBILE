import React, { useState, useCallback } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import Svg, { Circle } from "react-native-svg";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(d: string) {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function addDays(d: string, n: number) {
  const date = new Date(d + "T12:00:00");
  date.setDate(date.getDate() + n);
  return date.toISOString().split("T")[0];
}

function MacroRing({ eaten, target, color, size = 56 }: { eaten: number; target: number; color: string; size?: number }) {
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#252d3a" strokeWidth={6} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={6} fill="none"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [refreshing, setRefreshing] = useState(false);
  const isToday = selectedDate === todayStr();

  const { data: targets, isLoading: targetsLoading } = useQuery({
    queryKey: ["/api/me/targets/effective", selectedDate],
    queryFn: () => apiFetch<any>(`/me/targets/effective?date=${selectedDate}`),
  });

  const { data: food = [] } = useQuery({
    queryKey: ["/api/me/food", selectedDate],
    queryFn: () => apiFetch<any[]>(`/me/food/${selectedDate}`),
  });

  const { data: trainingSummary } = useQuery({
    queryKey: ["/api/me/training/summary", selectedDate],
    queryFn: () => apiFetch<any>(`/me/training/summary/${selectedDate}`),
  });

  const { data: readiness } = useQuery({
    queryKey: ["/api/me/readiness", selectedDate],
    queryFn: () => apiFetch<any>(`/me/readiness/${selectedDate}`),
  });

  const { data: amqs } = useQuery({
    queryKey: ["/api/me/amqs/score", selectedDate],
    queryFn: () => apiFetch<any>(`/me/amqs/score/${selectedDate}`),
  });

  const { data: stacks = [] } = useQuery({
    queryKey: ["/api/me/stacks/scheduled", selectedDate],
    queryFn: () => apiFetch<any[]>(`/me/stacks/scheduled?date=${selectedDate}`),
  });

  const { data: intakes = [] } = useQuery({
    queryKey: ["/api/me/supplement-intakes", selectedDate],
    queryFn: () => apiFetch<any[]>(`/me/supplement-intakes/${selectedDate}`),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  }, [qc]);

  const caloriesEaten = food.reduce((s: number, e: any) => s + (e.calories || 0), 0);
  const proteinEaten = food.reduce((s: number, e: any) => s + (e.protein || 0), 0);
  const carbsEaten = food.reduce((s: number, e: any) => s + (e.carbs || 0), 0);
  const fatEaten = food.reduce((s: number, e: any) => s + (e.fat || 0), 0);

  const targetCal = targets?.adjustedCalories ?? targets?.targetCalories ?? 2000;
  const targetProt = targets?.targetProtein ?? 150;
  const targetCarbs = targets?.targetCarbs ?? 200;
  const targetFat = targets?.targetFat ?? 70;

  const calPct = Math.min(caloriesEaten / targetCal, 1);
  const calRemaining = Math.max(targetCal - caloriesEaten, 0);

  const readinessScore = readiness?.score ?? null;
  const readinessLabel = readiness?.label ?? "No data";

  const readinessColor =
    readinessScore === null ? colors.mutedForeground :
    readinessScore >= 75 ? colors.success :
    readinessScore >= 50 ? colors.warning :
    colors.destructive;

  const takenSet = new Set(
    intakes.filter((i: any) => i.taken).map((i: any) => `${i.stackId ?? 0}-${i.reminderId ?? 0}-${i.supplementId}`)
  );

  const uniqueSupplements = Array.from(
    new Map(stacks.map((s: any) => [s.supplementId, s])).values()
  ).slice(0, 4);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting},</Text>
          <Text style={[styles.username, { color: colors.foreground }]}>{user?.username ?? "Athlete"}</Text>
        </View>
        <View style={[styles.amqsBadge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
          <Text style={[styles.amqsValue, { color: colors.primary }]}>{amqs?.score ?? "--"}</Text>
          <Text style={[styles.amqsLabel, { color: colors.primary }]}>AMQS</Text>
        </View>
      </View>

      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => setSelectedDate(d => addDays(d, -1))} style={styles.navBtn}>
          <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.dateText, { color: colors.foreground }]}>
          {isToday ? "Today" : formatDate(selectedDate)}
        </Text>
        <TouchableOpacity
          onPress={() => setSelectedDate(d => addDays(d, 1))}
          style={[styles.navBtn, { opacity: isToday ? 0.3 : 1 }]}
          disabled={isToday}
        >
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {readiness && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.readinessRow}>
            <View>
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>READINESS</Text>
              <Text style={[styles.readinessScore, { color: readinessColor }]}>
                {readinessScore !== null ? `${readinessScore}` : "--"}
              </Text>
              <Text style={[styles.readinessLabel, { color: readinessColor }]}>{readinessLabel}</Text>
            </View>
            <View style={styles.readinessComponents}>
              {readiness.components && Object.entries(readiness.components).slice(0, 3).map(([k, v]: [string, any]) => (
                <View key={k} style={styles.componentRow}>
                  <Text style={[styles.componentLabel, { color: colors.mutedForeground }]}>{k.replace(/([A-Z])/g, ' $1').trim()}</Text>
                  <Text style={[styles.componentValue, { color: colors.foreground }]}>{typeof v === 'number' ? v : '--'}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>CALORIES</Text>
        {targetsLoading ? (
          <View style={[styles.skeleton, { backgroundColor: colors.secondary }]} />
        ) : (
          <View style={styles.calorieRow}>
            <View style={styles.calorieRing}>
              <Svg width={100} height={100}>
                <Circle cx={50} cy={50} r={42} stroke={colors.secondary} strokeWidth={8} fill="none" />
                <Circle
                  cx={50} cy={50} r={42}
                  stroke={colors.primary} strokeWidth={8} fill="none"
                  strokeDasharray={`${calPct * 263.9} ${263.9 - calPct * 263.9}`}
                  strokeDashoffset={65.97}
                  strokeLinecap="round"
                />
              </Svg>
              <View style={styles.ringInner}>
                <Text style={[styles.ringValue, { color: colors.foreground }]}>{caloriesEaten}</Text>
                <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>eaten</Text>
              </View>
            </View>
            <View style={styles.calStats}>
              <View style={styles.calStat}>
                <Text style={[styles.calStatLabel, { color: colors.mutedForeground }]}>Target</Text>
                <Text style={[styles.calStatValue, { color: colors.foreground }]}>{targetCal} kcal</Text>
              </View>
              <View style={styles.calStat}>
                <Text style={[styles.calStatLabel, { color: colors.mutedForeground }]}>Remaining</Text>
                <Text style={[styles.calStatValue, { color: calRemaining > 0 ? colors.success : colors.destructive }]}>{calRemaining} kcal</Text>
              </View>
              {trainingSummary?.totalCaloriesBurned > 0 && (
                <View style={styles.calStat}>
                  <Text style={[styles.calStatLabel, { color: colors.mutedForeground }]}>Training</Text>
                  <Text style={[styles.calStatValue, { color: colors.warning }]}>+{trainingSummary.totalCaloriesBurned} kcal</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.macroRow}>
          {[
            { label: "Protein", eaten: proteinEaten, target: targetProt, color: colors.info },
            { label: "Carbs", eaten: carbsEaten, target: targetCarbs, color: colors.warning },
            { label: "Fat", eaten: fatEaten, target: targetFat, color: colors.primary },
          ].map(m => (
            <View key={m.label} style={styles.macroItem}>
              <MacroRing eaten={m.eaten} target={m.target} color={m.color} />
              <Text style={[styles.macroLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
              <Text style={[styles.macroValue, { color: colors.foreground }]}>{m.eaten}g</Text>
              <Text style={[styles.macroTarget, { color: colors.mutedForeground }]}>/{m.target}g</Text>
            </View>
          ))}
        </View>
      </View>

      {trainingSummary && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>TRAINING TODAY</Text>
          <View style={styles.trainingRow}>
            <View style={styles.trainingStat}>
              <Text style={[styles.trainingValue, { color: colors.foreground }]}>{trainingSummary.sessionCount ?? 0}</Text>
              <Text style={[styles.trainingStatLabel, { color: colors.mutedForeground }]}>Sessions</Text>
            </View>
            <View style={styles.trainingStat}>
              <Text style={[styles.trainingValue, { color: colors.foreground }]}>{trainingSummary.totalCaloriesBurned ?? 0}</Text>
              <Text style={[styles.trainingStatLabel, { color: colors.mutedForeground }]}>Calories</Text>
            </View>
            <View style={styles.trainingStat}>
              <Text style={[styles.trainingValue, { color: colors.foreground }]}>{trainingSummary.totalVolume ?? 0}</Text>
              <Text style={[styles.trainingStatLabel, { color: colors.mutedForeground }]}>Volume</Text>
            </View>
          </View>
          {trainingSummary.acwr != null && (
            <View style={[styles.acwrBadge, {
              backgroundColor: trainingSummary.acwr > 1.3 ? colors.destructive + "22" :
                trainingSummary.acwr < 0.8 ? colors.warning + "22" : colors.success + "22"
            }]}>
              <Text style={[styles.acwrText, {
                color: trainingSummary.acwr > 1.3 ? colors.destructive :
                  trainingSummary.acwr < 0.8 ? colors.warning : colors.success
              }]}>
                ACWR {trainingSummary.acwr?.toFixed(2)} — {
                  trainingSummary.acwr > 1.3 ? "High Load" :
                  trainingSummary.acwr < 0.8 ? "Under-training" : "Optimal"
                }
              </Text>
            </View>
          )}
        </View>
      )}

      {uniqueSupplements.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>TODAY'S SUPPLEMENTS</Text>
          {uniqueSupplements.map((s: any) => {
            const key = `${s.stackId ?? 0}-${s.reminderId ?? 0}-${s.supplementId}`;
            const taken = takenSet.has(key);
            return (
              <TouchableOpacity
                key={key}
                onPress={() => router.push("/(tabs)/supplements")}
                style={[styles.suppRow, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.suppCheck, {
                  backgroundColor: taken ? colors.success + "22" : colors.secondary,
                  borderColor: taken ? colors.success : colors.border,
                }]}>
                  {taken && <Feather name="check" size={12} color={colors.success} />}
                </View>
                <View style={styles.suppInfo}>
                  <Text style={[styles.suppName, { color: colors.foreground }]}>{s.supplementName}</Text>
                  {s.doseAmount && <Text style={[styles.suppDose, { color: colors.mutedForeground }]}>{s.doseAmount} {s.doseUnit}</Text>}
                </View>
                <Text style={[styles.suppTime, { color: colors.mutedForeground }]}>{s.time}</Text>
              </TouchableOpacity>
            );
          })}
          {stacks.length > 4 && (
            <TouchableOpacity onPress={() => router.push("/(tabs)/supplements")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all {stacks.length} supplements →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.quickActions}>
        {[
          { icon: "plus-circle" as const, label: "Log Food", route: "/(tabs)/nutrition" as const },
          { icon: "activity" as const, label: "Log Training", route: "/(tabs)/training" as const },
          { icon: "trending-down" as const, label: "Weight Cut", route: "/(tabs)/weightcut" as const },
          { icon: "package" as const, label: "Supplements", route: "/(tabs)/supplements" as const },
        ].map(a => (
          <TouchableOpacity
            key={a.label}
            style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(a.route)}
          >
            <Feather name={a.icon} size={22} color={colors.primary} />
            <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  greeting: { fontSize: 13, letterSpacing: 0.5 },
  username: { fontSize: 24, fontWeight: "700" },
  amqsBadge: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  amqsValue: { fontSize: 20, fontWeight: "800" },
  amqsLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 4 },
  navBtn: { padding: 6 },
  dateText: { fontSize: 15, fontWeight: "600", minWidth: 160, textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  cardLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginBottom: 4 },
  skeleton: { height: 20, borderRadius: 6, width: "50%" },
  readinessRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  readinessScore: { fontSize: 48, fontWeight: "800", lineHeight: 52 },
  readinessLabel: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  readinessComponents: { flex: 1, gap: 6 },
  componentRow: { flexDirection: "row", justifyContent: "space-between" },
  componentLabel: { fontSize: 12, textTransform: "capitalize" },
  componentValue: { fontSize: 12, fontWeight: "600" },
  calorieRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  calorieRing: { alignItems: "center", justifyContent: "center" },
  ringInner: { position: "absolute", alignItems: "center" },
  ringValue: { fontSize: 18, fontWeight: "800" },
  ringLabel: { fontSize: 10 },
  calStats: { flex: 1, gap: 8 },
  calStat: {},
  calStatLabel: { fontSize: 11, letterSpacing: 0.5 },
  calStatValue: { fontSize: 16, fontWeight: "700" },
  macroRow: { flexDirection: "row", justifyContent: "space-around" },
  macroItem: { alignItems: "center", gap: 2 },
  macroLabel: { fontSize: 11, letterSpacing: 0.5 },
  macroValue: { fontSize: 13, fontWeight: "700" },
  macroTarget: { fontSize: 10 },
  trainingRow: { flexDirection: "row", justifyContent: "space-around" },
  trainingStat: { alignItems: "center" },
  trainingValue: { fontSize: 24, fontWeight: "800" },
  trainingStatLabel: { fontSize: 11, letterSpacing: 0.5 },
  acwrBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  acwrText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  suppRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  suppCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  suppInfo: { flex: 1 },
  suppName: { fontSize: 14, fontWeight: "600" },
  suppDose: { fontSize: 12 },
  suppTime: { fontSize: 12 },
  seeAll: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  quickActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  quickBtn: { flex: 1, minWidth: "45%", alignItems: "center", gap: 8, padding: 16, borderRadius: 14, borderWidth: 1 },
  quickLabel: { fontSize: 12, fontWeight: "600" },
});
