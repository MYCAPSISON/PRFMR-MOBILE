---
name: PRFMR Mobile API rules
description: Critical API contract rules for the PRFMR mobile Expo app — POST /food required fields, auth pattern, key endpoints
---

## POST /food required fields
Every food entry POST must include ALL of these or the API returns 400:
- `name`, `calories`, `protein`, `carbs`, `fat`, `fibre`, `grams`
- `meal` (NOT `mealType` — the API field is `meal`)
- `date`, `sourceType`, `macroSource: "manual"`, `microSource: "none"`
- `enteredBasis: "cooked"`, `isRawWeight: false`

**Why:** The API validates all fields strictly; missing enteredBasis/isRawWeight causes 400 errors silently.

**How to apply:** Apply to ALL food mutation payloads — buildPayload(), addCustom(), barcode confirm, etc. There are TWO files with food mutations: `app/(tabs)/index.tsx` (MealsSection) and `app/(tabs)/nutrition.tsx`.

## Auth rule
NEVER set a manual `Cookie` header in apiFetch(). Use only `credentials: "include"`. Session cookies are managed by SecureStore via the cookie jar in `lib/api.ts`.

## Pre-existing TypeScript errors (do not fix)
- `training.tsx`: Feather `"flame"` icon not in type union
- `hooks/useColors.ts`: radius type mismatch in Record cast

## Key API endpoints
- Weight: `POST /weights { date, weight }` (NOT /me/body-composition)
- Sleep: `PUT /me/sleep/:date { hoursSlept, sleepQuality }`
- Rest day: `POST/DELETE /me/rest-day/:date`
- Morning status: `GET /me/morning-status/:date`
- Training load: `GET /me/training-load/:date` → `{ acwr, acute7day, chronic28day, classification, warnings[] }`
- AMQS score: `GET /me/amqs/score/:date` → `{ score, maxScore, label, gaps[] }`
- AMQS micros: `GET /me/amqs/micros/:date` → `{ nutrients: Record<string, { coverage, label }> }`
- Weight range: `GET /me/weights/range?start=&end=`
