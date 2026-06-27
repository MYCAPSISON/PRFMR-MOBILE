import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { format, subDays, addDays } from "date-fns";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface NutrientBreakdown {
  pctL1: number;
  pctL2: number;
  intakeValue: number;
  l1Target: number;
  l2Target: number;
  unit: string;
}

interface AMQSScore {
  score: number;
  tier: "Elite" | "Optimal" | "Good" | "Fair" | "Basic";
  confidence: "Low" | "Medium" | "High";
  allMet: boolean;
  topGaps: { microKey: string; label: string; pctOfTarget: number; suggestion?: string }[];
  nutrients: Record<string, NutrientBreakdown>;
  totals: Record<string, number>;
  breakdown: {
    food: Record<string, number>;
    supplements: Record<string, number>;
  };
  coverageStats?: { totalTakenSupplements?: number };
}

// ─────────────────────────────────────────
// Nutrient display config (17 tracked)
// ─────────────────────────────────────────
const NUTRIENTS: { key: string; label: string; unit: string; l1: number; l2: number }[] = [
  { key: "vitamin_c_mg",   label: "Vitamin C",          unit: "mg",  l1: 90,   l2: 200  },
  { key: "vitamin_d_ug",   label: "Vitamin D",           unit: "mcg", l1: 20,   l2: 50   },
  { key: "vitamin_b12_ug", label: "Vitamin B12",         unit: "mcg", l1: 2.4,  l2: 4    },
  { key: "vitamin_b6_mg",  label: "Vitamin B6",          unit: "mg",  l1: 1.7,  l2: 3    },
  { key: "folate_ug",      label: "Folate",              unit: "mcg", l1: 400,  l2: 600  },
  { key: "vitamin_a_ug",   label: "Vitamin A",           unit: "mcg", l1: 900,  l2: 1200 },
  { key: "vitamin_b2_mg",  label: "Vitamin B2",          unit: "mg",  l1: 1.3,  l2: 2    },
  { key: "vitamin_b1_mg",  label: "Vitamin B1",          unit: "mg",  l1: 1.2,  l2: 2    },
  { key: "vitamin_b3_mg",  label: "Vitamin B3 (Niacin)", unit: "mg",  l1: 16,   l2: 25   },
  { key: "iron_mg",        label: "Iron",                unit: "mg",  l1: 8,    l2: 12   },
  { key: "calcium_mg",     label: "Calcium",             unit: "mg",  l1: 1000, l2: 1300 },
  { key: "magnesium_mg",   label: "Magnesium",           unit: "mg",  l1: 420,  l2: 500  },
  { key: "zinc_mg",        label: "Zinc",                unit: "mg",  l1: 11,   l2: 14   },
  { key: "potassium_mg",   label: "Potassium",           unit: "mg",  l1: 3500, l2: 4700 },
  { key: "iodine_ug",      label: "Iodine",              unit: "mcg", l1: 150,  l2: 200  },
  { key: "omega3_g",       label: "Omega-3",             unit: "g",   l1: 1.1,  l2: 3    },
  { key: "selenium_ug",    label: "Selenium",            unit: "mcg", l1: 55,   l2: 70   },
];

const CRITICAL_KEYS = ["iron_mg", "calcium_mg", "vitamin_d_ug", "magnesium_mg", "zinc_mg", "omega3_g"];

const TIER_COLOR: Record<string, string> = {
  Elite:   "#10b981",
  Optimal: "#10b981",
  Good:    "#3b82f6",
  Fair:    "#eab308",
  Basic:   "#ef4444",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  High:   "#10b981",
  Medium: "#eab308",
  Low:    "#ef4444",
};

function fmt(val: number, unit: string) {
  if (val >= 1000 && unit === "mg") return `${(val / 1000).toFixed(1)}g`;
  if (val < 10) return val.toFixed(1);
  return Math.round(val).toString();
}

