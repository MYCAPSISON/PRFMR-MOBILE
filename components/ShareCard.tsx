import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

interface Props {
  weightLostKg: number;
  username?: string;
  currentWeight?: number;
  targetWeight?: number;
  daysLeft?: number;
}

function getShareMessage(kg: number, target?: number, daysLeft?: number): string {
  if (kg <= 0) {
    return "The journey starts now.\nEvery great fighter begins with a single step.";
  }
  if (kg >= 5) {
    return `${kg.toFixed(1)} kg shed — the discipline is showing.\nThis is what fight camp looks like.`;
  }
  if (kg >= 2) {
    return `Down ${kg.toFixed(1)} kg and feeling it.\nThe work is paying off.`;
  }
  return `${kg.toFixed(1)} kg closer to fight weight.\nEvery session counts.`;
}

function getMotivationalTagline(kg: number): string {
  if (kg <= 0) return "Fight camp activated 🎯";
  if (kg >= 5) return `${kg.toFixed(1)} kg lost so far 💪`;
  return `${kg.toFixed(1)} kg down, making weight 🥊`;
}

export function ShareCard({ weightLostKg, username, currentWeight, targetWeight, daysLeft }: Props) {
  const message = getShareMessage(weightLostKg, targetWeight, daysLeft);
  const tagline = getMotivationalTagline(weightLostKg);

  const remaining = targetWeight && currentWeight
    ? Math.max(0, currentWeight - targetWeight)
    : null;

  return (
    <View style={styles.card}>
      {/* Top: Logo */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image
            source={require("../assets/logo-main.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>PRFMR</Text>
        </View>
        {daysLeft != null && daysLeft > 0 && (
          <View style={styles.daysChip}>
            <Text style={styles.daysText}>🥊 {daysLeft} days to fight night</Text>
          </View>
        )}
      </View>

      {/* Middle: Big metric */}
      <View style={styles.metricArea}>
        {weightLostKg > 0 ? (
          <>
            <Text style={styles.metricNumber}>{weightLostKg.toFixed(1)}</Text>
            <Text style={styles.metricUnit}>kg lost</Text>
          </>
        ) : (
          <>
            <Text style={styles.metricNumber}>🎯</Text>
            <Text style={styles.metricUnit}>Fight camp set</Text>
          </>
        )}
      </View>

      {/* Weight stats row */}
      {(currentWeight || targetWeight || remaining != null) && (
        <View style={styles.statsRow}>
          {currentWeight && (
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{currentWeight.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Current kg</Text>
            </View>
          )}
          {remaining != null && (
            <View style={[styles.statCell, styles.statCellCenter]}>
              <Text style={[styles.statValue, { color: "#ff7a00" }]}>{remaining.toFixed(1)}</Text>
              <Text style={styles.statLabel}>kg to go</Text>
            </View>
          )}
          {targetWeight && (
            <View style={[styles.statCell, styles.statCellRight]}>
              <Text style={styles.statValue}>{targetWeight.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Fight weight</Text>
            </View>
          )}
        </View>
      )}

      {/* Orange divider */}
      <View style={styles.divider} />

      {/* Message */}
      <Text style={styles.message}>{message}</Text>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.tagline}>{tagline}</Text>
        {username && <Text style={styles.username}>— {username}</Text>}
        <Text style={styles.appName}>PRFMR · Fight Camp Tracker</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    height: 640,
    backgroundColor: "#0a0c12",
    padding: 28,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
  },
  logoText: {
    color: "#eceef2",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  daysChip: {
    backgroundColor: "rgba(255,122,0,0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,122,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  daysText: {
    color: "#ff7a00",
    fontSize: 11,
    fontWeight: "700",
  },
  metricArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metricNumber: {
    color: "#ff7a00",
    fontSize: 88,
    fontWeight: "900",
    lineHeight: 96,
    letterSpacing: -4,
  },
  metricUnit: {
    color: "#6b7280",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#13161d",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2330",
    padding: 14,
    marginBottom: 16,
  },
  statCell: {
    alignItems: "flex-start",
    flex: 1,
  },
  statCellCenter: {
    alignItems: "center",
  },
  statCellRight: {
    alignItems: "flex-end",
  },
  statValue: {
    color: "#eceef2",
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  divider: {
    height: 2,
    backgroundColor: "#ff7a00",
    borderRadius: 1,
    opacity: 0.4,
    marginBottom: 16,
  },
  message: {
    color: "#9ca3af",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  footer: {
    alignItems: "center",
    gap: 4,
  },
  tagline: {
    color: "#eceef2",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  username: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
  },
  appName: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 4,
  },
});
