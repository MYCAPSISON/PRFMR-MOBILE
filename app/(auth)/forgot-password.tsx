import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Always returns 200 regardless — no email enumeration (§34.4)
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: { email: trimmed },
      });
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground
      source={require("@/assets/stock-images/fight_action_1.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.backText, { color: "rgba(255,255,255,0.7)", fontFamily: colors.fonts.sans }]}>
              Back to sign in
            </Text>
          </Pressable>

          <View style={styles.header}>
            <Image
              source={require("@/assets/logo-main.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.card, { backgroundColor: "rgba(13,16,23,0.92)", borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
              Forgot password?
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
              Enter your email and we'll send you a reset link if the address is registered.
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive, fontFamily: colors.fonts.sans }]}>{error}</Text>
              </View>
            ) : null}

            {sent ? (
              <View style={[styles.successBox, { backgroundColor: "#16a34a22", borderColor: "#16a34a44" }]}>
                <Feather name="check-circle" size={14} color="#4ade80" />
                <Text style={[styles.errorText, { color: "#4ade80", fontFamily: colors.fonts.sans }]}>
                  If that email is registered, a reset link has been sent. Check your inbox.
                </Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>
                EMAIL
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: "#e5e7eb", color: colors.foreground, borderRadius: colors.radius, fontFamily: colors.fonts.sans }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!sent}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius, borderWidth: 1.5, borderColor: "#e5e7eb", opacity: (loading || sent) ? 0.65 : 1 }]}
              onPress={handleSubmit}
              disabled={loading || sent}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryForeground, fontFamily: colors.fonts.sansBd }]}>
                  {sent ? "Email sent" : "Send reset link"}
                </Text>
              )}
            </TouchableOpacity>

            {sent && (
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={styles.backToLogin}>
                <Text style={[styles.backToLoginText, { color: colors.primary, fontFamily: colors.fonts.sansBd }]}>
                  Back to Sign In
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  backText: {
    fontSize: 14,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    height: 44,
    width: 160,
  },
  card: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 15,
  },
  btn: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  backToLogin: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
