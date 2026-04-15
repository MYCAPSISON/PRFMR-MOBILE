import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface Supplement {
  id: number;
  name: string;
  dose?: string;
  unit?: string;
  timing?: string;
  notes?: string;
  taken?: boolean;
}

export default function SupplementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [unit, setUnit] = useState("mg");
  const [timing, setTiming] = useState("morning");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: supplements, isLoading, refetch } = useQuery<Supplement[]>({
    queryKey: ["supplements"],
    queryFn: () => apiFetch("/me/supplements"),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function addSupplement() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/me/supplements", {
        method: "POST",
        body: { name: name.trim(), dose, unit, timing, notes },
      });
      qc.invalidateQueries({ queryKey: ["supplements"] });
      setAddModalVisible(false);
      resetForm();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function toggleTaken(id: number, taken: boolean) {
    try {
      await apiFetch(`/me/supplements/${id}/taken`, {
        method: "POST",
        body: { taken, date: new Date().toISOString().split("T")[0] },
      });
      qc.invalidateQueries({ queryKey: ["supplements"] });
    } catch {
      // ignore
    }
  }

  async function deleteSupplement(id: number) {
    try {
      await apiFetch(`/me/supplements/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["supplements"] });
    } catch {
      // ignore
    }
  }

  function resetForm() {
    setName("");
    setDose("");
    setUnit("mg");
    setTiming("morning");
    setNotes("");
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top + 67, 100) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const timingGroups: Record<string, Supplement[]> = {};
  (supplements ?? []).forEach((s) => {
    const key = s.timing ?? "other";
    if (!timingGroups[key]) timingGroups[key] = [];
    timingGroups[key].push(s);
  });

  const takenCount = (supplements ?? []).filter((s) => s.taken).length;
  const totalCount = (supplements ?? []).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 100 + bottomPad, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Supplements</Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {totalCount > 0 && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>TODAY'S PROGRESS</Text>
            <Text style={[styles.progressValue, { color: colors.foreground }]}>
              {takenCount}/{totalCount}
              <Text style={[styles.progressUnit, { color: colors.mutedForeground }]}> taken</Text>
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${(takenCount / Math.max(totalCount, 1)) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        )}

        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (supplements ?? []).length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="package" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No supplements tracked</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add your supplement stack to track daily intake</Text>
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Text style={styles.emptyBtnText}>Add Supplement</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Object.entries(timingGroups).map(([timingKey, items]) => (
            <View key={timingKey} style={{ marginBottom: 12 }}>
              <Text style={[styles.timingHeader, { color: colors.mutedForeground }]}>
                {timingKey.toUpperCase()}
              </Text>
              {items.map((sup) => (
                <View key={sup.id} style={[styles.supCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <View style={styles.supInfo}>
                    <Text style={[styles.supName, { color: sup.taken ? colors.mutedForeground : colors.foreground, textDecorationLine: sup.taken ? "line-through" : "none" }]}>
                      {sup.name}
                    </Text>
                    {(sup.dose || sup.unit) && (
                      <Text style={[styles.supDose, { color: colors.primary }]}>
                        {sup.dose ?? ""}{sup.unit ? ` ${sup.unit}` : ""}
                      </Text>
                    )}
                    {sup.notes && <Text style={[styles.supNotes, { color: colors.mutedForeground }]}>{sup.notes}</Text>}
                  </View>
                  <View style={styles.supActions}>
                    <Switch
                      value={!!sup.taken}
                      onValueChange={(v) => toggleTaken(sup.id, v)}
                      trackColor={{ false: colors.border, true: colors.primary + "66" }}
                      thumbColor={sup.taken ? colors.primary : colors.mutedForeground}
                    />
                    <TouchableOpacity onPress={() => deleteSupplement(sup.id)} hitSlop={8}>
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={addModalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setAddModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Supplement</Text>
            <TouchableOpacity onPress={() => { setAddModalVisible(false); resetForm(); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>NAME</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, marginBottom: 16 }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Creatine, Vitamin D"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />

          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>DOSE</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                value={dose}
                onChangeText={setDose}
                keyboardType="decimal-pad"
                placeholder="5"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>UNIT</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                value={unit}
                onChangeText={setUnit}
                placeholder="mg, g, IU"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>TIMING</Text>
          <View style={styles.timingPicker}>
            {["morning", "pre-workout", "post-workout", "evening", "with meals"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTiming(t)}
                style={[styles.timingChip, { backgroundColor: timing === t ? colors.primary : colors.secondary, borderRadius: 20 }]}
              >
                <Text style={{ color: timing === t ? "#fff" : colors.mutedForeground, fontSize: 12, fontWeight: "600" }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>NOTES (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, height: 72, textAlignVertical: "top", paddingTop: 12 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes..."
            placeholderTextColor={colors.mutedForeground}
            multiline
          />

          <TouchableOpacity
            onPress={addSupplement}
            disabled={saving || !name.trim()}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, marginTop: 20, opacity: saving || !name.trim() ? 0.6 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Supplement</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  screenTitle: { fontSize: 24, fontWeight: "800" },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  progressCard: { padding: 16, borderWidth: 1, marginBottom: 16 },
  progressLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 4 },
  progressValue: { fontSize: 28, fontWeight: "700", marginBottom: 10 },
  progressUnit: { fontSize: 15, fontWeight: "400" },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4 },
  timingHeader: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  supCard: { flexDirection: "row", alignItems: "center", padding: 14, borderWidth: 1, marginBottom: 8 },
  supInfo: { flex: 1 },
  supName: { fontSize: 15, fontWeight: "600" },
  supDose: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  supNotes: { fontSize: 11, marginTop: 2 },
  supActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  emptyBox: { padding: 40, borderWidth: 1, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: { height: 48, paddingHorizontal: 14, borderWidth: 1, fontSize: 15 },
  rowInputs: { flexDirection: "row", gap: 12 },
  timingPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timingChip: { paddingHorizontal: 12, paddingVertical: 6 },
  saveBtn: { height: 52, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
