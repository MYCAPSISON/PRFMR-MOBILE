import { Feather, FontAwesome5 } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Link, router, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  AuthApiError,
  loginWithAppleCredential,
  loginWithGoogleToken,
  registerMobileEmail,
} from "@/lib/api";
import { getGoogleSignInModule } from "@/lib/googleSignIn";

const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_CONFIGURED = Platform.OS === "ios"
  ? Boolean(IOS_CLIENT_ID && WEB_CLIENT_ID)
  : Boolean(WEB_CLIENT_ID);
const GOOGLE_SIGN_IN_MODULE = getGoogleSignInModule();

const SOURCES = [
  { label: "Instagram", value: "ig" },
  { label: "TikTok", value: "tiktok" },
  { label: "Friend", value: "friend" },
  { label: "Gym / coach", value: "gym" },
  { label: "Reddit", value: "reddit" },
  { label: "Other", value: "other" },
] as const;

function socialErrorMessage(provider: "Google" | "Apple", reason: unknown): string {
  if (reason instanceof AuthApiError) {
    if (reason.status === 0) return "Cannot reach the server. Check your connection and try again.";
    if (reason.status === 400) return `${provider} sent an invalid account-creation request. Please try again.`;
    if (reason.status === 401) return `${provider} could not authenticate this account. Please try again.`;
    if (reason.status === 409) return reason.message || "This email is already linked to another sign-in method.";
    if (reason.status === 429) return "Too many attempts. Please wait and try again later.";
  }
  return `${provider} account creation failed. Please try again.`;
}

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { refetchUser } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "google" | "apple" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (GOOGLE_CONFIGURED && GOOGLE_SIGN_IN_MODULE) {
      GOOGLE_SIGN_IN_MODULE.GoogleSignin.configure({
        iosClientId: IOS_CLIENT_ID,
        webClientId: WEB_CLIENT_ID,
        offlineAccess: false,
      });
    }
    if (Platform.OS === "ios") {
      void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  function selectedSource(): string | null {
    if (source) return source;
    setError("Please tell us where you found PRFMR first.");
    return null;
  }

  async function handleEmailSignup() {
    const referralSource = selectedSource();
    if (!referralSource) return;
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedEmail || !normalizedUsername || !password) {
      setError("Email, username and password are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setLoading("email");
    try {
      const response = await registerMobileEmail({
        email: normalizedEmail,
        username: normalizedUsername,
        password,
        source: referralSource,
      });
      router.push({
        pathname: "/(auth)/check-email",
        params: {
          email: response.email,
          cooldown: String(response.verification.resendCooldownSeconds),
        },
      } as unknown as Href);
    } catch (reason) {
      if (reason instanceof AuthApiError) {
        if (reason.status === 503 || reason.code === "EMAIL_DELIVERY_FAILED") {
          router.push({
            pathname: "/(auth)/check-email",
            params: { email: normalizedEmail, cooldown: "0", deliveryFailed: "1" },
          } as unknown as Href);
          return;
        }
        setError(reason.fields?.[0]?.message ?? reason.message);
      } else {
        setError("Unable to create your account. Please try again.");
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogleSignup() {
    const referralSource = selectedSource();
    if (!referralSource) return;
    if (!GOOGLE_CONFIGURED) {
      setError("Google sign-in requires setup — please contact the app administrator.");
      return;
    }
    if (!GOOGLE_SIGN_IN_MODULE) {
      setError("Google sign-in is unavailable in Expo Go. Use a PRFMR development or preview build to test it.");
      return;
    }
    setError(null);
    setLoading("google");
    try {
      if (Platform.OS === "android") {
        await GOOGLE_SIGN_IN_MODULE.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GOOGLE_SIGN_IN_MODULE.GoogleSignin.signIn();
      if (GOOGLE_SIGN_IN_MODULE.isCancelledResponse(response)) return;
      const idToken = response.data.idToken;
      if (!idToken) throw new Error("Google returned no identity token.");
      await loginWithGoogleToken(idToken, referralSource);
      await refetchUser();
      router.replace("/onboarding");
    } catch (reason) {
      setError(socialErrorMessage("Google", reason));
    } finally {
      setLoading(null);
    }
  }

  async function handleAppleSignup() {
    const referralSource = selectedSource();
    if (!referralSource || !appleAvailable) return;
    setError(null);
    setLoading("apple");
    try {
      const state = Crypto.randomUUID();
      const nonce = Crypto.randomUUID();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        state,
        nonce,
      });
      if (credential.state !== state) throw new Error("Apple sign-in state did not match.");
      if (!credential.identityToken) throw new Error("Apple returned no identity token.");

      await loginWithAppleCredential({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode ?? undefined,
        fullName: credential.fullName ? {
          givenName: credential.fullName.givenName ?? undefined,
          familyName: credential.fullName.familyName ?? undefined,
        } : undefined,
        email: credential.email ?? undefined,
      }, referralSource);
      await refetchUser();
      router.replace("/onboarding");
    } catch (reason) {
      if (reason && typeof reason === "object" && "code" in reason && reason.code === "ERR_REQUEST_CANCELED") return;
      setError(socialErrorMessage("Apple", reason));
    } finally {
      setLoading(null);
    }
  }

  return (
    <ImageBackground
      source={require("@/assets/stock-images/fight_action_2.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView style={styles.background} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image source={require("@/assets/logo-main.png")} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.tagline, { fontFamily: colors.fonts.sans }]}>Create your PRFMR account — no invite code needed.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: "rgba(13,16,23,0.94)", borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: colors.fonts.display }]}>Create Account</Text>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: "#fff", fontFamily: colors.fonts.sans }]}
            placeholder="your@email.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>USERNAME</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: "#fff", fontFamily: colors.fonts.sans }]}
            placeholder="athlete_name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>PASSWORD</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={[styles.input, styles.passwordInput, { color: colors.foreground, backgroundColor: colors.input, borderColor: "#fff", fontFamily: colors.fonts.sans }]}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <Pressable style={styles.eyeButton} onPress={() => setShowPassword((visible) => !visible)}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={19} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: colors.fonts.sansSb }]}>CONFIRM PASSWORD</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: "#fff", fontFamily: colors.fonts.sans }]}
            placeholder="Enter password again"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Where did you hear about PRFMR?</Text>

          <View style={styles.sourceGrid}>
            {SOURCES.map((item) => {
              const selected = source === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => { setSource(item.value); setError(null); }}
                  style={[
                    styles.sourceButton,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "22" : colors.input },
                  ]}
                >
                  <Text style={[styles.sourceText, { color: selected ? colors.primary : colors.foreground, fontFamily: colors.fonts.sansSb }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "55" }]}>
              <Feather name="alert-circle" size={15} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive, fontFamily: colors.fonts.sans }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.emailButton, { backgroundColor: colors.primary, opacity: loading ? 0.65 : 1 }]}
            onPress={handleEmailSignup}
            disabled={loading !== null}
          >
            {loading === "email" ? <ActivityIndicator color="#fff" /> : <Text style={[styles.emailButtonText, { fontFamily: colors.fonts.sansBd }]}>Create Account</Text>}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>or</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, { borderColor: "#fff", opacity: loading ? 0.65 : 1 }]}
            onPress={handleGoogleSignup}
            disabled={loading !== null}
          >
            {loading === "google" ? <ActivityIndicator color="#fff" /> : <FontAwesome5 name="google" size={20} color="#fff" />}
            <Text style={[styles.socialButtonText, { fontFamily: colors.fonts.sansBd }]}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === "ios" && appleAvailable ? (
            <TouchableOpacity
              style={[styles.appleButton, { opacity: loading ? 0.65 : 1 }]}
              onPress={handleAppleSignup}
              disabled={loading !== null}
            >
              {loading === "apple" ? <ActivityIndicator color="#000" /> : <FontAwesome5 name="apple" size={22} color="#000" />}
              <Text style={[styles.appleButtonText, { fontFamily: colors.fonts.sansBd }]}>Continue with Apple</Text>
            </TouchableOpacity>
          ) : null}

          <Pressable onPress={() => void Linking.openURL("https://app.prfmr.link/start")} style={styles.webLink}>
            <Text style={[styles.webLinkText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Open account setup on the web</Text>
            <Feather name="external-link" size={14} color={colors.mutedForeground} />
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={[styles.loginText, { color: colors.mutedForeground, fontFamily: colors.fonts.sans }]}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable><Text style={[styles.loginLink, { color: colors.primary, fontFamily: colors.fonts.sansBd }]}>Sign In</Text></Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.68)" },
  container: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 28 },
  logo: { height: 44, width: 160, marginBottom: 12 },
  tagline: { color: "rgba(255,255,255,0.68)", fontSize: 14, letterSpacing: 0.3, textAlign: "center" },
  card: { padding: 22, borderWidth: 1, borderRadius: 12 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: "600", marginTop: 10, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, fontSize: 15 },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 46 },
  eyeButton: { position: "absolute", right: 13, top: 14 },
  subtitle: { fontSize: 15, marginTop: 18, marginBottom: 12 },
  sourceGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginBottom: 18 },
  sourceButton: { width: "48.5%", minHeight: 44, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  sourceText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 11, borderRadius: 8, borderWidth: 1, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 13 },
  emailButton: { height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emailButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13 },
  socialButton: { height: 52, borderRadius: 10, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 },
  socialButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  appleButton: { height: 52, borderRadius: 10, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 },
  appleButtonText: { color: "#000", fontSize: 16, fontWeight: "700" },
  webLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 8, marginBottom: 10 },
  webLinkText: { fontSize: 13, textDecorationLine: "underline" },
  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: "700" },
});
