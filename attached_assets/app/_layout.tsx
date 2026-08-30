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
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/AppToast";
import { AuthProvider, isOnboardingComplete, useAuth } from "@/context/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { SubscriptionProvider, useSubscription } from "@/lib/revenuecat";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// The only routes a non-Pro (but authenticated + onboarded) user may be on.
// Everything else belongs to the paid app -- (tabs), load-trend, amqs,
// readiness-detail, or any unresolved/other segment -- and must bounce to
// the gate no matter how the navigator got there (deep link, push,
// back/forward, or a programmatic replace elsewhere in the app).
const ALLOWED_WITHOUT_PRO_TOP_SEGMENTS = new Set(["subscribe", "paywall"]);
// Screens that only make sense before a user has reached the main app. An
// already-authenticated, onboarded, Pro user should never be stranded here.
const PRE_APP_TOP_SEGMENTS = new Set(["(auth)", "onboarding", "subscribe"]);

function RootLayoutNav() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isPro, isLoading: subscriptionLoading } = useSubscription();
  // The current top-level route segment. Including this in the guard effect
  // (not just auth/subscription state) is what makes the gate genuinely
  // global: a deep link, a router.push from elsewhere, or web back/forward
  // navigation changes this value and re-fires the check, even when nothing
  // about auth or entitlement state itself changed.
  const segments = useSegments();
  const currentTopSegment: string = segments[0] ?? "";

  const onboardingComplete = isOnboardingComplete(user);
  // The entitlement gate only applies once a user is authenticated and has
  // finished onboarding. Don't block on subscription state outside that case
  // (e.g. logged-out users), or the loading provider's default `true` would
  // stall the login/onboarding screens forever.
  const gateRelevant = isAuthenticated && onboardingComplete;
  const subscriptionPending = gateRelevant && subscriptionLoading;

  useEffect(() => {
    if (isLoading || subscriptionPending) return;

    if (!isAuthenticated) {
      if (currentTopSegment !== "(auth)") router.replace("/(auth)/login");
      return;
    }
    if (!onboardingComplete) {
      // User hasn't completed onboarding yet
      if (currentTopSegment !== "onboarding") router.replace("/onboarding");
      return;
    }
    if (!isPro) {
      // Authenticated, onboarded, but no active PRFMR Pro entitlement: any
      // route belonging to the paid app (or any unresolved/pre-app route)
      // must bounce to the subscription gate. Only the gate itself and the
      // on-demand paywall modal (which self-checks `isPro`) are allowed.
      if (!ALLOWED_WITHOUT_PRO_TOP_SEGMENTS.has(currentTopSegment)) {
        router.replace("/subscribe");
      }
      return;
    }
    // Authenticated, onboarded, and Pro: never leave the user stranded on a
    // login/onboarding/gate screen once they're actually entitled.
    if (currentTopSegment === "" || PRE_APP_TOP_SEGMENTS.has(currentTopSegment)) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, onboardingComplete, isPro, subscriptionPending, currentTopSegment]);

  // Never render a frame of protected navigation state while auth or
  // subscription status is still resolving — that's how a non-Pro user could
  // glimpse tabs before the redirect above fires.
  if (isLoading || subscriptionPending) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="load-trend" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="amqs" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="readiness-detail" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="paywall" options={{ headerShown: false, animation: "slide_from_bottom", presentation: "modal" }} />
      <Stack.Screen
        name="subscribe"
        options={{ headerShown: false, animation: "fade", gestureEnabled: false }}
      />
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
                <ToastProvider>
                  <AppWithSubscription />
                </ToastProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
