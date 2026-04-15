import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface ReadinessCardProps {
  score: number;
  label?: string;
  details?: Record<string, number>;
}

function getScoreColor(score: number, primary: string, warning: string, destructive: string): string {
  if (score >= 75) return primary;
  if (score >= 50) return warning;
  return destructive;
}

export function ReadinessCard({ score, label, details }: ReadinessCardProps) {
  const colors = useColors();
  const color = getScoreColor(score, colors.success, colors.warning, colors.destructive);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.row}>
        <View>
          <Text style={[styles.title, { color: colors.mutedForeground }]}>Readiness Score</Text>
          {label ? <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text> : null}
        </View>
        <View style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
          <Text style={[styles.score, { color }]}>{score}</Text>
        </View>
      </View>
      {details && (
        <View style={styles.details}>
          {Object.entries(details).map(([key, val]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: colors.mutedForeground }]}>
                {key.replace(/_/g, " ")}
              </Text>
              <View style={[styles.bar, { backgroundColor: colors.border }]}>
                <View style={[styles.barFill, { width: `${val}%`, backgroundColor: color }]} />
              </View>
              <Text style={[styles.detailVal, { color: colors.foreground }]}>{val}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 22,
    fontWeight: "700",
  },
  details: {
    marginTop: 14,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailKey: {
    fontSize: 11,
    textTransform: "capitalize",
    width: 90,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  detailVal: {
    fontSize: 11,
    fontWeight: "600",
    width: 28,
    textAlign: "right",
  },
});
