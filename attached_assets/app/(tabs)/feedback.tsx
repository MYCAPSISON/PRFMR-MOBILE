import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, Alert, Platform, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { useColors } from "@/hooks/useColors";
import { apiFetch, ApiError } from "@/lib/api";
import { AppLogoHeader } from "@/components/AppLogoHeader";

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────
const MAX_ATTACHMENTS = 3;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const CATEGORIES = [
  { value: "bug",     label: "Bug Report",       emoji: "🐛", desc: "Something isn't working" },
  { value: "feature", label: "Feature Request",  emoji: "✨", desc: "Suggest an improvement" },
  { value: "general", label: "General",          emoji: "💬", desc: "Anything on your mind" },
] as const;

type Category = typeof CATEGORIES[number]["value"];

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
interface LocalAttachment {
  uri:      string;
  filename: string;
  mimeType: string;
  size:     number;
}

interface UploadedAttachment {
  url:      string;   // objectPath returned by the server
  filename: string;
  mimeType: string;
  size:     number;
}

interface UploadUrlResponse {
  uploadURL:  string;
  objectPath: string;
}

interface FeedbackHistoryItem {
  id:        number;
  category:  string;
  message:   string;
  createdAt: string;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

/** Upload a single attachment via the pre-signed URL flow. */
async function uploadAttachment(att: LocalAttachment): Promise<UploadedAttachment> {
  // 1. Get a pre-signed upload URL from our server
  const { uploadURL, objectPath } = await apiFetch<UploadUrlResponse>(
    "/feedback/upload-url",
    {
      method: "POST",
      body: { name: att.filename, contentType: att.mimeType, size: att.size },
    },
  );

  // 2. PUT the raw file to the signed URL — no auth headers, just Content-Type
  const localRes = await fetch(att.uri);
  const blob     = await localRes.blob();
  const putRes   = await fetch(uploadURL, {
    method:  "PUT",
    headers: { "Content-Type": att.mimeType },
    body:    blob,
  });
  if (!putRes.ok) throw new Error(`Image upload failed (${putRes.status})`);

  return { url: objectPath, filename: att.filename, mimeType: att.mimeType, size: att.size };
}

/** Build a userAgent string from available device info. */
function buildUserAgent(): string {
  const os  = Platform.OS === "ios" ? "iOS" : "Android";
  const ver = String(Platform.Version ?? "unknown");
  const app = Constants.expoConfig?.version ?? "1.0.0";
  return `PRFMR/${app} (${os} ${ver})`;
}

/** Format a date nicely for the history list. */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

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
// Screen
// ─────────────────────────────────────────
export default function FeedbackScreen() {
  const colors = useColors();

  const [category,    setCategory]    = useState<Category>("bug");
  const [message,     setMessage]     = useState("");
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted,   setSubmitted]   = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ── History ──────────────────────────────────────
  const historyQ = useQuery<FeedbackHistoryItem[]>({
    queryKey: ["feedback-mine"],
    queryFn:  () => apiFetch("/feedback/mine"),
    enabled:  showHistory,
    staleTime: 1000 * 60,
  });

  // ── Attachment picker ─────────────────────────────
  async function pickPhoto() {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert("Limit reached", `You can attach up to ${MAX_ATTACHMENTS} screenshots.`);
      return;
    }
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to attach a screenshot.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality:    0.8,
      allowsEditing: false,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";
    const size     = asset.fileSize ?? 0;

    if (size > MAX_SIZE_BYTES) {
      Alert.alert("File too large", "Screenshots must be under 5 MB.");
      return;
    }

    // Derive a clean filename
    const ext      = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const filename = `screenshot-${Date.now()}.${ext}`;

