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
import { Link, router, useLocalSearchParams } from "expo-router";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const params = useLocalSearchParams<{ error?: string }>();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleAuthFailed = params.error === "google_auth_failed";
  const loginDisabled = loading || !identifier.trim() || !password.trim();

  async function handleLogin() {
    if (!identifier.trim() || !password.trim()) {
      setError("Email or username and password are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setError("Google sign-in is not available in the mobile app yet. Please use email or username.");
  }

  function handleForgotPassword() {
    setError("Password reset is not available in the mobile app yet.");
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
          <View style={styles.header}>
            <Image
              source={require("@/assets/logo-main.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.tagline, { color: "rgba(255,255,255,0.6)" }]}>
              Make weight. Peak on fight night. No guessing.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: "rgba(13,16,23,0.92)", borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
              Welcome back
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
              Sign in to continue tracking your nutrition and training.
            </Text>

            {googleAuthFailed ? (
              <View
                testID="text-google-error"
                style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]}
              >
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive, fontFamily: colors.fonts.sans }]}>
                  Google sign-in failed. Please try again or sign in with email.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive, fontFamily: colors.fonts.sans }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              testID="button-google-login"
              style={[styles.googleBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="google" size={16} color={colors.foreground} />
              <Text style={[styles.googleBtnText, { color: colors.foreground, fontFamily: colors.fonts.sansBd }]}>
                Continue with Google
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>
                Email or Username
              </Text>
              <TextInput
                testID="input-identifier"
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: colors.fonts.sans }]}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="you@example.com or username"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="default"
                autoCapitalize="none"
                autoComplete="username"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>
                PASSWORD
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  testID="input-password"
                  style={[styles.input, styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: colors.fonts.sans }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <Pressable testID="button-toggle-password" onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <Pressable testID="link-forgot-password" onPress={handleForgotPassword} style={styles.forgotLink}>
              <Text style={[styles.signupLink, { color: colors.primary, fontFamily: colors.fonts.sansBd }]}>
                Forgot password?
              </Text>
            </Pressable>

            <TouchableOpacity
              testID="button-login"
              style={[styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: loginDisabled ? 0.65 : 1 }]}
              onPress={handleLogin}
              disabled={loginDisabled}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={[styles.btnText, { color: colors.primaryForeground, fontFamily: colors.fonts.sansBd }]}>
                    Sign In
                  </Text>
                  <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.signupRow}>
              <Text style={[styles.signupText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                New to PRFMR?{" "}
              </Text>
              <Link href="/(auth)/signup" asChild>
                <Pressable testID="link-register">
                  <Text style={[styles.signupLink, { color: colors.primary, fontFamily: colors.fonts.sansBd }]}>
                    Request an invite
                  </Text>
                </Pressable>
              </Link>
            </View>
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
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    height: 44,
    width: 160,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 13,
    letterSpacing: 1,
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
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 15,
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  btn: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  btnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  googleBtn: {
    height: 48,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 18,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    flex: 1,
  },
  dividerText: {
    fontSize: 13,
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 14,
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
