import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FoodEntry, FoodItem } from "@/components/FoodEntry";
import { MacroRing } from "@/components/MacroRing";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

function today() {
  return new Date().toISOString().split("T")[0];
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snacks"] as const;

interface FoodDiaryResponse {
  entries: FoodItem[];
  totals?: { calories: number; protein: number; carbs: number; fat: number };
  targets?: { calories: number; protein: number; carbs: number; fat: number };
}

interface FoodSearchResult {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: number;
  servingUnit?: string;
}

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedDate] = useState(today);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<string>("breakfast");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery<FoodDiaryResponse>({
    queryKey: ["food", selectedDate],
    queryFn: () => apiFetch(`/me/food/${selectedDate}`),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function searchFood() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await apiFetch<FoodSearchResult[]>(`/foods/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addFood(item: FoodSearchResult) {
    try {
      await apiFetch(`/me/food/${selectedDate}`, {
        method: "POST",
        body: { foodId: item.id, meal: selectedMeal, quantity: 1 },
      });
      qc.invalidateQueries({ queryKey: ["food", selectedDate] });
      setAddModalVisible(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch {
      // ignore
    }
  }

  async function deleteFood(id: number) {
    try {
      await apiFetch(`/me/food/${selectedDate}/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["food", selectedDate] });
    } catch {
      // ignore
    }
  }

  const entries = data?.entries ?? [];
  const totals = data?.totals ?? entries.reduce(
    (acc, e) => ({ calories: acc.calories + (e.calories ?? 0), protein: acc.protein + (e.protein ?? 0), carbs: acc.carbs + (e.carbs ?? 0), fat: acc.fat + (e.fat ?? 0) }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const targets = data?.targets ?? { calories: 2000, protein: 150, carbs: 200, fat: 60 };

  const topPad = Platform.OS === "web" ? Math.max(insets.top + 67, 100) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 100 + bottomPad, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Nutrition</Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Food</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.ringCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <MacroRing
            calories={totals.calories}
            target={targets.calories}
            protein={totals.protein}
            carbs={totals.carbs}
            fat={totals.fat}
            size={130}
          />
          <View style={styles.targets}>
            <TargetRow label="Calories" val={totals.calories} target={targets.calories} colors={colors} color={colors.primary} />
            <TargetRow label="Protein" val={totals.protein} target={targets.protein} colors={colors} color="#60a5fa" />
            <TargetRow label="Carbs" val={totals.carbs} target={targets.carbs} colors={colors} color="#34d399" />
            <TargetRow label="Fat" val={totals.fat} target={targets.fat} colors={colors} color={colors.warning} />
          </View>
        </View>

        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          MEAL_TYPES.map((meal) => {
            const mealEntries = entries.filter((e) => (e.meal ?? "breakfast") === meal);
            return (
              <View key={meal} style={[styles.mealSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.mealHeader}>
                  <Text style={[styles.mealTitle, { color: colors.foreground }]}>
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                  <Text style={[styles.mealCals, { color: colors.mutedForeground }]}>
                    {mealEntries.reduce((s, e) => s + (e.calories ?? 0), 0)} kcal
                  </Text>
                </View>
                {mealEntries.length === 0 ? (
                  <Text style={[styles.emptyMeal, { color: colors.mutedForeground }]}>Nothing logged yet</Text>
                ) : (
                  mealEntries.map((item) => (
                    <FoodEntry key={item.id} item={item} onDelete={deleteFood} />
                  ))
                )}
                <TouchableOpacity
                  onPress={() => { setSelectedMeal(meal); setAddModalVisible(true); }}
                  style={styles.addMealBtn}
                >
                  <Feather name="plus" size={14} color={colors.primary} />
                  <Text style={[styles.addMealText, { color: colors.primary }]}>Add to {meal}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 24, paddingHorizontal: 16 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Food</Text>
            <TouchableOpacity onPress={() => { setAddModalVisible(false); setSearchResults([]); setSearchQuery(""); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search foods..."
              placeholderTextColor={colors.mutedForeground}
              onSubmitEditing={searchFood}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          <View style={styles.mealPicker}>
            {MEAL_TYPES.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setSelectedMeal(m)}
                style={[
                  styles.mealChip,
                  {
                    backgroundColor: selectedMeal === m ? colors.primary : colors.secondary,
                    borderRadius: 20,
                  },
                ]}
              >
                <Text style={[styles.mealChipText, { color: selectedMeal === m ? "#fff" : colors.mutedForeground }]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => addFood(item)}
                style={[styles.searchResult, { borderBottomColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.searchMacros, { color: colors.mutedForeground }]}>
                    {item.calories} kcal · P:{item.protein}g C:{item.carbs}g F:{item.fat}g
                  </Text>
                </View>
                <Feather name="plus-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              searchQuery && !searching ? (
                <Text style={[styles.noResults, { color: colors.mutedForeground }]}>
                  {searchResults.length === 0 ? "No results found" : ""}
                </Text>
              ) : null
            }
          />
        </View>
      </Modal>
    </View>
  );
}

function TargetRow({ label, val, target, colors, color }: { label: string; val: number; target: number; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; color: string }) {
  const pct = Math.min(val / Math.max(target, 1), 1);
  return (
    <View style={styles.targetRow}>
      <Text style={[styles.targetLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[styles.targetBar, { backgroundColor: colors.border }]}>
        <View style={[styles.targetFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.targetVal, { color: colors.foreground }]}>{val}/{target}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  ringCard: {
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: "center",
    gap: 16,
    flexDirection: "row",
  },
  targets: {
    flex: 1,
    gap: 8,
  },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  targetLabel: {
    fontSize: 11,
    width: 52,
  },
  targetBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  targetFill: {
    height: 4,
    borderRadius: 2,
  },
  targetVal: {
    fontSize: 10,
    width: 60,
    textAlign: "right",
  },
  mealSection: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mealCals: {
    fontSize: 13,
  },
  emptyMeal: {
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  addMealBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
  },
  addMealText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  mealPicker: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  mealChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mealChipText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchName: {
    fontSize: 14,
    fontWeight: "500",
  },
  searchMacros: {
    fontSize: 12,
    marginTop: 2,
  },
  noResults: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
});
