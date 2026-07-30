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
  /** 1 = camp < 7 days (show projected plan). 2 = camp ≥ 7 days (show real trend). */
  cardType?: 1 | 2;
  weeklyTargets?: Array<{ week: number; targetWeight: number }>;
  fightDate?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Build projected WeightPoints from weeklyTargets for the Type 1 card.
 *
 * weeklyTargets from the API only covers the fat-loss phase; the final
 * entry may be above fightWeight (which is after the temp cut). We always
 * append the real fightWeight at fightDate as the last point so the line
 * ends at the actual goal, and we drop any weeklyTarget that would land ON
 * fightDate to avoid a duplicate plotted there.
 */
function buildProjectedPoints(
  currentWeight: number,
  fightWeight: number,
  weeklyTargets: Array<{ week: number; targetWeight: number }>,
  fightDate: string,
): WeightPoint[] {
  if (!weeklyTargets.length && fightWeight == null) return [];

  const fightDateISO = fightDate.slice(0, 10);
  const fightMs = Date.parse(fightDateISO + "T12:00:00");
  const totalWeeks = weeklyTargets.length;

  const todayISO = new Date().toISOString().slice(0, 10);
  const points: WeightPoint[] = [{ date: todayISO, weight: currentWeight }];

  const sorted = [...weeklyTargets].sort((a, b) => a.week - b.week);
  for (const wt of sorted) {
    const weekMs = fightMs - (totalWeeks - wt.week) * 7 * 86_400_000;
    const weekISO = new Date(weekMs).toISOString().slice(0, 10);
    // Skip any target that lands on the fight date — we'll add fightWeight there
    if (weekISO === fightDateISO) continue;
    points.push({ date: weekISO, weight: wt.targetWeight });
  }

  // Always end at the actual fight weight on fight day
  if (fightWeight != null) {
    points.push({ date: fightDateISO, weight: fightWeight });
  }

  return points;
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
        <Text style={chart.emptyText}>
          Logging started — chart builds as you weigh in daily
        </Text>
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

  function toX(i: number) { return PAD_X + (i / (n - 1)) * innerW; }
  function toY(w: number) { return PAD_Y + ((maxW - w) / range) * innerH; }

  const polyPts = sorted.map((p, i) => `${toX(i)},${toY(p.weight)}`).join(" ");

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#ff7a00" stopOpacity="0.5" />
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
                <SvgText
                  x={x} y={y - 7}
                  fontSize={7} fill="#9ca3af"
                  textAnchor="middle" fontWeight="600"
                >
                  {p.weight.toFixed(1)}
                </SvgText>
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
  emptyText: { color: "#374151", fontSize: 11, textAlign: "center" },
});

// ─── shared sub-components ────────────────────────────────────────────────────

function CardHeader({ daysLeft }: { daysLeft?: number }) {
  return (
    <View style={styles.header}>
      {/* logo-main.png already contains the full brand mark incl. "PRFMR" text */}
      <Image
        source={require("../assets/logo-main.png")}
        style={styles.logoImg}
        resizeMode="contain"
      />
      {daysLeft != null && daysLeft > 0 && (
        <View style={styles.daysChip}>
          <Text style={styles.daysText}>🥊 {daysLeft} days to fight day</Text>
        </View>
      )}
    </View>
  );
}

function StatsRow({
  currentWeight,
  targetWeight,
  label = "kg to go",
}: {
  currentWeight?: number;
  targetWeight?: number;
  label?: string;
}) {
  const remaining =
    currentWeight != null && targetWeight != null
      ? Math.max(0, currentWeight - targetWeight)
      : null;

  if (currentWeight == null && remaining == null && targetWeight == null) return null;

  return (
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
          <Text style={[styles.statValue, { color: "#ff7a00" }]}>
            {remaining.toFixed(1)}
          </Text>
          <Text style={[styles.statUnit, { color: "#ff7a00" }]}>kg</Text>
          <Text style={[styles.statLabel, { color: "#ff7a00", textAlign: "center" }]}>
            {label}
          </Text>
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
  );
}

function CardFooter({ username }: { username?: string }) {
  return (
    <View style={styles.footer}>
      {username ? <Text style={styles.username}>— {username}</Text> : null}
      <Text style={styles.appName}>PRFMR · Fight Camp Tracker</Text>
    </View>
  );
}

// ─── Type 1 card (camp < 7 days) ─────────────────────────────────────────────

