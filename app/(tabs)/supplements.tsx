import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Switch,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/AppToast";

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

// Shared AMQS query keys to invalidate on any supplement mutation (§6.6, §14.5, §14.6, §14.7)
const AMQS_KEYS = [
  { queryKey: ["/api/me/amqs/score"],      exact: false },
  { queryKey: ["/api/me/amqs/score-range"], exact: false },
];

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
// Add / Edit Supplement Modal  (§14.5, §14.6)
// ─────────────────────────────────────────
function SupplementFormModal({
  visible, supplement, onClose,
}: { visible: boolean; supplement: Supplement | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!supplement;

  // Form state
  const [name, setName]                   = useState(supplement?.name ?? "");
  const [brand, setBrand]                 = useState(supplement?.brand ?? "");
  const [form, setForm]                   = useState(supplement?.form ?? "");
  const [notes, setNotes]                 = useState(supplement?.notes ?? "");
  const [doseAmount, setDoseAmount]       = useState(supplement?.doseAmount?.toString() ?? "");
  const [doseUnit, setDoseUnit]           = useState(supplement?.doseUnit ?? "mg");
  const [reminderEnabled, setReminderEnabled] = useState(supplement?.reminderEnabled ?? false);
  const [reminderTime, setReminderTime]   = useState(supplement?.reminderTime ?? "08:00");
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(supplement?.catalogId ?? null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogOpen, setCatalogOpen]     = useState(false);

  const { data: catalog = [], isError: catalogError } = useQuery<CatalogItem[]>({
    queryKey: ["supplement-catalog"],
    queryFn: () => apiFetch("/supplement-catalog"),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: visible,
  });

  // Reset when modal opens
  React.useEffect(() => {
    if (visible) {
      setName(supplement?.name ?? "");
      setBrand(supplement?.brand ?? "");
      setForm(supplement?.form ?? "");
      setNotes(supplement?.notes ?? "");
      setDoseAmount(supplement?.doseAmount?.toString() ?? "");
      setDoseUnit(supplement?.doseUnit ?? "mg");
      setReminderEnabled(supplement?.reminderEnabled ?? false);
      setReminderTime(supplement?.reminderTime ?? "08:00");
      setSelectedCatalogId(supplement?.catalogId ?? null);
      setCatalogSearch("");
      setCatalogOpen(false);
    }
  }, [visible, supplement]);

  const selectedCatalogItem = catalog.find(c => c.id === selectedCatalogId) ?? null;
  const filteredCatalog = catalog
    .filter(c => c.name.toLowerCase().includes(catalogSearch.toLowerCase()))
    .slice(0, 12);

  // ── Save mutation ──
  const saveMut = useMutation({
    mutationFn: () => {
      if (isEdit && supplement) {
        // PATCH body — send null explicitly for cleared fields (§14.6)
        const body = {
          name: name.trim(),
          brand: brand.trim() || null,
          form: form || null,
          notes: notes.trim() || null,
          catalogId: selectedCatalogId,
          doseAmount: parseFloat(doseAmount) || null,
          doseUnit: doseUnit || null,
          reminderEnabled,
          reminderTime: reminderEnabled ? reminderTime : null,
        };
        return apiFetch(`/supplements/${supplement.id}`, { method: "PATCH", body });
      }
      // POST body (§14.5) — only send reminder fields when relevant
      const body: Record<string, unknown> = {
        name: name.trim(),
        reminderEnabled,
      };
      if (brand.trim())          body.brand = brand.trim();
      if (form)                  body.form = form;
      if (notes.trim())          body.notes = notes.trim();
      if (selectedCatalogId)     body.catalogId = selectedCatalogId;
      if (parseFloat(doseAmount)) body.doseAmount = parseFloat(doseAmount);
      if (doseUnit)              body.doseUnit = doseUnit;
      if (reminderEnabled)       body.reminderTime = reminderTime;
      return apiFetch("/supplements", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplements"] });
      // exact: false catches ["stacks-scheduled", date] variants on the dashboard
      qc.invalidateQueries({ queryKey: ["stacks-scheduled"], exact: false });
      AMQS_KEYS.forEach(k => qc.invalidateQueries(k));
      showToast({ title: isEdit ? "Supplement updated" : "Supplement added" });
      onClose();
    },
  });

  const lbl = { color: "#6b7280", fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.5, marginBottom: 6 };
  const inp = {
    borderRadius: 8, borderWidth: 1, borderColor: "#1a1e28", color: "#eceef2",
    backgroundColor: "#181c26", padding: 11, fontSize: 14, marginBottom: 14,
  } as const;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f1117" }}>
        {/* ── Header ── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1e28" }}>
          <Text style={{ color: "#eceef2", fontWeight: "700", fontSize: 17 }}>
            {isEdit ? "Edit Supplement" : "Add Supplement"}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Catalog error banner ── */}
          {catalogError && (
            <View style={{ backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8,
              borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", padding: 10, marginBottom: 14,
              flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Feather name="alert-circle" size={14} color="#f87171" />
              <Text style={{ color: "#f87171", fontSize: 12, flex: 1 }}>
                Catalog unavailable — you can still add a custom supplement.
              </Text>
            </View>
          )}

          {/* ── Field 1: Catalog selector (§14.5 / §14.9) ── */}
          <Text style={lbl}>SELECT FROM CATALOG (OPTIONAL)</Text>

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
                  // Add mode: clear doseUnit per spec §14.5
                  // Edit mode: preserve existing doseUnit per spec §14.6
                  if (!isEdit) setDoseUnit("mg");
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
                    if (selectedCatalogId === item.id) {
                      // Deselect → treat as custom
                      setSelectedCatalogId(null);
                      if (!isEdit) setDoseUnit("mg");
                    } else {
                      setSelectedCatalogId(item.id);
                      // Auto-fill name (only if empty) and doseUnit (§14.5)
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

          {/* ── Catalog hint box (§14.9 — shown only when catalog item selected) ── */}
          {selectedCatalogItem ? (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8,
              backgroundColor: "rgba(107,114,128,0.12)", borderRadius: 8,
              padding: 10, marginBottom: 14, marginTop: 4 }}>
              <Feather name="info" size={12} color="#9ca3af" style={{ marginTop: 1 }} />
              <Text style={{ color: "#9ca3af", fontSize: 12, flex: 1, lineHeight: 17 }}>
                {selectedCatalogItem.notes ?? "This supplement's micronutrients will be tracked for AMQS."}
              </Text>
            </View>
          ) : (
            <View style={{ height: 14 }} />
          )}

          {/* ── Field 2: Name (§14.5) ── */}
          <Text style={lbl}>SUPPLEMENT NAME *</Text>
          <TextInput style={inp}
            placeholder="e.g. Vitamin D3" placeholderTextColor="#6b7280"
            value={name} onChangeText={setName} />

          {/* ── Fields 3 + 4: Dose (§14.5) ── */}
          <Text style={lbl}>DOSE AMOUNT</Text>
          <TextInput
            style={inp}
            placeholder="e.g. 25" placeholderTextColor="#6b7280"
            keyboardType="decimal-pad" value={doseAmount} onChangeText={setDoseAmount}
          />
          <Text style={lbl}>DOSE UNIT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {DOSE_UNITS.map(u => (
              <TouchableOpacity key={u} style={[s.chip, {
                borderColor: doseUnit === u ? "#ff7a00" : "#1a1e28",
                backgroundColor: doseUnit === u ? "rgba(255,122,0,0.1)" : "#181c26",
              }]} onPress={() => setDoseUnit(u)}>
                <Text style={{ color: doseUnit === u ? "#ff7a00" : "#6b7280", fontSize: 12, fontWeight: "700" }}>{u}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Field 5: Brand (§14.5) ── */}
          <Text style={lbl}>BRAND (OPTIONAL)</Text>
          <TextInput style={inp}
            placeholder="e.g. Nature Made" placeholderTextColor="#6b7280"
            value={brand} onChangeText={setBrand} />

          {/* ── Field 6: Form (§14.5) ── */}
          <Text style={lbl}>FORM (OPTIONAL)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {FORMS.map(f => (
              <TouchableOpacity key={f} style={[s.chip, {
                borderColor: form === f ? "#ff7a00" : "#1a1e28",
                backgroundColor: form === f ? "rgba(255,122,0,0.1)" : "#181c26",
              }]} onPress={() => setForm(form === f ? "" : f)}>
                <Text style={{ color: form === f ? "#ff7a00" : "#6b7280",
                  fontSize: 12, fontWeight: "700", textTransform: "capitalize" }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Field 7: Notes (§14.5) ── */}
          <Text style={lbl}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={{ ...inp, height: 72, textAlignVertical: "top" }}
            placeholder="Any personal notes..." placeholderTextColor="#6b7280"
            value={notes} onChangeText={setNotes} multiline />

          {/* ── Field 8: Daily Reminder toggle (§14.5) ── */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            marginBottom: reminderEnabled ? 10 : 14 }}>
            <View>
              <Text style={{ color: "#eceef2", fontSize: 14, fontWeight: "600" }}>Daily Reminder</Text>
              <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                Get a daily reminder to take this supplement
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              trackColor={{ false: "#1a1e28", true: "#ff7a00" }}
              thumbColor="#ffffff"
            />
          </View>

          {reminderEnabled && (
            <View style={{ marginBottom: 14 }}>
              <Text style={lbl}>REMINDER TIME</Text>
              <TextInput
                style={inp}
                placeholder="HH:MM (e.g. 08:00)"
                placeholderTextColor="#6b7280"
                value={reminderTime}
                onChangeText={setReminderTime}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          )}

          {/* ── Error ── */}
          {saveMut.isError && (
            <Text style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>
              {(saveMut.error as Error).message ?? "Failed to save. Try again."}
            </Text>
          )}

          {/* ── Submit ── */}
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// Supplement Row  (§14.7, §14.8)
// ─────────────────────────────────────────
function SupplementRow({ supplement }: { supplement: Supplement }) {
  const colors = useColors();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  // §14.7: no confirmation dialog — immediate delete
  const deleteMut = useMutation({
    mutationFn: () => apiFetch(`/supplements/${supplement.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplements"] });
      qc.invalidateQueries({ queryKey: ["stacks-scheduled"] });
      // Invalidate AMQS score (§6.6 — "4. Cache invalidation on supplement mutations")
      AMQS_KEYS.forEach(k => qc.invalidateQueries(k));
      showToast({ title: "Supplement deleted" });
    },
  });

  return (
    <>
      {/* §14.8 — exact row layout */}
      <View style={[s.suppRow, { borderColor: colors.border }]} testID={`supplement-item-${supplement.id}`}>

        {/* Icon */}
        <View style={[s.suppIcon, { backgroundColor: "rgba(255,122,0,0.1)", borderColor: "rgba(255,122,0,0.2)" }]}>
          <MaterialCommunityIcons name="pill" size={18} color={colors.primary} />
        </View>

        {/* Left column (flex-1) */}
        <View style={{ flex: 1 }}>

          {/* Row 1: name + badges */}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginBottom: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>{supplement.name}</Text>

            {/* Dose badge (outline variant) */}
            {supplement.doseAmount != null && supplement.doseUnit && (
              <View style={[s.microBadge, { borderColor: colors.border }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700" }}>
                  {supplement.doseAmount} {supplement.doseUnit}
                </Text>
              </View>
            )}

            {/* Form badge (secondary variant) */}
            {supplement.form && (
              <View style={[s.microBadge, { borderColor: colors.border, backgroundColor: "rgba(107,114,128,0.1)" }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", textTransform: "capitalize" }}>
                  {supplement.form}
                </Text>
              </View>
            )}

            {/* "AMQS tracked" badge — shown whenever catalogId is non-null (§6.6 §14.2 §14.8)
                Note: supplements with empty microsPerUnit (e.g. Creatine) still show this badge
                because the badge means "linked to catalog", not "moves the score" (§6.6 nuance) */}
            {supplement.catalogId != null && (
              <View style={[s.microBadge, {
                borderColor: "rgba(255,122,0,0.3)",
                backgroundColor: "rgba(255,122,0,0.1)",
              }]}>
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "700" }}>AMQS tracked</Text>
              </View>
            )}
          </View>

          {/* Row 2: "Contributing to your AMQS score" — shown when catalogId set (§14.8) */}
          {supplement.catalogId != null && (
            <Text style={{ color: colors.mutedForeground, fontSize: 11, opacity: 0.6, marginTop: 1 }}>
              Contributing to your AMQS score
            </Text>
          )}

          {/* Row 3: reminder line */}
          {supplement.reminderEnabled && supplement.reminderTime && (
            <Text style={{ color: colors.primary, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
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

        {/* Right column: action buttons */}
        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity
            style={{ padding: 8 }}
            testID={`button-edit-supplement-${supplement.id}`}
            onPress={() => setEditOpen(true)}>
            <Feather name="edit-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ padding: 8 }}
            testID={`button-delete-supplement-${supplement.id}`}
            onPress={() => deleteMut.mutate()}>
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

  const { error: catalogPageError } = useQuery<CatalogItem[]>({
    queryKey: ["supplement-catalog"],
    queryFn: () => apiFetch("/supplement-catalog"),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[s.header, { borderBottomColor: "#e5e7eb" }]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[s.pageTitle, { color: colors.foreground, fontFamily: colors.fonts.display }]}>My Supplements</Text>
          <Text style={[s.pageSubtitle, { color: colors.mutedForeground }]}>Track your personal supplement inventory</Text>
        </View>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          testID="button-add-supplement"
          onPress={() => setAddOpen(true)}>
          <Feather name="plus" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginLeft: 6, fontFamily: colors.fonts.sansBd }}>Add Supplement</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>

        {catalogPageError && (
          <Card style={{ borderColor: "rgba(239,68,68,0.50)", backgroundColor: "rgba(239,68,68,0.05)" }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Feather name="alert-triangle" size={20} color="#f87171" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 14 }}>Catalog Load Error</Text>
                <Text style={{ color: "#fca5a5", fontSize: 12, lineHeight: 18, marginTop: 3 }}>
                  Failed to load the supplement catalog. You can still add custom supplements.
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Info card */}
        <View style={[s.explainer, { borderColor: "rgba(229,231,235,0.40)", backgroundColor: "rgba(24,30,39,0.40)" }]} testID="supplements-explainer">
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13, marginBottom: 8, fontFamily: colors.fonts.sansSb }}>
            How Supplements work
          </Text>
          <View style={{ gap: 5 }}>
            {[
              "Add a supplement once (name, dose).",
              "Set an optional daily reminder time for each supplement.",
              "Scheduled supplements appear on the Dashboard — tick off as you take them.",
            ].map((line, index) => (
              <Text key={line} style={[s.xs, { color: colors.mutedForeground, lineHeight: 18, fontFamily: colors.fonts.sans }]}>
                {index + 1}. {line}
              </Text>
            ))}
          </View>
        </View>

        {/* Supplement list */}
        <Card>
          <View style={{ marginBottom: 14 }}>
            <Text style={[s.cardTitle, { color: colors.foreground, fontFamily: colors.fonts.sansSb }]}>Your Supplements</Text>
            <Text style={[s.listDescription, { color: colors.mutedForeground }]}>
              {supplements.length === 0
                ? "No supplements added yet. Add your first supplement to get started."
                : `${supplements.length} supplement${supplements.length === 1 ? "" : "s"} in your inventory`}
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : supplements.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <MaterialCommunityIcons name="pill" size={40} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
              <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 10,
                fontSize: 14, lineHeight: 20 }}>
                No supplements yet.{"\n"}Tap "+ Add" to get started.
              </Text>
            </View>
          ) : (
            supplements.map(supp => <SupplementRow key={supp.id} supplement={supp} />)
          )}
        </Card>

        <Text style={[s.footerDisclaimer, { color: colors.mutedForeground }]}>
          For tracking purposes only — not medical advice. Consult a healthcare professional before starting any supplement regimen.
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      <SupplementFormModal visible={addOpen} supplement={null} onClose={() => setAddOpen(false)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const s = StyleSheet.create({
  flex:       { flex: 1 },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 16, paddingVertical: 22, borderBottomWidth: 1 },
  pageTitle:  { fontSize: 28, fontWeight: "800" },
  pageSubtitle: { fontSize: 18, lineHeight: 26, marginTop: 4, fontFamily: "Inter_400Regular" },
  scrollPad:  { padding: 16, gap: 18 },
  card:       { borderRadius: 12, borderWidth: 1.5, padding: 24 },
  cardTitle:  { fontSize: 26, fontWeight: "800" },
  listDescription: { fontSize: 17, lineHeight: 25, marginTop: 8, fontFamily: "Inter_400Regular" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge:      { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  microBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2,
                backgroundColor: "transparent" },
  xs:         { fontSize: 12, fontWeight: "500" },
  sm:         { fontSize: 13 },
  addBtn:     { flexDirection: "row", alignItems: "center", borderRadius: 8,
                paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1.5, borderColor: "#e5e7eb" },
  explainer:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  suppRow:    { flexDirection: "row", alignItems: "flex-start", borderRadius: 9, borderWidth: 1.5,
                padding: 14, marginTop: 12, gap: 10 },
  suppIcon:   { width: 36, height: 36, borderRadius: 8, borderWidth: 1,
                alignItems: "center", justifyContent: "center", marginTop: 1 },
  fullBtn:    { borderRadius: 9, padding: 14, alignItems: "center" },
  chip:       { borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 },
  footerDisclaimer: { fontSize: 12, lineHeight: 18, fontStyle: "italic", textAlign: "center", paddingBottom: 12 },
});
