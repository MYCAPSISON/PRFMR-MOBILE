import { Feather } from "@expo/vector-icons";
import { Link, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { AuthApiError, verifyMobileEmail } from "@/lib/api";

type VerificationState = "verifying" | "success" | "error";

function verificationError(reason: unknown): string {
  if (reason instanceof AuthApiError) {
    if (reason.code === "TOKEN_EXPIRED" || reason.status === 410) return "This verification link has expired. Return to sign in and request a new email.";
    if (reason.code === "INVALID_TOKEN") return "This verification link is invalid or has already been used.";
    if (reason.code === "SESSION_FAILED") return "Your email was verified, but we could not sign you in automatically. Please sign in with your password.";
    if (reason.status === 429) return "Too many verification attempts. Please wait and try again.";
    return reason.message;
  }
  return "We could not verify this email. Please try again.";
}

export default function VerifyEmailScreen() {
  const colors = useColors();
  const { refetchUser } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const started = useRef(false);
  const [state, setState] = useState<VerificationState>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState("error");
      setError("This verification link is missing its token.");
      return;
    }

    void (async () => {
      try {
        await verifyMobileEmail(token);
        await refetchUser();
        setState("success");
        setTimeout(() => router.replace("/onboarding"), 700);
      } catch (reason) {
        setError(verificationError(reason));
        setState("error");
      }
    })();
  }, [refetchUser, token]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image source={require("@/assets/logo-main.png")} style={styles.logo} resizeMode="contain" />
        {state === "verifying" ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Verifying your email</Text>
            <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>This should only take a moment.</Text>
          </>
        ) : state === "success" ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}><Feather name="check" size={38} color={colors.primary} /></View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Email verified</Text>
            <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Your account is ready. Taking you to onboarding…</Text>
          </>
        ) : (
          <>
            <View style={[styles.iconCircle, { backgroundColor: colors.destructive + "20" }]}><Feather name="x" size={38} color={colors.destructive} /></View>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Verification failed</Text>
            <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>{error}</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable style={[styles.button, { backgroundColor: colors.primary }]}><Text style={[styles.buttonText, { fontFamily: colors.fonts.sansBd }]}>Go to sign in</Text></Pressable>
            </Link>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  logo: { width: 190, height: 62, marginBottom: 24 },
  iconCircle: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  button: { width: "100%", minHeight: 52, borderRadius: 10, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center", marginTop: 12 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
