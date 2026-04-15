import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, refetchUser } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [weightModal, setWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [weightClass, setWeightClass] = useState(user?.weightClass ?? "");
  const [sport, setSport] = useState(user?.sport ?? "");

  const { data: weightCut } = useQuery<any>({
    queryKey: ["/api/me/weight-cut"],
    queryFn: () => apiFetch("/me/weight-cut"),
  });

  const { data: amqs } = useQuery<any>({
    queryKey: ["/api/me/amqs/score", new Date().toISOString().split("T")[0]],
    queryFn: () => apiFetch(`/me/amqs/score/${new Date().toISOString().split("T")[0]}`),
  });

  const updateWeightMutation = useMutation({
    mutationFn: (w: number) => apiFetch("/me/body-composition", { method: "PATCH", body: { currentWeight: w } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/me/weight-cut"] });
      await refetchUser();
      setWeightModal(false);
      setWeightInput("");
    },
    onError: (e: any) => Alert.alert("Error", e.message ?? "Failed to update weight"),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/me/profile", { method: "PATCH", body: data }),
    onSuccess: async () => {
      await refetchUser();
      setEditModal(false);
    },
    onError: () => {
      setEditModal(false);
      refetchUser();
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchUser(),
      qc.invalidateQueries({ queryKey: ["/api/me/weight-cut"] }),
      qc.invalidateQueries({ queryKey: ["/api/me/amqs/score"] }),
    ]);
    setRefreshing(false);
  };

  const WEIGHT_CLASSES = [
    "Flyweight (57kg)", "Bantamweight (61kg)", "Featherweight (66kg)",
    "Lightweight (70kg)", "Welterweight (77kg)", "Middleweight (84kg)",
    "Light Heavyweight (93kg)", "Heavyweight (120kg)", "Super Heavyweight (120kg+)"
  ];
  const SPORTS = ["MMA", "Boxing", "Kickboxing", "Muay Thai", "BJJ", "Wrestling", "Judo", "Karate", "Other"];

  const stats = [
    { label: "Current Weight", value: user?.weight ? `${user.weight} kg` : (weightCut?.currentWeight ? `${weightCut.currentWeight} kg` : "—"), icon: "trending-down" as const },
    { label: "AMQS Score", value: amqs?.score != null ? String(amqs.score) : "—", icon: "shield" as const },
    { label: "Weight Class", value: user?.weightClass ?? "—", icon: "award" as const },
    { label: "Sport", value: user?.sport ?? "—", icon: "activity" as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
            <Text style={{ color: colors.primary, fontSize: 36, fontWeight: "800" }}>
              {(user?.username ?? "A")[0].toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "800", marginTop: 12 }}>
            {user?.displayName ?? user?.username ?? "Athlete"}
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 2 }}>
            @{user?.username}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <TouchableOpacity onPress={() => { setDisplayName(user?.displayName ?? ""); setWeightClass(user?.weightClass ?? ""); setSport(user?.sport ?? ""); setEditModal(true); }}
              style={[styles.heroBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Feather name="edit-2" size={15} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontWeight: "600", fontSize: 14 }}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWeightModal(true)}
              style={[styles.heroBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
              <Feather name="trending-down" size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Log Weight</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.statsGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 }}>ATHLETE STATS</Text>
          <View style={styles.grid}>
            {stats.map(s => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name={s.icon} size={18} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800", marginTop: 4 }}>{s.value}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {weightCut && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>FIGHT CAMP</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 8 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "800" }}>{weightCut.currentWeight?.toFixed(1)}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Current (kg)</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "800" }}>{weightCut.targetWeight?.toFixed(1)}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Target (kg)</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.warning, fontSize: 22, fontWeight: "800" }}>
                  {Math.max(0, Math.ceil((new Date(weightCut.fightDate + "T12:00:00").getTime() - Date.now()) / 86400000))}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Days out</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
          <Text style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 }}>ACCOUNT</Text>
          {user?.email && (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <Text style={{ color: colors.foreground, flex: 1 }}>{user.email}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: logout },
          ])} style={[styles.row, { borderBottomWidth: 0 }]}>
            <Feather name="log-out" size={16} color={colors.destructive} />
            <Text style={{ color: colors.destructive, flex: 1, fontWeight: "600" }}>Sign Out</Text>
            <Feather name="chevron-right" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={weightModal} animationType="slide" presentationStyle="formSheet">
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, gap: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "700" }}>Log Weight</Text>
            <TouchableOpacity onPress={() => { setWeightModal(false); setWeightInput(""); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.mutedForeground }}>Enter today's weight (kg)</Text>
          <TextInput
            style={{ height: 80, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground, fontSize: 36, textAlign: "center", fontWeight: "700" }}
            value={weightInput} onChangeText={setWeightInput}
            placeholder="85.0" placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad" autoFocus
          />
          <TouchableOpacity
            onPress={() => { const w = parseFloat(weightInput); if (!w) { Alert.alert("Invalid", "Please enter a valid weight"); return; } updateWeightMutation.mutate(w); }}
            disabled={updateWeightMutation.isPending}
            style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
            {updateWeightMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Weight</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setEditModal(false)}><Feather name="x" size={24} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 6 }}>DISPLAY NAME</Text>
              <TextInput style={[styles.inputField, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 6 }}>SPORT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {SPORTS.map(s => (
                    <TouchableOpacity key={s} onPress={() => setSport(s)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sport === s ? colors.primary : colors.secondary }}>
                      <Text style={{ color: sport === s ? "#fff" : colors.mutedForeground, fontSize: 13, fontWeight: "600" }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, marginBottom: 6 }}>WEIGHT CLASS</Text>
              {WEIGHT_CLASSES.map(w => (
                <TouchableOpacity key={w} onPress={() => setWeightClass(w)}
                  style={[styles.wcRow, { borderColor: weightClass === w ? colors.primary : colors.border, backgroundColor: weightClass === w ? colors.primary + "11" : "transparent" }]}>
                  <Text style={{ color: weightClass === w ? colors.primary : colors.foreground, fontWeight: weightClass === w ? "700" : "400" }}>{w}</Text>
                  {weightClass === w && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => updateProfileMutation.mutate({ displayName: displayName || undefined, sport: sport || undefined, weightClass: weightClass || undefined })}
              disabled={updateProfileMutation.isPending}
              style={{ backgroundColor: colors.primary, height: 54, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
              {updateProfileMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save Changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12 },
  hero: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center" },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  heroBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  statsGrid: { borderRadius: 14, borderWidth: 1, padding: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  statCard: { flex: 1, minWidth: "45%", padding: 14, borderRadius: 12, borderWidth: 1, gap: 2 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  inputField: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  wcRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
});
