import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/api";
import { AppLogoHeader } from "@/components/AppLogoHeader";

const CATEGORIES = [
  { value: "bug", label: "Bug Report", emoji: "🐛", desc: "Something isn't working right" },
  { value: "feature", label: "Feature Request", emoji: "✨", desc: "Suggest a new feature" },
  { value: "question", label: "Question", emoji: "❓", desc: "Need help with something" },
  { value: "other", label: "Other", emoji: "💬", desc: "General feedback" },
] as const;

type Category = typeof CATEGORIES[number]["value"];

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const colors = useColors();
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

export default function FeedbackScreen() {
  const colors = useColors();
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMut = useMutation({
    mutationFn: () => apiFetch("/feedback", {
      method: "POST",
      body: { category, message, includeDiagnostics: true },
    }),
    onSuccess: () => setSubmitted(true),
  });

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
          <Text style={[s.lg, { color: colors.foreground, marginTop: 16, textAlign: "center" }]}>Thanks for your feedback!</Text>
          <Text style={[s.sm, { color: colors.mutedForeground, textAlign: "center", marginTop: 8, lineHeight: 20 }]}>
            We read every submission and will use it to improve PRFMR.
          </Text>
          <TouchableOpacity
            style={[s.fullBtn, { backgroundColor: colors.primary, marginTop: 24, width: "100%" }]}
            onPress={() => { setSubmitted(false); setCategory("bug"); setMessage(""); }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Submit Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <AppLogoHeader />
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.pageTitle, { color: colors.foreground }]}>Feedback</Text>
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
        {/* Header Card */}
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
          <Text style={[s.cardTitle, { color: colors.foreground, marginBottom: 12 }]}>What type of feedback?</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[s.catCard, {
                  borderColor: category === cat.value ? colors.primary : colors.border,
                  backgroundColor: category === cat.value ? "rgba(255,122,0,0.08)" : colors.secondary,
                }]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={{ fontSize: 22, marginBottom: 4 }}>{cat.emoji}</Text>
                <Text style={[s.xs, { color: category === cat.value ? colors.primary : colors.foreground, fontWeight: "700" }]}>{cat.label}</Text>
                <Text style={[s.xs, { color: colors.mutedForeground, textAlign: "center", marginTop: 2, fontSize: 11 }]}>{cat.desc}</Text>
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
            {message.length} characters {message.length < 10 ? `(at least ${10 - message.length} more needed)` : "✓"}
          </Text>
        </Card>

        {/* Diagnostics note */}
        <View style={[s.row, { paddingHorizontal: 4 }]}>
          <Feather name="shield" size={13} color={colors.mutedForeground} />
          <Text style={[s.xs, { color: colors.mutedForeground, marginLeft: 6, flex: 1 }]}>
            Basic app diagnostics will be included to help us debug issues.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.fullBtn, { backgroundColor: colors.primary, opacity: message.length >= 10 ? 1 : 0.4 }]}
          disabled={message.length < 10 || submitMut.isPending}
          onPress={() => submitMut.mutate()}
        >
          {submitMut.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={s.row}>
              <Feather name="send" size={15} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginLeft: 8 }}>Send Feedback</Text>
            </View>
          )}
        </TouchableOpacity>

        {submitMut.isError && (
          <Text style={{ color: "#f87171", textAlign: "center", fontSize: 13 }}>
            Failed to send. Please try again.
          </Text>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
  xs: { fontSize: 12, fontWeight: "500" },
  sm: { fontSize: 13 },
  lg: { fontSize: 20, fontWeight: "800" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catCard: { width: "47.5%", borderRadius: 9, borderWidth: 1, padding: 12, alignItems: "center" },
  textarea: { borderRadius: 9, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 120, lineHeight: 20 },
  fullBtn: { borderRadius: 9, padding: 14, alignItems: "center" },
  successIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});
