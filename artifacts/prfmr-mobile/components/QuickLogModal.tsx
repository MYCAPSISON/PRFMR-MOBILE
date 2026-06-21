import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { INGREDIENTS_DATA, IngredientEntry } from "../lib/ingredients-data";
import { CORE_FOOD_UNITS } from "../lib/coreFoodUnits";
import {
  parseQuickLog,
  ParseResult,
  ParsedFood,
  ParsedWeight,
  ParsedTraining,
  ParsedSupplements,
  FoodItem,
  TimeOfDay,
} from "../lib/quickLogParser";

// ─── Types ────────────────────────────────────────────────────────────────────

type DialogState = "input" | "review" | "saving" | "done";

type FoodReviewItem = {
  rawText: string;
  normalizedName: string;
  count?: number;
  gramsHint?: number;
  match: { ingredient: IngredientEntry; idx: number } | null;
  grams: string;
  confirmed: boolean;
};

type SuppReviewItem = {
  raw: string;
  match: { id: number; name: string } | null;
  included: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchIngredient(query: string): { ingredient: IngredientEntry; idx: number } | null {
  const q = query.toLowerCase().trim();
  let best: { ingredient: IngredientEntry; idx: number; score: number } | null = null;

  for (let i = 0; i < INGREDIENTS_DATA.length; i++) {
    const ing = INGREDIENTS_DATA[i];
    const name = ing.name.toLowerCase();
    let score = 0;

    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (q.includes(name)) score = 50;
    else {
      const qWords = q.split(/\s+/).filter(w => w.length >= 3);
      const nameWords = name.split(/\s+/);
      const overlap = qWords.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)));
      score = overlap.length * 15;
    }

    if (score > (best?.score ?? 0)) best = { ingredient: ing, idx: i, score };
  }

  return best && best.score >= 15 ? { ingredient: best.ingredient, idx: best.idx } : null;
}

function calcMacros(ing: IngredientEntry, grams: number) {
  return {
    calories: Math.round(ing.caloriesPer100g * grams / 100),
    protein: Math.round(ing.proteinPer100g * grams / 100),
    carbs: Math.round(ing.carbsPer100g * grams / 100),
    fat: Math.round(ing.fatPer100g * grams / 100),
    fibre: Math.round(ing.fibrePer100g * grams / 100),
  };
}

function matchSupplement(raw: string, supplements: any[]): { id: number; name: string } | null {
  const q = raw.toLowerCase();
  let best: { supp: any; score: number } | null = null;

  for (const s of supplements) {
    const name = (s.name ?? "").toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.includes(q) || q.includes(name)) score = 60;
    else {
      const overlap = q.split(/\s+/).filter(w => w.length >= 3 && name.includes(w));
      score = overlap.length * 15;
    }
    if (score > (best?.score ?? 0)) best = { supp: s, score };
  }

  return best && best.score >= 15 ? { id: best.supp.id, name: best.supp.name } : null;
}

function getDefaultGrams(item: FoodItem): number {
  if (item.gramsHint) return item.gramsHint;
  const norm = item.normalizedName.toLowerCase();
  for (const [foodName, unit] of Object.entries(CORE_FOOD_UNITS)) {
    if (foodName.toLowerCase().includes(norm) || norm.includes(foodName.toLowerCase().split(" ")[0])) {
      const count = item.count ?? unit.defaultCount;
      if (unit.gramsBySize) return Math.round(unit.gramsBySize["medium"] * count);
      return Math.round((unit.gramsPerUnit ?? 100) * count);
    }
  }
  if (item.count) return item.count * 100;
  return 100;
}

function confColor(c: string) {
  if (c === "high") return "#4ade80";
  if (c === "medium") return "#f59e0b";
  return "#f87171";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  date: string;
}

