---
name: PRFMR Mobile API rules
description: Critical API contract rules for the PRFMR mobile Expo app — POST /food required fields, auth pattern, key endpoints
---

## POST /food required fields
Every food entry POST must include ALL of these or the API returns 400 "Validation failed":
- `userId` — REQUIRED; server does NOT inject from session; get from `useAuth().user.id`
- `name`, `calories`, `protein`, `carbs`, `fat` — integers (Math.round)
- `fibre`, `grams` — integers (Math.round)
- `meal` (NOT `mealType`), `date`
- `sourceType`: "manual" | "off" | "ingredient"
- `macroSource`: "off" (barcode) | "ingredient" (whole food / manual)
- `microSource`: "ingredient" | "none"
- `enteredBasis`: "raw" | "cooked" | null
- `snackIndex`: integer, only when `meal === "snack"`

**Do NOT send:** `isRawWeight` (removed from schema)

**Why:** Server Zod schema includes `userId` as required. Server does not inject it from session.

**How to apply:** Apply to ALL food mutation payloads — buildPayload(), addCustom() in MealsSection (index.tsx). There are TWO files with food mutations: `app/(tabs)/index.tsx` and `app/(tabs)/nutrition.tsx`.

## Auth rule
NEVER set a manual `Cookie` header in apiFetch(). Use only `credentials: "include"`. Session cookies are managed by SecureStore via the cookie jar in `lib/api.ts`.

## Pre-existing TypeScript errors (do not fix)
- `training.tsx`: Feather `"flame"` icon not in type union
- `hooks/useColors.ts`: radius type mismatch in Record cast
- `nutrition.tsx`: setWholeFoodQ not found

## POST /workouts/sessions/:id/activities
Two modes — field set differs:

**Cardio (default):**
- `name`, `durationMinutes` (REQUIRED)
- `metValue` (REQUIRED — from activity catalog or default 5.0 for custom)
- `activityCatalogId` optional
- `rpe` optional, `intensity` optional

**Lifting:**
- `name`, `durationMinutes` (REQUIRED)
- `activityType: "lifting"` (REQUIRED)
- `sessionRpe` (REQUIRED, 1–10)
- `bodyRegion`: "upper" | "lower" | "full" (REQUIRED)

Activity catalog GET /activities returns `{ id, name, intensity, metValue }` — field is `intensity` NOT `category`.

SessionActivity response shape: `{ id, durationMinutes, estimatedKcal, rpe, activityType, sessionRpe, bodyRegion, ... }` — NOT `duration`/`caloriesBurned`.

## User profile field names & onboarding status
`GET /user/me` returns `currentWeight` (NOT `weight`) for body weight, and has **no `onboardingComplete` field at all**. Server-side, onboarding status is inferred purely from `user.targetCalories != null` — it's only populated at the very end of `POST /user/me/onboard` once macros are calculated, so it doubles as the completion flag (no separate boolean column exists). Mirror this exact check client-side (see `isOnboardingComplete()` in `context/AuthContext.tsx`) rather than checking multiple profile fields. The login response body (`POST /auth/login`) only returns a minimal user object (`id`, `email`, `username`, `emailVerified`) — never trust it for profile/onboarding fields; always re-fetch `/user/me` after login.

## Key API endpoints
- Weight: `POST /weights { date, weight }` (NOT /me/body-composition)
- Sleep: `PUT /me/sleep/:date { hoursSlept, sleepQuality }`
- Rest day: `POST/DELETE /me/rest-day/:date`
- Morning status: `GET /me/morning-status/:date`
- Training load: `GET /me/training-load/:date` → `{ acwr, acuteLoad, acuteDaily, baselineLoad, baselineDaysUsed, warnings[] }`
- AMQS score: `GET /me/amqs/score/:date` → `{ score, tier, confidence, coverageStats, totals, targets, coverage, topGaps[], allMet, breakdown:{food,supplements}, layer2Score, layer2Tier, layer2Targets, layer2Coverage, layer2TopGaps }`. Trend: `GET /me/amqs/trend/:date` → `{ layer1, layer2 }` each `{ currentWeekAvg, prevWeekAvg, delta, trend, dailyScores[] }`. Use API-provided `targets`/`coverage` for nutrient bars, not hardcoded RDA tables — they're gender/profile-specific server-side.
- Weight range: `GET /me/weights/range?start=&end=`
- Correct workflow to restart Expo: `expo` (NOT `artifacts/prfmr-mobile: expo` — port conflicts)

## useQuery<T> type mismatches don't surface as TS errors
`useQuery<SomeInterface>({...})` only casts the response — TypeScript never validates it matches what the API actually returns. A hand-written interface can silently drift from the real backend shape (wrong field names, wrong nesting) and the code still typechecks cleanly while rendering broken/blank UI at runtime.
**Why:** Found in AMQS card/page — interfaces referenced nonexistent fields (`maxScore`, `label`, `gaps: string[]`) instead of the real shape, with zero typecheck errors.
**How to apply:** When replicating or fixing a feature against a spec, always diff the local response interface against the actual documented/observed API response shape before trusting existing code — don't assume typecheck passing means the data contract is correct.
