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
import { Link, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup() {
    if (!email.trim() || !username.trim() || !password.trim() || !inviteCode.trim()) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(email.trim(), username.trim(), password, inviteCode.trim());
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ImageBackground
      source={require("@/assets/stock-images/fight_action_2.jpg")}
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
            <Text style={[styles.tagline, { color: "rgba(255,255,255,0.6)", fontFamily: colors.fonts.sans }]}>
              Request access with your invite code
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: "rgba(13,16,23,0.92)", borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>
              Create Account
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive, fontFamily: colors.fonts.sans }]}>{error}</Text>
              </View>
            ) : null}

            <Field label="EMAIL" value={email} onChange={setEmail} placeholder="your@email.com" keyboardType="email-address" colors={colors} />
            <Field label="USERNAME" value={username} onChange={setUsername} placeholder="athlete_name" colors={colors} />

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>PASSWORD</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: colors.fonts.sans }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a strong password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>INVITE CODE</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary, borderRadius: colors.radius, fontWeight: "700", letterSpacing: 2, fontFamily: colors.fonts.mono }]}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="XXXX-XXXX"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
              />
              <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>An invite code is required to join PRFMR</Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryForeground, fontFamily: colors.fonts.sansBd }]}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>
                Already have an account?{" "}
              </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={[styles.loginLink, { color: colors.primary, fontFamily: colors.fonts.sansBd }]}>
                    Sign In
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

function Field({ label, value, onChange, placeholder, keyboardType, colors }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "email-address" | "default";
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: colors.fonts.sans }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
      />
    </View>
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
    marginBottom: 32,
  },
  logo: {
    height: 44,
    width: 160,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 13,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  card: {
    padding: 24,
    borderWidth: 1,
    borderRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  field: {
    marginBottom: 14,
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
  hint: {
    fontSize: 11,
    marginTop: 6,
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
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
