import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { SkeletonCard } from "@/components/SkeletonCard";
import { StatCard } from "@/components/StatCard";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface WeightCutData {
  currentWeight?: number;
  targetWeight?: number;
  fightDate?: string;
  daysOut?: number;
  dailyCalorieTarget?: number;
  waterCutPhase?: boolean;
  projectedWeight?: number;
  weightEntries?: { date: string; weight: number }[];
  guidance?: string[];
}

export default function WeightCutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [fightDate, setFightDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery<WeightCutData>({
    queryKey: ["weightCut"],
    queryFn: () => apiFetch("/me/weight-cut"),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function logWeight() {
    if (!weightInput) return;
    setSaving(true);
    try {
      await apiFetch("/me/weight-cut/entry", {
        method: "POST",
        body: { weight: parseFloat(weightInput), date: new Date().toISOString().split("T")[0] },
      });
      qc.invalidateQueries({ queryKey: ["weightCut"] });
      setLogModalVisible(false);
      setWeightInput("");
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function savePlan() {
    if (!targetWeight) return;
    setSaving(true);
    try {
      await apiFetch("/me/weight-cut", {
        method: "POST",
        body: { targetWeight: parseFloat(targetWeight), fightDate: fightDate || undefined },
      });
      qc.invalidateQueries({ queryKey: ["weightCut"] });
      setSetupModalVisible(false);
      setTargetWeight("");
      setFightDate("");
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top + 67, 100) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const entries = data?.weightEntries ?? [];
  const maxW = entries.length > 0 ? Math.max(...entries.map((e) => e.weight)) : (data?.currentWeight ?? 90);
  const minW = Math.min(data?.targetWeight ?? maxW * 0.9, maxW * 0.9);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 100 + bottomPad, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Weight Cut</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              onPress={() => setLogModalVisible(true)}
              style={[styles.headerBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.headerBtnText}>Log</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSetupModalVisible(true)}
              style={[styles.headerBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}
            >
              <Feather name="settings" size={16} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : !data || (!data.currentWeight && !data.targetWeight) ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="trending-down" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Weight Cut Setup</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Set your target weight and fight date to get started</Text>
            <TouchableOpacity
              onPress={() => setSetupModalVisible(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Text style={styles.emptyBtnText}>Set Up Weight Cut</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.statRow}>
              <StatCard label="Current" value={data.currentWeight ?? "—"} unit="kg" />
              <StatCard label="Target" value={data.targetWeight ?? "—"} unit="kg" accent />
              {data.daysOut != null && <StatCard label="Days Out" value={data.daysOut} />}
            </View>

            {data.dailyCalorieTarget && (
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.infoRow}>
                  <Feather name="target" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>DAILY CALORIE TARGET</Text>
                    <Text style={[styles.infoValue, { color: colors.foreground }]}>{data.dailyCalorieTarget} kcal</Text>
                  </View>
                </View>
              </View>
            )}

            {data.waterCutPhase && (
              <View style={[styles.alertCard, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "66", borderRadius: colors.radius }]}>
                <Feather name="droplet" size={18} color={colors.warning} />
                <View>
                  <Text style={[styles.alertTitle, { color: colors.warning }]}>Water Cut Phase Active</Text>
                  <Text style={[styles.alertText, { color: colors.mutedForeground }]}>Reduce water intake as per protocol</Text>
                </View>
              </View>
            )}

            {data.guidance && data.guidance.length > 0 && (
              <View style={[styles.guidanceCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={[styles.guidanceTitle, { color: colors.mutedForeground }]}>GUIDANCE</Text>
                {data.guidance.map((g, i) => (
                  <View key={i} style={styles.guidanceItem}>
                    <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.guidanceText, { color: colors.foreground }]}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {entries.length > 0 && (
              <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={[styles.chartTitle, { color: colors.mutedForeground }]}>WEIGHT HISTORY</Text>
                <View style={styles.chartArea}>
                  {entries.slice(-14).map((entry, i, arr) => {
                    const range = maxW - minW || 1;
                    const heightPct = ((entry.weight - minW) / range) * 100;
                    const isLast = i === arr.length - 1;
                    return (
                      <View key={entry.date} style={styles.barContainer}>
                        <View style={styles.barWrapper}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: `${Math.max(heightPct, 5)}%`,
                                backgroundColor: isLast ? colors.primary : colors.muted,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>
                          {new Date(entry.date).getDate()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {data.targetWeight && (
                  <View style={styles.legend}>
                    <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.legendText, { color: colors.mutedForeground }]}>
                      Target: {data.targetWeight}kg
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={logModalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setLogModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Weight</Text>
            <TouchableOpacity onPress={() => setLogModalVisible(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>WEIGHT (kg)</Text>
          <TextInput
            style={[styles.bigInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
            value={weightInput}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder="e.g. 75.5"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
          <TouchableOpacity
            onPress={logWeight}
            disabled={saving || !weightInput}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: saving || !weightInput ? 0.6 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Log Weight</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={setupModalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setSetupModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Set Up Weight Cut</Text>
            <TouchableOpacity onPress={() => setSetupModalVisible(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TARGET WEIGHT (kg)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, marginBottom: 16 }]}
            value={targetWeight}
            onChangeText={setTargetWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 70.0"
            placeholderTextColor={colors.mutedForeground}
          />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>FIGHT DATE (YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, marginBottom: 16 }]}
            value={fightDate}
            onChangeText={setFightDate}
            placeholder="2026-08-15"
            placeholderTextColor={colors.mutedForeground}
          />
          <TouchableOpacity
            onPress={savePlan}
            disabled={saving || !targetWeight}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: saving || !targetWeight ? 0.6 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Plan</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  screenTitle: { fontSize: 24, fontWeight: "800" },
  headerBtns: { flexDirection: "row", gap: 8 },
  headerBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  headerBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  infoCard: { padding: 16, borderWidth: 1, marginBottom: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  infoValue: { fontSize: 22, fontWeight: "700" },
  alertCard: { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1, marginBottom: 10, gap: 12 },
  alertTitle: { fontSize: 14, fontWeight: "700" },
  alertText: { fontSize: 12, marginTop: 2 },
  guidanceCard: { padding: 16, borderWidth: 1, marginBottom: 10 },
  guidanceTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 12 },
  guidanceItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  guidanceText: { fontSize: 13, flex: 1, lineHeight: 18 },
  chartCard: { padding: 16, borderWidth: 1, marginBottom: 10 },
  chartTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 12 },
  chartArea: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: 3 },
  barContainer: { flex: 1, alignItems: "center", height: "100%" },
  barWrapper: { flex: 1, justifyContent: "flex-end", width: "100%" },
  bar: { width: "100%", borderRadius: 3 },
  barLabel: { fontSize: 9, marginTop: 3 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  emptyBox: { padding: 40, borderWidth: 1, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: { height: 48, paddingHorizontal: 14, borderWidth: 1, fontSize: 15 },
  bigInput: { height: 72, paddingHorizontal: 20, borderWidth: 1, fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  saveBtn: { height: 52, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
