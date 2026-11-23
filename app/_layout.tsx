import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useSegments } from "expo-router";
import { PostHogProvider } from "posthog-react-native";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/AppToast";
import { AuthProvider, isOnboardingComplete, useAuth } from "@/context/AuthContext";
import { posthog } from "@/lib/posthog";
import { queryClient } from "@/lib/queryClient";
import { SubscriptionProvider, useSubscription } from "@/lib/revenuecat";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootLayoutNav() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isPro, isLoading: subscriptionLoading } = useSubscription();
  const segments = useSegments();
  const topSegment: string = segments[0] ?? "";
  const onboardingComplete = isOnboardingComplete(user);
  const subscriptionPending = isAuthenticated && onboardingComplete && subscriptionLoading;

  useEffect(() => {
    if (isLoading || subscriptionPending) return;
    if (!isAuthenticated) {
      if (topSegment !== "(auth)") router.replace("/(auth)/login");
      return;
    }
    if (!onboardingComplete) {
      if (topSegment !== "onboarding") router.replace("/onboarding");
      return;
    }
    if (!isPro) {
      if (topSegment !== "subscribe" && topSegment !== "paywall") router.replace("/subscribe");
      return;
    }
    if (topSegment === "" || topSegment === "subscribe" || topSegment === "onboarding" || topSegment === "(auth)") {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, isPro, onboardingComplete, subscriptionPending, topSegment]);

  // Do not mount protected tab screens while session restoration is pending.
  // Expo Router may otherwise restore the previous tab route and fire its API
  // queries before the authentication redirect completes.
  if (isLoading || subscriptionPending) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="load-trend" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="amqs" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="readiness-detail" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="subscribe" options={{ headerShown: false, animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="paywall" options={{ headerShown: false, animation: "slide_from_bottom", presentation: "modal" }} />
    </Stack>
  );
}

function AppWithAuth() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return <RootLayoutNav />;
}

function AppWithSubscription() {
  const { user, isLoading } = useAuth();
  return (
    <SubscriptionProvider
      userId={user?.id}
      isFounding={user?.isFounding ?? user?.is_founding ?? false}
      authResolved={!isLoading}
    >
      <AppWithAuth />
    </SubscriptionProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                {posthog ? (
                  <PostHogProvider client={posthog}>
                    <ToastProvider>
                      <AppWithSubscription />
                    </ToastProvider>
                  </PostHogProvider>
                ) : (
                  <ToastProvider>
                    <AppWithSubscription />
                  </ToastProvider>
                )}
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
