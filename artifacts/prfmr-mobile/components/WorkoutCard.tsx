import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export interface WorkoutSession {
  id: number;
  date: string;
  type: string;
  duration?: number;
  notes?: string;
  rpe?: number;
  exercises?: { name: string; sets: number; reps: number; weight?: number }[];
}

interface WorkoutCardProps {
  session: WorkoutSession;
  onPress?: () => void;
}

export function WorkoutCard({ session, onPress }: WorkoutCardProps) {
  const colors = useColors();
  const date = new Date(session.date);
  const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.type, { color: colors.foreground }]}>{session.type}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>{formattedDate}</Text>
        </View>
        <View style={styles.meta}>
          {session.rpe != null && (
            <View style={[styles.rpeBadge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
              <Text style={[styles.rpeText, { color: colors.primary }]}>RPE {session.rpe}</Text>
            </View>
          )}
          {session.duration != null && (
            <View style={styles.duration}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text style={[styles.durationText, { color: colors.mutedForeground }]}>{session.duration}m</Text>
            </View>
          )}
        </View>
      </View>
      {session.exercises && session.exercises.length > 0 && (
        <View style={styles.exercises}>
          {session.exercises.slice(0, 3).map((ex, idx) => (
            <Text key={idx} style={[styles.exercise, { color: colors.mutedForeground }]}>
              {ex.name} — {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}kg` : ""}
            </Text>
          ))}
          {session.exercises.length > 3 && (
            <Text style={[styles.more, { color: colors.primary }]}>+{session.exercises.length - 3} more</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  type: {
    fontSize: 15,
    fontWeight: "600",
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  meta: {
    alignItems: "flex-end",
    gap: 4,
  },
  rpeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  rpeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  duration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  durationText: {
    fontSize: 11,
  },
  exercises: {
    marginTop: 10,
    gap: 3,
  },
  exercise: {
    fontSize: 12,
  },
  more: {
    fontSize: 12,
    fontWeight: "600",
  },
});
