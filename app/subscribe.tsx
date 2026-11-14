import React, { Suspense, useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { REVENUECAT_ENTITLEMENT_IDENTIFIER, useSubscription } from "@/lib/revenuecat";

const RevenueCatPaywall = React.lazy(async () => {
  const module = await import("react-native-purchases-ui");
  return { default: module.default.Paywall };
});

export default function SubscribeScreen() {
  const colors = useColors();
  const { logout, user } = useAuth();
  const { isLoading, isInitialized, isPro, error, currentOffering, refresh, restorePurchases } = useSubscription();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const openPaywall = () => {
    setActionError(null);
    setPaywallVisible(true);
  };

  useEffect(() => {
    if (!isLoading && isInitialized && !isPro && currentOffering) setPaywallVisible(true);
  }, [currentOffering, isInitialized, isLoading, isPro]);

  // The embedded paywall can be unmounted as soon as an offer-code redemption
  // activates PRFMR Pro. An imperatively presented native paywall would remain
  // above the app until the customer manually closed it.
  if (paywallVisible && !isPro && currentOffering) {
    return (
      <Suspense fallback={<View style={[styles.screen, styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>}>
        <RevenueCatPaywall
          options={{ offering: currentOffering, displayCloseButton: true }}
          onDismiss={() => setPaywallVisible(false)}
          onPurchaseCompleted={() => void refresh()}
          onRestoreCompleted={() => void refresh()}
        />
      </Suspense>
    );
  }

  const restore = async () => {
    setBusy(true); setActionError(null);
    try {
      const info = await restorePurchases();
      if (!info?.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER]) {
        setActionError("No PRFMR Pro purchase was found for this Apple account.");
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to restore purchases.");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {(isLoading || busy) && <ActivityIndicator size="large" color={colors.primary} />}
        <Image source={require("@/assets/logo-main.png")} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { color: colors.foreground }]}>PRFMR Pro</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          {actionError ?? error?.message ?? "An active PRFMR Pro subscription is required to continue."}
        </Text>
        {user?.targetCalories != null && (
          <View style={[styles.targetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.targetLabel, { color: colors.mutedForeground }]}>YOUR DAILY CALORIE TARGET</Text>
            <Text style={[styles.targetValue, { color: colors.foreground }]}>
              {Math.round(user.targetCalories).toLocaleString()} <Text style={styles.targetUnit}>kcal</Text>
            </Text>
            <Text style={[styles.targetHint, { color: colors.mutedForeground }]}>Calculated from your onboarding profile</Text>
          </View>
        )}
        <Text style={[styles.subscribeHint, { color: colors.mutedForeground }]}>Subscribe to track your food and training sessions</Text>
        <TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={openPaywall} disabled={busy || !isInitialized || !currentOffering}>
          <Text style={styles.primaryText}>View plans</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondary, { borderColor: colors.border }]} onPress={() => void restore()} disabled={busy || !isInitialized}>
          <Text style={{ color: colors.foreground, fontWeight: "700" }}>Restore purchases</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void logout()} disabled={busy}>
          <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { justifyContent: "center", alignItems: "center" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, paddingHorizontal: 32 },
  logo: { width: 210, height: 68, marginBottom: 2 },
  title: { fontSize: 30, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  targetCard: { width: "100%", borderRadius: 14, borderWidth: 1, paddingVertical: 18, paddingHorizontal: 16, alignItems: "center" },
  targetLabel: { fontSize: 10, letterSpacing: 1.1, fontWeight: "700" },
  targetValue: { fontSize: 32, lineHeight: 40, fontWeight: "800", marginTop: 3 },
  targetUnit: { color: "#f97316", fontSize: 15, fontWeight: "700" },
  targetHint: { fontSize: 11, marginTop: 2 },
  subscribeHint: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: -4 },
  primary: { width: "100%", borderRadius: 12, borderWidth: 1.5, borderColor: "#fff", padding: 15, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondary: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 14, alignItems: "center" },
});
