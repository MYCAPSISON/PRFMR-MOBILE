import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import Svg, { Polyline } from "react-native-svg";
import { AppLogoHeader } from "@/components/AppLogoHeader";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────
// Types (mirrors real server AMQSScoreResult — spec §9.17.6)
// ─────────────────────────────────────────
type Tier = "Elite" | "Optimal" | "Good" | "Fair" | "Basic";

interface CoverageEntry {
  pctOfTarget: number;
  status: "low" | "ok" | "high";
}

interface AmqsGap {
  microKey: string;
  label: string;
  pctOfTarget: number;
  suggestion?: string;
}

interface AMQSScore {
  date: string;
  score: number;
  tier: Tier;
  confidence: "Low" | "Medium" | "High";
  coverageStats?: {
    totalFoodEntries?: number;
    foodEntriesWithMicros?: number;
    totalTakenSupplements?: number;
    takenSupplementsWithMicros?: number;
    overallCoverage?: number;
  };
  totals: Record<string, number>;
  targets: Record<string, number>;
  coverage: Record<string, CoverageEntry>;
  topGaps: AmqsGap[];
  allMet: boolean;
  breakdown: {
    food: Record<string, number>;
    supplements: Record<string, number>;
  };
  layer2Score?: number;
  layer2Tier?: Tier;
  layer2Targets?: Record<string, number>;
  layer2Coverage?: Record<string, CoverageEntry>;
  layer2TopGaps?: AmqsGap[];
}

interface AmqsTrendLayer {
  currentWeekAvg: number;
  prevWeekAvg: number;
  delta: number;
  trend: "improving" | "slightly_down" | "steady";
  dailyScores: { date: string; score: number }[];
}

interface AmqsTrend {
  layer1: AmqsTrendLayer;
  layer2: AmqsTrendLayer;
}

// ─────────────────────────────────────────
// Nutrient display metadata (17 tracked — spec §9.17.1)
// ─────────────────────────────────────────
const NUTRIENT_META: { key: string; label: string; unit: string }[] = [
  { key: "iron_mg", label: "Iron", unit: "mg" },
  { key: "calcium_mg", label: "Calcium", unit: "mg" },
  { key: "vitamin_d_ug", label: "Vitamin D", unit: "mcg" },
  { key: "magnesium_mg", label: "Magnesium", unit: "mg" },
  { key: "zinc_mg", label: "Zinc", unit: "mg" },
  { key: "iodine_ug", label: "Iodine", unit: "mcg" },
  { key: "selenium_ug", label: "Selenium", unit: "mcg" },
  { key: "folate_ug", label: "Folate", unit: "mcg" },
  { key: "vitamin_b12_ug", label: "Vitamin B12", unit: "mcg" },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg" },
  { key: "vitamin_a_ug", label: "Vitamin A", unit: "mcg" },
  { key: "potassium_mg", label: "Potassium", unit: "mg" },
  { key: "vitamin_b1_mg", label: "Vitamin B1", unit: "mg" },
  { key: "vitamin_b2_mg", label: "Vitamin B2", unit: "mg" },
  { key: "vitamin_b3_mg", label: "Vitamin B3", unit: "mg" },
  { key: "vitamin_b6_mg", label: "Vitamin B6", unit: "mg" },
  { key: "omega3_g", label: "Omega-3", unit: "g" },
];

const NUTRIENT_LABEL: Record<string, string> = Object.fromEntries(NUTRIENT_META.map(n => [n.key, n.label]));

const CRITICAL_KEYS = ["iron_mg", "calcium_mg", "vitamin_d_ug", "magnesium_mg", "zinc_mg"];

// Spec §9.17.7 tier color map
const TIER_COLOR: Record<string, string> = {
  Elite: "#10b981",
  Optimal: "#3b82f6",
  Good: "#f59e0b",
  Fair: "#94a3b8",
  Basic: "#94a3b8",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  High: "#10b981",
  Medium: "#eab308",
  Low: "#ef4444",
};

