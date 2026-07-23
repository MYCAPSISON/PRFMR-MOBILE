import React from "react";
import { View, Text, Image, ImageBackground, StyleSheet } from "react-native";
import Svg, {
  Polyline, Circle, Text as SvgText, Line, Defs, LinearGradient, Stop,
} from "react-native-svg";

export interface WeightPoint {
  date: string;
  weight: number;
}

interface Props {
  weightLostKg: number;
  username?: string;
  currentWeight?: number;
  targetWeight?: number;
  daysLeft?: number;
  weightHistory?: WeightPoint[];
  backgroundImageUri?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function motivationalCopy(kg: number): string {
  if (kg <= 0) return "Let's finish camp strong\nand get this W";
  if (kg >= 5) return `${kg.toFixed(1)} kg shed — the discipline\nis showing. This is fight camp.`;
  if (kg >= 2) return `${kg.toFixed(1)} kg down and feeling it.\nLet's get this W.`;
  return "Let's finish camp strong\nand get this W";
}

// ─── weight chart ─────────────────────────────────────────────────────────────

const CHART_W = 312;
const CHART_H = 108;
const PAD_X = 18;
const PAD_Y = 14;

function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) {
    return (
      <View style={chart.empty}>
        <Text style={chart.emptyText}>Logging started — chart builds as you weigh in daily</Text>
      </View>
    );
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const ws = sorted.map(p => p.weight);
  const rawMin = Math.min(...ws);
  const rawMax = Math.max(...ws);
  const padding = Math.max((rawMax - rawMin) * 0.25, 0.5);
  const minW = rawMin - padding;
  const maxW = rawMax + padding;
  const range = maxW - minW;

  const n = sorted.length;
  const innerW = CHART_W - 2 * PAD_X;
  const innerH = CHART_H - 2 * PAD_Y;

  function toX(i: number) {
    return PAD_X + (i / (n - 1)) * innerW;
  }
  function toY(w: number) {
    return PAD_Y + ((maxW - w) / range) * innerH;
  }

  const polyPts = sorted.map((p, i) => `${toX(i)},${toY(p.weight)}`).join(" ");

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#ff7a00" stopOpacity="0.6" />
          <Stop offset="1" stopColor="#ff7a00" stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* Baseline */}
      <Line
        x1={PAD_X} y1={PAD_Y + innerH}
        x2={PAD_X + innerW} y2={PAD_Y + innerH}
        stroke="#1f2330" strokeWidth={1}
      />

      {/* Orange trend line */}
      <Polyline
        points={polyPts}
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + labels */}
      {sorted.map((p, i) => {
        const x = toX(i);
        const y = toY(p.weight);
        const isFirst = i === 0;
        const isLast = i === n - 1;
        const showLabel = n <= 7 || isFirst || isLast || i % Math.ceil(n / 5) === 0;
        return (
          <React.Fragment key={p.date + i}>
            <Circle cx={x} cy={y} r={3.5} fill="#ff7a00" />
            {showLabel && (
              <>
                {/* weight reading above dot */}
                <SvgText
                  x={x} y={y - 7}
                  fontSize={7} fill="#9ca3af"
                  textAnchor="middle" fontWeight="600"
                >
                  {p.weight.toFixed(1)}
                </SvgText>
                {/* date below baseline */}
                <SvgText
                  x={x} y={PAD_Y + innerH + 10}
                  fontSize={7} fill="#6b7280"
                  textAnchor="middle"
                >
                  {fmtDate(p.date)}
                </SvgText>
              </>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const chart = StyleSheet.create({
  empty: {
    width: CHART_W, height: CHART_H,
    alignItems: "center", justifyContent: "center",
  },
  emptyText: {
    color: "#374151", fontSize: 11, textAlign: "center",
  },
});

// ─── main card ────────────────────────────────────────────────────────────────

export function ShareCard({
  weightLostKg, username, currentWeight, targetWeight,
  daysLeft, weightHistory = [], backgroundImageUri,
}: Props) {
  const remaining = (currentWeight != null && targetWeight != null)
    ? Math.max(0, currentWeight - targetWeight)
    : null;

  const content = (
    <View style={[styles.inner, backgroundImageUri ? styles.innerOverBg : null]}>
      {/* Header row */}
      <View style={styles.header}>
        {/* PRFMR logo pill */}
        <View style={styles.logoPill}>
          <Image
            source={require("../assets/logo-main.png")}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>PRFMR</Text>
        </View>

        {/* Days chip */}
        {daysLeft != null && daysLeft > 0 && (
          <View style={styles.daysChip}>
            <Text style={styles.daysText}>🥊 {daysLeft} days to fight day</Text>
          </View>
        )}
      </View>

      {/* Chart section */}
      <View style={styles.chartSection}>
        <Text style={styles.chartLabel}>Trend since fight camp started</Text>
        <View style={styles.chartBox}>
          <WeightChart points={weightHistory} />
        </View>
      </View>

      {/* "You've lost X kg so far" */}
      <View style={styles.lostRow}>
        {weightLostKg > 0 ? (
          <Text style={styles.lostHeadline}>
            You've lost{" "}
            <Text style={styles.lostKg}>{weightLostKg.toFixed(1)} kg</Text>
            {" "}so far
          </Text>
        ) : (
          <Text style={styles.lostHeadline}>Fight camp <Text style={styles.lostKg}>activated</Text> 🎯</Text>
        )}
      </View>

      {/* Stats row */}
      {(currentWeight != null || remaining != null || targetWeight != null) && (
        <View style={styles.statsRow}>
          {currentWeight != null && (
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{currentWeight.toFixed(1)}</Text>
              <Text style={styles.statUnit}>kg</Text>
              <Text style={styles.statLabel}>current{"\n"}weight</Text>
            </View>
          )}

          {remaining != null && (
            <View style={[styles.statCell, styles.statCellCenter]}>
              <Text style={[styles.statValue, { color: "#ff7a00" }]}>{remaining.toFixed(1)}</Text>
              <Text style={[styles.statUnit, { color: "#ff7a00" }]}>kg</Text>
              <Text style={[styles.statLabel, { color: "#ff7a00", textAlign: "center" }]}>to go</Text>
              {/* down-right arrow */}
              <Text style={styles.arrowIcon}>↘</Text>
            </View>
          )}

          {targetWeight != null && (
            <View style={[styles.statCell, styles.statCellRight]}>
              <Text style={styles.statValue}>{targetWeight.toFixed(1)}</Text>
              <Text style={styles.statUnit}>kg</Text>
              <Text style={styles.statLabel}>fight{"\n"}weight</Text>
            </View>
          )}
        </View>
      )}

      {/* Motivational copy */}
      <Text style={styles.copy}>{motivationalCopy(weightLostKg)}</Text>

      {/* Footer */}
      <View style={styles.footer}>
        {username && <Text style={styles.username}>— {username}</Text>}
        <Text style={styles.appName}>PRFMR · Fight Camp Tracker</Text>
      </View>
    </View>
  );

  if (backgroundImageUri) {
    return (
      <ImageBackground
        source={{ uri: backgroundImageUri }}
        style={styles.card}
        imageStyle={{ opacity: 0.28 }}
        resizeMode="cover"
      >
        <View style={styles.bgOverlay} />
        {content}
      </ImageBackground>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: 360,
    height: 640,
    backgroundColor: "#0a0c12",
    overflow: "hidden",
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,12,18,0.72)",
  },
  inner: {
    flex: 1,
    padding: 24,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  innerOverBg: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111318",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 7,
    borderWidth: 1,
    borderColor: "#2a2d38",
  },
  logoIcon: { width: 22, height: 22 },
  logoText: {
    color: "#eceef2",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  daysChip: {
    backgroundColor: "rgba(255,122,0,0.12)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,122,0,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  daysText: {
    color: "#ff7a00",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Chart
  chartSection: { gap: 6 },
  chartLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  chartBox: {
    backgroundColor: "#0d0f17",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1a1d29",
    overflow: "hidden",
    paddingTop: 4,
    paddingBottom: 2,
  },

  // "You've lost"
  lostRow: { alignItems: "center" },
  lostHeadline: {
    color: "#eceef2",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  lostKg: {
    color: "#ff7a00",
    fontWeight: "900",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#0d0f17",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a1d29",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statCell: {
    alignItems: "flex-start",
    flex: 1,
    gap: 1,
  },
  statCellCenter: { alignItems: "center" },
  statCellRight: { alignItems: "flex-end" },
  statValue: {
    color: "#eceef2",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
    letterSpacing: -0.5,
  },
  statUnit: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  statLabel: {
    color: "#4b5563",
    fontSize: 9,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    lineHeight: 12,
  },
  arrowIcon: {
    color: "#ff7a00",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  // Copy
  copy: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 19,
    letterSpacing: 0.1,
  },

  // Footer
  footer: { alignItems: "center", gap: 2 },
  username: { color: "#6b7280", fontSize: 11, fontWeight: "500" },
  appName: {
    color: "#2a2d38",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
