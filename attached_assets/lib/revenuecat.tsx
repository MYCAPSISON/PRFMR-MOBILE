import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import Purchases from "react-native-purchases";

// The SDK lives in the mobile artifact workspace. These narrow structural
// types keep the root TypeScript project independent from its transitive types.
type CustomerInfo = { entitlements: { active: Record<string, unknown> } };
type PurchasesOffering = { identifier: string };
type PurchasesOfferings = {
  current: PurchasesOffering | null;
  all: Record<string, PurchasesOffering>;
};
type ActiveSession = { generation: number; userId: string };

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "PRFMR Pro";
export const REVENUECAT_DEFAULT_OFFERING_IDENTIFIER = "default";
export const REVENUECAT_FOUNDING_OFFERING_IDENTIFIER = "founding";

let revenueCatConfigured = false;
let revenueCatInitializationError: Error | null = null;
let revenueCatInitializationPromise: Promise<boolean> | null = null;
let revenueCatOperationQueue: Promise<void> = Promise.resolve();
const resetSubscribers = new Set<() => Promise<void>>();

function enqueueRevenueCatOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = revenueCatOperationQueue.then(operation, operation);
  // Continue the queue after failures. Callers retain the original rejection.
  revenueCatOperationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function getRevenueCatApiKey(): string | null {
  // The RevenueCat Test Store is a Web Billing simulation: it renders its own
  // checkout using DOM APIs (`document`, offer-code sheets, etc.) that simply
  // don't exist in a native JS engine. It must only be selected for a genuine
  // browser session (Platform.OS === "web"), or Expo Go (executionEnvironment
  // "storeClient"), which can't load the real native purchases module at all
  // and falls back to this same web-style bridge to preview offerings.
  //
  // Any other native run -- Expo dev client, TestFlight, Play internal
  // testing, or production -- has the real native module compiled in and
  // must use the platform's public SDK key so StoreKit/Play Billing route
  // through their own sandbox (Apple/Google detect sandbox vs. production
  // automatically; no separate "test" key is needed or correct here).
  // Do NOT gate this on `__DEV__` -- a dev-client build on a real device is
  // still `__DEV__` but must use the native billing path, not the Test Store.
  if (Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY ?? null;
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY ?? null;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY ?? null;
  return null;
}

function isNativeKeyShapeValid(apiKey: string): boolean {
  if (Constants.executionEnvironment === "storeClient" || Platform.OS === "web") return true;
  if (Platform.OS === "ios") return apiKey.startsWith("appl_");
  if (Platform.OS === "android") return apiKey.startsWith("goog_");
  return false;
}

/** Configure RevenueCat once, after React has mounted. */
export function initializeRevenueCat(): Promise<boolean> {
  if (revenueCatConfigured) return Promise.resolve(true);
  if (revenueCatInitializationPromise) return revenueCatInitializationPromise;

  revenueCatInitializationPromise = (async () => {
    revenueCatInitializationError = null;
    const apiKey = getRevenueCatApiKey()?.trim() ?? "";
    const keyPresent = apiKey.length > 0;
    const keyShapeValid = keyPresent && isNativeKeyShapeValid(apiKey);

    // Never log the public SDK key itself. These booleans are sufficient to
    // diagnose whether Expo Launch injected the expected platform variable.
    logSubscriptionEvent("initializing", {
      platform: Platform.OS,
      keyPresent,
      keyShapeValid,
    });

    if (!keyPresent || !keyShapeValid) {
      revenueCatInitializationError = new Error(
        "Subscriptions are not configured correctly for this app build. Please try again later."
      );
      return false;
    }

    try {
      // The native singleton can survive a JavaScript runtime reload. Checking
      // it prevents configureWithAPIKey from raising an Objective-C exception
      // when the native SDK has already been configured.
      const alreadyConfigured = await Purchases.isConfigured();
      if (!alreadyConfigured) {
        Purchases.configure({ apiKey });
        const didConfigure = await Purchases.isConfigured();
        if (!didConfigure) {
          throw new Error("RevenueCat native configuration did not complete.");
        }
      }

      revenueCatConfigured = true;

      // INFO is already the SDK's release-build default. Avoid another native
      // void TurboModule call during production startup; enable verbose output
      // only in development, and always observe the returned promise.
      if (__DEV__) {
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }

      logSubscriptionEvent("initialized", {
        platform: Platform.OS,
        alreadyConfigured,
      });
      return true;
    } catch (reason) {
      revenueCatConfigured = false;
      revenueCatInitializationError = new Error(
        "Subscriptions could not be prepared. Check your connection and try again."
      );
      console.warn("[RevenueCat] initialization_failed", {
        platform: Platform.OS,
        reasonType: reason instanceof Error ? reason.name : typeof reason,
      });
      return false;
    }
  })().finally(() => {
    revenueCatInitializationPromise = null;
  });

  return revenueCatInitializationPromise;
}

function isEntitled(customerInfo: CustomerInfo | null): boolean {
  return customerInfo?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
}

/**
 * Non-sensitive diagnostic logging for the subscription flow. Never pass API
 * keys, offer codes, or payment details through this — identifiers and
 * booleans only.
 */
function logSubscriptionEvent(event: string, details?: Record<string, unknown>): void {
  console.log(`[RevenueCat] ${event}`, details ?? {});
}

function selectOffering(
  offerings: PurchasesOfferings | null,
  isFounding: boolean
): PurchasesOffering | null {
  if (!offerings) return null;
  if (isFounding) {
    // RevenueCat Targeting can set `current` from founding_user. This is a
    // server-authorized fallback if targeting has not been configured yet.
    return (
      offerings.all[REVENUECAT_FOUNDING_OFFERING_IDENTIFIER] ??
      offerings.current ??
      offerings.all[REVENUECAT_DEFAULT_OFFERING_IDENTIFIER] ??
      null
    );
  }
  return offerings.all[REVENUECAT_DEFAULT_OFFERING_IDENTIFIER] ?? offerings.current ?? null;
}

type SubscriptionContextValue = {
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  /** Compatibility alias for existing profile UI. */
  isSubscribed: boolean;
  isFounding: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  error: Error | null;
  retryInitialization: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  showPaywall: () => Promise<void>;
  restorePurchases: () => Promise<CustomerInfo | null>;
  presentCustomerCenter: () => Promise<void>;
  /** iOS-only. Opens Apple's native Offer Code redemption sheet, then
   * re-verifies entitlement. Throws on non-iOS platforms. */
  redeemOfferCode: () => Promise<CustomerInfo | null>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function SubscriptionProvider({
  children,
  userId,
  isFounding,
  authResolved,
}: {
  children: React.ReactNode;
  userId: number | null | undefined;
  isFounding: boolean;
  authResolved: boolean;
}) {
  const [isInitialized, setIsInitialized] = useState(revenueCatConfigured);
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [error, setError] = useState<Error | null>(() => revenueCatInitializationError);
  const activeSessionRef = useRef<ActiveSession | null>(null);
  const generationRef = useRef(0);

  const isCurrentSession = useCallback((session: ActiveSession | null) => {
    return (
      session !== null &&
      activeSessionRef.current === session &&
      generationRef.current === session.generation
    );
  }, []);

  const clearVisibleAccountState = useCallback(() => {
    activeSessionRef.current = null;
    setCustomerInfo(null);
    setCurrentOffering(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const retryInitialization = useCallback(async (): Promise<boolean> => {
    setIsInitialized(false);
    setIsLoading(true);
    setError(null);

    const initialized = await initializeRevenueCat();
    setIsInitialized(initialized);
    setError(initialized ? null : revenueCatInitializationError);
    if (!initialized) setIsLoading(false);
    return initialized;
  }, []);

  useEffect(() => {
    if (!authResolved) return;

    let active = true;
    const initialize = async () => {
      const initialized = await initializeRevenueCat();
      if (!active) return;
      setIsInitialized(initialized);
      setError(initialized ? null : revenueCatInitializationError);
      if (!initialized) setIsLoading(false);
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [authResolved]);

  const refreshCustomerInfo = useCallback(async (): Promise<CustomerInfo | null> => {
    const session = activeSessionRef.current;
    if (!revenueCatConfigured || !session) return null;

    try {
      const info = await enqueueRevenueCatOperation(() => Purchases.getCustomerInfo());
      if (!isCurrentSession(session)) return null;
      setCustomerInfo(info);
      setError(null);
      return info;
    } catch (reason) {
      if (isCurrentSession(session)) {
        setError(reason instanceof Error ? reason : new Error("Unable to refresh subscription status."));
      }
      return null;
    }
  }, [isCurrentSession]);

  const resetCurrentAccount = useCallback(async () => {
    // Invalidate UI before queueing the SDK transition. A late result can only
    // update state when it matches this exact session object and generation.
    generationRef.current += 1;
    clearVisibleAccountState();
    if (!revenueCatConfigured) return;
    try {
      await enqueueRevenueCatOperation(() => Purchases.logOut());
    } catch {
      // State has already failed closed, which is the safety requirement here.
    }
  }, [clearVisibleAccountState]);

  useEffect(() => {
    if (!isInitialized) return;

    const listener = () => {
      // Listener payloads are not identity-scoped. Fetch after the serialized
      // queue instead, so an old account callback cannot unlock the new one.
      void refreshCustomerInfo();
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refreshCustomerInfo();
    });

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
      appStateSubscription.remove();
    };
  }, [isInitialized, refreshCustomerInfo]);

  useEffect(() => {
    resetSubscribers.add(resetCurrentAccount);
    return () => {
      resetSubscribers.delete(resetCurrentAccount);
    };
  }, [resetCurrentAccount]);

  useEffect(() => {
    if (!authResolved) return;

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    clearVisibleAccountState();
    setError(revenueCatInitializationError);

    if (!isInitialized || !revenueCatConfigured) {
      setError(revenueCatInitializationError);
      setIsLoading(false);
      return;
    }

    const appUserId = userId ? String(userId) : null;
    if (!appUserId) {
      void enqueueRevenueCatOperation(() => Purchases.logOut()).catch(() => undefined);
      return;
    }

    setIsLoading(true);
    let cancelled = false;
    const identify = async () => {
      try {
        await enqueueRevenueCatOperation(async () => {
          if (cancelled || generationRef.current !== generation) return;

          const loginResult = await Purchases.logIn(appUserId);
          if (cancelled || generationRef.current !== generation) return;

          const session = { generation, userId: appUserId };
          activeSessionRef.current = session;

          // This value is returned by the authenticated backend model. It is
          // only a RevenueCat Targeting attribute—not an access-control signal.
          try {
            await Purchases.setAttributes({ founding_user: isFounding ? "true" : "" });
          } catch {
            // A targeting attribute retry must not hide a valid entitlement.
          }
          if (!isCurrentSession(session)) return;

          const [latestInfo, offerings] = await Promise.all([
            Purchases.getCustomerInfo().catch(() => loginResult.customerInfo),
            Purchases.getOfferings(),
          ]);
          if (!isCurrentSession(session)) return;

          const offering = selectOffering(offerings, isFounding);
          setCustomerInfo(latestInfo);
          setCurrentOffering(offering);
          setError(null);
          logSubscriptionEvent("identified", {
            platform: Platform.OS,
            appUserId,
            isFounding,
            offeringIdentifier: offering?.identifier ?? null,
            isPro: isEntitled(latestInfo),
          });
        });
      } catch (reason) {
        if (generationRef.current === generation && !cancelled) {
          const err = reason instanceof Error ? reason : new Error("Unable to load subscriptions.");
          setError(err);
          logSubscriptionEvent("identify_failed", { platform: Platform.OS, appUserId, message: err.message });
        }
      } finally {
        if (generationRef.current === generation && !cancelled) setIsLoading(false);
      }
    };

    void identify();
    return () => {
      cancelled = true;
    };
  }, [authResolved, clearVisibleAccountState, isCurrentSession, isFounding, isInitialized, userId]);

  const showPaywall = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!revenueCatConfigured || !session) throw new Error("Subscriptions are not ready yet.");

    // Fail closed: an unknown CustomerInfo result is never treated as inactive.
    const latestInfo = await refreshCustomerInfo();
    if (!isCurrentSession(session) || !latestInfo) {
      throw new Error("Unable to verify your subscription status. Please try again.");
    }
    if (isEntitled(latestInfo)) return;
    if (!currentOffering) throw new Error("No subscription offering is currently available.");

    logSubscriptionEvent("present_paywall", { platform: Platform.OS, offeringIdentifier: currentOffering.identifier });
    const RevenueCatUI = (await import("react-native-purchases-ui")).default;
    await enqueueRevenueCatOperation(async () => {
      if (!isCurrentSession(session)) return;
      await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_IDENTIFIER,
        // UI package types are installed with the mobile artifact; the root
        // provider deliberately exposes a narrow structural offering type.
        offering: currentOffering as any,
        displayCloseButton: true,
      });
    });
    if (isCurrentSession(session)) {
      const info = await refreshCustomerInfo();
      logSubscriptionEvent("paywall_dismissed", { isPro: isEntitled(info) });
    }
  }, [currentOffering, isCurrentSession, refreshCustomerInfo]);

  const restorePurchases = useCallback(async (): Promise<CustomerInfo | null> => {
    const session = activeSessionRef.current;
    if (!revenueCatConfigured || !session) throw new Error("Subscriptions are not ready yet.");

    try {
      const info = await enqueueRevenueCatOperation(() => Purchases.restorePurchases());
      if (!isCurrentSession(session)) return null;
      setCustomerInfo(info);
      setError(null);
      logSubscriptionEvent("restore_purchases", { isPro: isEntitled(info) });
      return info;
    } catch (reason) {
      const err = reason instanceof Error ? reason : new Error("Unable to restore purchases.");
      if (isCurrentSession(session)) {
        setError(err);
      }
      logSubscriptionEvent("restore_purchases_failed", { message: err.message });
      throw err;
    }
  }, [isCurrentSession]);

  const redeemOfferCode = useCallback(async (): Promise<CustomerInfo | null> => {
    const session = activeSessionRef.current;
    if (!revenueCatConfigured || !session) throw new Error("Subscriptions are not ready yet.");
    if (Platform.OS !== "ios") throw new Error("Offer code redemption is only available on iOS.");

    logSubscriptionEvent("redeem_offer_code_opened", { platform: Platform.OS });
    try {
      await enqueueRevenueCatOperation(async () => {
        if (!isCurrentSession(session)) return;
        await Purchases.presentCodeRedemptionSheet();
      });
    } catch (reason) {
      const err = reason instanceof Error ? reason : new Error("Unable to open the redemption sheet.");
      logSubscriptionEvent("redeem_offer_code_failed", { message: err.message });
      throw err;
    }
    if (!isCurrentSession(session)) return null;
    // The redemption sheet resolves once dismissed; the entitlement update
    // itself arrives asynchronously via the customer info listener, so an
    // immediate refresh may still lag. Poll briefly before giving up.
    let info: CustomerInfo | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      info = await refreshCustomerInfo();
      if (!isCurrentSession(session)) return null;
      if (isEntitled(info)) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    logSubscriptionEvent("redeem_offer_code_result", { isPro: isEntitled(info) });
    return info;
  }, [isCurrentSession, refreshCustomerInfo]);

  const presentCustomerCenter = useCallback(async () => {
    const session = activeSessionRef.current;
    if (!revenueCatConfigured || !session) throw new Error("Subscriptions are not ready yet.");
    const RevenueCatUI = (await import("react-native-purchases-ui")).default;

    await enqueueRevenueCatOperation(async () => {
      if (!isCurrentSession(session)) return;
      await RevenueCatUI.presentCustomerCenter();
    });
    if (isCurrentSession(session)) await refreshCustomerInfo();
  }, [isCurrentSession, refreshCustomerInfo]);

  const isPro = isEntitled(customerInfo);

  const loggedProStateRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (customerInfo === null) return;
    if (loggedProStateRef.current === isPro) return;
    loggedProStateRef.current = isPro;
    logSubscriptionEvent("entitlement_state", { platform: Platform.OS, isPro });
  }, [customerInfo, isPro]);

  return (
    <SubscriptionContext.Provider
      value={{
        isInitialized,
        isLoading,
        isPro,
        isSubscribed: isPro,
        isFounding,
        customerInfo,
        currentOffering,
        error,
        retryInitialization,
        refreshCustomerInfo,
        showPaywall,
        restorePurchases,
        presentCustomerCenter,
        redeemOfferCode,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * AuthContext awaits this before discarding its session. It removes all
 * account-specific subscription UI immediately, then resets the native SDK.
 */
export async function resetRevenueCatForLogout(): Promise<void> {
  await Promise.all([...resetSubscribers].map((reset) => reset()));
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return context;
}

export { SubscriptionProvider };