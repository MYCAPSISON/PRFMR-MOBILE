import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, refetchUser } = useAuth();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [weight, setWeight] = useState(user?.weight?.toString() ?? "");
  const [height, setHeight] = useState(user?.height?.toString() ?? "");
  const [age, setAge] = useState(user?.age?.toString() ?? "");
  const [sport, setSport] = useState(user?.sport ?? "");
  const [weightClass, setWeightClass] = useState(user?.weightClass ?? "");
  const [saving, setSaving] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top + 67, 100) : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  async function saveProfile() {
    setSaving(true);
    try {
      await apiFetch("/user/me", {
        method: "PATCH",
        body: {
          displayName: displayName || undefined,
          weight: weight ? parseFloat(weight) : undefined,
          height: height ? parseFloat(height) : undefined,
          age: age ? parseInt(age) : undefined,
          sport: sport || undefined,
          weightClass: weightClass || undefined,
        },
      });
      await refetchUser();
      setEditModalVisible(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function sendFeedback() {
    if (!feedbackText.trim()) return;
    setFeedbackSaving(true);
    try {
      await apiFetch("/me/feedback", {
        method: "POST",
        body: { message: feedbackText.trim() },
      });
      setFeedbackSent(true);
      setTimeout(() => {
        setFeedbackModal(false);
        setFeedbackText("");
        setFeedbackSent(false);
      }, 2000);
    } catch {
      // ignore
    } finally {
      setFeedbackSaving(false);
    }
  }

  const stats = [
    { label: "Sport", value: user?.sport ?? "—", icon: "shield" as const },
    { label: "Weight Class", value: user?.weightClass ?? "—", icon: "target" as const },
    { label: "Weight", value: user?.weight ? `${user.weight} kg` : "—", icon: "activity" as const },
    { label: "Height", value: user?.height ? `${user.height} cm` : "—", icon: "maximize" as const },
    { label: "Age", value: user?.age ? `${user.age}` : "—", icon: "user" as const },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: 100 + bottomPad, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profile</Text>
          <TouchableOpacity
            onPress={() => setEditModalVisible(true)}
            style={[styles.editBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Feather name="edit-2" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.avatarCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(user?.displayName ?? user?.username ?? "A").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {user?.displayName ?? user?.username ?? "Athlete"}
            </Text>
            <Text style={[styles.handle, { color: colors.mutedForeground }]}>@{user?.username}</Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
          </View>
        </View>

        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ATHLETE PROFILE</Text>
          {stats.map((stat) => (
            <View key={stat.label} style={[styles.statRow, { borderBottomColor: colors.border }]}>
              <View style={styles.statLeft}>
                <Feather name={stat.icon} size={16} color={colors.mutedForeground} />
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => setFeedbackModal(true)}
          style={[styles.menuRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
        >
          <Feather name="message-square" size={20} color={colors.primary} />
          <Text style={[styles.menuText, { color: colors.foreground }]}>Send Feedback</Text>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={logout}
          style={[styles.logoutBtn, { borderColor: colors.destructive + "44", borderRadius: colors.radius }]}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>PRFMR v1.0.0</Text>
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditModalVisible(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {[
            { label: "DISPLAY NAME", value: displayName, onChange: setDisplayName, placeholder: "Your name" },
            { label: "SPORT", value: sport, onChange: setSport, placeholder: "e.g. MMA, Boxing, Wrestling" },
            { label: "WEIGHT CLASS", value: weightClass, onChange: setWeightClass, placeholder: "e.g. Lightweight" },
            { label: "WEIGHT (kg)", value: weight, onChange: setWeight, placeholder: "75.0", numeric: true },
            { label: "HEIGHT (cm)", value: height, onChange: setHeight, placeholder: "175", numeric: true },
            { label: "AGE", value: age, onChange: setAge, placeholder: "25", numeric: true },
          ].map((field) => (
            <View key={field.label} style={{ marginBottom: 14 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{field.label}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                value={field.value}
                onChangeText={field.onChange}
                placeholder={field.placeholder}
                placeholderTextColor={colors.mutedForeground}
                keyboardType={field.numeric ? "decimal-pad" : "default"}
              />
            </View>
          ))}

          <TouchableOpacity
            onPress={saveProfile}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, marginTop: 8, opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      <Modal visible={feedbackModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setFeedbackModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Send Feedback</Text>
            <TouchableOpacity onPress={() => setFeedbackModal(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          {feedbackSent ? (
            <View style={styles.feedbackSent}>
              <Feather name="check-circle" size={48} color={colors.success} />
              <Text style={[styles.feedbackSentText, { color: colors.foreground }]}>Thank you for your feedback!</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.feedbackHint, { color: colors.mutedForeground }]}>
                Help us improve PRFMR. Share bugs, feature requests, or anything on your mind.
              </Text>
              <TextInput
                style={[styles.feedbackInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Your feedback..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoFocus
              />
              <TouchableOpacity
                onPress={sendFeedback}
                disabled={feedbackSaving || !feedbackText.trim()}
                style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, marginTop: 16, opacity: feedbackSaving || !feedbackText.trim() ? 0.6 : 1 }]}
              >
                {feedbackSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Send Feedback</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  screenTitle: { fontSize: 24, fontWeight: "800" },
  editBtn: { padding: 10, borderWidth: 1 },
  avatarCard: { flexDirection: "row", alignItems: "center", padding: 20, borderWidth: 1, gap: 16, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontWeight: "800" },
  displayName: { fontSize: 18, fontWeight: "700" },
  handle: { fontSize: 13, marginTop: 2 },
  email: { fontSize: 12, marginTop: 2 },
  statsCard: { padding: 16, borderWidth: 1, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  statLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statLabel: { fontSize: 14 },
  statValue: { fontSize: 14, fontWeight: "600" },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, marginBottom: 10, gap: 12 },
  menuText: { flex: 1, fontSize: 15, fontWeight: "500" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, borderWidth: 1, gap: 10, marginTop: 8, marginBottom: 24 },
  logoutText: { fontSize: 15, fontWeight: "700" },
  version: { textAlign: "center", fontSize: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  fieldLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  input: { height: 48, paddingHorizontal: 14, borderWidth: 1, fontSize: 15 },
  saveBtn: { height: 52, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  feedbackHint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  feedbackInput: { padding: 14, borderWidth: 1, fontSize: 15, height: 140 },
  feedbackSent: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  feedbackSentText: { fontSize: 18, fontWeight: "600", textAlign: "center" },
});
