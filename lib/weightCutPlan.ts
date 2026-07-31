// Shared weight-cut calculation engine — mirrors server-side logic.
// Used by onboarding (demo preview) and the dashboard (share card on camp creation).

export interface WeightCutPlanResult {
  totalToLose: number; weeksUntil: number; daysUntil: number;
  fatLossRequired: number; tempCut: number;
  requiredWeeklyRate: number; requiredWeeklyRatePct: number;
  recommendedWeeklyRate: number; suggestedDeficitKcal: number;
  predictedDayMinus4Weight?: number; predictedWeekMinus1Weight?: number;
  status: "on_track" | "aggressive" | "very_aggressive" | "unrealistic" | "complete" | "past_date";
  statusLabel: string;
  weeklyTargets: Array<{ week: number; targetWeight: number }>;
}

export function calculateWeightCutPlan(
  currentWeight: number, targetWeight: number, fightDateStr: string,
  weighInTiming: "same_day" | "day_before" = "same_day",
  manualTempReductionKg?: number | null,
): WeightCutPlanResult {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fight = new Date(fightDateStr + "T00:00:00");
  const daysUntil = Math.round((fight.getTime() - today.getTime()) / 86400000);
  const weeksUntil = Math.round((daysUntil / 7) * 10) / 10;
  const totalToLose = Math.round((currentWeight - targetWeight) * 10) / 10;

  const base = { totalToLose, weeksUntil, daysUntil, weeklyTargets: [] as Array<{ week: number; targetWeight: number }> };
  if (daysUntil <= 0) return { ...base, fatLossRequired: 0, tempCut: 0, requiredWeeklyRate: 0, requiredWeeklyRatePct: 0, recommendedWeeklyRate: 0, suggestedDeficitKcal: 0, status: "past_date", statusLabel: "Fight date has passed" };
  if (totalToLose <= 0) return { ...base, totalToLose: 0, fatLossRequired: 0, tempCut: 0, requiredWeeklyRate: 0, requiredWeeklyRatePct: 0, recommendedWeeklyRate: 0, suggestedDeficitKcal: 0, status: "complete", statusLabel: "Already at or below target" };

  let preFinal: number;
  const acuteDays = weighInTiming === "same_day" ? 4 : 7;
  if (weighInTiming === "same_day") {
    preFinal = manualTempReductionKg
      ? targetWeight + Math.min(manualTempReductionKg, targetWeight * 0.02)
      : targetWeight / 0.99;
  } else {
    preFinal = manualTempReductionKg
      ? targetWeight + Math.min(manualTempReductionKg, targetWeight * 0.10)
      : targetWeight / 0.94;
  }

  const weeksForFatLoss = Math.max(0.5, (daysUntil - acuteDays) / 7);
  const fatLossRequired = Math.max(0, Math.round((currentWeight - preFinal) * 10) / 10);
  const tempCut         = Math.max(0, Math.round((preFinal - targetWeight) * 10) / 10);
  const requiredWeeklyRate    = fatLossRequired / weeksForFatLoss;
  const requiredWeeklyRatePct = Math.round((requiredWeeklyRate / currentWeight) * 1000) / 10;
  const recommendedWeeklyRate = Math.min(requiredWeeklyRate, currentWeight * 0.01);
  const suggestedDeficitKcal  = Math.round(recommendedWeeklyRate * 7700 / 7);

  let status: WeightCutPlanResult["status"];
  let statusLabel: string;
  if (requiredWeeklyRatePct <= 0.5)       { status = "on_track";        statusLabel = "Steady pace"; }
  else if (requiredWeeklyRatePct <= 1.0)  { status = "on_track";        statusLabel = "On track"; }
  else if (requiredWeeklyRatePct <= 1.5)  { status = "aggressive";      statusLabel = "Quite aggressive — consider extending timeline"; }
  else if (requiredWeeklyRatePct <= 2.0)  { status = "very_aggressive"; statusLabel = "Very aggressive — adjust target or date"; }
  else                                     { status = "unrealistic";     statusLabel = "Timeline too tight — adjust target or date"; }

  const numWeeks = Math.ceil(weeksForFatLoss);
  const weeklyTargets: Array<{ week: number; targetWeight: number }> = [];
  for (let w = numWeeks; w >= 1; w--) {
    const projected = currentWeight - recommendedWeeklyRate * (numWeeks - w + 1);
    weeklyTargets.push({ week: w, targetWeight: Math.max(preFinal, Math.round(projected * 10) / 10) });
  }

  return {
    totalToLose, weeksUntil, daysUntil, fatLossRequired, tempCut,
    requiredWeeklyRate: Math.round(requiredWeeklyRate * 100) / 100,
    requiredWeeklyRatePct,
    recommendedWeeklyRate: Math.round(recommendedWeeklyRate * 100) / 100,
    suggestedDeficitKcal, status, statusLabel, weeklyTargets,
    ...(weighInTiming === "same_day" ? { predictedDayMinus4Weight: Math.round(preFinal * 10) / 10 } : { predictedWeekMinus1Weight: Math.round(preFinal * 10) / 10 }),
  };
}
