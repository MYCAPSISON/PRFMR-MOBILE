import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { apiFetch } from "@/lib/api";
import { INGREDIENTS_DATA } from "@/lib/ingredients-data";

const ORANGE = "#F97316";
const TARGET_CALORIES = 2200;
type Tab = "search" | "whole" | "barcode" | "custom";

type DemoFood = {
  name: string;
  brand?: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
};

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
type DemoEntry = DemoFood & { id: string; grams: number; meal: Meal };

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFood(item: any): DemoFood {
  const macros = item?.macros_per_100g ?? item?.off?.macros_per_100g ?? {};
  const nutriments = item?.nutriments ?? {};
  return {
    name: item?.name ?? item?.off?.name ?? item?.product_name ?? "Unknown food",
    brand: item?.brand ?? item?.off?.brand ?? item?.brands ?? undefined,
    imageUrl: item?.image_url ?? item?.imageUrl ?? item?.image ?? item?.off?.image_url
      ?? item?.image_front_url ?? item?.image_front_small_url ?? item?.image_front_thumb_url ?? undefined,
    calories: number(item?.caloriesPer100g ?? item?.calories_per_100g ?? macros.kcal ?? item?.calories ?? nutriments["energy-kcal_100g"]),
    protein: number(item?.proteinPer100g ?? item?.protein_g_per_100g ?? macros.protein ?? item?.protein ?? nutriments.proteins_100g),
    carbs: number(item?.carbsPer100g ?? item?.carbs_g_per_100g ?? macros.carbs ?? item?.carbs ?? nutriments.carbohydrates_100g),
    fat: number(item?.fatPer100g ?? item?.fat_g_per_100g ?? macros.fat ?? item?.fat ?? nutriments.fat_100g),
    fibre: number(item?.fibrePer100g ?? item?.fiberPer100g ?? macros.fibre ?? macros.fiber
      ?? item?.fibre_g_per_100g ?? item?.fiber_g_per_100g ?? nutriments.fiber_100g ?? nutriments.fibers_100g),
  };
}

