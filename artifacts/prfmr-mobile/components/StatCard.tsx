import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  accent?: boolean;
}

export function StatCard({ label, value, unit, subtitle, accent }: StatCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accent ? colors.primary + "22" : colors.card,
          borderColor: accent ? colors.primary + "44" : colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accent ? colors.primary : colors.foreground }]}>
          {value}
        </Text>
        {unit ? <Text style={[styles.unit, { color: colors.mutedForeground }]}>{unit}</Text> : null}
      </View>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  unit: {
    fontSize: 13,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
});