export function QuickLogModal({ visible, onClose, date }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [dialogState, setDialogState] = useState<DialogState>("input");
  const [inputText, setInputText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const [foodItems, setFoodItems] = useState<FoodReviewItem[]>([]);
  const [weightVal, setWeightVal] = useState("");
  const [activityName, setActivityName] = useState("");
  const [duration, setDuration] = useState(60);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("afternoon");
  const [activitySuggestions, setActivitySuggestions] = useState<any[]>([]);
  const [suppItems, setSuppItems] = useState<SuppReviewItem[]>([]);

  // Voice recognition
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check Web Speech API availability
  const speechSupported = Platform.OS === "web" && typeof window !== "undefined" &&
    !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;

  function stopListening() {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
  }

  function startListening() {
    if (Platform.OS !== "web") {
      Alert.alert("Voice input", "Voice input is available in the web version at app.prfmr.link.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert("Not supported", "Your browser doesn't support voice input. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        setInputText(prev => (prev.trim() ? prev.trim() + " " + final.trim() : final.trim()));
        setInterimText("");
      } else {
        setInterimText(interim);
      }
      // Reset silence timer on any speech activity
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(stopListening, 3000);
    };

    recognition.onerror = () => stopListening();
    recognition.onend = () => { setIsListening(false); setInterimText(""); };

    try {
      recognition.start();
      setIsListening(true);
      // Auto-stop after 3s of initial silence
      silenceTimerRef.current = setTimeout(stopListening, 3000);
    } catch { stopListening(); }
  }

  function toggleListening() {
    if (isListening) stopListening();
    else startListening();
  }

  // Stop listening when modal closes or state changes away from input
  useEffect(() => {
    if (!visible || dialogState !== "input") stopListening();
  }, [visible, dialogState]);

  const { data: supplements = [] } = useQuery<any[]>({
    queryKey: ["supplements"],
    queryFn: () => apiFetch("/me/supplements"),
    enabled: visible,
  });

  function reset() {
    stopListening();
    setDialogState("input");
    setInputText("");
    setParsed(null);
    setFoodItems([]);
    setWeightVal("");
    setActivityName("");
    setDuration(60);
    setTimeOfDay("afternoon");
    setSuppItems([]);
    setActivitySuggestions([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleParse() {
    if (!inputText.trim()) return;
    Keyboard.dismiss();

    const result = parseQuickLog(inputText);
    setParsed(result);

    if (result.intent === "log_food") {
      const r = result as ParsedFood;
      setFoodItems(r.items.map(item => {
        const match = matchIngredient(item.normalizedName);
        return {
          ...item,
          match,
          grams: String(match ? getDefaultGrams(item) : 100),
          confirmed: match !== null,
        };
      }));
    } else if (result.intent === "log_weight") {
      setWeightVal(String((result as ParsedWeight).weightKg));
    } else if (result.intent === "log_training_session") {
      const r = result as ParsedTraining;
      setActivityName(r.activityName);
      setDuration(r.durationMinutes);
      setTimeOfDay(r.timeOfDay);
    } else if (result.intent === "log_supplements") {
      setSuppItems((result as ParsedSupplements).items.map(raw => ({
        raw,
        match: matchSupplement(raw, supplements),
        included: true,
      })));
    }

    setDialogState("review");
  }

  const searchActivities = useCallback(async (q: string) => {
    if (q.length < 2) { setActivitySuggestions([]); return; }
    try {
      const res = await apiFetch<any[]>(`/activities?query=${encodeURIComponent(q)}`);
      setActivitySuggestions(Array.isArray(res) ? res.slice(0, 5) : []);
    } catch { setActivitySuggestions([]); }
  }, []);

  async function confirmFood() {
    if (!user) return;
    const confirmed = foodItems.filter(i => i.confirmed && i.match);
    if (!confirmed.length) return;
    setDialogState("saving");
    try {
      const meal = (parsed as ParsedFood).meal;
      for (const item of confirmed) {
        const g = parseInt(item.grams) || 100;
        const macros = calcMacros(item.match!.ingredient, g);
        await apiFetch("/food", {
          method: "POST",
          body: {
            userId: user.id,
            date,
            name: item.match!.ingredient.name,
            grams: g,
            meal,
            ...macros,
            sourceType: "ingredient",
            ingredientIndex: item.match!.idx,
            macroSource: "ingredient",
            microSource: "ingredient",
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["food", date] });
      qc.invalidateQueries({ queryKey: ["amqs-score", date] });
      setDialogState("done");
    } catch (e: any) {
      setDialogState("review");
      Alert.alert("Error", e?.message ?? "Failed to save food");
    }
  }

  async function confirmWeight() {
    const w = parseFloat(weightVal);
    if (!w) return;
    setDialogState("saving");
    try {
      await apiFetch("/weights", { method: "POST", body: { date, weight: w } });
      qc.invalidateQueries({ queryKey: ["morning-status", date] });
      qc.invalidateQueries({ queryKey: ["weight-cut"] });
      qc.invalidateQueries({ queryKey: ["weights-range"] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      setDialogState("done");
    } catch (e: any) {
      setDialogState("review");
      Alert.alert("Error", e?.message ?? "Failed to save weight");
    }
  }

  async function confirmTraining() {
    if (!activityName.trim()) return;
    setDialogState("saving");
    try {
      const session = await apiFetch<{ id: number }>("/workouts/sessions", {
        method: "POST",
        body: { date, timeOfDay, title: activityName, intensity: "moderate" },
      });
      let metValue = 6;
      let activityCatalogId: number | undefined;
      try {
        const acts = await apiFetch<any[]>(`/activities?query=${encodeURIComponent(activityName)}`);
        if (acts?.length) { metValue = acts[0].metValue ?? 6; activityCatalogId = acts[0].id; }
      } catch {}
      await apiFetch(`/workouts/sessions/${session.id}/activities`, {
        method: "POST",
        body: {
          name: activityName,
          durationMinutes: duration,
          intensity: "moderate",
          activityType: "cardio",
          metValue,
          ...(activityCatalogId ? { activityCatalogId } : {}),
        },
      });
      qc.invalidateQueries({ queryKey: ["sessions", date] });
      qc.invalidateQueries({ queryKey: ["targets", date] });
      setDialogState("done");
    } catch (e: any) {
      setDialogState("review");
      Alert.alert("Error", e?.message ?? "Failed to save training session");
    }
  }

  async function confirmSupplements() {
    const toLog = suppItems.filter(i => i.included && i.match);
    if (!toLog.length) return;
    setDialogState("saving");
    try {
      for (const item of toLog) {
        await apiFetch("/supplement-intakes", {
          method: "POST",
          body: { supplementId: item.match!.id, date, taken: true },
        });
      }
      qc.invalidateQueries({ queryKey: ["supplement-intakes", date] });
      setDialogState("done");
    } catch (e: any) {
      setDialogState("review");
      Alert.alert("Error", e?.message ?? "Failed to save supplements");
    }
  }

  const isSaving = dialogState === "saving";
  const confirmedFood = foodItems.filter(i => i.confirmed && i.match);
  const confirmedSupp = suppItems.filter(i => i.included && i.match);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" }}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />

        <View style={{
          backgroundColor: "#181c26",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          paddingBottom: Platform.OS === "ios" ? 40 : 24,
        }}>

          {/* ── DONE ─────────────────────────────────────── */}
          {dialogState === "done" && (
            <View style={{ alignItems: "center", paddingVertical: 28 }}>
              <Feather name="check-circle" size={52} color="#4ade80" />
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#eceef2", marginTop: 14 }}>
                Logged successfully
              </Text>
              <TouchableOpacity
                onPress={reset}
                style={{
                  marginTop: 20,
                  borderWidth: 1,
                  borderColor: "#1a1e28",
                  borderRadius: 10,
                  paddingHorizontal: 28,
                  paddingVertical: 12,
                }}
              >
                <Text style={{ color: "#eceef2", fontWeight: "600", fontSize: 14 }}>Log another</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── INPUT ────────────────────────────────────── */}
          {dialogState === "input" && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 18, color: "#ff7a00" }}>✦</Text>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#eceef2" }}>Quick Log</Text>
              </View>
              <Text style={{ fontSize: 12, color: "#6b7280", lineHeight: 18, marginBottom: 14 }}>
                Describe what you want to log in plain language. You'll review everything before it's saved.
              </Text>

              <View style={{ position: "relative" }}>
                <TextInput
                  style={{
                    backgroundColor: isListening ? "#0f1117" : "#0f1117",
                    borderColor: isListening ? "rgba(248,113,113,0.4)" : "#1a1e28",
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    paddingRight: 38,
                    color: "#eceef2",
                    minHeight: 88,
                    textAlignVertical: "top",
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={"e.g. '2 eggs and toast for breakfast' · 'Morning weight 71.8' · 'Pads 60 min at 7pm'"}
                  placeholderTextColor="#4b5563"
                  multiline
                  autoFocus={!isListening}
                />
                <TouchableOpacity
                  onPress={toggleListening}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: 8,
                    padding: 4,
                    borderRadius: 14,
                    backgroundColor: isListening ? "rgba(248,113,113,0.12)" : "transparent",
                  }}
                >
                  <Feather
                    name={isListening ? "mic-off" : "mic"}
                    size={18}
                    color={isListening ? "#f87171" : "#6b7280"}
                  />
                </TouchableOpacity>
              </View>

              {/* Listening indicator */}
              {isListening && (
                <View style={{ marginTop: 6, gap: 2 }}>
                  <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "600" }}>
                    ● Listening — speak naturally, stops after 3s silence
                  </Text>
                  {interimText ? (
                    <Text style={{ color: "#6b7280", fontSize: 12, fontStyle: "italic" }}>
                      {interimText}
                    </Text>
                  ) : null}
                </View>
              )}

              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#ff7a00",
                  borderRadius: 10,
                  padding: 14,
                  marginTop: 12,
                  opacity: inputText.trim() ? 1 : 0.4,
                }}
                onPress={handleParse}
                disabled={!inputText.trim()}
              >
                <Feather name="edit-2" size={15} color="#fff" style={{ marginRight: 6 }} />
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Review</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ alignItems: "center", padding: 12 }}
                onPress={handleClose}
              >
                <Text style={{ color: "#6b7280", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>

              <Text style={{ textAlign: "center", fontSize: 10, color: "#6b7280", opacity: 0.6 }}>
                Tap Review to continue · Nothing is saved until you confirm
              </Text>
            </>
          )}

          {/* ── REVIEW / SAVING ──────────────────────────── */}
          {(dialogState === "review" || isSaving) && parsed && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>

              {/* Back button */}
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14 }}
                onPress={() => setDialogState("input")}
              >
                <Feather name="arrow-left" size={14} color="#6b7280" />
                <Text style={{ color: "#6b7280", fontSize: 13 }}>Edit</Text>
              </TouchableOpacity>

              {/* Confidence + meal badge */}
              {"confidence" in parsed && (
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <View style={{
                    backgroundColor: `${confColor((parsed as any).confidence)}20`,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}>
                    <Text style={{ color: confColor((parsed as any).confidence), fontSize: 11, fontWeight: "700" }}>
                      {((parsed as any).confidence as string).toUpperCase()}
                    </Text>
                  </View>
                  {parsed.intent === "log_food" && (
                    <View style={{ backgroundColor: "rgba(255,122,0,0.2)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: "#ff7a00", fontSize: 11, fontWeight: "700" }}>
                        {(parsed as ParsedFood).meal.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── FOOD review ── */}
              {parsed.intent === "log_food" && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#eceef2", marginBottom: 10 }}>
                    Log this meal?
                  </Text>
                  {foodItems.map((item, i) => (
                    <View key={i} style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      backgroundColor: "#0f1117",
                      borderColor: "#1a1e28",
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                      gap: 10,
                    }}>
                      <TouchableOpacity
                        onPress={() => {
                          if (!item.match) return;
                          setFoodItems(prev => prev.map((it, j) => j === i ? { ...it, confirmed: !it.confirmed } : it));
                        }}
                        style={{ paddingTop: 1 }}
                      >
                        <Feather
                          name={item.match && item.confirmed ? "check-circle" : "x-circle"}
                          size={20}
                          color={item.match && item.confirmed ? "#4ade80" : "#6b7280"}
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        {item.match ? (
                          <>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#eceef2" }}>
                              {item.match.ingredient.name}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                              <TextInput
                                style={{
                                  width: 54,
                                  backgroundColor: "#1a1e28",
                                  borderRadius: 6,
                                  paddingHorizontal: 6,
                                  paddingVertical: 3,
                                  color: "#eceef2",
                                  fontSize: 12,
                                  textAlign: "center",
                                  fontVariant: ["tabular-nums"],
                                }}
                                value={item.grams}
                                keyboardType="numeric"
                                onChangeText={val =>
                                  setFoodItems(prev =>
                                    prev.map((it, j) => j === i ? { ...it, grams: val } : it)
                                  )
                                }
                              />
                              <Text style={{ color: "#6b7280", fontSize: 11 }}>g</Text>
                              {(() => {
                                const g = parseInt(item.grams) || 100;
                                const m = calcMacros(item.match!.ingredient, g);
                                return (
                                  <Text style={{ color: "#6b7280", fontSize: 11 }}>
                                    {m.calories} kcal · {m.protein}g P · {m.carbs}g C · {m.fat}g F
                                  </Text>
                                );
                              })()}
                            </View>
                          </>
                        ) : (
                          <Text style={{ color: "#6b7280", fontStyle: "italic", fontSize: 13 }}>
                            Unrecognised: "{item.normalizedName}" — deselected
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}

                  {foodItems.some(i => !i.match) && (
                    <Text style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>
                      Unrecognised items will be skipped. Use "Add Food" to log them manually.
                    </Text>
                  )}

                  {confirmedFood.length > 0 && (
                    <View style={{ backgroundColor: "#1a1e28", borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      {(() => {
                        const tot = confirmedFood.reduce((acc, item) => {
                          const g = parseInt(item.grams) || 100;
                          const m = calcMacros(item.match!.ingredient, g);
                          return { cal: acc.cal + m.calories, p: acc.p + m.protein };
                        }, { cal: 0, p: 0 });
                        return (
                          <Text style={{ color: "#eceef2", fontSize: 12 }}>
                            Total: {tot.cal} kcal · {tot.p}g protein
                          </Text>
                        );
                      })()}
                    </View>
                  )}

                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#ff7a00",
                      borderRadius: 10,
                      padding: 14,
                      marginTop: 4,
                      opacity: confirmedFood.length > 0 && !isSaving ? 1 : 0.4,
                    }}
                    onPress={confirmFood}
                    disabled={confirmedFood.length === 0 || isSaving}
                  >
                    {isSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                          Log {confirmedFood.length} item{confirmedFood.length !== 1 ? "s" : ""}
                        </Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              {/* ── WEIGHT review ── */}
              {parsed.intent === "log_weight" && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#eceef2", marginBottom: 12 }}>
                    Log morning weight?
                  </Text>
                  <View style={{
                    backgroundColor: "#0f1117",
                    borderColor: "#1a1e28",
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 12,
                    alignItems: "center",
                  }}>
                    <Text style={{ color: "#eceef2", fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                      {weightVal} kg
                    </Text>
                    <TextInput
                      style={{
                        marginTop: 10,
                        backgroundColor: "#1a1e28",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        color: "#eceef2",
                        fontSize: 14,
                        textAlign: "center",
                        width: 120,
                      }}
                      value={weightVal}
                      onChangeText={setWeightVal}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 71.8"
                      placeholderTextColor="#4b5563"
                    />
                  </View>
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#ff7a00",
                      borderRadius: 10,
                      padding: 14,
                      opacity: weightVal && !isSaving ? 1 : 0.4,
                    }}
                    onPress={confirmWeight}
                    disabled={!weightVal || isSaving}
                  >
                    {isSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Confirm</Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              {/* ── TRAINING review ── */}
              {parsed.intent === "log_training_session" && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#eceef2", marginBottom: 12 }}>
                    Log this training session?
                  </Text>
                  <View style={{
                    backgroundColor: "#0f1117",
                    borderColor: "#1a1e28",
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 12,
                    gap: 12,
                  }}>
                    <View>
                      <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Activity</Text>
                      <TextInput
                        style={{
                          backgroundColor: "#1a1e28",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          color: "#eceef2",
                          fontSize: 14,
                        }}
                        value={activityName}
                        onChangeText={val => { setActivityName(val); searchActivities(val); }}
                        placeholder="Activity name"
                        placeholderTextColor="#4b5563"
                      />
                      {activitySuggestions.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                          {activitySuggestions.map(act => (
                            <TouchableOpacity
                              key={act.id}
                              onPress={() => { setActivityName(act.name); setActivitySuggestions([]); }}
                              style={{
                                backgroundColor: "#1a1e28",
                                borderRadius: 14,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                marginRight: 6,
                                borderWidth: 1,
                                borderColor: "#ff7a00",
                              }}
                            >
                              <Text style={{ color: "#eceef2", fontSize: 12 }}>{act.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Duration (min)</Text>
                        <TextInput
                          style={{
                            backgroundColor: "#1a1e28",
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            color: "#eceef2",
                            fontSize: 14,
                            textAlign: "center",
                          }}
                          value={String(duration)}
                          onChangeText={val => setDuration(parseInt(val) || 60)}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Time of day</Text>
                        <TouchableOpacity
                          style={{
                            backgroundColor: "#1a1e28",
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 9,
                            alignItems: "center",
                          }}
                          onPress={() => {
                            const order: TimeOfDay[] = ["morning", "afternoon", "evening"];
                            setTimeOfDay(order[(order.indexOf(timeOfDay) + 1) % 3]);
                          }}
                        >
                          <Text style={{ color: "#eceef2", fontSize: 13 }}>
                            {timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} ↕
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {duration === 60 && !(parsed as ParsedTraining).rawInput.match(/\d+\s*min/i) && (
                      <View style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 8, padding: 8 }}>
                        <Text style={{ color: "#f59e0b", fontSize: 11 }}>
                          Duration was not detected — defaulted to 60 min.
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#ff7a00",
                      borderRadius: 10,
                      padding: 14,
                      opacity: activityName.trim() && !isSaving ? 1 : 0.4,
                    }}
                    onPress={confirmTraining}
                    disabled={!activityName.trim() || isSaving}
                  >
                    {isSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Log Session</Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              {/* ── SUPPLEMENTS review ── */}
              {parsed.intent === "log_supplements" && (
                <>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#eceef2", marginBottom: 12 }}>
                    Mark as taken?
                  </Text>
                  {suppItems.map((item, i) => (
                    <View key={i} style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#0f1117",
                      borderColor: "#1a1e28",
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                      gap: 10,
                    }}>
                      <TouchableOpacity
                        onPress={() => {
                          if (!item.match) return;
                          setSuppItems(prev => prev.map((it, j) => j === i ? { ...it, included: !it.included } : it));
                        }}
                      >
                        <Feather
                          name={item.match && item.included ? "check-circle" : "x-circle"}
                          size={20}
                          color={item.match && item.included ? "#4ade80" : "#6b7280"}
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#eceef2" }}>{item.raw}</Text>
                        {item.match
                          ? <Text style={{ color: "#6b7280", fontSize: 12 }}>→ {item.match.name}</Text>
                          : <Text style={{ color: "#f59e0b", fontSize: 12 }}>
                              Not found in your supplements — will be skipped
                            </Text>
                        }
                      </View>
                    </View>
                  ))}

                  {!suppItems.some(i => i.match) && (
                    <Text style={{ color: "#6b7280", fontSize: 12, marginBottom: 8 }}>
                      None matched your saved supplements. Add them in the Supplements tab first.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#ff7a00",
                      borderRadius: 10,
                      padding: 14,
                      marginTop: 4,
                      opacity: confirmedSupp.length > 0 && !isSaving ? 1 : 0.4,
                    }}
                    onPress={confirmSupplements}
                    disabled={confirmedSupp.length === 0 || isSaving}
                  >
                    {isSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Mark Taken</Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              {/* ── UNKNOWN ── */}
              {parsed.intent === "unknown" && (
                <>
                  <View style={{
                    backgroundColor: "rgba(245,158,11,0.1)",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 14,
                  }}>
                    <Text style={{ color: "#f59e0b", fontSize: 14, fontWeight: "700", marginBottom: 4 }}>
                      Not sure what to log
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 13 }}>
                      {parsed.clarificationHint}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Try something like:</Text>
                  {[
                    "2 eggs and 2 slices of toast for breakfast",
                    "Morning weight 71.8",
                    "Pads for 60 min at 7pm",
                    "Creatine and Vitamin D taken",
                  ].map((ex, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setInputText(ex); setDialogState("input"); }}
                      style={{
                        backgroundColor: "#1a1e28",
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 13 }}>"{ex}"</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={{ alignItems: "center", padding: 12 }}
                    onPress={() => setDialogState("input")}
                  >
                    <Text style={{ color: "#ff7a00", fontSize: 14 }}>← Try again</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
