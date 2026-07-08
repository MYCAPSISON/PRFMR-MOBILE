import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface OverrideStorage {
  ea?: "accepted" | "declined";
  carb?: "accepted" | "declined";
  perfToastShown?: boolean;
}

export interface FCOverrideState {
  overrideCalories: number | null;
  overrideCarbs: number | null;
  eaModalOpen: boolean;
  carbModalOpen: boolean;
  eaDecision: "accepted" | "declined" | undefined;
  carbDecision: "accepted" | "declined" | undefined;
  originallyLowEA: boolean;
  originallyLowCarb: boolean;
  shouldShowPerfToast: boolean;
  acceptEA: () => void;
  declineEA: () => void;
  closeEAModal: () => void;
  openEAModal: () => void;
  acceptCarb: () => void;
  declineCarb: () => void;
  closeCarbModal: () => void;
  openCarbModal: () => void;
  markPerfToastShown: () => void;
}

interface UseFightCampOverrideOptions {
  userId?: number;
  date: string;
  planId?: number;
  planFightDate?: string;
  planTargetWeight?: number;
  isLowEA: boolean;
  isLowCarb: boolean;
  eaRecommendedCalories?: number;
  carbRecommendedG?: number;
  serverCalories: number;
  serverProtein: number;
  serverFat: number;
  isFightCamp: boolean;
}

function makeStorageKey(opts: Pick<UseFightCampOverrideOptions,
  "userId" | "date" | "planId" | "planFightDate" | "planTargetWeight">
): string {
  const tw = opts.planTargetWeight != null ? Math.round(opts.planTargetWeight * 10) : "x";
  const fd = (opts.planFightDate ?? "").replace(/-/g, "");
  const d = (opts.date ?? "").replace(/-/g, "");
  return `fc_${opts.userId ?? 0}_${d}_${opts.planId ?? 0}_${fd}_${tw}`;
}

export function useFightCampOverride(opts: UseFightCampOverrideOptions): FCOverrideState {
  const {
    userId, date, planId, planFightDate, planTargetWeight,
    isLowEA, isLowCarb,
    eaRecommendedCalories, carbRecommendedG,
    serverCalories, serverProtein, serverFat,
    isFightCamp,
  } = opts;

  const storageKey = makeStorageKey({ userId, date, planId, planFightDate, planTargetWeight });

  const [stored, setStored] = useState<OverrideStorage>({});
  const [overrideCalories, setOverrideCalories] = useState<number | null>(null);
  const [overrideCarbs, setOverrideCarbs] = useState<number | null>(null);
  const [eaModalOpen, setEaModalOpen] = useState(false);
  const [carbModalOpen, setCarbModalOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const carbChainRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFightCamp) { setLoaded(true); return; }
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((val) => {
        if (cancelled) return;
        const s: OverrideStorage = val ? JSON.parse(val) : {};
        setStored(s);
        setOverrideCalories(s.ea === "accepted" && eaRecommendedCalories != null ? eaRecommendedCalories : null);
        setOverrideCarbs(s.carb === "accepted" && carbRecommendedG != null ? carbRecommendedG : null);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [storageKey, isFightCamp]);

  useEffect(() => {
    if (!isFightCamp || !loaded) return;
    if (isLowEA && !stored.ea) setEaModalOpen(true);
    else if (isLowCarb && !stored.carb) setCarbModalOpen(true);
  }, [isFightCamp, loaded, storageKey, isLowEA, isLowCarb]);

  const writeStorage = useCallback(async (update: Partial<OverrideStorage>) => {
    const next = { ...stored, ...update };
    setStored(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
  }, [storageKey, stored]);

  const chainCarb = useCallback(() => {
    if (isLowCarb && !stored.carb) {
      if (carbChainRef.current) clearTimeout(carbChainRef.current);
      carbChainRef.current = setTimeout(() => setCarbModalOpen(true), 350);
    }
  }, [isLowCarb, stored.carb]);

  const acceptEA = useCallback(() => {
    if (eaRecommendedCalories != null) setOverrideCalories(eaRecommendedCalories);
    writeStorage({ ea: "accepted" });
    setEaModalOpen(false);
    chainCarb();
  }, [eaRecommendedCalories, writeStorage, chainCarb]);

  const declineEA = useCallback(() => {
    writeStorage({ ea: "declined" });
    setEaModalOpen(false);
    chainCarb();
  }, [writeStorage, chainCarb]);

  const acceptCarb = useCallback(() => {
    if (carbRecommendedG != null) {
      setOverrideCarbs(carbRecommendedG);
      const currentCals = overrideCalories ?? serverCalories;
      const carbBasedCals = Math.round(serverProtein * 4 + serverFat * 9 + carbRecommendedG * 4);
      if (carbBasedCals > currentCals) setOverrideCalories(carbBasedCals);
    }
    writeStorage({ carb: "accepted" });
    setCarbModalOpen(false);
  }, [carbRecommendedG, overrideCalories, serverCalories, serverProtein, serverFat, writeStorage]);

  const declineCarb = useCallback(() => {
    writeStorage({ carb: "declined" });
    setCarbModalOpen(false);
  }, [writeStorage]);

  const markPerfToastShown = useCallback(() => {
    writeStorage({ perfToastShown: true });
  }, [writeStorage]);

  return {
    overrideCalories,
    overrideCarbs,
    eaModalOpen,
    carbModalOpen,
    eaDecision: stored.ea,
    carbDecision: stored.carb,
    originallyLowEA: isLowEA,
    originallyLowCarb: isLowCarb,
    shouldShowPerfToast: !stored.perfToastShown,
    acceptEA,
    declineEA,
    closeEAModal: useCallback(() => setEaModalOpen(false), []),
    openEAModal: useCallback(() => setEaModalOpen(true), []),
    acceptCarb,
    declineCarb,
    closeCarbModal: useCallback(() => setCarbModalOpen(false), []),
    openCarbModal: useCallback(() => setCarbModalOpen(true), []),
    markPerfToastShown,
  };
}
