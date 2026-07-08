import React, { useState, useCallback, useMemo } from "react";
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
import { INGREDIENTS_DATA } from "@/lib/ingredients-data";
import Svg, { Circle } from "react-native-svg";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
type TabId = "search" | "wholefood" | "barcode" | "custom";

const MEALS: { key: Meal; label: string; icon: any }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunrise" },
  { key: "lunch", label: "Lunch", icon: "sun" },
  { key: "dinner", label: "Dinner", icon: "moon" },
  { key: "snack", label: "Snacks", icon: "coffee" },
];

const MODAL_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "search", label: "Search", icon: "search" },
  { id: "wholefood", label: "Whole Food", icon: "box" },
  { id: "barcode", label: "Barcode", icon: "maximize" },
  { id: "custom", label: "Custom", icon: "edit-2" },
];

interface NormalizedFood {
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fibrePer100g: number;
  sourceType: "off" | "database" | "manual" | "ingredient";
  ingredientIndex?: number;
}


function normalize(item: any, sourceType: "off" | "database" | "manual"): NormalizedFood {
  return {
    name: item.name ?? item.product_name ?? "Unknown",
    brand: item.brand ?? item.brands ?? undefined,
    caloriesPer100g: item.caloriesPer100g ?? item.calories ?? item.nutriments?.["energy-kcal_100g"] ?? item.nutriments?.energy_kcal_100g ?? 0,
    proteinPer100g: item.proteinPer100g ?? item.protein ?? item.nutriments?.proteins_100g ?? 0,
    carbsPer100g: item.carbsPer100g ?? item.carbs ?? item.nutriments?.carbohydrates_100g ?? 0,
    fatPer100g: item.fatPer100g ?? item.fat ?? item.nutriments?.fat_100g ?? 0,
    fibrePer100g: item.fibrePer100g ?? item.fibre ?? item.nutriments?.fiber_100g ?? item.nutriments?.fibre_100g ?? 0,
    sourceType,
  };
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function addDays(d: string, n: number) {
  const date = new Date(d + "T12:00:00");
  date.setDate(date.getDate() + n);
  return date.toISOString().split("T")[0];
}
function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function r1(n: number) { return Math.round(n * 10) / 10; }

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [refreshing, setRefreshing] = useState(false);
  const isToday = selectedDate === todayStr();

  const [addModal, setAddModal] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal>("lunch");
  const [activeTab, setActiveTab] = useState<TabId>("search");

  const [selectedFood, setSelectedFood] = useState<NormalizedFood | null>(null);
  const [grams, setGrams] = useState("100");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [barcodeCode, setBarcodeCode] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");

  const [customName, setCustomName] = useState("");
  const [customGrams, setCustomGrams] = useState("100");
  const [customCal, setCustomCal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customFat, setCustomFat] = useState("");
  const [customFibre, setCustomFibre] = useState("0");

  const { data: food = [] } = useQuery<any[]>({
    queryKey: ["food", selectedDate],
    queryFn: () => apiFetch(`/me/food/${selectedDate}`),
  });
  const { data: targets } = useQuery<any>({
    queryKey: ["targets", selectedDate],
    queryFn: () => apiFetch(`/me/targets/effective?date=${selectedDate}`),
  });
  const { data: amqs } = useQuery<any>({
    queryKey: ["amqs-score", selectedDate],
    queryFn: () => apiFetch(`/me/amqs/score/${selectedDate}`),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["food", selectedDate] }),
      qc.invalidateQueries({ queryKey: ["targets", selectedDate] }),
      qc.invalidateQueries({ queryKey: ["amqs-score", selectedDate] }),
    ]);
    setRefreshing(false);
  }, [qc, selectedDate]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/food/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", selectedDate] });
      qc.invalidateQueries({ queryKey: ["amqs-score", selectedDate] });
    },
  });

  const addMutation = useMutation({
    mutationFn: (body: object) => {
      if (__DEV__) console.log("[nutrition] POST /food payload:", JSON.stringify(body));
      return apiFetch("/food", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food", selectedDate] });
      qc.invalidateQueries({ queryKey: ["targets", selectedDate] });
      qc.invalidateQueries({ queryKey: ["amqs-score", selectedDate] });
      closeModal();
    },
    onError: (err: any) => {
      console.error("[nutrition] POST /food error:", err?.message ?? err);
      Alert.alert("Could not add food", err?.message ?? "Unknown error");
    },
  });

  function closeModal() {
    setAddModal(false);
    setSelectedFood(null);
    setQuery(""); setResults([]); setGrams("100");
    setBarcodeCode(""); setBarcodeError("");
    setCustomName(""); setCustomGrams("100"); setCustomCal("");
    setCustomProtein(""); setCustomCarbs(""); setCustomFat(""); setCustomFibre("0");
  }

  function openModal(meal: Meal) {
    setSelectedMeal(meal);
    setActiveTab("search");
    setAddModal(true);
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

  async function lookupBarcode() {
    const code = barcodeCode.trim();
    if (!code) return;
    setBarcodeLoading(true); setBarcodeError("");
    try {
      const result = await apiFetch<any>(`/food/barcode/${code}`);
      if (!result || (!result.name && !result.product_name)) {
        setBarcodeError("No food found for this barcode.");
      } else {
        setSelectedFood(normalize(result, "off"));
        setGrams("100");
      }
    } catch (err: any) {
      setBarcodeError(err?.message ?? "Barcode lookup failed");
    } finally {
      setBarcodeLoading(false);
    }
  }

  function buildPayload(food: NormalizedFood, gramsStr: string) {
    const g = parseFloat(gramsStr) || 100;
    const r = g / 100;
    const isIngredient = food.sourceType === "ingredient" && food.ingredientIndex != null;
    return {
      name: food.name,
      calories: Math.round(food.caloriesPer100g * r),
      protein: r1(food.proteinPer100g * r),
      carbs: r1(food.carbsPer100g * r),
      fat: r1(food.fatPer100g * r),
      fibre: r1(food.fibrePer100g * r),
      grams: Math.round(g),
      meal: selectedMeal,
      date: selectedDate,
      sourceType: isIngredient ? "ingredient" : food.sourceType === "manual" ? "manual" : "off",
      ...(isIngredient ? { ingredientIndex: food.ingredientIndex } : {}),
      macroSource: isIngredient ? "ingredient" : "manual",
      microSource: isIngredient ? "ingredient" : "none",
      enteredBasis: "cooked",
      isRawWeight: false,
    };
  }

  function confirmAdd() {
    if (!selectedFood) return;
    addMutation.mutate(buildPayload(selectedFood, grams));
  }

  function addCustom() {
    const g = parseFloat(customGrams) || 100;
    addMutation.mutate({
      name: customName.trim(),
      calories: parseFloat(customCal) || 0,
      protein: parseFloat(customProtein) || 0,
      carbs: parseFloat(customCarbs) || 0,
      fat: parseFloat(customFat) || 0,
      fibre: parseFloat(customFibre) || 0,
      grams: Math.round(g),
      meal: selectedMeal,
      date: selectedDate,
      sourceType: "manual",
      macroSource: "manual",
      microSource: "none",
      enteredBasis: "cooked",
      isRawWeight: false,
    });
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
                { label: "Protein", val: Math.round(totalProt), max: targetProt, color: colors.info },
                { label: "Carbs", val: Math.round(totalCarbs), max: targetCarbs2, color: colors.warning },
                { label: "Fat", val: Math.round(totalFat), max: targetFat, color: colors.primary },
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
                <TouchableOpacity onPress={() => openModal(meal.key)}
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
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{entry.grams}g · P{Math.round(entry.protein)} C{Math.round(entry.carbs)} F{Math.round(entry.fat)}</Text>
                  </View>
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>{Math.round(entry.calories)}</Text>
                  <TouchableOpacity onPress={() => Alert.alert("Delete", `Remove "${entry.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(entry.id) },
                  ])} style={{ padding: 8 }}>
                    <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Add Food</Text>
            <TouchableOpacity onPress={closeModal}><Feather name="x" size={24} color={colors.foreground} /></TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 }}>
            {MEALS.map(m => (
              <TouchableOpacity key={m.key} onPress={() => setSelectedMeal(m.key)}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center",
                  backgroundColor: selectedMeal === m.key ? colors.primary : colors.secondary }}>
                <Text style={{ color: selectedMeal === m.key ? "#fff" : colors.mutedForeground, fontSize: 10, fontWeight: "700" }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
            {MODAL_TABS.map(tab => (
              <TouchableOpacity key={tab.id} onPress={() => { setActiveTab(tab.id); setSelectedFood(null); }}
                style={{ flex: 1, paddingVertical: 10, alignItems: "center", gap: 2,
                  borderBottomWidth: 2, borderBottomColor: activeTab === tab.id ? colors.primary : "transparent" }}>
                <Feather name={tab.icon as any} size={14} color={activeTab === tab.id ? colors.primary : colors.mutedForeground} />
                <Text style={{ color: activeTab === tab.id ? colors.primary : colors.mutedForeground, fontSize: 10, fontWeight: "700" }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selectedFood ? (
            <ConfirmView
              food={selectedFood} grams={grams} onGramsChange={setGrams}
              onConfirm={confirmAdd} onBack={() => setSelectedFood(null)}
              isPending={addMutation.isPending} colors={colors}
            />
          ) : (
            <>
              {activeTab === "search" && (
                <SearchTab query={query} onQueryChange={doSearch} results={results}
                  searching={searching} colors={colors} onSelect={item => { setSelectedFood(normalize(item, "off")); setGrams("100"); }} />
              )}
              {activeTab === "wholefood" && (
                <WholeFoodTab colors={colors} onSelect={wf => { setSelectedFood(wf); setGrams("100"); }} />
              )}
              {activeTab === "barcode" && (
                <BarcodeTab code={barcodeCode} onCodeChange={setBarcodeCode} onLookup={lookupBarcode}
                  loading={barcodeLoading} error={barcodeError} colors={colors} />
              )}
              {activeTab === "custom" && (
                <CustomTab
                  name={customName} setName={setCustomName}
                  grams={customGrams} setGrams={setCustomGrams}
                  cal={customCal} setCal={setCustomCal}
                  protein={customProtein} setProtein={setCustomProtein}
                  carbs={customCarbs} setCarbs={setCustomCarbs}
                  fat={customFat} setFat={setCustomFat}
                  fibre={customFibre} setFibre={setCustomFibre}
                  onAdd={addCustom} isPending={addMutation.isPending} colors={colors}
                />
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

function ConfirmView({ food, grams, onGramsChange, onConfirm, onBack, isPending, colors }: {
  food: NormalizedFood; grams: string; onGramsChange: (g: string) => void;
  onConfirm: () => void; onBack: () => void; isPending: boolean; colors: any;
}) {
  const g = parseFloat(grams) || 100;
  const r = g / 100;
  const cal = Math.round(food.caloriesPer100g * r);
  const prot = r1(food.proteinPer100g * r);
  const carbs = r1(food.carbsPer100g * r);
  const fat = r1(food.fatPer100g * r);
  const fibre = r1(food.fibrePer100g * r);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{food.name}</Text>
      {food.brand ? <Text style={{ color: colors.mutedForeground }}>{food.brand}</Text> : null}

      <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "700", marginTop: 8 }}>SERVING SIZE (grams)</Text>
      <TextInput
        style={{ height: 52, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.secondary, paddingHorizontal: 14, fontSize: 22, textAlign: "center", color: colors.foreground }}
        value={grams} onChangeText={onGramsChange} keyboardType="numeric" selectTextOnFocus
      />

      <View style={{ flexDirection: "row", justifyContent: "space-around", backgroundColor: colors.card,
        borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
        {[
          { l: "Calories", v: cal, u: "kcal" },
          { l: "Protein", v: prot, u: "g" },
          { l: "Carbs", v: carbs, u: "g" },
          { l: "Fat", v: fat, u: "g" },
          { l: "Fibre", v: fibre, u: "g" },
        ].map(s => (
          <View key={s.l} style={{ alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "800" }}>{s.v}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{s.u}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 9 }}>{s.l}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={onConfirm} disabled={isPending}
        style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
        {isPending ? <ActivityIndicator color="#fff" /> : (
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Food</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ alignItems: "center", padding: 12 }}>
        <Text style={{ color: colors.mutedForeground }}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SearchTab({ query, onQueryChange, results, searching, colors, onSelect }: {
  query: string; onQueryChange: (q: string) => void; results: any[];
  searching: boolean; colors: any; onSelect: (item: any) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput style={{ flex: 1, color: colors.foreground, fontSize: 15, marginLeft: 8 }}
          placeholder="Search foods..." placeholderTextColor={colors.mutedForeground}
          value={query} onChangeText={onQueryChange} autoFocus />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
      <FlatList
        data={results}
        keyExtractor={(_, i) => String(i)}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.length > 1 && !searching
            ? <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 32 }}>No results</Text>
            : query.length < 2
            ? <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 32, fontSize: 13 }}>Type to search the food database</Text>
            : null
        }
        renderItem={({ item }) => {
          const name = item.name ?? item.product_name ?? "Unknown";
          const brand = item.brand ?? item.brands ?? "";
          const cal = Math.round(item.caloriesPer100g ?? item.calories ?? item.nutriments?.["energy-kcal_100g"] ?? 0);
          const prot = Math.round(item.proteinPer100g ?? item.protein ?? item.nutriments?.proteins_100g ?? 0);
          const carbs = Math.round(item.carbsPer100g ?? item.carbs ?? item.nutriments?.carbohydrates_100g ?? 0);
          const fat = Math.round(item.fatPer100g ?? item.fat ?? item.nutriments?.fat_100g ?? 0);
          return (
            <TouchableOpacity onPress={() => onSelect(item)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }} numberOfLines={1}>{name}</Text>
                {brand ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{brand}</Text> : null}
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>P{prot} C{carbs} F{fat} per 100g</Text>
              </View>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>{cal}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function WholeFoodTab({ colors, onSelect }: { colors: any; onSelect: (food: NormalizedFood) => void }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const indexed = INGREDIENTS_DATA.map((ing, idx) => ({ ing, idx }));
  const list = term
    ? indexed.filter(({ ing }) => ing.name.toLowerCase().indexOf(term) !== -1)
    : indexed;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 6 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: colors.secondary, borderRadius: 10, borderWidth: 1,
        borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
        <Feather name="search" size={14} color={colors.mutedForeground} />
        <TextInput
          style={{ flex: 1, color: colors.foreground, fontSize: 14 }}
          placeholder="Search whole foods…" placeholderTextColor={colors.mutedForeground}
          value={q} onChangeText={setQ} autoCorrect={false}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      {list.length === 0 && (
        <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", marginTop: 24 }}>
          No match found
        </Text>
      )}
      {list.map(({ ing, idx }) => (
        <TouchableOpacity key={ing.name} onPress={() => onSelect({ ...ing, sourceType: "ingredient", ingredientIndex: idx })}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
            backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>{ing.name}</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
              P{ing.proteinPer100g} · C{ing.carbsPer100g} · F{ing.fatPer100g} per 100g
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontWeight: "700", marginRight: 4 }}>{ing.caloriesPer100g}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>kcal</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function BarcodeTab({ code, onCodeChange, onLookup, loading, error, colors }: {
  code: string; onCodeChange: (c: string) => void; onLookup: () => void;
  loading: boolean; error: string; colors: any;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
        Enter the barcode number from the food packaging.
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TextInput
          style={{ flex: 1, height: 52, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.secondary, paddingHorizontal: 14, fontSize: 18, color: colors.foreground,
            fontFamily: "monospace" }}
          placeholder="e.g. 5000112548167" placeholderTextColor={colors.mutedForeground}
          value={code} onChangeText={onCodeChange} keyboardType="number-pad"
          returnKeyType="search" onSubmitEditing={onLookup}
        />
        <TouchableOpacity onPress={onLookup} disabled={loading || !code.trim()}
          style={{ height: 52, paddingHorizontal: 16, borderRadius: 10, alignItems: "center",
            justifyContent: "center", backgroundColor: code.trim() ? colors.primary : colors.secondary }}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={{ color: code.trim() ? "#fff" : colors.mutedForeground, fontWeight: "700" }}>Lookup</Text>}
        </TouchableOpacity>
      </View>
      {!!error && (
        <View style={{ backgroundColor: colors.destructive + "22", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.destructive + "44" }}>
          <Text style={{ color: colors.destructive, fontSize: 14 }}>{error}</Text>
        </View>
      )}
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontStyle: "italic" }}>
        Barcode scanner (camera) coming soon. For now, enter the number manually.
      </Text>
    </ScrollView>
  );
}

function CustomTab({ name, setName, grams, setGrams, cal, setCal, protein, setProtein,
  carbs, setCarbs, fat, setFat, fibre, setFibre, onAdd, isPending, colors }: {
  name: string; setName: (v: string) => void;
  grams: string; setGrams: (v: string) => void;
  cal: string; setCal: (v: string) => void;
  protein: string; setProtein: (v: string) => void;
  carbs: string; setCarbs: (v: string) => void;
  fat: string; setFat: (v: string) => void;
  fibre: string; setFibre: (v: string) => void;
  onAdd: () => void; isPending: boolean; colors: any;
}) {
  const canAdd = name.trim().length > 0 && (parseFloat(cal) || 0) >= 0 && (parseFloat(grams) || 0) > 0;

  const fields = [
    { label: "Calories (kcal) *", val: cal, set: setCal, kb: "decimal-pad" },
    { label: "Protein (g)", val: protein, set: setProtein, kb: "decimal-pad" },
    { label: "Carbs (g)", val: carbs, set: setCarbs, kb: "decimal-pad" },
    { label: "Fat (g)", val: fat, set: setFat, kb: "decimal-pad" },
    { label: "Fibre (g)", val: fibre, set: setFibre, kb: "decimal-pad" },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>FOOD NAME *</Text>
        <TextInput
          style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.secondary, paddingHorizontal: 14, fontSize: 15, color: colors.foreground }}
          placeholder="e.g. Chicken breast" placeholderTextColor={colors.mutedForeground}
          value={name} onChangeText={setName}
        />
      </View>
      <View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>GRAMS *</Text>
        <TextInput
          style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.secondary, paddingHorizontal: 14, fontSize: 15, color: colors.foreground }}
          placeholder="100" placeholderTextColor={colors.mutedForeground}
          value={grams} onChangeText={setGrams} keyboardType="decimal-pad"
        />
      </View>
      {fields.map(f => (
        <View key={f.label}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>{f.label.toUpperCase()}</Text>
          <TextInput
            style={{ height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
              backgroundColor: colors.secondary, paddingHorizontal: 14, fontSize: 15, color: colors.foreground }}
            placeholder="0" placeholderTextColor={colors.mutedForeground}
            value={f.val} onChangeText={f.set} keyboardType={f.kb as any}
          />
        </View>
      ))}
      <TouchableOpacity onPress={onAdd} disabled={!canAdd || isPending}
        style={{ height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4,
          backgroundColor: canAdd ? colors.primary : colors.secondary }}>
        {isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ color: canAdd ? "#fff" : colors.mutedForeground, fontWeight: "700", fontSize: 16 }}>Add Food</Text>}
      </TouchableOpacity>
    </ScrollView>
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
  searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginVertical: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
});
