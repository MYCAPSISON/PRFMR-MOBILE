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
// Types
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
}

interface CatalogItem {
  id: number;
  name: string;
  category: string | null;
  defaultDoseAmount: number | null;
  defaultDoseUnit: string | null;
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
// Add/Edit Supplement Modal
// ─────────────────────────────────────────
function SupplementFormModal({
  visible, supplement, onClose,
}: { visible: boolean; supplement: Supplement | null; onClose: () => void }) {
  const colors = useColors();
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

  const { data: catalog = [] } = useQuery<CatalogItem[]>({
    queryKey: ["supplement-catalog"],
    queryFn: () => apiFetch("/supplement-catalog"),
    staleTime: 5 * 60 * 1000,
  });

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

  const filteredCatalog = catalog
    .filter(c => c.name.toLowerCase().includes(catalogSearch.toLowerCase()))
    .slice(0, 8);

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
    }
  }, [visible, supplement]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        <View style={[s.rowBetween, { padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }]}>
          <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17 }}>
            {isEdit ? "Edit Supplement" : "Add Supplement"}
          </Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color="#6b7280" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Catalog link */}
          {!isEdit && (
            <>
              <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>LINK TO CATALOG (OPTIONAL)</Text>
              <View style={[s.searchBar, { borderColor: "#1a1e28", backgroundColor: "#181c26" }]}>
                <Feather name="search" size={15} color="#6b7280" />
                <TextInput style={{ flex: 1, color: "#eceef2", fontSize: 14, marginLeft: 8 }}
                  placeholder="Search supplement catalog..." placeholderTextColor="#6b7280"
                  value={catalogSearch} onChangeText={setCatalogSearch} />
              </View>
              {filteredCatalog.map(item => (
                <TouchableOpacity key={item.id}
                  style={[s.catalogChip, {
                    borderColor: selectedCatalogId === item.id ? "#ff7a00" : "#1a1e28",
                    backgroundColor: selectedCatalogId === item.id ? "rgba(255,122,0,0.1)" : "#181c26",
                  }]}
                  onPress={() => {
                    if (selectedCatalogId === item.id) {
                      setSelectedCatalogId(null);
                    } else {
                      setSelectedCatalogId(item.id);
                      if (!name.trim()) setName(item.name);
                      if (!doseAmount && item.defaultDoseAmount) setDoseAmount(item.defaultDoseAmount.toString());
                      if (item.defaultDoseUnit) setDoseUnit(item.defaultDoseUnit);
                    }
                  }}>
                  <Text style={{ color: selectedCatalogId === item.id ? "#ff7a00" : "#eceef2", fontWeight: "600", fontSize: 13 }}>{item.name}</Text>
                  {item.category && <Text style={{ color: "#6b7280", fontSize: 12 }}>{item.category}</Text>}
                </TouchableOpacity>
              ))}
              <View style={{ height: 14 }} />
            </>
          )}

          {/* Name */}
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 }}>NAME *</Text>
          <TextInput style={[s.input, { borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26", marginBottom: 14 }]}
            placeholder="e.g. Creatine Monohydrate" placeholderTextColor="#6b7280"
            value={name} onChangeText={setName} />

          {/* Brand */}
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 }}>BRAND (optional)</Text>
          <TextInput style={[s.input, { borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26", marginBottom: 14 }]}
            placeholder="e.g. Optimum Nutrition" placeholderTextColor="#6b7280"
            value={brand} onChangeText={setBrand} />

          {/* Dose */}
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 }}>DOSE</Text>
          <View style={[s.row, { marginBottom: 14, gap: 8 }]}>
            <TextInput style={[s.input, { flex: 1, borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26" }]}
              placeholder="Amount" placeholderTextColor="#6b7280"
              keyboardType="decimal-pad" value={doseAmount} onChangeText={setDoseAmount} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DOSE_UNITS.map(u => (
                <TouchableOpacity key={u} style={[s.unitChip, {
                  borderColor: doseUnit === u ? "#ff7a00" : "#1a1e28",
                  backgroundColor: doseUnit === u ? "rgba(255,122,0,0.1)" : "#181c26",
                }]} onPress={() => setDoseUnit(u)}>
                  <Text style={{ color: doseUnit === u ? "#ff7a00" : "#6b7280", fontSize: 12, fontWeight: "700" }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Form */}
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 }}>FORM (optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {FORMS.map(f => (
              <TouchableOpacity key={f} style={[s.unitChip, {
                borderColor: form === f ? "#ff7a00" : "#1a1e28",
                backgroundColor: form === f ? "rgba(255,122,0,0.1)" : "#181c26",
              }]} onPress={() => setForm(form === f ? "" : f)}>
                <Text style={{ color: form === f ? "#ff7a00" : "#6b7280", fontSize: 12, fontWeight: "700", textTransform: "capitalize" }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Notes */}
          <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 }}>NOTES (optional)</Text>
          <TextInput style={[s.input, { borderColor: "#1a1e28", color: "#eceef2", backgroundColor: "#181c26", height: 80, textAlignVertical: "top", marginBottom: 14 }]}
            placeholder="Any notes about this supplement..." placeholderTextColor="#6b7280"
            value={notes} onChangeText={setNotes} multiline />

          <TouchableOpacity style={[s.fullBtn, { backgroundColor: "#ff7a00", opacity: name.trim() ? 1 : 0.4 }]}
            disabled={!name.trim() || saveMut.isPending}
            onPress={() => saveMut.mutate()}>
            {saveMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{isEdit ? "Save Changes" : "Add Supplement"}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Supplement Row
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
    Alert.alert("Delete supplement?", `Remove "${supplement.name}" from your list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate() },
    ]);
  };

  return (
    <>
      <View style={[s.suppRow, { borderColor: colors.border }]}>
        <View style={[s.suppIcon, { backgroundColor: "rgba(255,122,0,0.1)", borderColor: "rgba(255,122,0,0.2)" }]}>
          <MaterialCommunityIcons name="pill" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.sm, { color: colors.foreground, fontWeight: "700" }]}>{supplement.name}</Text>
          <Text style={[s.xs, { color: colors.mutedForeground }]}>
            {[
              supplement.brand,
              supplement.doseAmount ? `${supplement.doseAmount} ${supplement.doseUnit ?? ""}`.trim() : null,
              supplement.form,
            ].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <TouchableOpacity style={{ padding: 8 }} onPress={() => setEditOpen(true)}>
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 8 }} onPress={handleDelete}>
          <Feather name="trash-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
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
          <View style={[s.row, { marginBottom: 6 }]}>
            <Feather name="info" size={14} color="#93c5fd" />
            <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 14, marginLeft: 8 }}>How Supplements Work</Text>
          </View>
          <Text style={[s.xs, { color: colors.mutedForeground, lineHeight: 18 }]}>
            Add your supplements here, then create stacks and set reminders to see them on your daily dashboard. Each supplement can be linked to the catalog for automatic micronutrient tracking.
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
              <Text style={[{ color: colors.mutedForeground, textAlign: "center", marginTop: 10, fontSize: 14, lineHeight: 20 }]}>
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
            <View style={s.row}>
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
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  addBtn: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  suppRow: { flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, padding: 12, marginTop: 6, gap: 10 },
  suppIcon: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { borderRadius: 8, borderWidth: 1, padding: 11, fontSize: 14 },
  fullBtn: { borderRadius: 9, padding: 14, alignItems: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 9, borderWidth: 1, padding: 10, marginBottom: 8 },
  catalogChip: { borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 6 },
  unitChip: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
});
