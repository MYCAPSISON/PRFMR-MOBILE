import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";

/**
 * RevenueCat Paywall Builder owns subscription plans, localized prices, trial
 * eligibility, and promotional offer disclosure. This screen only coordinates
 * its presentation and offers a restore path when checkout is unavailable.
 */
export default function PaywallScreen() {
  const colors = useColors();
  const router = useRouter();
  const {
    isInitialized,
    isLoading,
    isPro,
    error,
    showPaywall,
    restorePurchases,
  } = useSubscription();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (isPro) {
      router.back();
      return;
    }
    if (!isInitialized) return;

    let active = true;
    const present = async () => {
      try {
        await showPaywall();
        if (active) router.back();
      } catch (reason) {
        if (active) {
          setActionError(
            reason instanceof Error ? reason.message : "Unable to open subscriptions right now."
          );
        }
      }
    };
    void present();
    return () => {
      active = false;
    };
  }, [isInitialized, isLoading, isPro, router, showPaywall]);

  const handleRestore = async () => {
    setActionError(null);
    setIsRestoring(true);
    try {
      const customerInfo = await restorePurchases();
      if (customerInfo?.entitlements.active["PRFMR Pro"]) {
        router.back();
      } else {
        setActionError("No PRFMR Pro purchase was found for this account.");
      }
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Unable to restore purchases right now."
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const unavailableMessage = actionError ?? error?.message;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={styles.content}>
        {isLoading && !unavailableMessage ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>Preparing secure checkout…</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              Loading plans and prices directly from the App Store.
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Subscriptions unavailable</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {unavailableMessage ?? "We could not load a subscription offering. Please try again shortly."}
            </Text>
            <TouchableOpacity
              style={[styles.restoreButton, { borderColor: colors.border }]}
              onPress={handleRestore}
              disabled={isRestoring || !isInitialized}
            >
              {isRestoring ? (
                <ActivityIndicator color={colors.foreground} />
              ) : (
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Restore purchases</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Close</Text>
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
  restoreButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  closeButton: { padding: 10 },
});