function MacroRow({ food, grams }: { food: DemoFood; grams: number }) {
  const ratio = grams / 100;
  return (
    <View style={styles.macroRow}>
      {[
        ["Calories", `${Math.round(food.calories * ratio)}`, "kcal"],
        ["Protein", `${(food.protein * ratio).toFixed(1)}`, "g"],
        ["Carbs", `${(food.carbs * ratio).toFixed(1)}`, "g"],
        ["Fat", `${(food.fat * ratio).toFixed(1)}`, "g"],
        ["Fibre", `${(food.fibre * ratio).toFixed(1)}`, "g"],
      ].map(([label, value, unit]) => (
        <View key={label} style={styles.macroCell}>
          <Text style={styles.macroValue}>{value}</Text>
          <Text style={styles.macroUnit}>{unit}</Text>
          <Text style={styles.macroLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function FoodResult({ food, onPress, showImage = true }: { food: DemoFood; onPress: () => void; showImage?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.result}>
      {showImage && (food.imageUrl ? <Image source={{ uri: food.imageUrl }} style={styles.foodImage} /> : (
        <View style={[styles.foodImage, styles.foodImageFallback]}><Feather name="coffee" size={17} color="#71717a" /></View>
      ))}
      <View style={{ flex: 1 }}>
        <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
        {!!food.brand && <Text style={styles.muted} numberOfLines={1}>{food.brand}</Text>}
        <Text style={styles.resultMacros}>P{Math.round(food.protein)} · C{Math.round(food.carbs)} · F{Math.round(food.fat)} per 100g</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.resultCalories}>{Math.round(food.calories)}</Text>
        <Text style={styles.muted}>kcal</Text>
      </View>
    </TouchableOpacity>
  );
}

export function OnboardingFoodDemo() {
  const [tab, setTab] = useState<Tab>("search");
  const [entries, setEntries] = useState<DemoEntry[]>([]);
  const [meal, setMeal] = useState<Meal>("lunch");
  const [selected, setSelected] = useState<DemoFood | null>(null);
  const [grams, setGrams] = useState("100");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DemoFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [wholeQuery, setWholeQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState("");
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraScanned, setCameraScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [custom, setCustom] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", fibre: "", grams: "100" });
  const [serverWholeFoods, setServerWholeFoods] = useState<DemoFood[]>([]);

  const totalCalories = entries.reduce((sum, entry) => sum + entry.calories * entry.grams / 100, 0);
  const progress = Math.min(totalCalories / TARGET_CALORIES, 1);

  useEffect(() => {
    if (tab !== "search" || query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError("");
      void apiFetch<{ results?: any[] } | any[]>(`/foods/search?q=${encodeURIComponent(query.trim())}`)
        .then(response => {
          const items = Array.isArray(response) ? response : response?.results ?? [];
          if (active) setSearchResults(items.map(normalizeFood));
        })
        .catch(reason => { if (active) setSearchError(reason instanceof Error ? reason.message : "Search unavailable."); })
        .finally(() => { if (active) setSearching(false); });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [query, tab]);

  useEffect(() => {
    let active = true;
    void apiFetch<any[]>("/ingredients")
      .then(items => { if (active && Array.isArray(items)) setServerWholeFoods(items.map(normalizeFood)); })
      .catch(() => { /* The bundled catalogue below remains available offline. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (tab !== "barcode") setCameraVisible(false);
    setSelected(null);
  }, [tab]);

  const wholeFoods = useMemo(() => {
    const term = wholeQuery.trim().toLowerCase();
    const catalogue = serverWholeFoods.length > 0 ? serverWholeFoods : INGREDIENTS_DATA.map(normalizeFood);
    return catalogue
      .filter(food => !term || food.name.toLowerCase().includes(term))
      .slice(0, term ? 12 : 8)
  }, [wholeQuery, serverWholeFoods]);

  function addFood(food: DemoFood, amount = number(grams) || 100) {
    setEntries(current => [...current, { ...food, grams: amount, meal, id: `${Date.now()}-${current.length}` }]);
    setSelected(null);
    setGrams("100");
  }

  async function lookupBarcode(code = barcode) {
    const cleaned = code.trim();
    if (!cleaned) return;
    setBarcode(cleaned);
    setBarcodeLoading(true);
    setBarcodeError("");
    setSelected(null);
    try {
      const result = await apiFetch<any>(`/food/barcode/${encodeURIComponent(cleaned)}`);
      if (!result?.found) throw new Error("Product not found. Try another barcode.");
      setSelected(normalizeFood(result?.off ?? result?.custom ?? result));
      setCameraVisible(false);
    } catch (reason) {
      setBarcodeError(reason instanceof Error ? reason.message : "Barcode lookup failed.");
    } finally {
      setBarcodeLoading(false);
    }
  }

  async function toggleCamera() {
    if (!permission?.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        setBarcodeError("Camera access is needed to scan a barcode.");
        return;
      }
    }
    setCameraScanned(false);
    setCameraVisible(value => !value);
  }

  const canAddCustom = custom.name.trim().length > 0 && number(custom.calories) >= 0 && number(custom.grams) > 0;

  return (
    <View>
      <View style={styles.targetCard}>
        <View style={styles.targetTop}>
          <View>
            <Text style={styles.eyebrow}>SAMPLE DAILY TARGET</Text>
            <Text style={styles.targetValue}>{Math.round(totalCalories)} <Text style={styles.targetOf}>/ {TARGET_CALORIES} kcal</Text></Text>
          </View>
          <Text style={styles.remaining}>{Math.max(0, TARGET_CALORIES - Math.round(totalCalories))} left</Text>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        {entries.map(entry => (
          <TouchableOpacity key={entry.id} onPress={() => setEntries(current => current.filter(item => item.id !== entry.id))} style={styles.loggedRow}>
            <Feather name="check-circle" size={14} color="#22c55e" />
            <Text style={styles.loggedName} numberOfLines={1}>{entry.name}</Text>
            <Text style={styles.mealBadge}>{entry.meal}</Text>
            <Text style={styles.loggedCalories}>{Math.round(entry.calories * entry.grams / 100)} kcal</Text>
            <Feather name="x" size={13} color="#71717a" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.guideRow}>
        <Text style={styles.guideText}>1  Choose a meal</Text>
        <Text style={styles.guideText}>2  Find a food</Text>
        <Text style={styles.guideText}>3  Set serving & add</Text>
      </View>

      <View style={styles.meals}>
        {(["breakfast", "lunch", "dinner", "snack"] as Meal[]).map(value => (
          <TouchableOpacity key={value} onPress={() => setMeal(value)} style={[styles.meal, meal === value && styles.mealActive]}>
            <Text style={[styles.mealText, meal === value && styles.mealTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabs}>
        {([
          ["search", "search", "Search"],
          ["whole", "box", "Whole"],
          ["barcode", "maximize", "Barcode"],
          ["custom", "edit-2", "Custom"],
        ] as const).map(([id, icon, label]) => (
          <TouchableOpacity key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <Feather name={icon} size={15} color={tab === id ? ORANGE : "#71717a"} />
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "search" && !selected && <View style={styles.panel}>
        <Text style={styles.panelTitle}>Search Open Food Facts</Text>
        <View style={styles.searchBox}>
          <Feather name="search" size={17} color="#71717a" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Try ‘protein yoghurt’" placeholderTextColor="#52525b" style={styles.searchInput} autoCorrect={false} />
          {searching && <ActivityIndicator size="small" color={ORANGE} />}
        </View>
        {!!searchError && <Text style={styles.error}>{searchError}</Text>}
        {query.trim().length < 2 && <Text style={styles.hint}>Type at least 2 characters to search the same database used in Add Food.</Text>}
        {searchResults.slice(0, 8).map((food, index) => <FoodResult key={`${food.name}-${index}`} food={food} onPress={() => setSelected(food)} />)}
      </View>}

      {tab === "whole" && !selected && <View style={styles.panel}>
        <Text style={styles.panelTitle}>Whole Food catalogue</Text>
        <View style={styles.searchBox}>
          <Feather name="search" size={17} color="#71717a" />
          <TextInput value={wholeQuery} onChangeText={setWholeQuery} placeholder="Search ingredients…" placeholderTextColor="#52525b" style={styles.searchInput} autoCorrect={false} />
        </View>
        {wholeFoods.map((food, index) => <FoodResult key={`${food.name}-${index}`} food={food} showImage={false} onPress={() => setSelected(food)} />)}
      </View>}

      {tab === "barcode" && !selected && <View style={styles.panel}>
        <Text style={styles.panelTitle}>Scan a packaged food</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput value={barcode} onChangeText={setBarcode} placeholder="Barcode number" placeholderTextColor="#52525b" keyboardType="number-pad" style={[styles.searchBox, styles.barcodeInput]} onSubmitEditing={() => void lookupBarcode()} />
          <TouchableOpacity onPress={() => void lookupBarcode()} disabled={!barcode.trim() || barcodeLoading} style={[styles.orangeButton, (!barcode.trim() || barcodeLoading) && styles.disabled]}>
            {barcodeLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.orangeButtonText}>Lookup</Text>}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => void toggleCamera()} style={styles.outlineButton}>
          <Feather name="camera" size={16} color="#fff" />
          <Text style={styles.outlineButtonText}>{cameraVisible ? "Hide camera" : "Scan barcode"}</Text>
        </TouchableOpacity>
        {cameraVisible && <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
            onMountError={event => {
              setCameraVisible(false);
              setBarcodeError(event.message || "The camera could not be started on this device.");
            }}
            onBarcodeScanned={cameraScanned ? undefined : event => {
              setCameraScanned(true);
              // Stop the preview immediately so a single barcode cannot fire
              // repeatedly while its server lookup is in flight. The user can
              // reopen the camera straight away if the lookup is unsuccessful.
              setCameraVisible(false);
              void lookupBarcode(event.data);
            }}
          />
          <View pointerEvents="none" style={styles.scanFrame} />
        </View>}
        {!!barcodeError && <Text style={styles.error}>{barcodeError}</Text>}
      </View>}

      {tab === "custom" && !selected && <View style={styles.panel}>
        <Text style={styles.panelTitle}>Create a custom food</Text>
        <TextInput value={custom.name} onChangeText={name => setCustom(value => ({ ...value, name }))} placeholder="Food or meal name" placeholderTextColor="#52525b" style={styles.field} />
        <View style={styles.fieldGrid}>
          {([
            ["calories", "Calories"], ["grams", "Serving (g)"], ["protein", "Protein (g)"],
            ["carbs", "Carbs (g)"], ["fat", "Fat (g)"], ["fibre", "Fibre (g)"],
          ] as const).map(([key, label]) => (
            <View key={key} style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
              <TextInput value={custom[key]} onChangeText={text => setCustom(value => ({ ...value, [key]: text.replace(/[^0-9.]/g, "") }))} placeholder="0" placeholderTextColor="#52525b" keyboardType="decimal-pad" style={styles.field} />
            </View>
          ))}
        </View>
        <TouchableOpacity disabled={!canAddCustom} onPress={() => {
          addFood({ name: custom.name.trim(), calories: number(custom.calories), protein: number(custom.protein), carbs: number(custom.carbs), fat: number(custom.fat), fibre: number(custom.fibre) }, number(custom.grams));
          setCustom({ name: "", calories: "", protein: "", carbs: "", fat: "", fibre: "", grams: "100" });
        }} style={[styles.orangeButton, !canAddCustom && styles.disabled]}>
          <Text style={styles.orangeButtonText}>Add custom food</Text>
        </TouchableOpacity>
      </View>}

      {selected && <View style={styles.selectionCard}>
        <TouchableOpacity onPress={() => setSelected(null)} style={styles.backToResults}>
          <Feather name="arrow-left" size={14} color="#a1a1aa" />
          <Text style={styles.backToResultsText}>Back to results</Text>
        </TouchableOpacity>
        <View style={styles.selectionHeader}>
          {tab !== "whole" && selected.imageUrl && <Image source={{ uri: selected.imageUrl }} style={styles.selectedImage} />}
          <View style={{ flex: 1 }}><Text style={styles.resultName}>{selected.name}</Text>{!!selected.brand && <Text style={styles.muted}>{selected.brand}</Text>}</View>
          <TouchableOpacity onPress={() => setSelected(null)}><Feather name="x" size={18} color="#a1a1aa" /></TouchableOpacity>
        </View>
        <Text style={styles.fieldLabel}>SERVING SIZE (GRAMS)</Text>
        <TextInput value={grams} onChangeText={setGrams} keyboardType="decimal-pad" selectTextOnFocus style={[styles.field, { textAlign: "center", fontSize: 18 }]} />
        <View style={styles.quickAmounts}>{[50, 100, 150, 200].map(amount => <TouchableOpacity key={amount} onPress={() => setGrams(String(amount))} style={[styles.amount, grams === String(amount) && styles.amountActive]}><Text style={styles.amountText}>{amount}g</Text></TouchableOpacity>)}</View>
        <MacroRow food={selected} grams={number(grams) || 100} />
        <TouchableOpacity onPress={() => addFood(selected)} style={styles.orangeButton}><Text style={styles.orangeButtonText}>Add to {meal[0].toUpperCase() + meal.slice(1)}</Text></TouchableOpacity>
      </View>}

      <Text style={styles.demoNote}>Demo only — foods added here won’t be saved to your diary. Tap a logged item to remove it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  targetCard: { borderRadius: 14, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.35)", padding: 14, marginBottom: 12 },
  targetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { color: "#71717a", fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  targetValue: { color: "#fff", fontSize: 23, fontWeight: "800", marginTop: 3 },
  targetOf: { color: "#71717a", fontSize: 13, fontWeight: "500" },
  remaining: { color: ORANGE, fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: "#27272a", overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: ORANGE },
  loggedRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  loggedName: { color: "#d4d4d8", fontSize: 12, flex: 1 },
  mealBadge: { color: "#71717a", fontSize: 8, textTransform: "capitalize", borderRadius: 5, borderWidth: 1, borderColor: "#3f3f46", paddingHorizontal: 5, paddingVertical: 2 },
  loggedCalories: { color: "#a1a1aa", fontSize: 11 },
  guideRow: { flexDirection: "row", gap: 5, marginBottom: 9 },
  guideText: { flex: 1, color: "#71717a", fontSize: 8, lineHeight: 11, textAlign: "center" },
  meals: { flexDirection: "row", gap: 5, marginBottom: 9 },
  meal: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b" },
  mealActive: { backgroundColor: ORANGE, borderColor: "#fff", borderWidth: 1.2 },
  mealText: { color: "#71717a", fontSize: 9, fontWeight: "700" },
  mealTextActive: { color: "#fff" },
  tabs: { flexDirection: "row", borderRadius: 12, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", padding: 3, marginBottom: 12 },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 9, borderRadius: 9 },
  tabActive: { backgroundColor: "rgba(249,115,22,0.12)", borderWidth: 1, borderColor: "rgba(249,115,22,0.45)" },
  tabText: { color: "#71717a", fontSize: 10, fontWeight: "600" },
  tabTextActive: { color: ORANGE },
  panel: { gap: 9 },
  panelTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, borderColor: "#3f3f46", backgroundColor: "#18181b", paddingHorizontal: 12 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 12 },
  barcodeInput: { flex: 1, color: "#fff", fontSize: 14 },
  result: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, borderColor: "#27272a", backgroundColor: "rgba(39,39,42,0.4)", padding: 10 },
  foodImage: { width: 43, height: 43, borderRadius: 8 },
  selectedImage: { width: 52, height: 52, borderRadius: 9, backgroundColor: "#27272a" },
  foodImageFallback: { backgroundColor: "#27272a", alignItems: "center", justifyContent: "center" },
  resultName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  resultMacros: { color: "#71717a", fontSize: 9, marginTop: 2 },
  resultCalories: { color: ORANGE, fontSize: 14, fontWeight: "700" },
  muted: { color: "#71717a", fontSize: 10, marginTop: 1 },
  hint: { color: "#71717a", fontSize: 11, lineHeight: 16, textAlign: "center", paddingVertical: 14 },
  error: { color: "#f87171", fontSize: 11, lineHeight: 16 },
  orangeButton: { minHeight: 48, borderRadius: 10, borderWidth: 1.5, borderColor: "#fff", backgroundColor: ORANGE, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  orangeButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  outlineButton: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#e4e4e7", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  outlineButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cameraWrap: { height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  scanFrame: { position: "absolute", width: "68%", height: 105, top: 57, alignSelf: "center", borderWidth: 2, borderColor: ORANGE, borderRadius: 8 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fieldHalf: { width: "48.5%" },
  fieldLabel: { color: "#71717a", fontSize: 9, fontWeight: "700", letterSpacing: 0.6, marginBottom: 4 },
  field: { minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: "#3f3f46", backgroundColor: "#18181b", color: "#fff", paddingHorizontal: 12, fontSize: 13 },
  selectionCard: { gap: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.45)", backgroundColor: "#111113", padding: 13, marginTop: 12 },
  backToResults: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 2 },
  backToResultsText: { color: "#a1a1aa", fontSize: 10, fontWeight: "600" },
  selectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  quickAmounts: { flexDirection: "row", gap: 6 },
  amount: { flex: 1, borderRadius: 7, borderWidth: 1, borderColor: "#3f3f46", paddingVertical: 7, alignItems: "center" },
  amountActive: { borderColor: ORANGE, backgroundColor: "rgba(249,115,22,0.12)" },
  amountText: { color: "#d4d4d8", fontSize: 11, fontWeight: "600" },
  macroRow: { flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: "#27272a", backgroundColor: "#18181b", paddingVertical: 10 },
  macroCell: { flex: 1, alignItems: "center" },
  macroValue: { color: "#fff", fontSize: 14, fontWeight: "800" },
  macroUnit: { color: "#71717a", fontSize: 8 },
  macroLabel: { color: "#71717a", fontSize: 8, marginTop: 2 },
  demoNote: { color: "#52525b", fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 12 },
});
