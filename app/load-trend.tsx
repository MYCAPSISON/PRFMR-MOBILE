import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect, Line, Text as SvgText, G, Defs, Path } from "react-native-svg";
import { AppLogoHeader } from "@/components/AppLogoHeader";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface LoadHistoryEntry {
  date: string;
  totalLoad: number;
  classification: string;
  relativeLoad: number;
  sessionCount: number;
}

interface TrainingLoad {
  acwr: number | null;
  acuteLoad: number;
  acuteDaily: number;
  baselineLoad: number | null;
  baselineDaysUsed: number;
  date: string;
  history: LoadHistoryEntry[];
  warnings?: string[];
}

// ─────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────
function absLoadColor(totalLoad: number): string {
  if (totalLoad < 300) return "#4ade80";
  if (totalLoad < 600) return "#facc15";
  if (totalLoad < 900) return "#f97316";
  return "#f87171";
}

function relLoadColor(rel: number): string {
  if (rel < 1.0) return "#4ade80";
  if (rel < 1.2) return "#f97316";
  if (rel < 1.4) return "#fb923c";
  return "#f87171";
}

function acwrColor(acwr: number): string {
  if (acwr > 1.5) return "#f87171";
  if (acwr > 1.3) return "#f97316";
  if (acwr >= 0.8) return "#4ade80";
  return "#facc15";
}

function acwrLabel(acwr: number): string {
  if (acwr > 1.5) return "Overtraining risk";
  if (acwr > 1.3) return "Caution zone (>1.3)";
  if (acwr >= 0.8) return "Optimal zone (0.8–1.3)";
  return "Undertraining (<0.8)";
}

function classLabel(cls: string): string {
  return cls.charAt(0).toUpperCase() + cls.slice(1).replace("_", " ");
}

function classColor(cls: string): string {
  switch (cls) {
    case "very_hard": return "#f87171";
    case "hard": return "#f97316";
    case "moderate": return "#facc15";
    case "easy": return "#4ade80";
    default: return "#6b7280";
  }
}