// ─────────────────────────────────────────
// NutrientCard
// ─────────────────────────────────────────
function NutrientCard({ nutrient, data, totals }: {
  nutrient: typeof NUTRIENTS[0];
  data?: NutrientBreakdown;
  totals: Record<string, number>;
}) {
  const colors = useColors();
  const intake = totals[nutrient.key] ?? 0;
  const pctL1 = Math.min(100, (intake / nutrient.l1) * 100);
  const pctL2 = intake >= nutrient.l1 ? Math.min(100, ((intake - nutrient.l1) / (nutrient.l2 - nutrient.l1)) * 100) : 0;
  const isCritical = CRITICAL_KEYS.includes(nutrient.key);

  const barColor = pctL1 >= 100 ? (pctL2 >= 100 ? "#10b981" : "#3b82f6") : "#ff7a00";

  return (
    <View style={[s.nutrientCard, { backgroundColor: colors.card, borderColor: isCritical ? colors.border + "80" : colors.border }]}>
      <View style={s.nutrientHeader}>
        <Text style={[s.nutrientLabel, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]} numberOfLines={1}>
          {nutrient.label}
        </Text>
        {isCritical && (
          <View style={[s.critBadge, { backgroundColor: "rgba(255,122,0,0.1)" }]}>
            <Text style={{ fontSize: 9, color: colors.primary, fontFamily: colors.fonts.sansSb }}>KEY</Text>
          </View>
        )}
      </View>

      <Text style={[s.nutrientValue, { color: colors.foreground, fontFamily: colors.fonts.mono }]}>
        {fmt(intake, nutrient.unit)}
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}> {nutrient.unit}</Text>
      </Text>

      {/* L1 bar */}
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pctL1}%` as any, backgroundColor: barColor }]} />
      </View>

      <View style={s.barLabels}>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {Math.round(pctL1)}% baseline
        </Text>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {fmt(nutrient.l1, nutrient.unit)}{nutrient.unit}
        </Text>
      </View>

      {/* L2 athlete bar */}
      <View style={[s.barTrack, { marginTop: 4 }]}>
        <View style={[s.barFill, { width: `${pctL2}%` as any, backgroundColor: "#3b82f6" }]} />
      </View>
      <View style={s.barLabels}>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {Math.round(pctL2)}% athlete
        </Text>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {fmt(nutrient.l2, nutrient.unit)}{nutrient.unit}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function AMQSScreen() {
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const displayDate = format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy");

  const { data: daily, isLoading } = useQuery<AMQSScore>({
    queryKey: ["amqs-score", selectedDate],
    queryFn: () => apiFetch(`/me/amqs/score/${selectedDate}`),
    retry: false,
  });

  const tierColor = daily ? TIER_COLOR[daily.tier] ?? colors.primary : colors.primary;
  const confColor = daily ? CONFIDENCE_COLOR[daily.confidence] ?? colors.mutedForeground : colors.mutedForeground;

  const hasFoodToday = daily && daily.confidence !== "Low" && daily.score > 0;
  const hasSupplements = (daily?.coverageStats?.totalTakenSupplements ?? 0) > 0;
  const hasData = hasFoodToday || hasSupplements;

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
          Micronutrient Score
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Date nav */}
        <View style={[s.dateRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSelectedDate(format(subDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.dateText, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]}>{displayDate}</Text>
          <TouchableOpacity onPress={() => setSelectedDate(format(addDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : !daily || !hasData ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="shield" size={40} color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
              No data yet
            </Text>
            <Text style={[s.emptyText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
              Log some food or mark supplements as taken to see your micronutrient quality score.
            </Text>
          </View>
        ) : (
          <>
            {/* Score hero */}
            <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.scoreRow}>
                <View>
                  <Text style={[s.scoreNum, { color: tierColor, fontFamily: colors.fonts.mono }]}>
                    {Math.round(daily.score)}
                  </Text>
                  <Text style={[s.scoreLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                    / 100
                  </Text>
                </View>
                <View style={s.scoreBadges}>
                  <View style={[s.tierBadge, { backgroundColor: tierColor + "22", borderColor: tierColor + "44" }]}>
                    <Text style={[s.tierText, { color: tierColor, fontFamily: colors.fonts.sansSb }]}>
                      {daily.tier}
                    </Text>
                  </View>
                  <View style={[s.confBadge, { backgroundColor: confColor + "18" }]}>
                    <Text style={[s.confText, { color: confColor, fontFamily: colors.fonts.sans }]}>
                      {daily.confidence} confidence
                    </Text>
                  </View>
                </View>
              </View>

              {/* Score progress bar */}
              <View style={[s.barTrack, { marginTop: 16, height: 8 }]}>
                <View style={[s.barFill, { width: `${daily.score}%` as any, backgroundColor: tierColor, borderRadius: 4 }]} />
              </View>

              {/* All met callout */}
              {daily.allMet ? (
                <View style={[s.allMetRow, { backgroundColor: "#10b98118", borderColor: "#10b98130" }]}>
                  <Feather name="shield" size={16} color="#10b981" />
                  <Text style={[s.allMetText, { color: "#10b981", fontFamily: colors.fonts.sansMd }]}>
                    Baseline adequacy covered. Tap a nutrient to see athlete optimisation targets.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Top gaps */}
                  {daily.topGaps.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[s.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>
                        TOP GAPS
                      </Text>
                      {daily.topGaps.slice(0, 3).map(gap => (
                        <View key={gap.microKey} style={[s.gapRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                          <View style={s.gapLeft}>
                            <Feather name="alert-triangle" size={12} color={colors.amber} />
                            <Text style={[s.gapLabel, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]}>
                              {gap.label}
                            </Text>
                          </View>
                          <Text style={[s.gapPct, { color: colors.amber, fontFamily: colors.fonts.mono }]}>
                            {Math.round(gap.pctOfTarget)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Score ≥ 85 detail callout */}
              {daily.score >= 85 && (
                <View style={[s.layer1Row, { backgroundColor: "#10b98112", borderColor: "#10b98128" }]}>
                  <Feather name="shield" size={14} color="#10b981" />
                  <Text style={[s.layer1Text, { color: "#10b981", fontFamily: colors.fonts.sans }]}>
                    Baseline micronutrient needs covered. If you're training hard, consider optimising toward athlete targets.
                  </Text>
                </View>
              )}
            </View>

            {/* Nutrient grid */}
            <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
              All Nutrients
            </Text>
            <View style={s.nutrientGrid}>
              {NUTRIENTS.map(n => (
                <NutrientCard
                  key={n.key}
                  nutrient={n}
                  data={daily.nutrients?.[n.key]}
                  totals={daily.totals}
                />
              ))}
            </View>

            {/* Footer disclaimer */}
            <Text style={[s.disclaimer, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
              Based on logged foods and supplements. Estimates only; not medical advice.
            </Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  scrollPad: { padding: 16, gap: 12 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateText: { fontSize: 15 },
  center: { paddingVertical: 60, alignItems: "center" },
  emptyCard: {
    alignItems: "center",
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  scoreCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  scoreNum: { fontSize: 56, fontWeight: "800", lineHeight: 60 },
  scoreLabel: { fontSize: 14, marginTop: 2 },
  scoreBadges: { gap: 8, flex: 1 },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  tierText: { fontSize: 13, fontWeight: "600" },
  confBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  confText: { fontSize: 12 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  allMetRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  allMetText: { fontSize: 13, flex: 1, lineHeight: 18 },
  layer1Row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  layer1Text: { fontSize: 12, flex: 1, lineHeight: 17 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.8, marginBottom: 6 },
  gapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  gapLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  gapLabel: { fontSize: 13 },
  gapPct: { fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  nutrientGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nutrientCard: {
    width: "48%",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  nutrientHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  nutrientLabel: { fontSize: 12, flex: 1 },
  critBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  nutrientValue: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  barLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  barLabelText: { fontSize: 10 },
  disclaimer: { fontSize: 11, fontStyle: "italic", textAlign: "center", marginTop: 8 },
});
