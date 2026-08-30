import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface MacroRingProps {
  calories: number;
  target: number;
  protein: number;
  carbs: number;
  fat: number;
  size?: number;
}

export function MacroRing({ calories, target, protein, carbs, fat, size = 120 }: MacroRingProps) {
  const colors = useColors();
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(calories / Math.max(target, 1), 1);
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={8}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={8}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.calValue, { color: colors.foreground }]}>{calories}</Text>
        <Text style={[styles.calLabel, { color: colors.mutedForeground }]}>kcal</Text>
      </View>
      <View style={styles.macros}>
        <MacroItem label="P" value={protein} color="#60a5fa" />
        <MacroItem label="C" value={carbs} color="#34d399" />
        <MacroItem label="F" value={fat} color={colors.primary} />
      </View>
    </View>
  );
}

function MacroItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.macroItem}>
      <Text style={[styles.macroLabel, { color }]}>{label}</Text>
      <Text style={[styles.macroValue]}>{value}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  svg: {},
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  calValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  calLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  macros: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  macroItem: {
    alignItems: "center",
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  macroValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f0f2f5",
  },
});