// ─────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────
function StatCard({ label, value, sub, subColor }: {
  label: string; value: string; sub: string; subColor?: string;
}) {
  return (
    <View style={ss.statCard}>
      <Text style={ss.statLabel}>{label}</Text>
      <Text style={ss.statValue}>{value}</Text>
      <Text style={[ss.statSub, subColor ? { color: subColor } : {}]}>{sub}</Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Absolute Load Bar Chart
// ─────────────────────────────────────────
const CHART_PAD = { top: 12, bottom: 36, left: 8, right: 4 };
const CHART_H = 160;

function AbsoluteLoadChart({
  history, baselineLoad, chartWidth,
}: {
  history: LoadHistoryEntry[];
  baselineLoad: number | null;
  chartWidth: number;
}) {
  const [tooltip, setTooltip] = useState<number | null>(null);
  const innerW = chartWidth - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H;
  const n = history.length || 28;
  const barSlotW = innerW / n;
  const barW = Math.max(barSlotW * 0.65, 3);

  const maxLoad = Math.max(...history.map(d => d.totalLoad), 400);
  const yMax = Math.ceil(maxLoad / 200) * 200;

  function yPos(v: number) {
    return innerH - (v / yMax) * innerH;
  }

  const xAxisLabels: { i: number; label: string }[] = [];
  history.forEach((entry, i) => {
    if (i % 7 === 0) {
      xAxisLabels.push({ i, label: format(parseISO(entry.date), "d MMM") });
    }
  });

  const svgH = CHART_H + CHART_PAD.top + CHART_PAD.bottom;
  const totalW = chartWidth;

  const tip = tooltip !== null ? history[tooltip] : null;
  const tipX = tooltip !== null
    ? CHART_PAD.left + tooltip * barSlotW + barSlotW / 2
    : 0;

  return (
    <View>
      <View style={{ position: "relative" }}>
        <Svg width={totalW} height={svgH}>
          <G x={CHART_PAD.left} y={CHART_PAD.top}>
            {/* Y-axis labels */}
            {[0, Math.round(yMax / 2), yMax].map(v => (
              <SvgText
                key={v}
                x={-2}
                y={yPos(v) + 4}
                fontSize={9}
                fill="#6b7280"
                textAnchor="end"
              >
                {v}
              </SvgText>
            ))}

            {/* Baseline dashed line */}
            {baselineLoad != null && (
              <Line
                x1={0} y1={yPos(baselineLoad)}
                x2={innerW} y2={yPos(baselineLoad)}
                stroke="#f97316" strokeWidth={1.5}
                strokeDasharray="5,3"
              />
            )}
            {baselineLoad != null && (
              <SvgText
                x={4} y={yPos(baselineLoad) - 3}
                fontSize={9} fill="#f97316"
              >
                baseline
              </SvgText>
            )}

            {/* Bars */}
            {history.map((entry, i) => {
              const x = i * barSlotW + (barSlotW - barW) / 2;
              const h = Math.max((entry.totalLoad / yMax) * innerH, entry.totalLoad > 0 ? 2 : 0);
              const y = innerH - h;
              const color = absLoadColor(entry.totalLoad);
              const isSelected = tooltip === i;
              return (
                <G key={entry.date}>
                  <Rect
                    x={x} y={y} width={barW} height={h}
                    fill={isSelected ? "#ffffff" : color}
                    opacity={isSelected ? 1 : 0.85}
                    rx={1}
                    onPress={() => setTooltip(isSelected ? null : i)}
                  />
                </G>
              );
            })}

            {/* X-axis labels */}
            {xAxisLabels.map(({ i, label }) => (
              <SvgText
                key={i}
                x={i * barSlotW + barSlotW / 2}
                y={innerH + 22}
                fontSize={9} fill="#6b7280" textAnchor="middle"
              >
                {label}
              </SvgText>
            ))}
          </G>
        </Svg>

        {/* Tooltip */}
        {tip && tooltip !== null && (
          <View style={[ss.tooltip, {
            left: Math.min(Math.max(tipX - 60, 4), totalW - 124),
            top: CHART_PAD.top + 8,
          }]}>
            <Text style={ss.tooltipDate}>{format(parseISO(tip.date), "EEE d MMM")}</Text>
            <View style={ss.tooltipRow}>
              <Text style={ss.tooltipKey}>Load</Text>
              <Text style={ss.tooltipVal}>{Math.round(tip.totalLoad)}</Text>
            </View>
            <View style={ss.tooltipRow}>
              <Text style={ss.tooltipKey}>Relative</Text>
              <Text style={ss.tooltipVal}>{tip.relativeLoad.toFixed(2)}×</Text>
            </View>
            <View style={ss.tooltipRow}>
              <Text style={ss.tooltipKey}>Class</Text>
              <Text style={[ss.tooltipVal, { color: classColor(tip.classification) }]}>
                {classLabel(tip.classification)}
              </Text>
            </View>
            <View style={ss.tooltipRow}>
              <Text style={ss.tooltipKey}>Sessions</Text>
              <Text style={ss.tooltipVal}>{tip.sessionCount}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={ss.legend}>
        {[
          { color: "#4ade80", label: "Light (< 300)" },
          { color: "#facc15", label: "Moderate (< 600)" },
          { color: "#f97316", label: "Hard (< 900)" },
          { color: "#f87171", label: "Very Hard (≥ 900)" },
        ].map(item => (
          <View key={item.label} style={ss.legendItem}>
            <View style={[ss.legendDot, { backgroundColor: item.color }]} />
            <Text style={ss.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────
// Relative Load Bar Chart
// ─────────────────────────────────────────
const REL_Y_MAX = 2.5;
const REL_Y_TICKS = [0, 0.55, 1.1, 1.65, 2.2];

function RelativeLoadChart({
  history, chartWidth,
}: {
  history: LoadHistoryEntry[];
  chartWidth: number;
}) {
  const [tooltip, setTooltip] = useState<number | null>(null);
  const innerW = chartWidth - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H;
  const n = history.length || 28;
  const barSlotW = innerW / n;
  const barW = Math.max(barSlotW * 0.65, 3);

  function yPos(v: number) {
    return innerH - (Math.min(v, REL_Y_MAX) / REL_Y_MAX) * innerH;
  }

  const xAxisLabels: { i: number; label: string }[] = [];
  history.forEach((entry, i) => {
    if (i % 7 === 0) {
      xAxisLabels.push({ i, label: format(parseISO(entry.date), "d MMM") });
    }
  });

  const svgH = CHART_H + CHART_PAD.top + CHART_PAD.bottom;
  const totalW = chartWidth;
  const tip = tooltip !== null ? history[tooltip] : null;
  const tipX = tooltip !== null
    ? CHART_PAD.left + tooltip * barSlotW + barSlotW / 2
    : 0;

  return (
    <View>
      <View style={{ position: "relative" }}>
        <Svg width={totalW} height={svgH}>
          <G x={CHART_PAD.left} y={CHART_PAD.top}>
            {/* Y-axis labels */}
            {REL_Y_TICKS.map(v => (
              <SvgText key={v} x={-2} y={yPos(v) + 4}
                fontSize={9} fill="#6b7280" textAnchor="end"
              >
                {v.toFixed(2)}×
              </SvgText>
            ))}

            {/* 1.0 baseline line */}
            <Line x1={0} y1={yPos(1.0)} x2={innerW} y2={yPos(1.0)}
              stroke="#6b7280" strokeWidth={1} strokeDasharray="4,3" />

            {/* 1.2 high stress line */}
            <Line x1={0} y1={yPos(1.2)} x2={innerW} y2={yPos(1.2)}
              stroke="#f97316" strokeWidth={1.5} strokeDasharray="5,3" />
            <SvgText x={4} y={yPos(1.2) - 3} fontSize={9} fill="#f97316">
              high stress
            </SvgText>

            {/* 1.4 very high line */}
            <Line x1={0} y1={yPos(1.4)} x2={innerW} y2={yPos(1.4)}
              stroke="#f87171" strokeWidth={1.5} strokeDasharray="5,3" />
            <SvgText x={4} y={yPos(1.4) - 3} fontSize={9} fill="#f87171">
              very high
            </SvgText>

            {/* Bars */}
            {history.map((entry, i) => {
              const x = i * barSlotW + (barSlotW - barW) / 2;
              const val = Math.min(entry.relativeLoad, REL_Y_MAX);
              const h = Math.max((val / REL_Y_MAX) * innerH, entry.relativeLoad > 0 ? 2 : 0);
              const y = innerH - h;
              const color = relLoadColor(entry.relativeLoad);
              const isSelected = tooltip === i;
              return (
                <Rect key={entry.date}
                  x={x} y={y} width={barW} height={h}
                  fill={isSelected ? "#ffffff" : color}
                  opacity={isSelected ? 1 : 0.85}
                  rx={1}
                  onPress={() => setTooltip(isSelected ? null : i)}
                />
              );
            })}

            {/* X-axis labels */}
            {xAxisLabels.map(({ i, label }) => (
              <SvgText key={i}
                x={i * barSlotW + barSlotW / 2}
                y={innerH + 22}
                fontSize={9} fill="#6b7280" textAnchor="middle"
              >
                {label}
              </SvgText>
            ))}
          </G>
        </Svg>

        {/* Tooltip */}
        {tip && tooltip !== null && (
          <View style={[ss.tooltip, {
            left: Math.min(Math.max(tipX - 60, 4), totalW - 124),
            top: CHART_PAD.top + 8,
          }]}>
            <Text style={ss.tooltipDate}>{format(parseISO(tip.date), "EEE d MMM")}</Text>
            <View style={ss.tooltipRow}>
              <Text style={ss.tooltipKey}>Load</Text>
              <Text style={ss.tooltipVal}>{Math.round(tip.totalLoad)}</Text>
            </View>
            <View style={ss.tooltipRow}>
              <Text style={ss.tooltipKey}>Relative</Text>
              <Text style={ss.tooltipVal}>{tip.relativeLoad.toFixed(2)}×</Text>
            </View>
            <View style={ss.tooltipRow}>
              <Text style={ss.tooltipKey}>Class</Text>
              <Text style={[ss.tooltipVal, { color: classColor(tip.classification) }]}>
                {classLabel(tip.classification)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Legend */}
      <Text style={ss.relLegendText}>
        1.0 = exactly at baseline · &gt;1.2 high stress · &gt;1.4 very high stress
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function LoadTrendScreen() {
  const colors = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardPad = 16;
  const chartWidth = width - 32 - cardPad * 2;

  const today = format(new Date(), "yyyy-MM-dd");

  const { data, isLoading } = useQuery<TrainingLoad>({
    queryKey: ["training-load", today],
    queryFn: () => apiFetch(`/me/training-load/${today}`),
    staleTime: 5 * 60 * 1000,
  });

  const { data: historyRaw, isLoading: historyLoading } = useQuery<any>({
    queryKey: ["training-load-history", today],
    queryFn: async () => {
      const res = await apiFetch(`/me/training/load-history/${today}`);
      if (__DEV__) console.log("[load-trend] load-history keys:", Object.keys(res ?? {}), "full:", JSON.stringify(res).slice(0, 500));
      return res;
    },
    staleTime: 5 * 60 * 1000,
  });

  // API may return { history: [...] } or a bare array
  const history: LoadHistoryEntry[] = Array.isArray(historyRaw)
    ? historyRaw
    : Array.isArray(historyRaw?.history)
      ? historyRaw.history
      : Array.isArray(historyRaw?.days)
        ? historyRaw.days
        : [];

  const trainingDays = history.filter(d => d.sessionCount > 0).length;
  const highStressDays = history.filter(
    d => d.classification === "hard" || d.classification === "very_hard"
  ).length;

  return (
    <SafeAreaView style={[ss.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <AppLogoHeader />

      {/* Header */}
      <View style={ss.header}>
        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[ss.backText, { color: colors.mutedForeground }]}>Training</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[ss.title, { color: colors.foreground }]}>Load Trend</Text>
          <Text style={[ss.subtitle, { color: colors.mutedForeground }]}>
            28-day acute & chronic workload
          </Text>
        </View>
        <Feather name="bar-chart-2" size={20} color={colors.mutedForeground} />
      </View>

      {(isLoading || historyLoading) ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[ss.content, { paddingBottom: 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── 4 stat cards ── */}
          <View style={ss.statsGrid}>
            <StatCard
              label="ACWR"
              value={data?.acwr != null ? data.acwr.toFixed(2) : "—"}
              sub={data?.acwr != null ? acwrLabel(data.acwr) : "Not enough history"}
              subColor={data?.acwr != null ? acwrColor(data.acwr) : "#6b7280"}
            />
            <StatCard
              label="BASELINE"
              value={data?.baselineLoad != null ? String(Math.round(data.baselineLoad)) : "—"}
              sub={data ? `${data.baselineDaysUsed}-day avg` : ""}
            />
            <StatCard
              label="ACUTE (7D)"
              value={data ? String(Math.round(data.acuteLoad)) : "—"}
              sub={data ? `${Math.round(data.acuteDaily)}/day avg` : ""}
            />
            <StatCard
              label="HIGH-STRESS"
              value={String(highStressDays)}
              sub={`of ${trainingDays} training days`}
            />
          </View>

          {/* ── Absolute Load chart ── */}
          <View style={[ss.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={ss.cardHeader}>
              <Feather name="trending-up" size={16} color="#f97316" />
              <Text style={[ss.cardTitle, { color: colors.foreground }]}>Absolute Load</Text>
            </View>
            <Text style={[ss.cardSub, { color: colors.mutedForeground }]}>
              RPE × minutes per day (last 28 days)
            </Text>
            {history.length > 0 ? (
              <AbsoluteLoadChart
                history={history}
                baselineLoad={data?.baselineLoad ?? null}
                chartWidth={chartWidth}
              />
            ) : (
              <Text style={[ss.cardSub, { color: colors.mutedForeground, marginTop: 24, textAlign: "center" }]}>
                No training data yet
              </Text>
            )}
          </View>

          {/* ── Relative Load chart ── */}
          <View style={[ss.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={ss.cardHeader}>
              <Feather name="bar-chart" size={16} color="#f97316" />
              <Text style={[ss.cardTitle, { color: colors.foreground }]}>Relative Load</Text>
            </View>
            <Text style={[ss.cardSub, { color: colors.mutedForeground }]}>
              Today's load ÷ {data?.baselineDaysUsed ?? 28}-day baseline average
            </Text>
            {history.length > 0 ? (
              <RelativeLoadChart
                history={history}
                chartWidth={chartWidth}
              />
            ) : (
              <Text style={[ss.cardSub, { color: colors.mutedForeground, marginTop: 24, textAlign: "center" }]}>
                No training data yet
              </Text>
            )}
          </View>

          {/* ── About ACWR ── */}
          <View style={[ss.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={ss.cardHeader}>
              <Feather name="info" size={16} color="#f97316" />
              <Text style={[ss.cardTitle, { color: colors.foreground }]}>About ACWR</Text>
            </View>
            <Text style={[ss.bodyText, { color: colors.foreground }]}>
              The Acute:Chronic Workload Ratio (ACWR) compares your 7-day average load to your
              baseline. Research suggests the "sweet spot" is{" "}
              <Text style={{ fontWeight: "700" }}>0.8–1.3</Text> — below this suggests
              detraining, above 1.5 indicates injury risk elevation.
            </Text>
            <Text style={[ss.bodyText, { color: colors.foreground, marginTop: 8 }]}>
              Baseline window: 28 days → 14 days → 7 days as your history builds.
            </Text>
            <Text style={[ss.citation, { color: colors.mutedForeground }]}>
              Based on: Gabbett, T.J. (2016). The training-injury prevention paradox: should
              athletes be training smarter and harder?{" "}
              <Text style={{ fontStyle: "italic" }}>
                British Journal of Sports Medicine, 50(5), 273–280.
              </Text>
            </Text>
            <Text style={[ss.citation, { color: colors.mutedForeground, marginTop: 12, textAlign: "center" }]}>
              Daily stress rating is personalised to your baseline.{"\n"}
              ACWR tracks your weekly load trend.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const ss = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 14 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 1 },
  content: { padding: 16, gap: 12 },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  statCard: {
    flex: 1, minWidth: "47%",
    backgroundColor: "#1a1d24", borderRadius: 12, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)", padding: 14,
  },
  statLabel: {
    fontSize: 10, fontWeight: "700", color: "#6b7280",
    letterSpacing: 0.8, marginBottom: 4,
  },
  statValue: {
    fontSize: 26, fontWeight: "900", color: "#f8fafc", marginBottom: 2,
  },
  statSub: { fontSize: 12, color: "#6b7280" },

  card: {
    borderRadius: 14, borderWidth: 1, padding: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardSub: { fontSize: 12, marginBottom: 12 },

  tooltip: {
    position: "absolute",
    backgroundColor: "#1e2330",
    borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    padding: 10, minWidth: 120, zIndex: 10,
  },
  tooltipDate: { fontSize: 11, fontWeight: "700", color: "#f8fafc", marginBottom: 6 },
  tooltipRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 2 },
  tooltipKey: { fontSize: 11, color: "#6b7280" },
  tooltipVal: { fontSize: 11, fontWeight: "600", color: "#f8fafc" },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: "#6b7280" },

  relLegendText: {
    fontSize: 10, color: "#6b7280", marginTop: 8, lineHeight: 16,
  },

  bodyText: { fontSize: 14, lineHeight: 22 },
  citation: { fontSize: 11, lineHeight: 17, marginTop: 12 },
});
