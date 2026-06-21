import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

// ─────────────────────────────────────────
// Types — matched to actual API shape
// ─────────────────────────────────────────
interface Supplement {
  id: number;
  name: string;
  brand: string | null;
  form: string | null;
  notes: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  catalogId: number | null;
  reminderEnabled: boolean;
  reminderTime: string | null;
}

interface CatalogItem {
  id: number;
  name: string;
  defaultUnit: string;
  notes: string | null;
  microsPerUnit: Record<string, number>;
}

const FORMS = ["pill", "capsule", "powder", "liquid", "tablet", "softgel", "gummy", "other"];
const DOSE_UNITS = ["mcg", "mg", "g", "IU", "ml", "serving", "CFU"];

// ─────────────────────────────────────────
// UI primitives
// ─────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const colors = useColors();
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────
// Add / Edit Supplement Modal
// ─────────────────────────────────────────
function SupplementFormModal({
  visible, supplement, onClose,
}: { visible: boolean; supplement: Supplement | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!supplement;

  const [name, setName] = useState(supplement?.name ?? "");
  const [brand, setBrand] = useState(supplement?.brand ?? "");
  const [form, setForm] = useState(supplement?.form ?? "");
  const [notes, setNotes] = useState(supplement?.notes ?? "");
  const [doseAmount, setDoseAmount] = useState(supplement?.doseAmount?.toString() ?? "");
  const [doseUnit, setDoseUnit] = useState(supplement?.doseUnit ?? "mg");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(supplement?.catalogId ?? null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const { data: catalog = [], isError: catalogError } = useQuery<CatalogItem[]>({
    queryKey: ["supplement-catalog"],
    queryFn: () => apiFetch("/supplement-catalog"),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  React.useEffect(() => {
    if (visible) {
      setName(supplement?.name ?? "");
      setBrand(supplement?.brand ?? "");
      setForm(supplement?.form ?? "");
      setNotes(supplement?.notes ?? "");
      setDoseAmount(supplement?.doseAmount?.toString() ?? "");
      setDoseUnit(supplement?.doseUnit ?? "mg");
      setSelectedCatalogId(supplement?.catalogId ?? null);
      setCatalogSearch("");
      setCatalogOpen(false);
    }
  }, [visible, supplement]);

  const selectedCatalogItem = catalog.find(c => c.id === selectedCatalogId) ?? null;

  const filteredCatalog = catalog
    .filter(c => c.name.toLowerCase().includes(catalogSearch.toLowerCase()))
    .slice(0, 10);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        brand: brand.trim() || null,
        form: form || null,
        notes: notes.trim() || null,
        catalogId: selectedCatalogId,
        doseAmount: parseFloat(doseAmount) || null,
        doseUnit: doseUnit || null,
      };
      if (isEdit && supplement) {
        return apiFetch(`/supplements/${supplement.id}`, { method: "PATCH", body });
      }
      return apiFetch("/supplements", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplements"] });
      qc.invalidateQueries({ queryKey: ["stacks-scheduled"] });
      onClose();
    },
  });

  const lbl = { color: "#6b7280", fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.5, marginBottom: 6 };
  const inp = { borderRadius: 8, borderWidth: 1, borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26", padding: 11, fontSize: 14, marginBottom: 14 } as const;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
          <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17 }}>
            {isEdit ? "Edit Supplement" : "Add Supplement"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Catalog error banner */}
          {catalogError && (
            <View style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", padding: 10, marginBottom: 14, flexDirection: "row", gap: 8 }}>
              <Feather name="alert-circle" size={14} color="#f87171" />
              <Text style={{ color: "#f87171", fontSize: 12, flex: 1 }}>
                Catalog unavailable — you can still add a custom supplement.
              </Text>
            </View>
          )}

          {/* ── Catalog selector (shown for both Add and Edit) ── */}
          <Text style={lbl}>SELECT FROM CATALOG (OPTIONAL)</Text>

          {/* Current selection or placeholder */}
          <TouchableOpacity
            onPress={() => setCatalogOpen(o => !o)}
            style={{ flexDirection: "row", alignItems: "center", height: 46,
              borderRadius: 10, borderWidth: 1,
              borderColor: catalogOpen ? "#ff7a00" : "#1a1e28",
              backgroundColor: "#181c26", paddingHorizontal: 12, marginBottom: 4 }}>
            <Text style={{ flex: 1, color: selectedCatalogItem ? "#eceef2" : "#6b7280", fontSize: 14 }}>
              {selectedCatalogItem ? selectedCatalogItem.name : "Custom Supplement"}
            </Text>
            <Feather name={catalogOpen ? "chevron-up" : "chevron-down"} size={15} color="#6b7280" />
          </TouchableOpacity>

          {catalogOpen && (
            <View style={{ borderRadius: 10, borderWidth: 1, borderColor: "#1a1e28",
              backgroundColor: "#181c26", marginBottom: 4, overflow: "hidden" }}>
              {/* Search */}
              <View style={{ flexDirection: "row", alignItems: "center", padding: 10,
                borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
                <Feather name="search" size={13} color="#6b7280" />
                <TextInput
                  style={{ flex: 1, color: "#eceef2", fontSize: 13, marginLeft: 8 }}
                  placeholder="Search catalog..." placeholderTextColor="#6b7280"
                  value={catalogSearch} onChangeText={setCatalogSearch}
                  autoFocus
                />
              </View>
              {/* Custom option */}
              <TouchableOpacity
                onPress={() => {
                  setSelectedCatalogId(null);
                  setCatalogOpen(false);
                  setCatalogSearch("");
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 11,
                  borderBottomWidth: 1, borderBottomColor: "#1a1e28",
                  backgroundColor: selectedCatalogId === null ? "rgba(255,122,0,0.08)" : "transparent" }}>
                <Text style={{ color: selectedCatalogId === null ? "#ff7a00" : "#9ca3af",
                  fontWeight: selectedCatalogId === null ? "700" : "400", fontSize: 13 }}>
                  Custom Supplement
                </Text>
              </TouchableOpacity>
              {/* Catalog items */}
              {filteredCatalog.map((item, i) => (
                <TouchableOpacity key={item.id}
                  onPress={() => {
                    const wasSelected = selectedCatalogId === item.id;
                    if (wasSelected) {
                      setSelectedCatalogId(null);
                    } else {
                      setSelectedCatalogId(item.id);
                      if (!name.trim()) setName(item.name);
                      setDoseUnit(item.defaultUnit);
                    }
                    setCatalogOpen(false);
                    setCatalogSearch("");
                  }}
                  style={{ paddingHorizontal: 14, paddingVertical: 11,
                    borderBottomWidth: i < filteredCatalog.length - 1 ? 1 : 0,
                    borderBottomColor: "#1a1e28",
                    backgroundColor: selectedCatalogId === item.id ? "rgba(255,122,0,0.08)" : "transparent" }}>
                  <Text style={{ color: selectedCatalogId === item.id ? "#ff7a00" : "#eceef2",
                    fontWeight: selectedCatalogId === item.id ? "700" : "400", fontSize: 13 }}>
                    {item.name}
                  </Text>
                  {item.notes && (
                    <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      {item.notes}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
              {filteredCatalog.length === 0 && catalogSearch.length > 0 && (
                <View style={{ padding: 14 }}>
                  <Text style={{ color: "#6b7280", fontSize: 13 }}>No matches — add as custom.</Text>
                </View>
              )}
            </View>
          )}

          {/* Catalog hint box */}
          {selectedCatalogItem && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8,
              backgroundColor: "rgba(147,197,253,0.06)", borderRadius: 8,
              borderWidth: 1, borderColor: "rgba(147,197,253,0.15)", padding: 10, marginBottom: 14, marginTop: 4 }}>
              <Feather name="info" size={13} color="#93c5fd" style={{ marginTop: 1 }} />
              <Text style={{ color: "#93c5fd", fontSize: 12, flex: 1, lineHeight: 17 }}>
                {selectedCatalogItem.notes ?? "This supplement's micronutrients will be tracked for AMQS."}
              </Text>
            </View>
          )}
          {!selectedCatalogItem && <View style={{ height: 14 }} />}

          {/* ── Name ── */}
          <Text style={lbl}>SUPPLEMENT NAME *</Text>
          <TextInput style={inp}
            placeholder="e.g. Vitamin D3" placeholderTextColor="#6b7280"
            value={name} onChangeText={setName} />

          {/* ── Brand ── */}
          <Text style={lbl}>BRAND (optional)</Text>
          <TextInput style={inp}
            placeholder="e.g. Nature Made" placeholderTextColor="#6b7280"
            value={brand} onChangeText={setBrand} />

          {/* ── Dose ── */}
          <Text style={lbl}>DOSE</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
            <TextInput
              style={{ ...inp, flex: 1, marginBottom: 0 }}
              placeholder="Amount (e.g. 25)" placeholderTextColor="#6b7280"
              keyboardType="decimal-pad" value={doseAmount} onChangeText={setDoseAmount} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DOSE_UNITS.map(u => (
                <TouchableOpacity key={u} style={[s.chip, {
                  borderColor: doseUnit === u ? "#ff7a00" : "#1a1e28",
                  backgroundColor: doseUnit === u ? "rgba(255,122,0,0.1)" : "#181c26",
                }]} onPress={() => setDoseUnit(u)}>
                  <Text style={{ color: doseUnit === u ? "#ff7a00" : "#6b7280", fontSize: 12, fontWeight: "700" }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Form ── */}
          <Text style={lbl}>FORM (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {FORMS.map(f => (
              <TouchableOpacity key={f} style={[s.chip, {
                borderColor: form === f ? "#ff7a00" : "#1a1e28",
                backgroundColor: form === f ? "rgba(255,122,0,0.1)" : "#181c26",
              }]} onPress={() => setForm(form === f ? "" : f)}>
                <Text style={{ color: form === f ? "#ff7a00" : "#6b7280", fontSize: 12, fontWeight: "700", textTransform: "capitalize" }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Notes ── */}
          <Text style={lbl}>NOTES (optional)</Text>
          <TextInput
            style={{ ...inp, height: 80, textAlignVertical: "top" }}
            placeholder="Any personal notes..." placeholderTextColor="#6b7280"
            value={notes} onChangeText={setNotes} multiline />

          {/* ── Submit ── */}
          {saveMut.isError && (
            <Text style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>
              {(saveMut.error as Error).message ?? "Failed to save. Try again."}
            </Text>
          )}
          <TouchableOpacity
            style={[s.fullBtn, { backgroundColor: "#ff7a00", opacity: name.trim() ? 1 : 0.4 }]}
            disabled={!name.trim() || saveMut.isPending}
            onPress={() => saveMut.mutate()}>
            {saveMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                  {isEdit ? "Save Changes" : "Add Supplement"}
                </Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Supplement Row (§14.8)
// ─────────────────────────────────────────
function SupplementRow({ supplement }: { supplement: Supplement }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => apiFetch(`/supplements/${supplement.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplements"] });
      qc.invalidateQueries({ queryKey: ["stacks-scheduled"] });
    },
  });

  const handleDelete = () => {
    Alert.alert(
      "Delete supplement?",
      `Remove "${supplement.name}" from your list?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() },
      ]
    );
  };

  return (
    <>
      <View style={[s.suppRow, { borderColor: colors.border }]}>
        {/* Icon */}
        <View style={[s.suppIcon, { backgroundColor: "rgba(255,122,0,0.1)", borderColor: "rgba(255,122,0,0.2)" }]}>
          <MaterialCommunityIcons name="pill" size={18} color={colors.primary} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Row 1: name + badges */}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginBottom: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>{supplement.name}</Text>
            {supplement.doseAmount != null && supplement.doseUnit && (
              <View style={[s.microBadge, { borderColor: colors.border }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700" }}>
                  {supplement.doseAmount} {supplement.doseUnit}
                </Text>
              </View>
            )}
            {supplement.form && (
              <View style={[s.microBadge, { borderColor: colors.border, backgroundColor: "rgba(107,114,128,0.1)" }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", textTransform: "capitalize" }}>
                  {supplement.form}
                </Text>
              </View>
            )}
            {supplement.catalogId != null && (
              <View style={[s.microBadge, { borderColor: "rgba(255,122,0,0.3)", backgroundColor: "rgba(255,122,0,0.1)" }]}>
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "700" }}>AMQS tracked</Text>
              </View>
            )}
          </View>

          {/* Row 2: AMQS sub-line */}
          {supplement.catalogId != null && (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, opacity: 0.7, marginTop: 1 }}>
              Contributing to your AMQS score
            </Text>
          )}

          {/* Row 3: reminder */}
          {supplement.reminderEnabled && supplement.reminderTime && (
            <Text style={{ color: colors.primary, fontSize: 11, opacity: 0.8, marginTop: 2 }}>
              ⏰ Daily reminder at {supplement.reminderTime}
            </Text>
          )}

          {/* Row 4: brand + notes */}
          {supplement.brand && (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
              {supplement.brand}
            </Text>
          )}
          {supplement.notes && (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontStyle: "italic", marginTop: 2 }}>
              {supplement.notes}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => setEditOpen(true)}>
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8 }} onPress={handleDelete}>
            {deleteMut.isPending
              ? <ActivityIndicator size="small" color="#f87171" />
              : <Feather name="trash-2" size={15} color={colors.mutedForeground} />}
          </TouchableOpacity>
        </View>
      </View>

      <SupplementFormModal visible={editOpen} supplement={supplement} onClose={() => setEditOpen(false)} />
    </>
  );
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function SupplementsScreen() {
  const colors = useColors();
  const [addOpen, setAddOpen] = useState(false);

  const { data: supplements = [], isLoading } = useQuery<Supplement[]>({
    queryKey: ["supplements"],
    queryFn: () => apiFetch("/me/supplements"),
  });

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>My Supplements</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setAddOpen(true)}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13, marginLeft: 4 }}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <Card style={{ borderColor: "rgba(147,197,253,0.2)", backgroundColor: "rgba(147,197,253,0.04)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <Feather name="info" size={14} color="#93c5fd" />
            <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 14, marginLeft: 8 }}>How Supplements Work</Text>
          </View>
          <Text style={[s.xs, { color: colors.mutedForeground, lineHeight: 18 }]}>
            Add your supplements here, then create stacks and set reminders to see them on your daily dashboard. Supplements linked to the catalog automatically track micronutrients for your AMQS score.
          </Text>
        </Card>

        {/* Supplements List */}
        <Card>
          <View style={[s.rowBetween, { marginBottom: 8 }]}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Your Supplements</Text>
            {supplements.length > 0 && (
              <View style={[s.badge, { backgroundColor: "rgba(255,122,0,0.1)", borderColor: "rgba(255,122,0,0.3)" }]}>
                <Text style={[s.xs, { color: colors.primary, fontWeight: "700" }]}>{supplements.length}</Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : supplements.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <MaterialCommunityIcons name="pill" size={40} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
              <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 10, fontSize: 14, lineHeight: 20 }}>
                No supplements yet.{"\n"}Tap "+ Add" to get started.
              </Text>
            </View>
          ) : (
            <View>
              {supplements.map(supp => <SupplementRow key={supp.id} supplement={supp} />)}
            </View>
          )}
        </Card>

        {/* Stacks Hint */}
        {supplements.length > 0 && (
          <Card style={{ borderColor: "rgba(255,122,0,0.15)" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="layers" size={14} color={colors.primary} />
              <Text style={[s.sm, { color: colors.foreground, fontWeight: "700", marginLeft: 8 }]}>Stacks & Reminders</Text>
            </View>
            <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 6, lineHeight: 18 }]}>
              Group your supplements into stacks (e.g. Morning Stack, Pre-Workout) and set reminders to track them on your daily dashboard.
            </Text>
            <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 6 }]}>
              Manage stacks from the web app at app.prfmr.link for full control.
            </Text>
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <SupplementFormModal visible={addOpen} supplement={null} onClose={() => setAddOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  pageTitle: { fontSize: 20, fontWeight: "800" },
  scrollPad: { padding: 12, gap: 10 },
  card: { borderRadius: 9, borderWidth: 1, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  microBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "transparent" },
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  addBtn: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  suppRow: { flexDirection: "row", alignItems: "flex-start", borderRadius: 9, borderWidth: 1, padding: 12, marginTop: 6, gap: 10 },
  suppIcon: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 1 },
  fullBtn: { borderRadius: 9, padding: 14, alignItems: "center" },
  chip: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
});
