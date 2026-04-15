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
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

interface PlaybookEntry {
  id: number;
  title: string;
  category?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
}

export default function PlaybookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [viewEntry, setViewEntry] = useState<PlaybookEntry | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("technique");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const { data: entries, isLoading, refetch } = useQuery<PlaybookEntry[]>({
    queryKey: ["playbook"],
    queryFn: () => apiFetch("/me/playbook"),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function addEntry() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/me/playbook", {
        method: "POST",
        body: { title: title.trim(), category, content },
      });
      qc.invalidateQueries({ queryKey: ["playbook"] });
      setAddModalVisible(false);
      setTitle("");
      setContent("");
      setCategory("technique");
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: number) {
    try {
      await apiFetch(`/me/playbook/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["playbook"] });
    } catch {
      // ignore
    }
  }

  const topPad = Platform.OS === "web" ? Math.max(insets.top + 67, 100) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const categories = ["technique", "strategy", "mental", "nutrition", "recovery", "other"];
  const filteredEntries = filter ? (entries ?? []).filter((e) => e.category === filter) : (entries ?? []);

  const categoryColors: Record<string, string> = {
    technique: colors.primary,
    strategy: colors.info,
    mental: "#a78bfa",
    nutrition: "#34d399",
    recovery: "#60a5fa",
    other: colors.mutedForeground,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 100 + bottomPad, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Playbook</Text>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              onPress={() => setFilter(null)}
              style={[styles.filterChip, { backgroundColor: !filter ? colors.primary : colors.secondary, borderRadius: 20 }]}
            >
              <Text style={{ color: !filter ? "#fff" : colors.mutedForeground, fontSize: 12, fontWeight: "600" }}>All</Text>
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setFilter(filter === cat ? null : cat)}
                style={[styles.filterChip, { backgroundColor: filter === cat ? (categoryColors[cat] ?? colors.primary) : colors.secondary, borderRadius: 20 }]}
              >
                <Text style={{ color: filter === cat ? "#fff" : colors.mutedForeground, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredEntries.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="book-open" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {filter ? `No ${filter} entries` : "Your playbook is empty"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Document techniques, strategies, and mental notes
            </Text>
            <TouchableOpacity
              onPress={() => setAddModalVisible(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Text style={styles.emptyBtnText}>Add Entry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredEntries.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              onPress={() => setViewEntry(entry)}
              style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
              activeOpacity={0.7}
            >
              <View style={styles.entryHeader}>
                <View style={styles.entryTitleRow}>
                  {entry.category && (
                    <View style={[styles.catBadge, { backgroundColor: (categoryColors[entry.category] ?? colors.primary) + "22", borderColor: (categoryColors[entry.category] ?? colors.primary) + "44" }]}>
                      <Text style={[styles.catText, { color: categoryColors[entry.category] ?? colors.primary }]}>{entry.category}</Text>
                    </View>
                  )}
                  <Text style={[styles.entryTitle, { color: colors.foreground }]} numberOfLines={1}>{entry.title}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={8}>
                  <Feather name="trash-2" size={15} color={colors.destructive} />
                </TouchableOpacity>
              </View>
              {entry.content && (
                <Text style={[styles.entryContent, { color: colors.mutedForeground }]} numberOfLines={2}>{entry.content}</Text>
              )}
              {entry.createdAt && (
                <Text style={[styles.entryDate, { color: colors.mutedForeground }]}>
                  {new Date(entry.createdAt).toLocaleDateString()}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddModalVisible(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Entry</Text>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>TITLE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, marginBottom: 16 }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Double Leg Takedown Setup"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
          <View style={styles.categoryPicker}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.catChip, { backgroundColor: category === cat ? (categoryColors[cat] ?? colors.primary) : colors.secondary, borderRadius: 20 }]}
              >
                <Text style={{ color: category === cat ? "#fff" : colors.mutedForeground, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 16 }]}>CONTENT</Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
            value={content}
            onChangeText={setContent}
            placeholder="Describe the technique, strategy, or note..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={6}
          />

          <TouchableOpacity
            onPress={addEntry}
            disabled={saving || !title.trim()}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, marginTop: 20, opacity: saving || !title.trim() ? 0.6 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Entry</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      <Modal visible={!!viewEntry} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewEntry(null)}>
        {viewEntry && (
          <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={2}>{viewEntry.title}</Text>
              <TouchableOpacity onPress={() => setViewEntry(null)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            {viewEntry.category && (
              <View style={[styles.catBadge, { backgroundColor: (categoryColors[viewEntry.category] ?? colors.primary) + "22", borderColor: (categoryColors[viewEntry.category] ?? colors.primary) + "44", alignSelf: "flex-start", marginBottom: 16 }]}>
                <Text style={[styles.catText, { color: categoryColors[viewEntry.category] ?? colors.primary }]}>{viewEntry.category}</Text>
              </View>
            )}
            {viewEntry.content ? (
              <Text style={[styles.fullContent, { color: colors.foreground }]}>{viewEntry.content}</Text>
            ) : (
              <Text style={[styles.fullContent, { color: colors.mutedForeground, fontStyle: "italic" }]}>No content</Text>
            )}
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  screenTitle: { fontSize: 24, fontWeight: "800" },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7 },
  entryCard: { padding: 16, borderWidth: 1, marginBottom: 10 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  entryTitleRow: { flex: 1, gap: 6 },
  entryTitle: { fontSize: 15, fontWeight: "600" },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, alignSelf: "flex-start" },
  catText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  entryContent: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  entryDate: { fontSize: 11 },
  emptyBox: { padding: 40, borderWidth: 1, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: "700", flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: { height: 48, paddingHorizontal: 14, borderWidth: 1, fontSize: 15 },
  textarea: { height: 120, paddingTop: 12, textAlignVertical: "top" },
  categoryPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6 },
  saveBtn: { height: 52, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  fullContent: { fontSize: 15, lineHeight: 24 },
});