    setAttachments(prev => [...prev, { uri: asset.uri, filename, mimeType, size }]);
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────
  async function handleSubmit() {
    if (message.trim().length < 10 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Upload attachments first (in parallel)
      const uploaded: UploadedAttachment[] = attachments.length > 0
        ? await Promise.all(attachments.map(uploadAttachment))
        : [];

      const { width, height } = Dimensions.get("window");

      await apiFetch("/feedback", {
        method: "POST",
        body: {
          category,
          message:      message.trim(),
          route:        "/(tabs)/feedback",
          userAgent:    buildUserAgent(),
          viewport:     `${Math.round(width)}x${Math.round(height)}`,
          appVersion:   Constants.expoConfig?.version ?? "1.0.0",
          attachments:  uploaded,
        },
      });

      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setSubmitError("You've sent too many reports. Please wait a while before submitting again.");
      } else {
        setSubmitError(err instanceof Error ? err.message : "Failed to send. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
        <AppLogoHeader />
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>Feedback</Text>
        </View>
        <View style={[s.flex, { alignItems: "center", justifyContent: "center", padding: 32 }]}>
          <View style={[s.successIcon, { backgroundColor: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)" }]}>
            <Feather name="check" size={32} color="#4ade80" />
          </View>
          <Text style={[s.lg, { color: colors.foreground, marginTop: 16, textAlign: "center" }]}>
            Thanks for your feedback!
          </Text>
          <Text style={[s.sm, { color: colors.mutedForeground, textAlign: "center", marginTop: 8, lineHeight: 20 }]}>
            We read every submission and use it to improve PRFMR.
          </Text>
          <TouchableOpacity
            style={[s.fullBtn, { backgroundColor: colors.primary, marginTop: 24, width: "100%" }]}
            onPress={() => {
              setSubmitted(false);
              setCategory("bug");
              setMessage("");
              setAttachments([]);
              setSubmitError(null);
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Submit Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main form ─────────────────────────────────────
  const canSubmit = message.trim().length >= 10 && !submitting;

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <AppLogoHeader />
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>Feedback</Text>
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>

        {/* Intro banner */}
        <Card style={{ borderColor: "rgba(255,122,0,0.2)", backgroundColor: "rgba(255,122,0,0.04)" }}>
          <View style={s.row}>
            <Feather name="message-square" size={18} color={colors.primary} />
            <Text style={[s.cardTitle, { color: colors.foreground, marginLeft: 10 }]}>Beta Feedback</Text>
          </View>
          <Text style={[s.sm, { color: colors.mutedForeground, marginTop: 6, lineHeight: 20 }]}>
            PRFMR is in active development. Your feedback directly shapes what we build next — bugs, features, or anything on your mind.
          </Text>
        </Card>

        {/* Category */}
        <Card>
          <Text style={[s.cardTitle, { color: colors.foreground, marginBottom: 12 }]}>Type of feedback</Text>
          <View style={s.catRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[s.catCard, {
                  borderColor:     category === cat.value ? colors.primary : colors.border,
                  backgroundColor: category === cat.value ? "rgba(255,122,0,0.08)" : colors.secondary,
                }]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={{ fontSize: 22, marginBottom: 4 }}>{cat.emoji}</Text>
                <Text style={[s.xs, { color: category === cat.value ? colors.primary : colors.foreground, fontWeight: "700" }]}>
                  {cat.label}
                </Text>
                <Text style={[s.xs, { color: colors.mutedForeground, textAlign: "center", marginTop: 2, fontSize: 11 }]}>
                  {cat.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Message */}
        <Card>
          <Text style={[s.cardTitle, { color: colors.foreground, marginBottom: 8 }]}>Your message</Text>
          <TextInput
            style={[s.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.secondary }]}
            placeholder="Describe your bug, idea, or question in detail..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
          <Text style={[s.xs, { color: colors.mutedForeground, marginTop: 6 }]}>
            {message.length} chars
            {message.trim().length < 10
              ? ` — ${10 - message.trim().length} more needed`
              : " ✓"}
          </Text>
        </Card>

        {/* Screenshots */}
        <Card>
          <View style={[s.rowBetween, { marginBottom: 10 }]}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>
              Screenshots{" "}
              <Text style={[s.xs, { color: colors.mutedForeground, fontWeight: "400" }]}>(optional, max {MAX_ATTACHMENTS})</Text>
            </Text>
            {attachments.length < MAX_ATTACHMENTS && (
              <TouchableOpacity
                onPress={pickPhoto}
                style={[s.addBtn, { borderColor: colors.primary, backgroundColor: "rgba(255,122,0,0.08)" }]}
              >
                <Feather name="image" size={14} color={colors.primary} />
                <Text style={[s.xs, { color: colors.primary, marginLeft: 5, fontWeight: "700" }]}>
                  {attachments.length === 0 ? "Add" : "Add more"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {attachments.length === 0 ? (
            <TouchableOpacity
              onPress={pickPhoto}
              style={[s.emptyPhotoZone, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            >
              <Feather name="image" size={22} color={colors.mutedForeground} />
              <Text style={[s.sm, { color: colors.mutedForeground, marginTop: 6 }]}>Tap to add a screenshot</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.thumbRow}>
              {attachments.map((att, i) => (
                <View key={i} style={s.thumbWrap}>
                  <Image
                    source={{ uri: att.uri }}
                    style={[s.thumb, { backgroundColor: colors.secondary }]}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => removeAttachment(i)}
                    style={s.thumbRemove}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Meta note */}
        <View style={[s.row, { paddingHorizontal: 4 }]}>
          <Feather name="shield" size={13} color={colors.mutedForeground} />
          <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 6, flex: 1 }]}>
            Device info and app version are sent automatically to help us debug issues.
          </Text>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[s.fullBtn, { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.4 }]}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={s.row}>
              <Feather name="send" size={15} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginLeft: 8 }}>
                {attachments.length > 0
                  ? `Send Feedback + ${attachments.length} Screenshot${attachments.length > 1 ? "s" : ""}`
                  : "Send Feedback"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Error */}
        {submitError && (
          <View style={[s.errorBox, { borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.07)" }]}>
            <Feather name="alert-circle" size={14} color="#f87171" style={{ marginTop: 1 }} />
            <Text style={[s.sm, { color: "#f87171", flex: 1, lineHeight: 18 }]}>{submitError}</Text>
          </View>
        )}

        {/* ── History ── */}
        <TouchableOpacity
          style={[s.historyToggle, { borderColor: colors.border }]}
          onPress={() => setShowHistory(v => !v)}
        >
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[s.sm, { color: colors.mutedForeground, marginLeft: 7, flex: 1 }]}>
            Your recent submissions
          </Text>
          <Feather name={showHistory ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {showHistory && (
          <Card>
            {historyQ.isLoading && (
              <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 12 }} />
            )}
            {historyQ.isError && (
              <Text style={[s.sm, { color: "#f87171", textAlign: "center" }]}>
                Couldn't load history.
              </Text>
            )}
            {historyQ.data && historyQ.data.length === 0 && (
              <Text style={[s.sm, { color: colors.mutedForeground, textAlign: "center", paddingVertical: 8 }]}>
                No submissions yet.
              </Text>
            )}
            {historyQ.data?.map((item, i) => (
              <View
                key={item.id}
                style={[s.historyItem, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
              >
                <View style={[s.row, { marginBottom: 4 }]}>
                  <View style={[s.categoryPill, { backgroundColor: "rgba(255,122,0,0.1)", borderColor: "rgba(255,122,0,0.2)" }]}>
                    <Text style={[s.xs, { color: colors.primary, fontSize: 11 }]}>
                      {item.category}
                    </Text>
                  </View>
                  <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: "auto", fontSize: 11 }]}>
                    {fmtDate(item.createdAt)}
                  </Text>
                </View>
                <Text
                  style={[s.sm, { color: colors.foreground, lineHeight: 18 }]}
                  numberOfLines={2}
                >
                  {item.message}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const s = StyleSheet.create({
  flex:          { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  pageTitle:     { fontSize: 20, fontWeight: "800" },
  scrollPad:     { padding: 12, gap: 10 },
  card:          { borderRadius: 9, borderWidth: 1, padding: 14 },
  cardTitle:     { fontSize: 15, fontWeight: "700" },
  row:           { flexDirection: "row", alignItems: "center" },
  rowBetween:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  xs:            { fontSize: 12, fontWeight: "500" },
  sm:            { fontSize: 13 },
  lg:            { fontSize: 20, fontWeight: "800" },
  catRow:        { flexDirection: "row", gap: 8 },
  catCard:       { flex: 1, borderRadius: 9, borderWidth: 1, padding: 10, alignItems: "center" },
  textarea:      { borderRadius: 9, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 120, lineHeight: 20 },
  fullBtn:       { borderRadius: 9, padding: 14, alignItems: "center" },
  successIcon:   { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  addBtn:        { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  emptyPhotoZone:{ borderWidth: 1, borderStyle: "dashed", borderRadius: 9, paddingVertical: 24, alignItems: "center", justifyContent: "center" },
  thumbRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumbWrap:     { position: "relative" },
  thumb:         { width: 80, height: 80, borderRadius: 7 },
  thumbRemove:   { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 12, width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  errorBox:      { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 9, padding: 12 },
  historyToggle: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1 },
  historyItem:   { paddingVertical: 10 },
  categoryPill:  { borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
});
