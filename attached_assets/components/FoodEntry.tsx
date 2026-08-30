import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export interface FoodItem {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: number;
  servingUnit?: string;
  quantity?: number;
  meal?: string;
}

interface FoodEntryProps {
  item: FoodItem;
  onDelete?: (id: number) => void;
}

export function FoodEntry({ item, onDelete }: FoodEntryProps) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.macros, { color: colors.mutedForeground }]}>
          P:{item.protein}g · C:{item.carbs}g · F:{item.fat}g
          {item.servingSize ? ` · ${item.quantity ?? 1}×${item.servingSize}${item.servingUnit ?? "g"}` : ""}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.calories, { color: colors.foreground }]}>{item.calories}</Text>
        <Text style={[styles.kcal, { color: colors.mutedForeground }]}>kcal</Text>
        {onDelete && (
          <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.del} hitSlop={8}>
            <Feather name="trash-2" size={14} color={colors.destructive} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: "500",
  },
  macros: {
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 4,
    alignSelf: "center",
  },
  calories: {
    fontSize: 15,
    fontWeight: "700",
  },
  kcal: {
    fontSize: 11,
    marginTop: 3,
  },
  del: {
    marginLeft: 8,
  },
});
