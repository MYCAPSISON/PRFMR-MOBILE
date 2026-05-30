import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import Svg, { Circle } from "react-native-svg";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
const MEALS: { key: Meal; label: string; icon: any }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunrise" },
  { key: "lunch", label: "Lunch", icon: "sun" },
  { key: "dinner", label: "Dinner", icon: "moon" },
  { key: "snack", label: "Snacks", icon: "coffee" },
];

function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(d: string, n: number) {
  const date = new Date(d + "T12:00:00");
  date.setDate(date.getDate() + n);
  return date.toISOString().split("T")[0];
}
function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [addModal, setAddModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal>("lunch");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [grams, setGrams] = useState("100");
  const [refreshing, setRefreshing] = useState(false);
  const isToday = selectedDate === todayStr();

  const { data: food = [] } = useQuery<any[]>({
    queryKey: ["/api/me/food", selectedDate],
    queryFn: () => apiFetch(`/me/food/${selectedDate}`),
  });
  const { data: targets } = useQuery<any>({
    queryKey: ["/api/me/targets/effective", selectedDate],
    queryFn: () => apiFetch(`/me/targets/effective?date=${selectedDate}`),
  });
  const { data: amqs } = useQuery<any>({
    queryKey: ["/api/me/amqs/score", selectedDate],
    queryFn: () => apiFetch(`/me/amqs/score/${selectedDate}`),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/me/food"] }),
      qc.invalidateQueries({ queryKey: ["/api/me/targets/effective"] }),
      qc.invalidateQueries({ queryKey: ["/api/me/amqs/score"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/food/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/food"] });
      qc.invalidateQueries({ queryKey: ["/api/me/amqs/score"] });
    },
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/food", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/food"] });
      qc.invalidateQueries({ queryKey: ["/api/me/targets/effective"] });
      qc.invalidateQueries({ queryKey: ["/api/me/amqs/score"] });
      closeModal();
    },
  });

  function closeModal() {
    setAddModal(false);
    setSelectedFood(null);
    setQuery("");
    setResults([]);
    setGrams("100");
  }

  async function doSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await apiFetch<any[]>(`/foods/search?q=${encodeURIComponent(q.trim())}`);
      setResults(Array.isArray(r) ? r.slice(0, 20) : []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function confirmAdd() {
    if (!selectedFood) return;
    const g = parseFloat(grams) || 100;
    const r = g / 100;
    const name = selectedFood.name ?? selectedFood.product_name ?? "Unknown";
    const cal = (selectedFood.calories ?? selectedFood.nutriments?.["energy-kcal_100g"] ?? selectedFood.nutriments?.energy_kcal_100g ?? 0) * r;
    const prot = (selectedFood.protein ?? selectedFood.nutriments?.proteins_100g ?? 0) * r;
    const carb = (selectedFood.carbs ?? selectedFood.nutriments?.carbohydrates_100g ?? 0) * r;
    const fat = (selectedFood.fat ?? selectedFood.nutriments?.fat_100g ?? 0) * r;
    addMutation.mutate({ name, calories: Math.round(cal), protein: Math.round(prot), carbs: Math.round(carb), fat: Math.round(fat), grams: Math.round(g), meal: selectedMeal, date: selectedDate, sourceType: "manual" });
  }

  const totalCal = food.reduce((s: number, e: any) => s + (e.calories || 0), 0);
  const totalProt = food.reduce((s: number, e: any) => s + (e.protein || 0), 0);
  const totalCarbs = food.reduce((s: number, e: any) => s + (e.carbs || 0), 0);
  const totalFat = food.reduce((s: number, e: any) => s + (e.fat || 0), 0);
  const targetCal = targets?.adjustedCalories ?? targets?.targetCalories ?? 2000;
  const targetProt = targets?.targetProtein ?? 150;
  const targetCarbs2 = targets?.targetCarbs ?? 200;
  const targetFat = targets?.targetFat ?? 70;
  const calPct = Math.min(totalCal / targetCal, 1);
  const circ = 2 * Math.PI * 42;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.row}>
          <Text style={[styles.title, { color: colors.foreground }]}>Nutrition</Text>
          {amqs?.score != null && (
            <View style={[styles.badge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>AMQS {amqs.score}</Text>
            </View>
          )}
        </View>

        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => setSelectedDate(d => addDays(d, -1))} style={styles.navBtn}>
            <Feather name="chevron-left" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.dateText, { color: colors.foreground }]}>{isToday ? "Today" : formatDate(selectedDate)}</Text>
          <TouchableOpacity onPress={() => setSelectedDate(d => addDays(d, 1))} style={[styles.navBtn, { opacity: isToday ? 0.3 : 1 }]} disabled={isToday}>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Svg width={100} height={100}>
                <Circle cx={50} cy={50} r={42} stroke={colors.secondary} strokeWidth={8} fill="none" />
                <Circle cx={50} cy={50} r={42} stroke={colors.primary} strokeWidth={8} fill="none"
                  strokeDasharray={`${calPct * circ} ${circ - calPct * circ}`}
                  strokeDashoffset={circ / 4} strokeLinecap="round" />
              </Svg>
              <View style={{ position: "absolute", alignItems: "center" }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>{totalCal}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>kcal</Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {[
                { label: "Protein", val: totalProt, max: targetProt, color: colors.info },
                { label: "Carbs", val: totalCarbs, max: targetCarbs2, color: colors.warning },
                { label: "Fat", val: totalFat, max: targetFat, color: colors.primary },
              ].map(m => (
                <View key={m.label}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{m.label}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: "600" }}>{m.val}/{m.max}g</Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: colors.secondary, borderRadius: 2 }}>
                    <View style={{ height: 4, width: `${Math.min(m.val / m.max, 1) * 100}%`, backgroundColor: m.color, borderRadius: 2 }} />
                  </View>
                </View>
              ))}
              <Text style={{ color: totalCal <= targetCal ? colors.success : colors.destructive, fontSize: 12, fontWeight: "700" }}>
                {totalCal <= targetCal ? `${targetCal - totalCal} kcal remaining` : `${totalCal - targetCal} kcal over`}
              </Text>
            </View>
          </View>
        </View>

        {MEALS.map(meal => {
          const entries = food.filter((e: any) => (e.meal ?? e.mealType) === meal.key);
          const mealCal = entries.reduce((s: number, e: any) => s + (e.calories || 0), 0);
          return (
            <View key={meal.key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
              <View style={[styles.row, { marginBottom: 8 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name={meal.icon} size={16} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>{meal.label}</Text>
                  {mealCal > 0 && <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{mealCal} kcal</Text>}
                </View>
                <TouchableOpacity onPress={() => { setSelectedMeal(meal.key); setAddModal(true); }}
                  style={[styles.addBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
                  <Feather name="plus" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {entries.length === 0 && (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontStyle: "italic", paddingVertical: 4 }}>Nothing logged</Text>
              )}
              {entries.map((entry: any) => (
                <View key={entry.id} style={[styles.entryRow, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{entry.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{entry.grams}g · P{entry.protein} C{entry.carbs} F{entry.fat}</Text>
                  </View>
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>{entry.calories}</Text>
                  <TouchableOpacity onPress={() => Alert.alert("Delete", `Remove "${entry.name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(entry.id) }])} style={{ padding: 8 }}>
                    <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>
              Add Food — {MEALS.find(m => m.key === selectedMeal)?.label}
            </Text>
            <TouchableOpacity onPress={closeModal}><Feather name="x" size={24} color={colors.foreground} /></TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 8, padding: 12 }}>
            {MEALS.map(m => (
              <TouchableOpacity key={m.key} onPress={() => setSelectedMeal(m.key)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: selectedMeal === m.key ? colors.primary : colors.secondary }}>
                <Text style={{ color: selectedMeal === m.key ? "#fff" : colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!selectedFood ? (
            <>
              <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="search" size={18} color={colors.mutedForeground} />
                <TextInput style={[styles.searchInput, { color: colors.foreground }]} placeholder="Search foods..." placeholderTextColor={colors.mutedForeground}
                  value={query} onChangeText={doSearch} autoFocus />
                {searching && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <FlatList data={results} keyExtractor={(_, i) => String(i)}
                ListEmptyComponent={query.length > 1 && !searching ? (
                  <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 32 }}>No results found</Text>
                ) : null}
                renderItem={({ item }) => {
                  const name = item.name ?? item.product_name ?? "Unknown";
                  const brand = item.brand ?? item.brands ?? "";
                  const cal = Math.round(item.calories ?? item.nutriments?.["energy-kcal_100g"] ?? item.nutriments?.energy_kcal_100g ?? 0);
                  const prot = Math.round(item.protein ?? item.nutriments?.proteins_100g ?? 0);
                  const carb = Math.round(item.carbs ?? item.nutriments?.carbohydrates_100g ?? 0);
                  const fat = Math.round(item.fat ?? item.nutriments?.fat_100g ?? 0);
                  return (
                    <TouchableOpacity onPress={() => setSelectedFood(item)} style={[styles.resultRow, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontWeight: "600" }} numberOfLines={1}>{name}</Text>
                        {brand ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{brand}</Text> : null}
                        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>P{prot} C{carb} F{fat} per 100g</Text>
                      </View>
                      <Text style={{ color: colors.primary, fontWeight: "700" }}>{cal}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{selectedFood.name ?? selectedFood.product_name}</Text>
              {(selectedFood.brand ?? selectedFood.brands) ? <Text style={{ color: colors.mutedForeground }}>{selectedFood.brand ?? selectedFood.brands}</Text> : null}
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600", marginTop: 8 }}>SERVING SIZE (grams)</Text>
              <TextInput style={[styles.gramsInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={grams} onChangeText={setGrams} keyboardType="numeric" />
              {(() => {
                const g = parseFloat(grams) || 100;
                const r = g / 100;
                const cal = Math.round((selectedFood.calories ?? selectedFood.nutriments?.["energy-kcal_100g"] ?? selectedFood.nutriments?.energy_kcal_100g ?? 0) * r);
                const prot = Math.round((selectedFood.protein ?? selectedFood.nutriments?.proteins_100g ?? 0) * r);
                const carb = Math.round((selectedFood.carbs ?? selectedFood.nutriments?.carbohydrates_100g ?? 0) * r);
                const fat = Math.round((selectedFood.fat ?? selectedFood.nutriments?.fat_100g ?? 0) * r);
                return (
                  <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
                    {[{ l: "Calories", v: cal, u: "kcal" }, { l: "Protein", v: prot, u: "g" }, { l: "Carbs", v: carb, u: "g" }, { l: "Fat", v: fat, u: "g" }].map(s => (
                      <View key={s.l} style={{ alignItems: "center" }}>
                        <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>{s.v}</Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.u}</Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{s.l}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
              <TouchableOpacity onPress={confirmAdd} disabled={addMutation.isPending}
                style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                {addMutation.isPending ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add to {MEALS.find(m => m.key === selectedMeal)?.label}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedFood(null)} style={{ alignItems: "center", padding: 12 }}>
                <Text style={{ color: colors.mutedForeground }}>← Back to search</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "800" },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 13, fontWeight: "700" },
  dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  navBtn: { padding: 6 },
  dateText: { fontSize: 15, fontWeight: "600", minWidth: 140, textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  addBtn: { padding: 8, borderRadius: 8, borderWidth: 1 },
  entryRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10, borderTopWidth: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  gramsInput: { height: 52, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 22, textAlign: "center" },
});
