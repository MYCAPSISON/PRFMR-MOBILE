import React, { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { ReadinessCard } from "@/components/ReadinessCard";
import { StatCard } from "@/components/StatCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = today();

  const { data: readiness, isLoading: loadingReadiness, refetch: refetchReadiness } = useQuery({
    queryKey: ["readiness", todayStr],
    queryFn: () => apiFetch<{ score: number; details?: Record<string, number>; label?: string }>(`/me/readiness/${todayStr}`),
  });

  const { data: food, isLoading: loadingFood, refetch: refetchFood } = useQuery({
    queryKey: ["food", todayStr],
    queryFn: () => apiFetch<{ entries: { calories: number; protein: number; carbs: number; fat: number }[]; totals?: { calories: number; protein: number; carbs: number; fat: number } }>(`/me/food/${todayStr}`),
  });

  const { data: weightCut, isLoading: loadingWC, refetch: refetchWC } = useQuery({
    queryKey: ["weightCut"],
    queryFn: () => apiFetch<{ currentWeight?: number; targetWeight?: number; fightDate?: string; daysOut?: number; dailyCalorieTarget?: number }>("/me/weight-cut"),
  });

  const { data: training, isLoading: loadingTraining, refetch: refetchTraining } = useQuery({
    queryKey: ["trainingLoad"],
    queryFn: () => apiFetch<{ acwr?: number; weeklyLoad?: number; trend?: string }>("/me/training/load"),
  });

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetchReadiness(), refetchFood(), refetchWC(), refetchTraining()]);
    setRefreshing(false);
  }

  const totals = food?.totals ?? food?.entries?.reduce(
    (acc, e) => ({ calories: acc.calories + (e.calories ?? 0), protein: acc.protein + (e.protein ?? 0), carbs: acc.carbs + (e.carbs ?? 0), fat: acc.fat + (e.fat ?? 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  ) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const topPad = Platform.OS === "web" ? Math.max(insets.top + 67, 100) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 100 + bottomPad, paddingHorizontal: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {getGreeting()}, {user?.username ?? "Athlete"}
          </Text>
          <Text style={[styles.dateText, { color: colors.foreground }]}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={logout}
          style={[styles.logoutBtn, { borderColor: colors.border }]}
        >
          <Feather name="log-out" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {loadingReadiness ? (
        <SkeletonCard />
      ) : readiness ? (
        <ReadinessCard score={readiness.score} label={readiness.label} details={readiness.details} />
      ) : (
        <View style={[styles.noData, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
          <Feather name="activity" size={20} color={colors.mutedForeground} />
          <Text style={[styles.noDataText, { color: colors.mutedForeground }]}>Complete a morning check-in for readiness</Text>
        </View>
      )}

      <SectionHeader title="Today's Nutrition" onPress={() => router.push("/(tabs)/nutrition")} colors={colors} />
      {loadingFood ? (
        <SkeletonCard />
      ) : (
        <View style={styles.statRow}>
          <StatCard label="Calories" value={totals.calories} unit="kcal" accent />
          <StatCard label="Protein" value={totals.protein} unit="g" />
        </View>
      )}

      <SectionHeader title="Weight Cut" onPress={() => router.push("/(tabs)/weightcut")} colors={colors} />
      {loadingWC ? (
        <SkeletonCard />
      ) : weightCut ? (
        <View style={styles.statRow}>
          <StatCard label="Current" value={weightCut.currentWeight ?? "—"} unit="kg" />
          <StatCard label="Target" value={weightCut.targetWeight ?? "—"} unit="kg" accent />
          {weightCut.daysOut != null && <StatCard label="Days Out" value={weightCut.daysOut} />}
        </View>
      ) : (
        <EmptyCard icon="trending-down" text="Set up your weight cut plan" onPress={() => router.push("/(tabs)/weightcut")} colors={colors} />
      )}

      <SectionHeader title="Training Load" onPress={() => router.push("/(tabs)/training")} colors={colors} />
      {loadingTraining ? (
        <SkeletonCard />
      ) : training ? (
        <View style={styles.statRow}>
          <StatCard label="ACWR" value={training.acwr?.toFixed(2) ?? "—"} accent={!!training.acwr && training.acwr > 1.3} />
          <StatCard label="Weekly Load" value={training.weeklyLoad ?? "—"} />
          {training.trend && <StatCard label="Trend" value={training.trend} />}
        </View>
      ) : (
        <EmptyCard icon="zap" text="Log sessions to track load" onPress={() => router.push("/(tabs)/training")} colors={colors} />
      )}

      <View style={styles.quickActions}>
        <QuickAction icon="plus-circle" label="Log Food" onPress={() => router.push("/(tabs)/nutrition")} colors={colors} />
        <QuickAction icon="activity" label="Log Workout" onPress={() => router.push("/(tabs)/training")} colors={colors} />
        <QuickAction icon="bar-chart-2" label="Log Weight" onPress={() => router.push("/(tabs)/weightcut")} colors={colors} />
        <QuickAction icon="package" label="Supplements" onPress={() => router.push("/(tabs)/supplements")} colors={colors} />
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title, onPress, colors }: { title: string; onPress?: () => void; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {onPress && (
        <TouchableOpacity onPress={onPress}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyCard({ icon, text, onPress, colors }: { icon: string; text: string; onPress?: () => void; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
    >
      <Feather name={icon as never} size={18} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
      {onPress && <Feather name="chevron-right" size={16} color={colors.primary} />}
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, onPress, colors }: { icon: string; label: string; onPress: () => void; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
      activeOpacity={0.7}
    >
      <Feather name={icon as never} size={22} color={colors.primary} />
      <Text style={[styles.quickLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  logoutBtn: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  noData: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 4,
  },
  noDataText: {
    fontSize: 13,
    flex: 1,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 4,
  },
  emptyText: {
    flex: 1,
    fontSize: 13,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 24,
  },
  quickAction: {
    width: "47%",
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
});
