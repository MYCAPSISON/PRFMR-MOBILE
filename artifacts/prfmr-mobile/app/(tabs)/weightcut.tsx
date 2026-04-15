import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysUntil(d: string) {
  const diff = new Date(d + "T12:00:00").getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function WeightCutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [logWeightModal, setLogWeightModal] = useState(false);
  const [setupModal, setSetupModal] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [fightDate, setFightDate] = useState("");
  const [weighInTiming, setWeighInTiming] = useState<"same_day" | "day_before">("same_day");

  const { data: plan, isLoading } = useQuery<any>({
    queryKey: ["/api/me/weight-cut"],
    queryFn: () => apiFetch("/me/weight-cut"),
  });

  const { data: weightHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/me/weights/range"],
    queryFn: () => {
      const end = todayStr();
      const start = new Date(Date.now() - 30 * 24 * 3600000).toISOString().split("T")[0];
      return apiFetch(`/me/weights/range?start=${start}&end=${end}`);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/api/me/weight-cut"] });
    await qc.invalidateQueries({ queryKey: ["/api/me/weights/range"] });
    setRefreshing(false);
  }, [qc]);

  const logWeightMutation = useMutation({
    mutationFn: (weight: number) => apiFetch("/me/body-composition", { method: "PATCH", body: { currentWeight: weight } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/weight-cut"] });
      qc.invalidateQueries({ queryKey: ["/api/me/weights/range"] });
      qc.invalidateQueries({ queryKey: ["/api/user/me"] });
      setLogWeightModal(false);
      setWeightInput("");
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "Failed to log weight"),
  });

  const setupMutation = useMutation({
    mutationFn: (data: any) => plan
      ? apiFetch("/me/weight-cut", { method: "PUT", body: data })
      : apiFetch("/me/weight-cut", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/weight-cut"] });
      setSetupModal(false);
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "Failed to save plan"),
  });

  function openSetup() {
    if (plan) {
      setCurrentWeight(String(plan.currentWeight ?? ""));
      setTargetWeight(String(plan.targetWeight ?? ""));
      setFightDate(plan.fightDate ?? "");
      setWeighInTiming(plan.weighInTiming ?? "same_day");
    }
    setSetupModal(true);
  }

  function submitSetup() {
    const cw = parseFloat(currentWeight);
    const tw = parseFloat(targetWeight);
    if (!cw || !tw || !fightDate) {
      Alert.alert("Missing fields", "Please fill in all fields");
      return;
    }
    setupMutation.mutate({ currentWeight: cw, targetWeight: tw, fightDate, weighInTiming });
  }

  const weightToLose = plan ? (plan.currentWeight - plan.targetWeight) : 0;
  const days = plan?.fightDate ? daysUntil(plan.fightDate) : 0;
  const progress = plan && weightToLose > 0 ? Math.min((plan.currentWeight - plan.targetWeight) / weightToLose, 1) : 0;

  function weightColor(w: number) {
    if (!plan) return colors.foreground;
    const gap = w - plan.targetWeight;
    if (gap <= 0) return colors.success;
    if (gap <= 2) return colors.warning;
    return colors.destructive;
  }

  const recent = weightHistory.slice(-7).reverse();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Weight Cut</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={openSetup}
              style={[styles.iconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="settings" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLogWeightModal(true)}
              style={[styles.iconBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
              <Feather name="plus" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", padding: 40 }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !plan ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", padding: 32, gap: 12 }]}>
            <Feather name="target" size={40} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700", textAlign: "center" }}>No Fight Camp Set</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center" }}>Set your target weight and fight date to start your weight cut plan.</Text>
            <TouchableOpacity onPress={openSetup}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Set Up Fight Camp</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>CURRENT STATUS</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: 8 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: weightColor(plan.currentWeight), fontSize: 36, fontWeight: "800" }}>{plan.currentWeight?.toFixed(1)}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Current (kg)</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: colors.foreground, fontSize: 36, fontWeight: "800" }}>{plan.targetWeight?.toFixed(1)}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Target (kg)</Text>
                </View>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: colors.warning, fontSize: 36, fontWeight: "800" }}>{days}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Days left</Text>
                </View>
              </View>
              <View style={{ height: 8, backgroundColor: colors.secondary, borderRadius: 4 }}>
                <View style={{ height: 8, width: `${progress * 100}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>
                {(plan.currentWeight - plan.targetWeight).toFixed(1)} kg to go
              </Text>
            </View>

            {(plan.dailyCalTarget || plan.deficit) && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>DAILY TARGETS</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 8 }}>
                  {plan.dailyCalTarget && (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "800" }}>{Math.round(plan.dailyCalTarget)}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>kcal target</Text>
                    </View>
                  )}
                  {plan.deficit && (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: colors.warning, fontSize: 28, fontWeight: "800" }}>{Math.round(Math.abs(plan.deficit))}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>kcal deficit</Text>
                    </View>
                  )}
                  {plan.weeklyFatLoss && (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "800" }}>{plan.weeklyFatLoss?.toFixed(2)}</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>kg/week</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {plan.waterCutKg > 0 && (
              <View style={[styles.card, { backgroundColor: colors.info + "11", borderColor: colors.info + "33" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="droplet" size={18} color={colors.info} />
                  <Text style={{ color: colors.info, fontWeight: "700" }}>Water Cut: {plan.waterCutKg?.toFixed(1)} kg</Text>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  Remaining to lose through water manipulation before weigh-in.
                </Text>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 }}>RECENT WEIGHTS</Text>
              {recent.length === 0 ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontStyle: "italic" }}>No weight logs yet. Log your daily weight to track progress.</Text>
              ) : (
                recent.map((w: any, i: number) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: i < recent.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{w.date}</Text>
                    <Text style={{ color: weightColor(w.weight ?? w.kg), fontSize: 14, fontWeight: "700" }}>{(w.weight ?? w.kg)?.toFixed(1)} kg</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={logWeightModal} animationType="slide" presentationStyle="formSheet">
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, gap: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}>Log Weight</Text>
            <TouchableOpacity onPress={() => { setLogWeightModal(false); setWeightInput(""); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.mutedForeground }}>Today: {todayStr()}</Text>
          <TextInput
            style={[styles.bigInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            value={weightInput} onChangeText={setWeightInput}
            placeholder="85.4" placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad" autoFocus
          />
          <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center" }}>Weight in kilograms (kg)</Text>
          <TouchableOpacity
            onPress={() => { const w = parseFloat(weightInput); if (!w) { Alert.alert("Invalid", "Please enter a valid weight"); return; } logWeightMutation.mutate(w); }}
            disabled={logWeightMutation.isPending}
            style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
            {logWeightMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Log Weight</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={setupModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Fight Camp Setup</Text>
            <TouchableOpacity onPress={() => setSetupModal(false)}><Feather name="x" size={24} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {[
              { label: "Current Weight (kg)", value: currentWeight, set: setCurrentWeight, kb: "decimal-pad" as const },
              { label: "Target Weight (kg)", value: targetWeight, set: setTargetWeight, kb: "decimal-pad" as const },
              { label: "Fight Date (YYYY-MM-DD)", value: fightDate, set: setFightDate, kb: "default" as const },
            ].map(f => (
              <View key={f.label}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 6, letterSpacing: 0.5 }}>{f.label.toUpperCase()}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                  value={f.value} onChangeText={f.set}
                  placeholder={f.label} placeholderTextColor={colors.mutedForeground}
                  keyboardType={f.kb}
                />
              </View>
            ))}
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", marginBottom: 6, letterSpacing: 0.5 }}>WEIGH-IN TIMING</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["same_day", "day_before"] as const).map(t => (
                  <TouchableOpacity key={t} onPress={() => setWeighInTiming(t)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: weighInTiming === t ? colors.primary : colors.secondary }}>
                    <Text style={{ color: weighInTiming === t ? "#fff" : colors.mutedForeground, fontWeight: "600" }}>
                      {t === "same_day" ? "Same Day" : "Day Before"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity onPress={submitSetup} disabled={setupMutation.isPending}
              style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
              {setupMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Plan</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: "800" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  iconBtn: { padding: 10, borderRadius: 10, borderWidth: 1 },
  bigInput: { height: 72, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 32, textAlign: "center", fontWeight: "700" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
});