function Type1Content({
  currentWeight, targetWeight, daysLeft,
  weeklyTargets = [], fightDate, username, innerStyle,
}: Pick<Props, "currentWeight" | "targetWeight" | "daysLeft" | "weeklyTargets" | "fightDate" | "username"> & { innerStyle?: object }) {
  const projectedPoints =
    currentWeight != null && targetWeight != null && fightDate
      ? buildProjectedPoints(currentWeight, targetWeight, weeklyTargets, fightDate)
      : [];

  return (
    <View style={[styles.inner, innerStyle]}>
      <CardHeader daysLeft={daysLeft} />

      {/* Projected chart */}
      <View style={styles.chartSection}>
        <Text style={styles.chartLabel}>Your projected weight cut</Text>
        <View style={styles.chartBox}>
          {projectedPoints.length >= 2 ? (
            <WeightChart points={projectedPoints} />
          ) : (
            <View style={chart.empty}>
              <Text style={chart.emptyText}>Set fight date to see projection</Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.statsSectionLabel}>Target each week</Text>
        <StatsRow
          currentWeight={currentWeight}
          targetWeight={targetWeight}
          label="to go"
        />
      </View>

      {/* Copy */}
      <Text style={styles.copy}>Let's finish camp strong{"\n"}and get this W 💪</Text>

      <CardFooter username={username} />
    </View>
  );
}

// ─── Type 2 card (camp ≥ 7 days) ─────────────────────────────────────────────

function Type2Content({
  weightLostKg, currentWeight, targetWeight, daysLeft,
  weightHistory = [], username, innerStyle,
}: Pick<Props, "weightLostKg" | "currentWeight" | "targetWeight" | "daysLeft" | "weightHistory" | "username"> & { innerStyle?: object }) {
  // Use the first logged camp weight as the baseline. If the current weight is
  // lower than that, the athlete has genuinely lost weight since camp started.
  const sorted = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const campStartWeight = sorted[0]?.weight ?? null;
  const actualLostKg =
    campStartWeight != null && currentWeight != null
      ? campStartWeight - currentWeight
      : (weightLostKg ?? 0);

  return (
    <View style={[styles.inner, innerStyle]}>
      <CardHeader daysLeft={daysLeft} />

      {/* Real trend chart */}
      <View style={styles.chartSection}>
        <Text style={styles.chartLabel}>Trend since fight camp started</Text>
        <View style={styles.chartBox}>
          <WeightChart points={weightHistory} />
        </View>
      </View>

      {/* You've lost X kg */}
      <View style={styles.lostRow}>
        {actualLostKg > 0 ? (
          <Text style={styles.lostHeadline}>
            You've lost{" "}
            <Text style={styles.lostKg}>{actualLostKg.toFixed(1)} kg</Text>
            {" "}so far
          </Text>
        ) : (
          <Text style={styles.lostHeadline}>
            Camp is <Text style={styles.lostKg}>underway</Text> 🔥
          </Text>
        )}
      </View>

      {/* Stats */}
      <StatsRow currentWeight={currentWeight} targetWeight={targetWeight} />

      {/* Copy */}
      <Text style={styles.copy}>Let's finish camp strong{"\n"}and get this W 💪</Text>

      <CardFooter username={username} />
    </View>
  );
}

// ─── main card ────────────────────────────────────────────────────────────────

export function ShareCard({
  weightLostKg, username, currentWeight, targetWeight,
  daysLeft, weightHistory = [], backgroundImageUri,
  cardType = 2, weeklyTargets = [], fightDate,
}: Props) {
  const innerStyle = backgroundImageUri ? styles.innerOverBg : undefined;

  const content =
    cardType === 1 ? (
      <Type1Content
        currentWeight={currentWeight}
        targetWeight={targetWeight}
        daysLeft={daysLeft}
        weeklyTargets={weeklyTargets}
        fightDate={fightDate}
        username={username}
        innerStyle={innerStyle}
      />
    ) : (
      <Type2Content
        weightLostKg={weightLostKg}
        currentWeight={currentWeight}
        targetWeight={targetWeight}
        daysLeft={daysLeft}
        weightHistory={weightHistory}
        username={username}
        innerStyle={innerStyle}
      />
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
  // logo-main.png is ~3:1 ratio; render at a size that's legible on the card
  logoImg: { width: 108, height: 36 },
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

  // Stats section (Type 1 has a heading)
  statsSection: { gap: 6 },
  statsSectionLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // "You've lost" (Type 2)
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

  // Stats row
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
