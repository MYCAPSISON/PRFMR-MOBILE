import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface ReadinessComponent {
  name: string;
  score: number;
  maxPoints: number;
  detail: string;
}

interface ProvisionalReadiness {
  score: number;
  label: string;
  feelScore: number;
  fuelScore: number;
  intensityScore: number;
  message: string;
  suggestedFix: string;
}

interface ReadinessData {
  total: number;
  label: "High" | "Moderate" | "Low" | "Poor" | "Provisional";
  primaryLimiter: string;
  suggestedFix: string;
  components: ReadinessComponent[];
  incomplete: boolean;
  provisional: boolean;
  missingData: string[];
  crossSignal: string | null;
  date: string;
  plannedIntensity: string;
  hasPlannedTraining: boolean;
  hasYesterdayFood: boolean;
  hasYesterdayTraining: boolean;
  bodyweightSource: string | null;
  bodyweightKg: number | null;
  checkin: unknown;
  provisionalReadiness: ProvisionalReadiness | null;
  loadWarnings: string[];
  backToBackHardDays: boolean;
  highLoadCluster: boolean;
  threeDayStreak: boolean;
  yesterdayTrainingDemand: string | null;
}

interface ProvisionalFuel {
  fuelStatus: "Adequate" | "Low";
  fuelRisk: "Low" | "Elevated" | "Unclear";
  message: string;
  suggestedFix: string;
}

interface FuelData {
  fuelStatus: "High" | "Adequate" | "Low";
  glycogenRisk: "Low" | "Moderate" | "High";
  constraint: string;
  suggestedFix: string;
  eaValue: number | null;
  carbsPerKg: number | null;
  ffmKg: number | null;
  date: string;
  plannedIntensity: string;
  hasPlannedTraining: boolean;
  bodyweightSource: string | null;
  bodyweightKg: number | null;
  provisional: boolean;
  hasYesterdayFood: boolean;
  hasYesterdayTraining: boolean;
  checkin: unknown;
  provisionalFuel: ProvisionalFuel | null;
  fuelLoadWarning: string | null;
  backToBackHardDays: boolean;
  highLoadCluster: boolean;
  threeDayStreak: boolean;
  yesterdayTrainingDemand: string | null;
}

// ─────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────
function readinessBadgeColors(label: string): { text: string; bg: string; border: string } {
  switch (label) {
    case "High":        return { text: "#4ade80", bg: "rgba(74,222,128,0.1)",    border: "rgba(74,222,128,0.3)" };
    case "Moderate":    return { text: "#facc15", bg: "rgba(250,204,21,0.1)",    border: "rgba(250,204,21,0.3)" };
    case "Low":         return { text: "#fb923c", bg: "rgba(251,146,60,0.1)",    border: "rgba(251,146,60,0.3)" };
    case "Poor":        return { text: "#f87171", bg: "rgba(248,113,113,0.1)",   border: "rgba(248,113,113,0.3)" };
    default:            return { text: "#93c5fd", bg: "rgba(147,197,253,0.1)",   border: "rgba(147,197,253,0.3)" };
  }
}

function readinessBarColor(label: string): string {
  switch (label) {
    case "High":     return "#4ade80";
    case "Moderate": return "#facc15";
    case "Low":      return "#fb923c";
    case "Poor":     return "#f87171";
    default:         return "#93c5fd";
  }
}