function fmt(val: number, unit: string) {
  if (val >= 1000 && unit === "mg") return `${(val / 1000).toFixed(1)}g`;
  if (val < 10) return val.toFixed(1);
  return Math.round(val).toString();
}

function formatTrendLine(layer?: AmqsTrendLayer) {
  if (!layer) return "";
  if (layer.prevWeekAvg === 0) return "still building";
  if (layer.trend === "improving") return `↑ +${layer.delta} vs last week`;
  if (layer.trend === "slightly_down") return `↓ ${layer.delta} vs last week`;
  return "→ steady vs last week";
}

function trendLineColor(layer?: AmqsTrendLayer) {
  if (!layer || layer.prevWeekAvg === 0) return "#6b7280";
  if (layer.trend === "improving") return "#10b981";
  if (layer.trend === "slightly_down") return "#fb923c";
  return "#6b7280";
}

function gapPercent(gap: AmqsGap) {
  return Math.max(0, Math.min(100, Math.round(gap.pctOfTarget)));
}

function gapPointEstimate(gap: AmqsGap) {
  return Math.min(8, Math.max(2, Math.round(((100 - gap.pctOfTarget) / 100) * 7)));
}

// ─────────────────────────────────────────
// Dual-line 7-day trend chart (spec §9.17.8)
// ─────────────────────────────────────────
function TrendChart({ layer1, layer2 }: { layer1: AmqsTrendLayer; layer2: AmqsTrendLayer }) {
  const colors = useColors();
  const days1 = layer1.dailyScores;
  const days2 = layer2.dailyScores;
  if (days1.length < 2) return null;

  const W = 320, H = 160;
  const allScores = [...days1.map(d => d.score), ...days2.map(d => d.score)];
  const max = Math.max(...allScores, 1);
  const min = Math.min(...allScores, 0);
  const rng = (max - min) || 1;

  function toPoints(days: { score: number }[]) {
    return days.map((d, i) => {
      const x = days.length < 2 ? W / 2 : (i / (days.length - 1)) * W;
      const y = H - ((d.score - min) / rng) * H;
      return `${x},${y}`;
    }).join(" ");
  }

  return (
    <View style={[s.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.rowBetween}>
        <Text style={[s.sectionTitle, { color: colors.foreground, fontFamily: colors.fonts.display, marginTop: 0 }]}>
          7-Day Trend
        </Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 11, color: trendLineColor(layer1) }}>Basic {formatTrendLine(layer1)}</Text>
          <Text style={{ fontSize: 11, color: trendLineColor(layer2) }}>Perf {formatTrendLine(layer2)}</Text>
        </View>
      </View>
      <View style={{ height: H, marginTop: 12 }}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Polyline points={toPoints(days1)} fill="none" stroke={colors.primary} strokeWidth={2} />
          <Polyline points={toPoints(days2)} fill="none" stroke="#3b82f6" strokeWidth={2} />
        </Svg>
      </View>
      <View style={s.tickRow}>
        {days1.map(d => (
          <Text key={d.date} style={{ fontSize: 9, color: colors.mutedForeground }}>{d.date.slice(5)}</Text>
        ))}
      </View>
      <View style={[s.rowBetween, { marginTop: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.primary, fontFamily: colors.fonts.mono }}>
            {layer1.currentWeekAvg}
          </Text>
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>General avg · Baseline adequacy</Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#3b82f6", fontFamily: colors.fonts.mono }}>
            {layer2.currentWeekAvg}
          </Text>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: "right" }}>Performance avg · Athlete optimisation</Text>
        </View>
      </View>
      <Text style={[s.disclaimer, { color: colors.mutedForeground, marginTop: 12 }]}>
        AMQS combines food and supplement micronutrient data. Estimates only — not medical advice.{"\n"}
        Basic = baseline adequacy targets · Performance = athlete optimisation targets
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────
// NutrientCard — driven by API-provided targets/coverage, not hardcoded values
// ─────────────────────────────────────────
function NutrientCard({ meta, totals, coverage, layer2Targets, layer2Coverage, targets, athleteLayerOpen }: {
  meta: typeof NUTRIENT_META[0];
  totals: Record<string, number>;
  targets: Record<string, number>;
  coverage: Record<string, CoverageEntry>;
  layer2Targets?: Record<string, number>;
  layer2Coverage?: Record<string, CoverageEntry>;
  athleteLayerOpen: boolean;
}) {
  const colors = useColors();
  const intake = totals[meta.key] ?? 0;
  const l1Target = targets[meta.key] ?? 0;
  const l2Target = layer2Targets?.[meta.key] ?? l1Target;
  const pctL1 = Math.min(100, coverage[meta.key]?.pctOfTarget ?? (l1Target > 0 ? (intake / l1Target) * 100 : 0));
  const pctL2 = Math.min(100, layer2Coverage?.[meta.key]?.pctOfTarget ?? (l2Target > 0 ? (intake / l2Target) * 100 : 0));
  const isCritical = CRITICAL_KEYS.includes(meta.key);

  const barColor = pctL1 >= 100 ? (pctL2 >= 100 ? "#10b981" : "#3b82f6") : "#ff7a00";

  return (
    <View style={[s.nutrientCard, { backgroundColor: colors.card, borderColor: isCritical ? colors.border + "80" : colors.border }]}>
      <View style={s.nutrientHeader}>
        <Text style={[s.nutrientLabel, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]} numberOfLines={1}>
          {meta.label}
        </Text>
        {isCritical && (
          <View style={[s.critBadge, { backgroundColor: "rgba(255,122,0,0.1)" }]}>
            <Text style={{ fontSize: 9, color: colors.primary, fontFamily: colors.fonts.sansSb }}>KEY</Text>
          </View>
        )}
      </View>

      <Text style={[s.nutrientValue, { color: colors.foreground, fontFamily: colors.fonts.mono }]}>
        {fmt(intake, meta.unit)}
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}> {meta.unit}</Text>
      </Text>

      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pctL1}%` as any, backgroundColor: barColor }]} />
      </View>
      <View style={s.barLabels}>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {Math.round(pctL1)}% baseline
        </Text>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {fmt(l1Target, meta.unit)}{meta.unit}
        </Text>
      </View>

      <View style={[s.barTrack, { marginTop: 4, opacity: athleteLayerOpen ? 1 : 0.35 }]}>
        <View style={[s.barFill, { width: `${pctL2}%` as any, backgroundColor: athleteLayerOpen ? "#3b82f6" : "#64748b" }]} />
      </View>
      <View style={[s.barLabels, { opacity: athleteLayerOpen ? 1 : 0.35 }]}>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {Math.round(pctL2)}% athlete
        </Text>
        <Text style={[s.barLabelText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
          {fmt(l2Target, meta.unit)}{meta.unit}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────
// "How AMQS is scored" reference dialog — spec §9.17.7b
// ─────────────────────────────────────────
function HowScoredDialog({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "82%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, fontFamily: colors.fonts.display }}>
              How AMQS is scored
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 36 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Two layers, one score pair</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                AMQS scores your day's micronutrient intake against two independent targets: a{" "}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>General</Text> (baseline adequacy — avoiding
                deficiency) score and a <Text style={{ color: "#3b82f6", fontWeight: "700" }}>Performance</Text> (athlete
                optimisation — training-adjusted) score. Both run 0–100 and are computed from the same logged food and
                supplement intake, just measured against different target tables.
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>The formula</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                For each tracked nutrient, coverage is capped at 100% of target so mega-dosing one nutrient can't mask
                gaps elsewhere. The overall score is the average coverage across all tracked nutrients, weighted
                slightly toward nutrients flagged "critical" for combat-sport athletes (e.g. iron, zinc, vitamin D,
                magnesium, omega-3).
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>Tier thresholds</Text>
              {[
                { tier: "Elite", range: "90–100", color: "#10b981" },
                { tier: "Optimal", range: "75–89", color: "#3b82f6" },
                { tier: "Good", range: "60–74", color: "#f59e0b" },
                { tier: "Fair", range: "40–59", color: "#94a3b8" },
                { tier: "Basic", range: "0–39", color: "#94a3b8" },
              ].map(t => (
                <View key={t.tier} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
                    <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>{t.tier}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: colors.fonts.mono }}>{t.range}</Text>
                </View>
              ))}
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Nutrients tracked</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                {NUTRIENT_META.map(n => n.label).join(" · ")}
              </Text>
            </View>

            <View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Data confidence</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                Confidence reflects how much of today's logged food and supplements have known micronutrient profiles.
                Manually-entered foods without a matched ingredient don't contribute micronutrient data, which lowers
                confidence even if calories/macros are fully logged.
              </Text>
            </View>

            <View style={{ backgroundColor: colors.secondary, borderRadius: 10, padding: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, fontStyle: "italic", lineHeight: 16 }}>
                AMQS combines food and supplement micronutrient data. Estimates only — not medical advice. Blood
                tests, diagnosed deficiencies, or a registered dietitian override these figures.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function AMQSScreen() {
  const colors = useColors();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showHowScored, setShowHowScored] = useState(false);
  const [athleteLayerOpen, setAthleteLayerOpen] = useState(false);
  const displayDate = format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy");

  const { data: daily, isLoading } = useQuery<AMQSScore>({
    queryKey: ["amqs-score", selectedDate],
    queryFn: () => apiFetch(`/me/amqs/score/${selectedDate}`),
    retry: false,
  });

  const { data: trend } = useQuery<AmqsTrend>({
    queryKey: ["amqs-trend", selectedDate],
    queryFn: () => apiFetch(`/me/amqs/trend/${selectedDate}`),
    enabled: !!daily,
    retry: false,
  });

  const tierColor = daily ? TIER_COLOR[daily.tier] ?? colors.primary : colors.primary;
  const layer2TierColor = daily?.layer2Tier ? TIER_COLOR[daily.layer2Tier] ?? "#3b82f6" : "#3b82f6";
  const confColor = daily ? CONFIDENCE_COLOR[daily.confidence] ?? colors.mutedForeground : colors.mutedForeground;

  const hasFoodToday = daily && daily.confidence !== "Low" && daily.score > 0;
  const hasSupplements = (daily?.coverageStats?.totalTakenSupplements ?? 0) > 0;
  const hasData = hasFoodToday || hasSupplements;

  // "What moved it" — spec §9.17.7
  let whatMovedIt = "Log a meal or supplement to see drivers";
  if (daily && hasData) {
    const combined: Record<string, number> = {};
    for (const [k, v] of Object.entries(daily.breakdown?.food ?? {})) combined[k] = (combined[k] ?? 0) + v;
    for (const [k, v] of Object.entries(daily.breakdown?.supplements ?? {})) combined[k] = (combined[k] ?? 0) + v;
    const entries = Object.entries(combined).filter(([, v]) => v > 0);
    const topContributor = entries.length ? entries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
    const topGap = daily.topGaps?.[0];
    if (topContributor && topGap) {
      whatMovedIt = `+${Math.round(topContributor[1])}${NUTRIENT_META.find(n => n.key === topContributor[0])?.unit ?? ""} ${NUTRIENT_LABEL[topContributor[0]] ?? topContributor[0]} · ${topGap.label} at ${topGap.pctOfTarget >= 100 ? "Target met" : `${Math.round(topGap.pctOfTarget)}%`}`;
    } else if (topContributor) {
      whatMovedIt = `+${Math.round(topContributor[1])}${NUTRIENT_META.find(n => n.key === topContributor[0])?.unit ?? ""} ${NUTRIENT_LABEL[topContributor[0]] ?? topContributor[0]}`;
    } else {
      whatMovedIt = "Log one more meal to improve insight quality";
    }
  }

  const microGoals = (daily?.topGaps ?? []).filter(g => g.suggestion).slice(0, 3);

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <AppLogoHeader />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
          Micronutrient Score
        </Text>
        <TouchableOpacity onPress={() => setShowHowScored(true)} style={s.backBtn}>
          <Feather name="info" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <HowScoredDialog visible={showHowScored} onClose={() => setShowHowScored(false)} colors={colors} />

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Date nav */}
        <View style={[s.dateRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => setSelectedDate(format(subDays(new Date(selectedDate + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[s.dateText, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]}>{displayDate}</Text>
          {selectedDate !== format(new Date(), "yyyy-MM-dd") && (
            <TouchableOpacity onPress={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}>
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "700" }}>Today</Text>
            </TouchableOpacity>
          )}
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
            {/* Score hero — side-by-side General / Performance */}
            <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.scoreRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>GENERAL SCORE</Text>
                  <Text style={[s.scoreNum, { color: tierColor, fontFamily: colors.fonts.mono }]}>
                    {Math.round(daily.score)}
                  </Text>
                  <View style={[s.tierBadge, { backgroundColor: tierColor + "22", borderColor: tierColor + "44" }]}>
                    <Text style={[s.tierText, { color: tierColor, fontFamily: colors.fonts.sansSb }]}>{daily.tier}</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: trendLineColor(trend?.layer1), marginTop: 6 }}>
                    {formatTrendLine(trend?.layer1)}
                  </Text>
                </View>
                {daily.layer2Score != null && (
                  <TouchableOpacity
                    onPress={() => setAthleteLayerOpen(true)}
                    activeOpacity={0.85}
                    style={{ flex: 1, alignItems: "flex-end", opacity: athleteLayerOpen ? 1 : 0.35 }}
                  >
                    <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>PERFORMANCE SCORE</Text>
                    <Text style={[s.scoreNum, { color: layer2TierColor, fontFamily: colors.fonts.mono }]}>
                      {Math.round(daily.layer2Score)}
                    </Text>
                    <View style={[s.tierBadge, { backgroundColor: layer2TierColor + "22", borderColor: layer2TierColor + "44" }]}>
                      <Text style={[s.tierText, { color: layer2TierColor, fontFamily: colors.fonts.sansSb }]}>{daily.layer2Tier}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: trendLineColor(trend?.layer2), marginTop: 6 }}>
                      {formatTrendLine(trend?.layer2)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Confidence */}
              <View style={[s.rowBetween, { marginTop: 16 }]}>
                <Text style={[s.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>DATA CONFIDENCE</Text>
                <View style={[s.confBadge, { backgroundColor: confColor + "18" }]}>
                  <Text style={[s.confText, { color: confColor, fontFamily: colors.fonts.sans }]}>{daily.confidence}</Text>
                </View>
              </View>
              <View style={[s.barTrack, { marginTop: 6, height: 6 }]}>
                <View style={[s.barFill, { width: `${{ High: 100, Medium: 60, Low: 30 }[daily.confidence]}%` as any, backgroundColor: confColor }]} />
              </View>

              {/* What moved it */}
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 12, fontStyle: "italic" }}>
                {whatMovedIt}
              </Text>

              {daily.topGaps.length > 0 && (
                <View style={s.amqsGapList}>
                  <Text style={[s.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>
                    LAYER 1 GAPS (BASELINE)
                  </Text>
                  {daily.topGaps.slice(0, 3).map((gap, index) => (
                    <View key={gap.microKey} style={s.amqsGapBlock}>
                      <View style={s.rowBetween}>
                        <Text style={[s.gapLabel, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]}>
                          {gap.label}
                        </Text>
                        <Text style={[s.gapPct, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                          {gapPercent(gap)}% of target
                        </Text>
                      </View>
                      <View style={s.amqsGapTrack}>
                        <View
                          style={[
                            s.amqsGapFill,
                            {
                              width: `${gapPercent(gap)}%` as any,
                              backgroundColor: index === 0 ? colors.primary : "#4b5563",
                            },
                          ]}
                        />
                      </View>
                      {gap.suggestion && (
                        <Text style={[s.barLabelText, { color: colors.mutedForeground }]}>
                          Try: <Text style={{ color: colors.foreground, fontWeight: "700" }}>{gap.suggestion}</Text>
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {daily.layer2TopGaps && daily.layer2TopGaps.length > 0 && (
                <TouchableOpacity
                  onPress={() => setAthleteLayerOpen(true)}
                  activeOpacity={0.85}
                  style={[s.amqsGapList, { opacity: athleteLayerOpen ? 1 : 0.35 }]}
                >
                  <View style={s.rowBetween}>
                    <Text style={[s.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>
                      LAYER 2 GAPS (ATHLETE OPTIMISATION)
                    </Text>
                    {!athleteLayerOpen && <Feather name="chevron-down" size={16} color={colors.mutedForeground} />}
                  </View>
                  {(athleteLayerOpen ? daily.layer2TopGaps : daily.layer2TopGaps.slice(0, 1)).slice(0, 3).map((gap, index) => (
                    <View key={gap.microKey} style={[s.amqsGapBlock, { borderColor: "#1d4ed855", borderWidth: athleteLayerOpen ? 1 : 0 }]}>
                      <View style={s.rowBetween}>
                        <Text style={[s.gapLabel, { color: colors.foreground, fontFamily: colors.fonts.sansMd }]}>
                          {gap.label}
                        </Text>
                        <Text style={[s.gapPct, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                          {gapPercent(gap)}% of athlete target
                        </Text>
                      </View>
                      <View style={s.amqsGapTrack}>
                        <View
                          style={[
                            s.amqsGapFill,
                            {
                              width: `${gapPercent(gap)}%` as any,
                              backgroundColor: athleteLayerOpen && index === 0 ? "#3b82f6" : "#4b5563",
                            },
                          ]}
                        />
                      </View>
                      {gap.suggestion && (
                        <Text style={[s.barLabelText, { color: colors.mutedForeground }]}>
                          Try: <Text style={{ color: colors.foreground, fontWeight: "700" }}>{gap.suggestion}</Text>
                        </Text>
                      )}
                    </View>
                  ))}
                </TouchableOpacity>
              )}

              {microGoals.length > 0 && (
                <View style={s.microGoalList}>
                  <Text style={[s.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>
                    MICRO-GOALS
                  </Text>
                  {microGoals.map(gap => (
                    <Text key={gap.microKey} style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 5 }}>
                      <Text style={{ color: colors.primary, fontWeight: "800" }}>+{gapPointEstimate(gap)}</Text>{" "}
                      if you add <Text style={{ color: colors.foreground, fontWeight: "700" }}>{gap.suggestion}</Text>{" "}
                      ({gap.label})
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* 7-day dual-line trend chart */}
            {trend && trend.layer1?.dailyScores?.length > 1 && (
              <TrendChart layer1={trend.layer1} layer2={trend.layer2} />
            )}

            {/* Footer disclaimer */}
            <Text style={[s.disclaimer, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
              General nutrition targets — not medical advice. Blood tests, diagnosed deficiencies, or a registered dietitian override these figures.
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
  scoreRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  eyebrow: { fontSize: 10, letterSpacing: 0.6, marginBottom: 4 },
  scoreNum: { fontSize: 40, fontWeight: "800", lineHeight: 44 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 6,
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
  microGoalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
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
  gapLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  gapLabel: { fontSize: 13 },
  gapPct: { fontSize: 13, fontWeight: "600" },
  amqsGapList: { gap: 10, marginTop: 16 },
  amqsGapBlock: {
    gap: 5,
    padding: 10,
    borderRadius: 8,
  },
  amqsGapTrack: {
    height: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  amqsGapFill: { height: "100%", borderRadius: 6 },
  microGoalList: { marginTop: 16 },
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
  chartCard: { padding: 16, borderRadius: 12, borderWidth: 1 },
  tickRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
});
