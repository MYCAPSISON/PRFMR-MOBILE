import Constants from "expo-constants";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import type PurchasesType from "react-native-purchases";

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "PRFMR Pro";
const DEFAULT_OFFERING = "default";
const FOUNDING_OFFERING = "founding";
// Expo Go cannot load RevenueCat's native SDK. In a local Metro development
// session only, grant a preview entitlement so authenticated developers can
// inspect protected screens. This is false in development clients, preview
// builds, TestFlight, Play builds and production releases.
const IS_EXPO_GO_PREVIEW = __DEV__ && Constants.executionEnvironment === "storeClient";

type PurchasesModule = typeof PurchasesType;
type CustomerInfo = Awaited<ReturnType<PurchasesModule["getCustomerInfo"]>>;
type Offering = Awaited<ReturnType<PurchasesModule["getOfferings"]>>["current"];

let purchasesModule: PurchasesModule | null = null;
let configured = false;

function publicApiKey(): string | null {
  if (Platform.OS === "ios") return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || null;
  if (Platform.OS === "android") return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || null;
  return null;
}

function hasPro(info: CustomerInfo | null): boolean {
  return info?.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
}

async function getPurchases(): Promise<PurchasesModule> {
  if (purchasesModule) return purchasesModule;
  const imported = await import("react-native-purchases");
  purchasesModule = imported.default;
  return purchasesModule;
}

async function configureRevenueCat(): Promise<PurchasesModule> {
  if (Constants.executionEnvironment === "storeClient") {
    throw new Error("Subscriptions require a native development or TestFlight build; Expo Go is not supported.");
  }
  const key = publicApiKey();
  if (!key) throw new Error("The RevenueCat public SDK key is missing from this build.");
  if (Platform.OS === "ios" && !key.startsWith("appl_")) {
    throw new Error("The configured RevenueCat iOS key is invalid.");
  }
  if (Platform.OS === "android" && !key.startsWith("goog_")) {
    throw new Error("The configured RevenueCat Android key is invalid.");
  }

  const Purchases = await getPurchases();
  if (!configured) {
    const alreadyConfigured = await Purchases.isConfigured();
    if (!alreadyConfigured) Purchases.configure({ apiKey: key });
    configured = true;
    if (__DEV__) await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  }
  return Purchases;
}

type SubscriptionValue = {
  isLoading: boolean;
  isInitialized: boolean;
  isPro: boolean;
  error: Error | null;
  currentOffering: Offering;
  refresh: () => Promise<CustomerInfo | null>;
  showPaywall: () => Promise<CustomerInfo | null>;
  restorePurchases: () => Promise<CustomerInfo | null>;
};

const SubscriptionContext = createContext<SubscriptionValue | null>(null);

export function SubscriptionProvider({
  children,
  userId,
  isFounding,
  authResolved,
}: {
  children: React.ReactNode;
  userId?: number | null;
  isFounding: boolean;
  authResolved: boolean;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<Offering>(null);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!configured || !userId) return null;
    try {
      const Purchases = await getPurchases();
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      setError(null);
      return info;
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Unable to verify your subscription."));
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!authResolved) return;
    let active = true;
    setCustomerInfo(null);
    setCurrentOffering(null);
    setError(null);

    if (!userId) {
      setIsInitialized(false);
      setIsLoading(false);
      return;
    }

    if (IS_EXPO_GO_PREVIEW) {
      setIsInitialized(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const initialize = async () => {
      try {
        const Purchases = await configureRevenueCat();
        const login = await Purchases.logIn(String(userId));
        await Purchases.setAttributes({ founding_user: isFounding ? "true" : "" });
        const offerings = await Purchases.getOfferings();
        if (!active) return;
        setCustomerInfo(login.customerInfo);
        setCurrentOffering(
          offerings.all[isFounding ? FOUNDING_OFFERING : DEFAULT_OFFERING]
          ?? offerings.current
          ?? null
        );
        setIsInitialized(true);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason : new Error("Subscriptions are unavailable."));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void initialize();
    return () => { active = false; };
  }, [authResolved, isFounding, userId]);

  useEffect(() => {
    if (!isInitialized) return;
    let listener: ((info: CustomerInfo) => void) | null = null;
    void getPurchases().then((Purchases) => {
      listener = (info) => setCustomerInfo(info);
      Purchases.addCustomerInfoUpdateListener(listener);
    });
    return () => {
      if (listener && purchasesModule) purchasesModule.removeCustomerInfoUpdateListener(listener);
    };
  }, [isInitialized]);

  // Offer-code redemption is completed by Apple's App Store sheet outside
  // React Native. Re-read CustomerInfo when the app becomes active so a
  // successful redemption unlocks the gate without requiring a relaunch.
  useEffect(() => {
    if (!isInitialized || !userId) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [isInitialized, refresh, userId]);

  const restorePurchases = useCallback(async () => {
    const Purchases = await configureRevenueCat();
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
    return info;
  }, []);

  const showPaywall = useCallback(async () => {
    if (!currentOffering) throw new Error("No RevenueCat offering is available.");
    const RevenueCatUI = (await import("react-native-purchases-ui")).default;
    await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_IDENTIFIER,
      offering: currentOffering,
      displayCloseButton: true,
    });
    return refresh();
  }, [currentOffering, refresh]);

  const value = useMemo<SubscriptionValue>(() => ({
    isLoading,
    isInitialized,
    isPro: IS_EXPO_GO_PREVIEW || hasPro(customerInfo),
    error,
    currentOffering,
    refresh,
    showPaywall,
    restorePurchases,
  }), [customerInfo, currentOffering, error, isInitialized, isLoading, refresh, restorePurchases, showPaywall]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export async function resetRevenueCatForLogout(): Promise<void> {
  if (!configured || !purchasesModule) return;
  try { await purchasesModule.logOut(); } catch { /* fail closed in provider state */ }
}

export function useSubscription(): SubscriptionValue {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return value;
}