function fuelBadgeColors(status: string): { text: string; bg: string; border: string } {
  if (status === "Low") return { text: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" };
  return { text: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.3)" };
}

function glycogenBadgeColors(risk: string): { text: string; bg: string; border: string } {
  switch (risk) {
    case "Low":      return { text: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)" };
    case "Moderate": return { text: "#facc15", bg: "rgba(250,204,21,0.1)",  border: "rgba(250,204,21,0.3)" };
    case "High":     return { text: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)" };
    default:         return { text: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.3)" };
  }
}

function fuelRiskBadgeColors(risk: string): { text: string; bg: string; border: string } {
  switch (risk) {
    case "Low":      return { text: "#4ade80", bg: "rgba(74,222,128,0.1)",  border: "rgba(74,222,128,0.3)" };
    case "Elevated": return { text: "#facc15", bg: "rgba(250,204,21,0.1)",  border: "rgba(250,204,21,0.3)" };
    default:         return { text: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.3)" };
  }
}

// ─────────────────────────────────────────
// Badge
// ─────────────────────────────────────────
function Badge({ label, colors: c }: { label: string; colors: { text: string; bg: string; border: string } }) {
  return (
    <View style={[s.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[s.badgeText, { color: c.text }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────
export default function ReadinessDetailScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const colors = useColors();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: readiness, isLoading: rLoading } = useQuery<ReadinessData>({
    queryKey: ["readiness", date],
    queryFn: () => apiFetch(`/me/readiness/${date}`),
    enabled: !!date,
  });

  const { data: fuel, isLoading: fLoading } = useQuery<FuelData>({
    queryKey: ["fuel", date],
    queryFn: () => apiFetch(`/me/fuel/${date}`),
    enabled: !!date,
  });

  const dateLabel = date ? format(parseISO(date + "T12:00:00"), "EEEE, MMMM d") : "";

  // Readiness display values (§7.7)
  const pr = readiness?.provisionalReadiness ?? null;
  const isProvR = !!(readiness?.provisional);
  const displayScore   = isProvR && pr ? pr.score        : (readiness?.total ?? 0);
  const displayLabel   = isProvR && pr ? pr.label        : (readiness?.label ?? "Provisional");
  const displayLimiter = isProvR && pr ? pr.message      : (readiness?.primaryLimiter ?? "");
  const displayFix     = isProvR && pr ? pr.suggestedFix : (readiness?.suggestedFix ?? "");
  const rBadge = readinessBadgeColors(displayLabel);
  const scoreText = isProvR && pr ? `~${displayScore}` : String(displayScore);

  // Fuel display values (§8.4)
  const isProvFWithCheckin = !!(fuel?.provisional && fuel?.provisionalFuel);
  const displayFuelStatus = isProvFWithCheckin ? fuel!.provisionalFuel!.fuelStatus : (fuel?.fuelStatus ?? "Adequate");
  const displayFuelFix    = isProvFWithCheckin ? fuel!.provisionalFuel!.suggestedFix : (fuel?.suggestedFix ?? "");
  const showObjectiveWarn = !!(fuel && !fuel.provisional && (fuel.fuelStatus === "Low" || fuel.glycogenRisk === "High"));

  if (rLoading && fLoading) {
    return (
      <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Session Readiness</Text>
          <Text style={[s.headerSub, { color: colors.mutedForeground }]} numberOfLines={2}>
            Your readiness and fuel status for {dateLabel}
          </Text>
        </View>
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Session Readiness Card ── */}
        {readiness && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header row */}
            <View style={s.rowBetween}>
              <View style={s.row}>
                <Feather name="zap" size={16} color={colors.primary} />
                <Text style={[s.cardTitle, { color: colors.foreground, marginLeft: 8 }]}>Session Readiness</Text>
              </View>
              <Badge label={`${scoreText} — ${displayLabel}`} colors={rBadge} />
            </View>

            {/* Progress bar */}
            <View style={[s.progBg, { marginTop: 12 }]}>
              <View style={[s.progFill, {
                width: `${Math.min(displayScore, 100)}%` as any,
                backgroundColor: readinessBarColor(displayLabel),
              }]} />
            </View>

            {/* Provisional notice */}
            {isProvR && (
              <View style={[s.infoBox, { marginTop: 10 }]}>
                <Feather name="info" size={13} color="#93c5fd" />
                <Text style={[s.infoText, { color: "#93c5fd" }]}>
                  {"  "}Sleep not logged — showing estimated readiness from check-in
                </Text>
              </View>
            )}

            {/* Primary limiter row */}
            {!!displayLimiter && (
              <View style={[s.row, { marginTop: 12, alignItems: "flex-start" }]}>
                <Feather name="zap" size={13} color={colors.foreground} style={{ marginTop: 1 }} />
                <Text style={[s.limiterText, { color: colors.foreground, marginLeft: 6, flex: 1 }]}>
                  {displayLimiter}
                </Text>
              </View>
            )}

            {/* Suggested fix */}
            {!!displayFix && (
              <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 4, marginLeft: 19, lineHeight: 17 }]}>
                {displayFix}
              </Text>
            )}

            {/* Cross signal — amber */}
            {!isProvR && !!readiness.crossSignal && (
              <Text style={[s.xs, { color: "#fb923c", fontWeight: "600", marginTop: 6 }]}>
                {readiness.crossSignal}
              </Text>
            )}

            {/* Load stacking warning — orange */}
            {!isProvR && (readiness.backToBackHardDays || readiness.highLoadCluster || readiness.threeDayStreak) && (
              <Text style={[s.xs, { color: "#fb923c", fontWeight: "600", marginTop: 6 }]}>
                {readiness.threeDayStreak
                  ? "Three consecutive high-load days — consider recovery support"
                  : readiness.highLoadCluster
                  ? "Training load is clustering across consecutive days"
                  : "Back-to-back hard training days — recovery demand is elevated"}
              </Text>
            )}

            {/* No planned training */}
            {!readiness.hasPlannedTraining && (
              <Text style={[s.xs, { color: colors.mutedForeground, fontStyle: "italic", marginTop: 6 }]}>
                No training session planned — using moderate defaults
              </Text>
            )}

            {/* Collapsible details trigger */}
            <TouchableOpacity
              style={[s.row, { marginTop: 14 }]}
              onPress={() => setDetailsOpen(v => !v)}
              activeOpacity={0.7}
            >
              <Text style={[s.xs, { color: colors.mutedForeground }]}>
                {detailsOpen ? "∧" : "∨"}{"  "}Details
              </Text>
            </TouchableOpacity>

            {/* Details content */}
            {detailsOpen && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {isProvR && pr ? (
                  // Provisional sub-scores
                  <>
                    <View style={s.rowBetween}>
                      <Text style={[s.xs, { color: colors.mutedForeground }]}>Wellness</Text>
                      <Text style={[s.xs, { color: colors.foreground, fontWeight: "700" }]}>{pr.feelScore} pts</Text>
                    </View>
                    <View style={s.rowBetween}>
                      <Text style={[s.xs, { color: colors.mutedForeground }]}>Perceived fueling</Text>
                      <Text style={[s.xs, { color: colors.foreground, fontWeight: "700" }]}>{pr.fuelScore} pts</Text>
                    </View>
                    <View style={s.rowBetween}>
                      <Text style={[s.xs, { color: colors.mutedForeground }]}>Session demand</Text>
                      <Text style={[s.xs, { color: colors.foreground, fontWeight: "700" }]}>{pr.intensityScore} pts</Text>
                    </View>
                  </>
                ) : (
                  // Objective component breakdown
                  <>
                    {readiness.components.map(c => (
                      <View key={c.name} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                        <View style={s.rowBetween}>
                          <Text style={[s.xs, { color: colors.foreground, fontWeight: "700" }]}>{c.name}</Text>
                          <Text style={[s.xs, { color: colors.mutedForeground }]}>{c.score}/{c.maxPoints}</Text>
                        </View>
                        {!!c.detail && (
                          <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 2 }]}>{c.detail}</Text>
                        )}
                      </View>
                    ))}
                    {readiness.bodyweightKg !== null && readiness.bodyweightSource && (
                      <Text style={[s.xs, { color: colors.mutedForeground, fontStyle: "italic", marginTop: 4 }]}>
                        Weight: {readiness.bodyweightKg.toFixed(1)} kg ({readiness.bodyweightSource})
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Fuel Status Card ── */}
        {fuel && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header row */}
            <View style={s.rowBetween}>
              <View style={s.row}>
                <Feather name="droplet" size={16} color="#f59e0b" />
                <Text style={[s.cardTitle, { color: colors.foreground, marginLeft: 8 }]}>Fuel Status</Text>
              </View>
              {fuel.provisional && !fuel.provisionalFuel
                ? <Badge label="Provisional" colors={{ text: "#93c5fd", bg: "rgba(147,197,253,0.1)", border: "rgba(147,197,253,0.3)" }} />
                : <Badge label={displayFuelStatus} colors={fuelBadgeColors(displayFuelStatus)} />
              }
            </View>

            {/* Glycogen Risk row (objective) */}
            {!fuel.provisional && (
              <View style={[s.rowBetween, { marginTop: 10 }]}>
                <Text style={[s.xs, { color: colors.mutedForeground }]}>Glycogen Risk</Text>
                <Badge label={fuel.glycogenRisk} colors={glycogenBadgeColors(fuel.glycogenRisk)} />
              </View>
            )}

            {/* Fuel Availability Risk row (provisional with checkin) */}
            {fuel.provisional && fuel.provisionalFuel && (
              <View style={[s.rowBetween, { marginTop: 10 }]}>
                <Text style={[s.xs, { color: colors.mutedForeground }]}>Fuel Availability Risk</Text>
                <Badge label={fuel.provisionalFuel.fuelRisk} colors={fuelRiskBadgeColors(fuel.provisionalFuel.fuelRisk)} />
              </View>
            )}

            {/* Provisional notice */}
            {fuel.provisional && (
              <View style={[s.infoBox, { marginTop: 10 }]}>
                <Feather name="info" size={13} color="#93c5fd" />
                <Text style={[s.infoText, { color: "#93c5fd" }]}>
                  {"  "}Yesterday's food not logged — fuel status is estimated
                </Text>
              </View>
            )}

            {/* Objective constraint warning */}
            {showObjectiveWarn && (
              <View style={[s.row, { marginTop: 10, alignItems: "flex-start" }]}>
                <Feather name="alert-triangle" size={13} color="#fb923c" style={{ marginTop: 1 }} />
                <Text style={[s.xs, { color: "#fb923c", marginLeft: 6, flex: 1 }]}>{fuel.constraint}</Text>
              </View>
            )}

            {/* Fuel load warning */}
            {!fuel.provisional && !!fuel.fuelLoadWarning && (
              <Text style={[s.xs, { color: "#fb923c", fontWeight: "600", marginTop: 6 }]}>
                {fuel.fuelLoadWarning}
              </Text>
            )}

            {/* Suggested fix */}
            {!!displayFuelFix && (
              <View style={[s.row, { marginTop: 10, alignItems: "flex-start" }]}>
                <Feather name="zap" size={13} color={colors.foreground} style={{ marginTop: 1 }} />
                <Text style={[s.xs, { color: colors.foreground, marginLeft: 6, flex: 1 }]}>{displayFuelFix}</Text>
              </View>
            )}

            {/* Footer metrics row */}
            {!fuel.provisional && fuel.eaValue !== null && fuel.carbsPerKg !== null && (
              <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 12, fontStyle: "italic" }]}>
                EA: {fuel.eaValue} kcal/kg{"   "}Carbs: {fuel.carbsPerKg} g/kg{"   "}Intensity: {fuel.plannedIntensity}
              </Text>
            )}
          </View>
        )}

        {/* ── Footer disclaimer ── */}
        <Text style={[s.xs, { color: colors.mutedForeground, textAlign: "center", fontStyle: "italic", paddingHorizontal: 16 }]}>
          Scores are estimates based on logged food, sleep, and training
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const s = StyleSheet.create({
  flex:       { flex: 1 },
  header:     { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:    { paddingTop: 3 },
  headerTitle:{ fontSize: 20, fontWeight: "800" },
  headerSub:  { fontSize: 13, marginTop: 3, lineHeight: 18 },
  scroll:     { padding: 12, gap: 10 },
  card:       { borderRadius: 12, borderWidth: 1, padding: 14 },
  row:        { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle:  { fontSize: 15, fontWeight: "700" },
  badge:      { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:  { fontSize: 12, fontWeight: "700" },
  xs:         { fontSize: 12, fontWeight: "500" },
  progBg:     { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" },
  progFill:   { height: 6, borderRadius: 3 },
  infoBox:    { flexDirection: "row", alignItems: "flex-start", borderRadius: 8, borderWidth: 1,
                borderColor: "rgba(147,197,253,0.2)", backgroundColor: "rgba(147,197,253,0.08)", padding: 10 },
  infoText:   { fontSize: 12, flex: 1, lineHeight: 17 },
  limiterText:{ fontSize: 13, fontWeight: "600" },
});
