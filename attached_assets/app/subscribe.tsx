import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/lib/revenuecat";

/**
 * The authoritative subscription gate. `app/_layout.tsx` routes every
 * authenticated, onboarded, non-Pro user here and nowhere else is reachable
 * until `isPro` becomes true — at that point the root layout's own effect
 * redirects to `(tabs)`, so this screen never navigates on success itself.
 *
 * Unlike `app/paywall.tsx` (an on-demand modal reachable from Profile that
 * can be dismissed back to wherever it was opened from), this screen has no
 * dismiss path into the app: no close button, no swipe gesture (disabled at
 * the Stack.Screen level), and the Android hardware back button is
 * intercepted so it cannot pop this screen either.
 */
export default function SubscribeScreen() {
  const colors = useColors();
  const { logout } = useAuth();
  const {
    isInitialized,
    isLoading,
    isPro,
    isFounding,
    error,
    currentOffering,
    retryInitialization,
    showPaywall,
    restorePurchases,
    redeemOfferCode,
  } = useSubscription();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const hasAutoPresentedRef = useRef(false);

  // Block the Android hardware back button entirely — there is nothing valid
  // to go back to from this screen.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, []);

  const presentPaywall = async () => {
    setActionError(null);
    setIsBusy(true);
    try {
      await showPaywall();
      // Root layout redirects automatically once `isPro` flips true; if the
      // user dismissed without purchasing, we simply stay on this screen.
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to open subscriptions right now.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRetryInitialization = async () => {
    setActionError(null);
    setIsBusy(true);
    hasAutoPresentedRef.current = false;
    try {
      const initialized = await retryInitialization();
      if (!initialized) {
        setActionError("Subscriptions are still unavailable. Please try again in a moment.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (isLoading || isPro || !isInitialized || hasAutoPresentedRef.current) return;
    hasAutoPresentedRef.current = true;
    void presentPaywall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isPro, isInitialized]);

  const handleRestore = async () => {
    setActionError(null);
    setIsBusy(true);
    try {
      const customerInfo = await restorePurchases();
      if (!customerInfo?.entitlements.active["PRFMR Pro"]) {
        setActionError("No PRFMR Pro purchase was found for this account.");
      }
      // On success the root layout picks up the new `isPro` value and redirects.
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to restore purchases right now.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleRedeemOfferCode = async () => {
    setActionError(null);
    setIsBusy(true);
    try {
      const customerInfo = await redeemOfferCode();
      if (!customerInfo?.entitlements.active["PRFMR Pro"]) {
        setActionError("The code was submitted, but PRFMR Pro isn't active yet. Try again in a moment.");
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to open code redemption right now.");
    } finally {
      setIsBusy(false);
    }
  };

  const showFoundingRedemption = isFounding && Platform.OS === "ios";
  const unavailableMessage = actionError ?? error?.message;
  const showRetryState = !isLoading && (!!unavailableMessage || (!currentOffering && isInitialized));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.content}>
        {isLoading || (isBusy && !showRetryState) ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Preparing secure checkout…</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              Loading plans and prices directly from the store.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {showRetryState ? "Subscription required" : "PRFMR Pro"}
            </Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {unavailableMessage ??
                "An active PRFMR Pro subscription is required to continue. Choose a plan to unlock the app."}
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={isInitialized ? presentPaywall : handleRetryInitialization}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{isInitialized ? "View plans" : "Try again"}</Text>
              )}
            </TouchableOpacity>

            {showFoundingRedemption && (
              <TouchableOpacity
                style={[styles.outlineButton, { borderColor: colors.border }]}
                onPress={handleRedeemOfferCode}
                disabled={isBusy || !isInitialized}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Redeem Founding Offer</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: colors.border }]}
              onPress={handleRestore}
              disabled={isBusy || !isInitialized}
            >
              <Text style={{ color: colors.foreground, fontWeight: "700" }}>Restore purchases</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => void logout()} style={styles.logoutButton} disabled={isBusy}>
              <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>Log out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  description: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  primaryButton: {
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 6,
    minWidth: 200,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  outlineButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, minWidth: 200, alignItems: "center" },
  logoutButton: { padding: 10, marginTop: 8 },
});
