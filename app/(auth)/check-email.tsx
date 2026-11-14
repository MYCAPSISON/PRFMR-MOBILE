import { Feather } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { AuthApiError, resendMobileVerification } from "@/lib/api";

export default function CheckEmailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ email?: string; cooldown?: string; deliveryFailed?: string }>();
  const email = typeof params.email === "string" ? params.email : "your email address";
  const initialCooldown = Math.max(0, Number(params.cooldown) || 60);
  const [seconds, setSeconds] = useState(initialCooldown);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.deliveryFailed === "1" ? "Your account was created, but the first email could not be delivered. Tap resend to try again." : null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function resend() {
    if (busy || seconds > 0 || email === "your email address") return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await resendMobileVerification(email);
      setMessage(response.message);
      setSeconds(response.resendCooldownSeconds || 60);
    } catch (reason) {
      if (reason instanceof AuthApiError && reason.status === 429) {
        setError("Too many resend attempts. Please wait 15 minutes and try again.");
      } else {
        setError(reason instanceof Error ? reason.message : "Unable to resend the email.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image source={require("@/assets/logo-main.png")} style={styles.logo} resizeMode="contain" />
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="mail" size={34} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Check your email</Text>
        <Text style={[styles.body, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>We sent a verification link to</Text>
        <Text style={[styles.email, { color: colors.foreground, fontFamily: colors.fonts.sansBd }]}>{email}</Text>
        <Text style={[styles.help, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Tap the link in the email to verify your account and continue to onboarding. The link expires after 24 hours.</Text>

        {message ? <Text style={[styles.status, { color: colors.primary, fontFamily: colors.fonts.sans }]}>{message}</Text> : null}
        {error ? <Text style={[styles.status, { color: colors.destructive, fontFamily: colors.fonts.sans }]}>{error}</Text> : null}

        <Pressable
          onPress={() => void resend()}
          disabled={busy || seconds > 0}
          style={[styles.primary, { backgroundColor: colors.primary, opacity: busy || seconds > 0 ? 0.55 : 1 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.primaryText, { fontFamily: colors.fonts.sansBd }]}>{seconds > 0 ? `Resend in ${seconds}s` : "Resend verification email"}</Text>}
        </Pressable>

        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.secondary}><Text style={[styles.secondaryText, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>Back to sign in</Text></Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  logo: { width: 190, height: 62, marginBottom: 34 },
  iconCircle: { width: 74, height: 74, borderRadius: 37, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  title: { fontSize: 30, fontWeight: "800", textAlign: "center", marginBottom: 14 },
  body: { fontSize: 16, textAlign: "center" },
  email: { fontSize: 16, textAlign: "center", marginTop: 5 },
  help: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 18, marginBottom: 18 },
  status: { fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 14 },
  primary: { width: "100%", minHeight: 52, borderRadius: 10, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center" },
  secondary: { padding: 18 },
  secondaryText: { fontSize: 14, fontWeight: "600" },
});
