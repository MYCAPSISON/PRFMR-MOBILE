import React, { Suspense, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";

const RevenueCatPaywall = React.lazy(async () => {
  const module = await import("react-native-purchases-ui");
  return { default: module.default.Paywall };
});

export default function PaywallScreen() {
  const colors = useColors();
  const { isLoading, isInitialized, isPro, error, currentOffering, refresh } = useSubscription();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isPro) { router.back(); return; }
  }, [isPro]);

  if (!isLoading && isInitialized && !isPro && currentOffering) {
    return (
      <Suspense fallback={<View style={[styles.screen, styles.content, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>}>
        <RevenueCatPaywall
          options={{ offering: currentOffering, displayCloseButton: true }}
          onDismiss={() => router.back()}
          onPurchaseCompleted={() => void refresh()}
          onRestoreCompleted={() => void refresh()}
          onPurchaseError={({ error: purchaseError }) => setActionError(purchaseError.message)}
          onRestoreError={({ error: restoreError }) => setActionError(restoreError.message)}
        />
      </Suspense>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} />}
        <Text style={[styles.title, { color: colors.foreground }]}>PRFMR Pro</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{actionError ?? error?.message ?? "Loading plans…"}</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary, fontWeight: "700" }}>Close</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 32 },
  title: { fontSize: 26, fontWeight: "800" },
  body: { textAlign: "center", fontSize: 15, lineHeight: 22 },
});
