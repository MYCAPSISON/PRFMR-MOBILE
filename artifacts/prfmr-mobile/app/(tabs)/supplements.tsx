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

function todayStr() { return new Date().toISOString().split("T")[0]; }
function fmtTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function SupplementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"today" | "manage">("today");
  const [refreshing, setRefreshing] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [suppName, setSuppName] = useState("");
  const [suppDose, setSuppDose] = useState("");
  const [suppUnit, setSuppUnit] = useState("mg");
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const today = todayStr();

  const { data: scheduled = [], isLoading: schedLoading } = useQuery<any[]>({
    queryKey: ["/api/me/stacks/scheduled", today],
    queryFn: () => apiFetch(`/me/stacks/scheduled?date=${today}`),
  });

  const { data: intakes = [] } = useQuery<any[]>({
    queryKey: ["/api/me/supplement-intakes", today],
    queryFn: () => apiFetch(`/me/supplement-intakes/${today}`),
  });

  const { data: mySupplements = [] } = useQuery<any[]>({
    queryKey: ["/api/me/supplements"],
    queryFn: () => apiFetch("/me/supplements"),
  });

  const { data: catalog = [] } = useQuery<any[]>({
    queryKey: ["/api/supplement-catalog"],
    queryFn: () => apiFetch("/supplement-catalog"),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/me/stacks/scheduled"] }),
      qc.invalidateQueries({ queryKey: ["/api/me/supplement-intakes"] }),
      qc.invalidateQueries({ queryKey: ["/api/me/supplements"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const intakeKey = (i: any) => `${i.stackId ?? 0}-${i.reminderId ?? 0}-${i.supplementId}`;
  const slotKey = (s: any) => `${s.stackId ?? 0}-${s.reminderId ?? 0}-${s.supplementId}`;
  const takenSet = new Set(intakes.filter((i: any) => i.taken).map(intakeKey));

  const toggleMutation = useMutation({
    mutationFn: async (slot: any) => {
      const key = slotKey(slot);
      const taken = !takenSet.has(key);
      await apiFetch("/supplement-intakes", {
        method: "POST",
        body: { supplementId: slot.supplementId, stackId: slot.stackId, reminderId: slot.reminderId, date: today, taken },
      });
      if (taken) {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        await apiFetch("/supplement-logs", {
          method: "POST",
          body: { supplementId: slot.supplementId, stackId: slot.stackId, date: today, time, taken: true },
        });
      }
    },
    onMutate: async (slot: any) => {
      await qc.cancelQueries({ queryKey: ["/api/me/supplement-intakes", today] });
      const prev = qc.getQueryData<any[]>(["/api/me/supplement-intakes", today]);
      const key = slotKey(slot);
      const taken = !takenSet.has(key);
      qc.setQueryData<any[]>(["/api/me/supplement-intakes", today], (old = []) => {
        if (taken) {
          if (old.some(i => intakeKey(i) === key)) return old.map(i => intakeKey(i) === key ? { ...i, taken: true } : i);
          return [...old, { id: -Date.now(), supplementId: slot.supplementId, stackId: slot.stackId, reminderId: slot.reminderId, taken: true, date: today }];
        }
        return old.filter(i => intakeKey(i) !== key);
      });
      return { prev };
    },
    onError: (_e, _d, ctx) => { if (ctx?.prev) qc.setQueryData(["/api/me/supplement-intakes", today], ctx.prev); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/supplement-intakes"] });
      qc.invalidateQueries({ queryKey: ["/api/me/amqs/score"] });
    },
  });

  const addSuppMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/supplements", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/me/supplements"] });
      setAddModal(false);
      setSuppName(""); setSuppDose(""); setSuppUnit("mg"); setSelectedCatalogId(null);
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "Failed to add supplement"),
  });

  const deleteSuppMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/supplements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/me/supplements"] }),
  });

  const uniqueSlots = Array.from(new Map(scheduled.map((s: any) => [s.supplementId, s])).values());
  const takenCount = uniqueSlots.filter(s => takenSet.has(slotKey(s))).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Supplements</Text>
          {tab === "manage" && (
            <TouchableOpacity onPress={() => setAddModal(true)}
              style={[styles.addBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
              <Feather name="plus" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.tabRow, { backgroundColor: colors.secondary }]}>
          {(["today", "manage"] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={[styles.tab, { backgroundColor: tab === t ? colors.primary : "transparent" }]}>
              <Text style={{ color: tab === t ? "#fff" : colors.mutedForeground, fontWeight: "600", fontSize: 14 }}>
                {t === "today" ? "Today" : "Manage"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "today" && (
          <>
            {uniqueSlots.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>PROGRESS</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>{takenCount}/{uniqueSlots.length} taken</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.secondary, borderRadius: 3 }}>
                  <View style={{
                    height: 6,
                    width: uniqueSlots.length > 0 ? `${(takenCount / uniqueSlots.length) * 100}%` : "0%",
                    backgroundColor: takenCount === uniqueSlots.length ? colors.success : colors.primary,
                    borderRadius: 3,
                  }} />
                </View>
              </View>
            )}

            {schedLoading ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 40, alignItems: "center" }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : uniqueSlots.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", padding: 32, gap: 12 }]}>
                <Feather name="package" size={36} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center" }}>
                  No supplements scheduled. Add supplements and create stacks to see them here.
                </Text>
                <TouchableOpacity onPress={() => setTab("manage")}
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Manage Supplements</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
                {uniqueSlots.map((slot: any, i: number) => {
                  const key = slotKey(slot);
                  const taken = takenSet.has(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => toggleMutation.mutate(slot)}
                      style={[styles.suppRow, { borderBottomWidth: i < uniqueSlots.length - 1 ? 1 : 0, borderBottomColor: colors.border }]}
                    >
                      <View style={[styles.check, {
                        backgroundColor: taken ? colors.success + "22" : colors.secondary,
                        borderColor: taken ? colors.success : colors.border,
                      }]}>
                        {taken && <Feather name="check" size={14} color={colors.success} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: taken ? colors.mutedForeground : colors.foreground, fontSize: 15, fontWeight: "600", textDecorationLine: taken ? "line-through" : "none" }}>
                          {slot.supplementName}
                        </Text>
                        {slot.doseAmount != null && (
                          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{slot.doseAmount} {slot.doseUnit}</Text>
                        )}
                      </View>
                      {slot.time && <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{fmtTime(slot.time)}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {tab === "manage" && (
          <>
            {mySupplements.length === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", padding: 32, gap: 12 }]}>
                <Feather name="package" size={36} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center" }}>No supplements yet. Add your first one!</Text>
                <TouchableOpacity onPress={() => setAddModal(true)}
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Add Supplement</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
                {mySupplements.map((s: any, i: number) => (
                  <View key={s.id} style={[styles.suppRow, { borderBottomWidth: i < mySupplements.length - 1 ? 1 : 0, borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{s.name}</Text>
                      {s.doseAmount != null && (
                        <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{s.doseAmount} {s.doseUnit}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => Alert.alert("Delete", `Remove ${s.name}?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deleteSuppMutation.mutate(s.id) },
                      ])}
                      style={{ padding: 10 }}>
                      <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={addModal} animationType="slide" presentationStyle="formSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Add Supplement</Text>
            <TouchableOpacity onPress={() => { setAddModal(false); setSuppName(""); setSuppDose(""); setSelectedCatalogId(null); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {catalog.length > 0 && (
              <View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 }}>FROM CATALOG</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8, paddingBottom: 4 }}>
                    {catalog.slice(0, 20).map((c: any) => (
                      <TouchableOpacity key={c.id} onPress={() => { setSelectedCatalogId(c.id); setSuppName(c.name); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: selectedCatalogId === c.id ? colors.primary : colors.secondary }}>
                        <Text style={{ color: selectedCatalogId === c.id ? "#fff" : colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 6 }}>NAME</Text>
              <TextInput style={[styles.inputField, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={suppName} onChangeText={setSuppName} placeholder="e.g. Creatine Monohydrate" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 2 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 6 }}>DOSE</Text>
                <TextInput style={[styles.inputField, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                  value={suppDose} onChangeText={setSuppDose} placeholder="5" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 6 }}>UNIT</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {["mg", "g", "ml", "IU"].map(u => (
                    <TouchableOpacity key={u} onPress={() => setSuppUnit(u)}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: suppUnit === u ? colors.primary : colors.secondary, alignItems: "center" }}>
                      <Text style={{ color: suppUnit === u ? "#fff" : colors.mutedForeground, fontSize: 12, fontWeight: "600" }}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => { if (!suppName.trim()) { Alert.alert("Error", "Name is required"); return; } addSuppMutation.mutate({ name: suppName.trim(), doseAmount: parseFloat(suppDose) || null, doseUnit: suppUnit, catalogId: selectedCatalogId }); }}
              disabled={addSuppMutation.isPending}
              style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
              {addSuppMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Supplement</Text>}
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
  addBtn: { padding: 10, borderRadius: 10, borderWidth: 1 },
  tabRow: { flexDirection: "row", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  suppRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  inputField: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
});
